from __future__ import annotations

from typing import Any

# In-memory mutable policy store (demo only — no persistence)
# Shape matches the PolicyRule schema.
_POLICY_STORE: list[dict[str, Any]] = [
    {
        "id": "credential-exfiltration-block",
        "title": "Credential exfiltration block",
        "description": "Explicitly block any real credential from leaving the trusted boundary. "
                       "This rule always fails closed regardless of role.",
        "roles": ["General Employee", "HR Administrator", "Security Administrator"],
        "destinations": ["Local AI model", "External AI service", "Internal reporting system"],
        "sensitivity_levels": ["credential"],
        "default_action": "block",
    },
    {
        "id": "comp-role-restrict",
        "title": "Compensation access policy",
        "description": "General employees receive a redacted compensation summary; HR may review "
                       "compensation data in the approved internal reporting system.",
        "roles": ["General Employee", "HR Administrator", "Security Administrator"],
        "destinations": ["Local AI model", "External AI service", "Internal reporting system"],
        "sensitivity_levels": ["compensation"],
        "default_action": "redact",
    },
    {
        "id": "personal-contact-policy",
        "title": "Personal contact data policy",
        "description": "Email addresses and phone numbers are redacted for general employee access "
                       "and restricted to approved internal channels.",
        "roles": ["General Employee", "HR Administrator", "Security Administrator"],
        "destinations": ["Local AI model", "External AI service", "Internal reporting system"],
        "sensitivity_levels": ["personal_contact"],
        "default_action": "redact",
    },
    {
        "id": "public-info-allow",
        "title": "Public information allowlist",
        "description": "Public information — such as published salary bands or password-policy guidance — "
                       "is allowed for all roles and destinations.",
        "roles": ["General Employee", "HR Administrator", "Security Administrator"],
        "destinations": ["Local AI model", "External AI service", "Internal reporting system"],
        "sensitivity_levels": ["public"],
        "default_action": "allow",
    },
]


def build_rules() -> list[dict[str, Any]]:
    """Return the current policy rules (snapshot)."""
    return list(_POLICY_STORE)


def update_rule_action(rule_id: str, new_action: str) -> dict[str, Any] | None:
    """Update the default_action for a rule in the in-memory store. Returns updated rule or None."""
    for rule in _POLICY_STORE:
        if rule["id"] == rule_id:
            rule["default_action"] = new_action
            return rule
    return None


def _get_rule_action(rule_id: str) -> str:
    for rule in _POLICY_STORE:
        if rule["id"] == rule_id:
            return str(rule["default_action"])
    return "allow"


def evaluate_policy(
    text: str,
    entities: list[dict[str, Any]],
    context: dict[str, Any],
    role: str,
    destination: str,
    score: float,
) -> dict[str, Any]:
    entity_types = {e["type"] for e in entities}
    context_label = context.get("label", "")

    # ── Rule 1: Credential — always block, fail closed ────────────────────────
    if "credential" in entity_types or context_label == "credential":
        return {
            "action": "block",
            "rule_id": "credential-exfiltration-block",
            "reason": (
                "A real credential was detected. The credential-exfiltration-block rule applies "
                "to all roles and destinations and fails closed. The downstream model was not invoked."
            ),
        }

    # ── Rule 2: Compensation ──────────────────────────────────────────────────
    if context_label == "compensation":
        rule_action = _get_rule_action("comp-role-restrict")
        # HR + internal reporting system gets special treatment
        if role == "HR Administrator" and destination == "Internal reporting system":
            return {
                "action": "allow",
                "rule_id": "comp-role-restrict",
                "reason": (
                    "HR Administrator has permission to access compensation data "
                    "in the approved internal reporting system. The original payload is forwarded."
                ),
            }
        # Any other role → apply the stored default action
        return {
            "action": rule_action,
            "rule_id": "comp-role-restrict",
            "reason": (
                f"Compensation-related content detected. Role '{role}' accessing '{destination}' "
                f"receives action '{rule_action}' per the compensation access policy."
            ),
        }

    # ── Rule 3: Personal contact ──────────────────────────────────────────────
    if context_label == "personal_contact":
        rule_action = _get_rule_action("personal-contact-policy")
        return {
            "action": rule_action,
            "rule_id": "personal-contact-policy",
            "reason": (
                f"Personal contact information (email/phone) detected. "
                f"Action '{rule_action}' applied per the personal contact data policy for role '{role}'."
            ),
        }

    # ── Rule 4: Public information ────────────────────────────────────────────
    if context_label == "public" or not entities:
        return {
            "action": "allow",
            "rule_id": "public-info-allow",
            "reason": (
                "Content classified as public information with no sensitive entities detected. "
                "Allowed under the public information policy for all roles."
            ),
        }

    # ── Rule 5: Risk-score fallback for ambiguous content ─────────────────────
    if score > 0.80:
        return {
            "action": "block",
            "rule_id": "credential-exfiltration-block",
            "reason": f"Computed risk score ({score:.2f}) exceeds the block threshold (0.80). Request blocked.",
        }
    if score >= 0.30:
        return {
            "action": "redact",
            "rule_id": "comp-role-restrict",
            "reason": f"Computed risk score ({score:.2f}) falls in the redaction band (0.30–0.80). Content sanitized.",
        }

    return {
        "action": "allow",
        "rule_id": "public-info-allow",
        "reason": f"Risk score ({score:.2f}) is below the redaction threshold (0.30). Content allowed.",
    }
