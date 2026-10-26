from __future__ import annotations

from typing import Any


PLACEHOLDERS = {
    "credential": "[CREDENTIAL_REDACTED]",
    "email": "[EMAIL_REDACTED]",
    "phone": "[PHONE_REDACTED]",
    "person": "[PERSON_1]",
    "compensation": "[SALARY_REDACTED]",
}


def sanitize_text(text: str, entities: list[dict[str, Any]]) -> str:
    spans: list[tuple[int, int, str]] = []
    replacement_order: dict[str, int] = {"person": 0, "email": 1, "phone": 2, "credential": 3, "compensation": 4}

    for entity in entities:
        entity_type = entity["type"]
        if entity_type not in PLACEHOLDERS:
            continue
        span = (int(entity["start"]), int(entity["end"]), PLACEHOLDERS[entity_type])
        spans.append(span)

    if not spans:
        return text

    ordered = sorted(spans, key=lambda x: x[0], reverse=True)
    sanitized = text
    for start, end, placeholder in ordered:
        sanitized = sanitized[:start] + placeholder + sanitized[end:]
    return sanitized


def get_entity_summary(entities: list[dict[str, Any]]) -> list[str]:
    return [entity["type"] for entity in entities]
