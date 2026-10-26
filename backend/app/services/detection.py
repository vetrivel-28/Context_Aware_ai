from __future__ import annotations

import re
from typing import Any

# ─── Patterns ───────────────────────────────────────────────────────────────
# Email — high confidence standard regex
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

# Credential — "password is X" or "pwd: X" where X looks like a real secret
# Requires the secret portion to have mixed chars or special chars (not just words or length guidance)
CREDENTIAL_RE = re.compile(
    r"(?i)(?:password|pwd|passcode|secret|credential|api[_\-]?key)"
    r"(?:\s*(?:is|=|:|was|:=))?\s+"
    r"([A-Za-z0-9!@#$%^&*()\-_+=\[\]{};:',.<>?/\\|`~]{6,})"
)

# Phone — standard formats (US/international with digits)
PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?1[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4})(?!\d)"
)

# Compensation — specific numeric / monetary amounts ONLY.
# Does NOT match descriptive verbal phrases like "compensation was revised".
# Examples matched: ₹18 lakh, ₹18,00,000, Rs. 50,000, INR 18 lakh, $120,000, USD 120k, 18 lakh, 1.5 crore.
COMPENSATION_AMOUNT_RE = re.compile(
    r"(?:₹|INR|Rs\.?|USD|\$)\s*\d[\d,]*(?:\s*(?:lakh|crore|thousand|million|k|m))?\b"
    r"|"
    r"\b\d[\d,]*(?:\.\d+)?\s*(?:lakh|crore|thousand|million)\b"
    r"|"
    r"(?:salary|compensation|pay|remuneration)\s*(?:is|was|of|at|to|raised to|increased to|revised to)\s*(?:₹|INR|Rs\.?|USD|\$)?\s*(\d[\d,]*(?:\s*(?:lakh|crore|thousand|million|k|m))?)\b",
    re.IGNORECASE,
)

# Stopwords that look like title-cased proper nouns but are common domain nouns
_NAME_STOPWORDS = frozenset({
    "engineer", "engineers", "public", "company", "admin", "password", "passwords",
    "send", "latest", "review", "reviews", "available", "careers", "page",
    "information", "internal", "external", "general", "customer", "report",
    "local", "service", "system", "security", "salary", "bands", "must",
    "contain", "characters", "database", "standard", "operating", "procedure",
    "the", "a", "an", "this", "that", "these", "those", "we", "they",
})

# Person Name: matches title-cased names.
# For possessive forms ("Anita's"), group(1) isolates "Anita" so 's remains outside the entity span.
PERSON_NAME_RE = re.compile(r"\b([A-Z][a-z]{2,})(?:'s)?(?:\s[A-Z][a-z]{2,})?\b")


def _is_real_credential(value: str) -> bool:
    """Return True when the matched value looks like an actual secret, not policy guidance."""
    # Policy guidance like "12 characters" or "at least X" -> not a credential
    if re.match(r"^\d+\s*\w*$", value):
        return False
    if len(value) < 6:
        return False
    # Real secrets usually contain mixed character classes (e.g. upper + lower + digit/special)
    has_digit = bool(re.search(r"\d", value))
    has_special = bool(re.search(r"[!@#$%^&*()\-_+=\[\]{};:',.<>?/\\|`~]", value))
    has_upper = bool(re.search(r"[A-Z]", value))
    has_lower = bool(re.search(r"[a-z]", value))
    return (has_digit or has_special) and has_upper and has_lower


def detect_entities(text: str) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []

    # 1. --- Email ---
    for m in EMAIL_RE.finditer(text):
        e_start, e_end = m.start(), m.end()
        # Trim trailing sentence punctuation if any
        while e_end > e_start and text[e_end - 1] in {".", ",", ";", ":"}:
            e_end -= 1
        matches.append({
            "type": "email",
            "value": text[e_start:e_end],
            "start": e_start,
            "end": e_end,
            "confidence": 0.98,
        })

    # 2. --- Credential (actual secrets only) ---
    for m in CREDENTIAL_RE.finditer(text):
        g1_start, g1_end = m.start(1), m.end(1)
        # Trim trailing sentence punctuation (e.g. period at end of "password is Mx7!qR2z.")
        while g1_end > g1_start and text[g1_end - 1] in {".", ",", ";", ":"}:
            g1_end -= 1
        secret = text[g1_start:g1_end]
        if _is_real_credential(secret):
            matches.append({
                "type": "credential",
                "value": secret,
                "start": g1_start,
                "end": g1_end,
                "confidence": 0.99,
            })

    # 3. --- Phone ---
    for m in PHONE_RE.finditer(text):
        digits = re.sub(r"\D", "", m.group(0))
        if len(digits) < 7:
            continue
        p_start, p_end = m.start(), m.end()
        while p_end > p_start and text[p_end - 1] in {".", ",", ";", ":"}:
            p_end -= 1
        matches.append({
            "type": "phone",
            "value": text[p_start:p_end],
            "start": p_start,
            "end": p_end,
            "confidence": 0.88,
        })

    # 4. --- Compensation amount (numeric/monetary values only) ---
    for m in COMPENSATION_AMOUNT_RE.finditer(text):
        # If group 1 matched (from "salary is 18 lakh"), extract group 1
        if m.lastindex and m.group(1):
            val = m.group(1).strip()
            g_start, g_end = m.start(1), m.end(1)
        else:
            val = m.group(0).strip()
            g_start, g_end = m.start(), m.end()

        # Trim trailing punctuation
        while g_end > g_start and text[g_end - 1] in {".", ",", ";", ":"}:
            g_end -= 1
        val = text[g_start:g_end]

        # Strict check: compensation amounts MUST contain at least one digit
        if not any(c.isdigit() for c in val):
            continue

        matches.append({
            "type": "compensation",
            "value": val,
            "start": g_start,
            "end": g_end,
            "confidence": 0.88,
        })

    # 5. --- Person name ---
    for m in PERSON_NAME_RE.finditer(text):
        # Extract group 1 so possessives ('s) are not captured in the person name entity
        candidate = m.group(1)
        c_start, c_end = m.start(1), m.end(1)

        if candidate.lower() in _NAME_STOPWORDS:
            continue

        # Skip if overlapping with an already detected entity (e.g. credential or email)
        overlap = any(
            existing["start"] <= c_start < existing["end"] or c_start <= existing["start"] < c_end
            for existing in matches
        )
        if overlap:
            continue

        matches.append({
            "type": "person",
            "value": text[c_start:c_end],
            "start": c_start,
            "end": c_end,
            "confidence": 0.78,
        })

    # De-duplicate and sort strictly by start position
    seen: set[tuple[str, int, int]] = set()
    deduped: list[dict[str, Any]] = []
    for item in sorted(matches, key=lambda x: (x["start"], x["end"])):
        key = (item["type"], item["start"], item["end"])
        if key not in seen:
            deduped.append(item)
            seen.add(key)

    # Invariant: verify that for every entity, text[start:end] == value
    for item in deduped:
        assert text[item["start"]:item["end"]] == item["value"], (
            f"Offset mismatch: expected '{item['value']}', got '{text[item['start']:item['end']]}'"
        )

    return deduped

