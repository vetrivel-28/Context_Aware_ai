import re
from typing import Any

# ─── Patterns ───────────────────────────────────────────────────────────────
# Email — high confidence
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

# Credential — "password is X" or "pwd: X" where X looks like a real secret
# Requires the secret portion to have mixed chars or special chars (not just words)
CREDENTIAL_RE = re.compile(
    r"(?i)(?:password|pwd|passcode|secret|credential|api[_\-]?key)"
    r"(?:\s*(?:is|=|:|was|:=))?\s+"
    r"([A-Za-z0-9!@#$%^&*()\-_+=\[\]{};:',.<>?/\\|`~]{6,})"
)

# Phone — standard formats
PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?1[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4})(?!\d)"
)

# Compensation — specific amount expressions (not just the word "salary")
COMPENSATION_AMOUNT_RE = re.compile(
    r"(?:₹|INR|Rs\.?|USD|\$)\s*\d[\d,]*(?:\s*(?:lakh|crore|thousand|million|k|m))?"
    r"|"
    r"\d[\d,]+\s*(?:lakh|crore)\b"
    r"|"
    r"(?:salary|compensation|pay|remuneration)\s+(?:is|was|of|at|to)\s+\S+"
)

# Compensation keyword near a person name — contextual
COMP_CONTEXT_KEYWORDS = frozenset({
    "salary", "compensation", "remuneration", "pay", "package",
    "ctc", "lakh", "rupees", "inr", "revised", "increment", "raise", "hike",
    "wage", "stipend", "bonus", "appraisal",
})

# Words that look like proper nouns but are NOT person names in this domain
_NAME_STOPWORDS = frozenset({
    "engineer", "engineers", "public", "company", "admin", "password", "passwords",
    "send", "latest", "review", "reviews", "available", "careers", "page",
    "information", "internal", "external", "general", "customer", "report",
    "local", "service", "system", "security", "salary", "bands", "must",
    "contain", "characters",
    "the", "a", "an",
})

# Title-cased word(s) — match both at sentence start and mid-sentence
# Possessive forms (Anita's) are handled by allowing ' after the name
PERSON_NAME_RE = re.compile(r"\b([A-Z][a-z]{2,})(?:'s)?(?:\s[A-Z][a-z]{2,})?\b")


def _is_real_credential(value: str) -> bool:
    """Return True when the matched value looks like an actual secret, not a policy hint."""
    # Policy guidance like "12 characters" or "at least X" → not a credential
    if re.match(r"^\d+\s*\w*$", value):
        return False
    if len(value) < 6:
        return False
    # Real secrets usually have mixed chars; pure dictionary words score lower
    has_digit = bool(re.search(r"\d", value))
    has_special = bool(re.search(r"[!@#$%^&*()\-_+=\[\]{};:',.<>?/\\|`~]", value))
    has_upper = bool(re.search(r"[A-Z]", value))
    has_lower = bool(re.search(r"[a-z]", value))
    return (has_digit or has_special) and has_upper and has_lower


def detect_entities(text: str) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []

    # --- Email ---
    for m in EMAIL_RE.finditer(text):
        matches.append({
            "type": "email",
            "value": m.group(0),
            "start": m.start(),
            "end": m.end(),
            "confidence": 0.98,
        })

    # --- Credential (real secrets only) ---
    for m in CREDENTIAL_RE.finditer(text):
        secret = m.group(1)
        if _is_real_credential(secret):
            # Store only the secret span, not the keyword
            g1_start = m.start(1)
            g1_end = m.end(1)
            matches.append({
                "type": "credential",
                "value": secret,
                "start": g1_start,
                "end": g1_end,
                "confidence": 0.99,
            })

    # --- Phone ---
    for m in PHONE_RE.finditer(text):
        digits = re.sub(r"\D", "", m.group(0))
        if len(digits) < 7:
            continue
        matches.append({
            "type": "phone",
            "value": m.group(0),
            "start": m.start(),
            "end": m.end(),
            "confidence": 0.88,
        })

    # --- Compensation amount ---
    for m in COMPENSATION_AMOUNT_RE.finditer(text):
        val = m.group(0).strip()
        if not val or val.lower() in {"salary", "compensation", "pay", "remuneration"}:
            continue
        matches.append({
            "type": "compensation",
            "value": val,
            "start": m.start(),
            "end": m.end(),
            "confidence": 0.85,
        })

    # --- Person name ---
    for m in PERSON_NAME_RE.finditer(text):
        candidate = m.group(0)
        if candidate.lower() in _NAME_STOPWORDS:
            continue
        # Skip if already captured as part of another entity
        overlap = any(
            existing["start"] <= m.start() < existing["end"]
            for existing in matches
        )
        if overlap:
            continue
        matches.append({
            "type": "person",
            "value": candidate,
            "start": m.start(),
            "end": m.end(),
            "confidence": 0.76,
        })

    # De-duplicate and sort by start position
    seen: set[tuple[str, int, int]] = set()
    deduped: list[dict[str, Any]] = []
    for item in sorted(matches, key=lambda x: (x["start"], x["end"])):
        key = (item["type"], item["start"], item["end"])
        if key not in seen:
            deduped.append(item)
            seen.add(key)

    return deduped
