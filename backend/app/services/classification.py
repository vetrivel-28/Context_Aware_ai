from __future__ import annotations

import re
from typing import Any

# Contextual compensation terms that indicate salary/pay discussion
_COMP_CONTEXT = frozenset({
    "salary", "compensation", "remuneration", "pay", "package", "ctc",
    "lakh", "crore", "rupees", "inr", "revised", "increment", "raise",
    "hike", "wage", "stipend", "bonus", "appraisal", "revised upward",
    "revised downward", "compensation was", "salary was", "salary is",
})

# Public information and policy indicators
_PUBLIC_SIGNALS = frozenset({
    "public careers page", "careers page", "public page", "available on",
    "policy guidance", "must contain", "at least", "password policy",
    "salary bands", "band", "publicly available", "schedule", "meeting",
    "calendar", "standard operating procedure", "operating procedure",
    "procedure", "rotation",
})

# Terms that suggest policy / documentation context rather than real secret disclosure
_POLICY_HINTS = frozenset({
    "must contain", "at least", "should be", "policy", "requirement",
    "procedure", "rotation", "guideline", "documentation", "sop", "standard",
    "instructions", "guidance", "best practice", "best practices",
})

_CREDENTIAL_WORDS = frozenset({
    "password", "admin password", "passcode", "secret", "credential",
    "api key", "token", "api_key",
})


def _contains_any(text: str, terms: frozenset[str]) -> bool:
    lowered = text.lower()
    return any(t in lowered for t in terms)


def classify_context(text: str, entities: list[dict[str, Any]]) -> dict[str, Any]:
    lowered = text.lower()
    entity_types = {e["type"] for e in entities}

    # ── 1. Credential (highest priority) ──────────────────────────────────────
    if "credential" in entity_types:
        return {"label": "credential", "confidence": 0.97, "source": "heuristic"}
    if _contains_any(text, _CREDENTIAL_WORDS):
        # Only flag as credential-context if it is NOT policy guidance/documentation
        if not _contains_any(text, _POLICY_HINTS):
            return {"label": "credential", "confidence": 0.91, "source": "heuristic"}

    # ── 2. Email / Personal Contact ───────────────────────────────────────────
    if "email" in entity_types or re.search(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", text):
        return {"label": "personal_contact", "confidence": 0.93, "source": "heuristic"}

    # ── 3. Compensation with explicit amount ──────────────────────────────────
    if "compensation" in entity_types:
        if _contains_any(text, _PUBLIC_SIGNALS):
            # E.g. "salary bands available on public careers page"
            return {"label": "public", "confidence": 0.85, "source": "heuristic"}
        return {"label": "compensation", "confidence": 0.92, "source": "heuristic"}

    # ── 4. Compensation contextual mentions (without numeric currency) ─────────
    # Catches "Anita's compensation was revised upward during the latest review"
    if _contains_any(text, _COMP_CONTEXT):
        if _contains_any(text, _PUBLIC_SIGNALS):
            return {"label": "public", "confidence": 0.82, "source": "heuristic"}
        # If a person name is present or compensation review language is used
        person_present = "person" in entity_types
        confidence = 0.88 if person_present else 0.72
        return {"label": "compensation", "confidence": confidence, "source": "heuristic"}

    # ── 5. Phone ──────────────────────────────────────────────────────────────
    if "phone" in entity_types:
        return {"label": "personal_contact", "confidence": 0.85, "source": "heuristic"}

    # ── 6. Public / Benign context ────────────────────────────────────────────
    if _contains_any(text, _PUBLIC_SIGNALS) or _contains_any(text, _POLICY_HINTS):
        return {"label": "public", "confidence": 0.85, "source": "heuristic"}

    if not entities:
        return {"label": "public", "confidence": 0.60, "source": "heuristic"}

    # ── 7. Person name alone without sensitive topic -> ambiguous ─────────────
    if entity_types == {"person"}:
        return {"label": "ambiguous", "confidence": 0.58, "source": "heuristic"}

    return {"label": "ambiguous", "confidence": 0.62, "source": "heuristic"}

