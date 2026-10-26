from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, ConfigDict


class ScanRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    role: str = Field(..., min_length=1, max_length=80)
    destination: str = Field(..., min_length=1, max_length=80)


class ScanResponse(BaseModel):
    action: Literal["allow", "redact", "restrict", "block"]
    risk_score: float
    score_breakdown: dict[str, float]
    decision_reason: str
    sanitized_output: str
    detected_entities: list[dict[str, Any]]
    context_classification: dict[str, Any]
    policy_rule: str
    detection_method: str
    downstream: dict[str, Any]
    event_id: str


class PolicyRule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    title: str
    description: str
    applies_to_roles: list[str]
    applies_to_destinations: list[str]
    sensitivity_levels: list[str]
    default_action: Literal["allow", "redact", "restrict", "block"]


class PolicyList(BaseModel):
    roles: list[str]
    destinations: list[str]
    rules: list[PolicyRule]


class AuditEvent(BaseModel):
    event_id: str
    timestamp: str
    entity_types: list[str]
    context_classification: dict[str, Any]
    entity_risk: float
    context_risk: float
    exposure_risk: float
    final_risk_score: float
    selected_role: str
    destination: str
    action_taken: Literal["allow", "redact", "restrict", "block"]
    applicable_policy_rule: str
    detection_method: str
    sanitized_output: str
    downstream_invoked: bool
    policy_reason: str
