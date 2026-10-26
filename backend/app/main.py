from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.schemas import PolicyList, ScanRequest, ScanResponse
from app.services.classification import classify_context
from app.services.detection import detect_entities
from app.services.evaluation import run_evaluation
from app.services.policy import build_rules, evaluate_policy, update_rule_action
from app.services.redaction import sanitize_text

app = FastAPI(title="ContextGuard API", version="0.2.0", docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory audit log (labelled as such in the UI)
AUDIT_LOGS: list[dict[str, Any]] = []


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _generate_event_id() -> str:
    return f"evt_{uuid.uuid4().hex[:12]}"


def _risk_scores(
    entities: list[dict[str, Any]],
    context: dict[str, Any],
    destination: str,
) -> tuple[float, float, float, float]:
    entity_risk = max((float(e.get("confidence", 0.0)) for e in entities), default=0.10)
    context_risk = float(context.get("confidence", 0.25))
    exposure_risk = (
        0.90 if destination == "External AI service"
        else 0.55 if destination == "Internal reporting system"
        else 0.25
    )
    raw = 0.4 * entity_risk + 0.4 * context_risk + 0.2 * exposure_risk
    return entity_risk, context_risk, exposure_risk, min(1.0, max(0.0, raw))


def _downstream_response(sanitized_text: str, action: str, destination: str) -> dict[str, Any]:
    if action == "block":
        return {
            "invoked": False,
            "received_payload": None,
            "response": "Blocked by policy — downstream model was not invoked.",
            "destination": destination,
        }
    payload = sanitized_text or ""
    low = payload.lower()
    if "salary" in low or "compensation" in low or "lakh" in low:
        response_text = "Summary: compensation data is available only in a redacted or HR-approved context."
    elif "email" in low or "@" in low:
        response_text = "Acknowledged — contact data has been received in sanitized form."
    else:
        response_text = "Approved — content reviewed within the configured sandbox."
    return {
        "invoked": True,
        "received_payload": payload,
        "response": response_text,
        "destination": destination,
    }


def _to_policy_rule(raw: dict[str, Any]) -> dict[str, Any]:
    """Convert internal rule dict (uses 'roles'/'destinations') to API shape."""
    return {
        "id": raw["id"],
        "title": raw["title"],
        "description": raw["description"],
        "applies_to_roles": raw.get("roles", raw.get("applies_to_roles", [])),
        "applies_to_destinations": raw.get("destinations", raw.get("applies_to_destinations", [])),
        "sensitivity_levels": raw["sensitivity_levels"],
        "default_action": raw["default_action"],
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ContextGuard Enterprise Security"}


@app.get("/api/policies", response_model=PolicyList)
def get_policies() -> PolicyList:
    rules = [_to_policy_rule(r) for r in build_rules()]
    return PolicyList(
        roles=["General Employee", "HR Administrator", "Security Administrator"],
        destinations=["Local AI model", "External AI service", "Internal reporting system"],
        rules=rules,  # type: ignore[arg-type]
    )


class PolicyUpdateRequest(BaseModel):
    default_action: Literal["allow", "redact", "restrict", "block"]


@app.put("/api/policies/{rule_id}")
def put_policy(rule_id: str, body: PolicyUpdateRequest) -> dict[str, Any]:
    updated = update_rule_action(rule_id, body.default_action)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Policy rule '{rule_id}' not found.")
    return _to_policy_rule(updated)


@app.post("/api/scan", response_model=ScanResponse)
def scan(request: ScanRequest) -> ScanResponse:
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")
    if len(request.text) > 5000:
        raise HTTPException(status_code=400, detail="Input text exceeds the 5000-character limit.")

    entities = detect_entities(request.text)
    context = classify_context(request.text, entities)
    entity_risk, context_risk, exposure_risk, risk_score = _risk_scores(entities, context, request.destination)
    policy_decision = evaluate_policy(request.text, entities, context, request.role, request.destination, risk_score)
    action = policy_decision["action"]

    if action == "block":
        sanitized_output = "[BLOCKED — sensitive content withheld by policy]"
    else:
        sanitized_output = sanitize_text(request.text, entities)

    downstream = _downstream_response(sanitized_output, action, request.destination)
    event_id = _generate_event_id()

    event: dict[str, Any] = {
        "event_id": event_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "entity_types": sorted({e["type"] for e in entities}),
        "context_classification": context,
        "entity_risk": round(entity_risk, 4),
        "context_risk": round(context_risk, 4),
        "exposure_risk": round(exposure_risk, 4),
        "final_risk_score": round(risk_score, 4),
        "selected_role": request.role,
        "destination": request.destination,
        "action_taken": action,
        "applicable_policy_rule": policy_decision["rule_id"],
        "detection_method": context.get("source", "heuristic"),
        # Audit records store sanitized output, never the raw sensitive input
        "sanitized_output": sanitized_output,
        "downstream_invoked": downstream["invoked"],
        "policy_reason": policy_decision["reason"],
    }
    AUDIT_LOGS.append(event)

    return ScanResponse(
        action=action,
        risk_score=round(risk_score, 4),
        score_breakdown={
            "entity_risk": round(entity_risk, 4),
            "context_risk": round(context_risk, 4),
            "exposure_risk": round(exposure_risk, 4),
        },
        decision_reason=policy_decision["reason"],
        sanitized_output=sanitized_output,
        detected_entities=entities,
        context_classification=context,
        policy_rule=policy_decision["rule_id"],
        detection_method=context.get("source", "heuristic"),
        downstream=downstream,
        event_id=event_id,
        evaluated_role=request.role,
        evaluated_destination=request.destination,
    )


@app.get("/api/audit")
def get_audit() -> dict[str, Any]:
    return {"records": AUDIT_LOGS}


@app.post("/api/evaluate")
def evaluate() -> dict[str, Any]:
    return run_evaluation()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
