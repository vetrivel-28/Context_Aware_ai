from __future__ import annotations

import re
from typing import Any

# Contextual compensation words that indicate salary/pay discussion
_COMP_CONTEXT = frozenset({
    "salary", "compensation", "remuneration", "pay", "package", "ctc",
    "lakh", "crore", "rupees", "inr", "revised", "increment", "raise",
    "hike", "wage", "stipend", "bonus", "appraisal", "revised upward",
    "revised downward", "compensation was", "salary was", "salary is",
})

_PUBLIC_SIGNALS = frozenset({
    "public careers page", "careers page", "public page", "available on",
    "policy guidance", "must contain", "at least", "password policy",
    "salary bands", "band", "publicly available",
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

    # ── Credential (highest priority) ────────────────────────────────────────
    if "credential" in entity_types:
        return {"label": "credential", "confidence": 0.97, "source": "heuristic"}
    if _contains_any(text, _CREDENTIAL_WORDS):
        # Only flag as credential-context if it looks like an actual disclosure,
        # not a policy hint ("passwords must contain…")
        if not _contains_any(text, {"must contain", "at least", "should be", "policy", "requirement"}):
            return {"label": "credential", "confidence": 0.91, "source": "heuristic"}

    # ── Email / personal contact ──────────────────────────────────────────────
    if "email" in entity_types or re.search(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", text):
        return {"label": "personal_contact", "confidence": 0.93, "source": "heuristic"}

    # ── Compensation — explicit amount present ────────────────────────────────
    if "compensation" in entity_types:
        if _contains_any(text, _PUBLIC_SIGNALS):
            # "salary bands available on public page" — public context
            return {"label": "public", "confidence": 0.78, "source": "heuristic"}
        return {"label": "compensation", "confidence": 0.90, "source": "heuristic"}

    # ── Compensation — contextual keywords even without a detected amount ─────
    # Catches "Anita's compensation was revised upward during the latest review"
    if _contains_any(text, _COMP_CONTEXT):
        if _contains_any(text, _PUBLIC_SIGNALS):
            return {"label": "public", "confidence": 0.78, "source": "heuristic"}
        # If a person name is also present, raise confidence
        person_present = "person" in entity_types
        confidence = 0.82 if person_present else 0.68
        return {"label": "compensation", "confidence": confidence, "source": "heuristic"}

    # ── Phone ─────────────────────────────────────────────────────────────────
    if "phone" in entity_types:
        return {"label": "personal_contact", "confidence": 0.85, "source": "heuristic"}

    # ── Public information ────────────────────────────────────────────────────
    if _contains_any(text, _PUBLIC_SIGNALS):
        return {"label": "public", "confidence": 0.82, "source": "heuristic"}

    if not entities:
        return {"label": "public", "confidence": 0.55, "source": "heuristic"}

    # ── Person name alone — ambiguous ─────────────────────────────────────────
    if entity_types == {"person"}:
        return {"label": "ambiguous", "confidence": 0.58, "source": "heuristic"}

    return {"label": "ambiguous", "confidence": 0.62, "source": "heuristic"}
