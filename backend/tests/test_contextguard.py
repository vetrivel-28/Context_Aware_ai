"""
ContextGuard backend tests.
Run with:  python -m pytest tests/ -v  from backend/
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app, AUDIT_LOGS
from app.services.detection import detect_entities, _is_real_credential
from app.services.classification import classify_context
from app.services.policy import evaluate_policy, build_rules, update_rule_action
from app.services.redaction import sanitize_text
from app.services.evaluation import run_evaluation, baseline_decision

client = TestClient(app)


# ─── Health ───────────────────────────────────────────────────────────────────

def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "ContextGuard" in data["service"]


# ─── Detection ────────────────────────────────────────────────────────────────

class TestDetection:
    def test_email_detected(self):
        entities = detect_entities("Contact priya@example.com for details.")
        types = [e["type"] for e in entities]
        assert "email" in types
        email_e = next(e for e in entities if e["type"] == "email")
        assert email_e["value"] == "priya@example.com"

    def test_real_credential_detected(self):
        entities = detect_entities("The admin password is Mx7!qR2z.")
        types = [e["type"] for e in entities]
        assert "credential" in types
        cred = next(e for e in entities if e["type"] == "credential")
        assert cred["value"] == "Mx7!qR2z"

    def test_policy_guidance_not_credential(self):
        entities = detect_entities("Passwords must contain at least 12 characters.")
        types = [e["type"] for e in entities]
        assert "credential" not in types

    def test_compensation_amount_detected(self):
        entities = detect_entities("Anita's salary is being raised to ₹18 lakh.")
        types = [e["type"] for e in entities]
        assert "compensation" in types
        comp = next(e for e in entities if e["type"] == "compensation")
        assert comp["value"] == "₹18 lakh"

    def test_public_salary_bands_no_compensation_entity(self):
        entities = detect_entities("Engineer salary bands are available on the company's public careers page.")
        types = [e["type"] for e in entities]
        assert "credential" not in types
        assert "compensation" not in types

    def test_person_name_detected(self):
        text = "Anita's salary is being raised to ₹18 lakh."
        entities = detect_entities(text)
        types = [e["type"] for e in entities]
        assert "person" in types
        person = next(e for e in entities if e["type"] == "person")
        assert person["value"] == "Anita"
        assert text[person["start"]:person["end"]] == "Anita"

    def test_is_real_credential(self):
        assert _is_real_credential("Mx7!qR2z") is True
        assert _is_real_credential("P@ssw0rd99#") is True
        assert _is_real_credential("12characters") is False
        assert _is_real_credential("12") is False

    def test_compensation_without_amount_does_not_create_compensation_entity(self):
        """Input with contextual compensation but no numeric amount should NOT generate a compensation entity."""
        text = "Anita's compensation was revised upward during the latest review."
        entities = detect_entities(text)
        types = [e["type"] for e in entities]
        assert "compensation" not in types
        assert "person" in types
        person = next(e for e in entities if e["type"] == "person")
        assert person["value"] == "Anita"
        assert text[person["start"]:person["end"]] == "Anita"

    def test_all_entity_spans_match_original_text(self):
        """Invariant: text[start:end] must strictly equal entity value."""
        samples = [
            "Anita's salary is being raised to ₹18 lakh.",
            "Send the customer report to priya@example.com.",
            "The admin password is Mx7!qR2z.",
            "Call me at +1 415-555-2671 immediately.",
            "Production database root credential: P@ssw0rd99#.",
        ]
        for s in samples:
            entities = detect_entities(s)
            for e in entities:
                assert s[e["start"]:e["end"]] == e["value"], (
                    f"Mismatch in sample '{s}': text[{e['start']}:{e['end']}] != '{e['value']}'"
                )


# ─── Classification ───────────────────────────────────────────────────────────

class TestClassification:
    def test_credential_context(self):
        entities = [{"type": "credential", "value": "Mx7!qR2z", "start": 0, "end": 8, "confidence": 0.99}]
        ctx = classify_context("The admin password is Mx7!qR2z.", entities)
        assert ctx["label"] == "credential"

    def test_password_guidance_is_not_credential(self):
        ctx = classify_context("Passwords must contain at least 12 characters.", [])
        assert ctx["label"] != "credential"

    def test_password_sop_is_not_credential(self):
        ctx = classify_context("Review the standard operating procedure for password rotation.", [])
        assert ctx["label"] != "credential"

    def test_compensation_with_person(self):
        entities = [
            {"type": "person", "value": "Anita", "start": 0, "end": 5, "confidence": 0.78},
            {"type": "compensation", "value": "₹18 lakh", "start": 34, "end": 42, "confidence": 0.88},
        ]
        ctx = classify_context("Anita's salary is being raised to ₹18 lakh.", entities)
        assert ctx["label"] == "compensation"

    def test_public_salary_bands(self):
        ctx = classify_context(
            "Engineer salary bands are available on the company's public careers page.", []
        )
        assert ctx["label"] == "public"

    def test_email_context(self):
        entities = [{"type": "email", "value": "priya@example.com", "start": 30, "end": 47, "confidence": 0.98}]
        ctx = classify_context("Send the customer report to priya@example.com.", entities)
        assert ctx["label"] == "personal_contact"

    def test_ambiguous_contextual_compensation(self):
        entities = [{"type": "person", "value": "Anita", "start": 0, "end": 5, "confidence": 0.78}]
        ctx = classify_context("Anita's compensation was revised upward during the latest review.", entities)
        assert ctx["label"] == "compensation"


# ─── Policy engine ────────────────────────────────────────────────────────────

class TestPolicy:
    def _ctx(self, label: str, confidence: float = 0.85) -> dict:
        return {"label": label, "confidence": confidence, "source": "heuristic"}

    def test_credential_always_blocked(self):
        entities = [{"type": "credential", "value": "Mx7!qR2z", "start": 0, "end": 8, "confidence": 0.99}]
        result = evaluate_policy("...", entities, self._ctx("credential"), "General Employee", "External AI service", 0.9)
        assert result["action"] == "block"

    def test_credential_blocked_for_hr_too(self):
        entities = [{"type": "credential", "value": "Mx7!qR2z", "start": 0, "end": 8, "confidence": 0.99}]
        result = evaluate_policy("...", entities, self._ctx("credential"), "HR Administrator", "Internal reporting system", 0.9)
        assert result["action"] == "block"

    def test_credential_blocked_for_security_admin_external(self):
        entities = [{"type": "credential", "value": "P@ssw0rd99#", "start": 0, "end": 11, "confidence": 0.99}]
        result = evaluate_policy("...", entities, self._ctx("credential"), "Security Administrator", "External AI service", 0.95)
        assert result["action"] == "block"

    def test_general_employee_compensation_redacted(self):
        entities = [{"type": "compensation", "value": "₹18 lakh", "start": 0, "end": 8, "confidence": 0.85}]
        result = evaluate_policy("...", entities, self._ctx("compensation"), "General Employee", "External AI service", 0.6)
        assert result["action"] == "redact"
        assert "General Employee" in result["reason"]

    def test_hr_internal_compensation_allowed(self):
        entities = [{"type": "compensation", "value": "₹18 lakh", "start": 0, "end": 8, "confidence": 0.85}]
        result = evaluate_policy("...", entities, self._ctx("compensation"), "HR Administrator", "Internal reporting system", 0.5)
        assert result["action"] == "allow"
        assert "HR Administrator" in result["reason"]

    def test_hr_external_compensation_redacted(self):
        entities = [{"type": "compensation", "value": "₹18 lakh", "start": 0, "end": 8, "confidence": 0.85}]
        result = evaluate_policy("...", entities, self._ctx("compensation"), "HR Administrator", "External AI service", 0.7)
        assert result["action"] == "redact"
        assert "HR Administrator" in result["reason"]

    def test_public_info_allowed(self):
        result = evaluate_policy("...", [], self._ctx("public"), "General Employee", "Local AI model", 0.1)
        assert result["action"] == "allow"

    def test_personal_contact_redacted(self):
        entities = [{"type": "email", "value": "priya@example.com", "start": 0, "end": 17, "confidence": 0.98}]
        result = evaluate_policy("...", entities, self._ctx("personal_contact"), "General Employee", "External AI service", 0.55)
        assert result["action"] == "redact"

    def test_update_rule_action(self):
        original = None
        for r in build_rules():
            if r["id"] == "comp-role-restrict":
                original = r["default_action"]
        updated = update_rule_action("comp-role-restrict", "restrict")
        assert updated is not None
        assert updated["default_action"] == "restrict"
        # Restore
        update_rule_action("comp-role-restrict", original or "redact")

    def test_update_nonexistent_rule(self):
        result = update_rule_action("no-such-rule", "block")
        assert result is None


# ─── Redaction ────────────────────────────────────────────────────────────────

class TestRedaction:
    def test_email_redacted(self):
        entities = [{"type": "email", "value": "priya@example.com", "start": 30, "end": 47, "confidence": 0.98}]
        out = sanitize_text("Send the customer report to priya@example.com.", entities)
        assert "priya@example.com" not in out
        assert "[EMAIL_REDACTED]" in out

    def test_salary_redacted(self):
        entities = [
            {"type": "compensation", "value": "₹18 lakh", "start": 34, "end": 42, "confidence": 0.85},
        ]
        out = sanitize_text("Anita's salary is being raised to ₹18 lakh.", entities)
        assert "₹18 lakh" not in out
        assert "[SALARY_REDACTED]" in out

    def test_no_entities_unchanged(self):
        text = "Engineer salary bands are available on the company's public careers page."
        out = sanitize_text(text, [])
        assert out == text

    def test_credential_redacted(self):
        entities = [{"type": "credential", "value": "Mx7!qR2z", "start": 22, "end": 30, "confidence": 0.99}]
        out = sanitize_text("The admin password is Mx7!qR2z.", entities)
        assert "Mx7!qR2z" not in out
        assert "[CREDENTIAL_REDACTED]" in out


# ─── API endpoints ────────────────────────────────────────────────────────────

class TestScanAPI:
    def test_empty_input_rejected(self):
        resp = client.post("/api/scan", json={"text": "   ", "role": "General Employee", "destination": "Local AI model"})
        assert resp.status_code == 400

    def test_oversized_input_rejected(self):
        resp = client.post("/api/scan", json={"text": "A" * 5001, "role": "General Employee", "destination": "Local AI model"})
        assert resp.status_code in {400, 422}

    def test_scan_response_role_and_destination_consistency(self):
        """Regression test for Objective 3A: verify evaluated role and destination match request."""
        resp = client.post("/api/scan", json={
            "text": "Anita's salary is being raised to ₹18 lakh.",
            "role": "HR Administrator",
            "destination": "Internal reporting system",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["evaluated_role"] == "HR Administrator"
        assert data["evaluated_destination"] == "Internal reporting system"
        assert "HR Administrator" in data["decision_reason"]
        assert data["action"] == "allow"

    def test_public_salary_bands_allowed(self):
        resp = client.post("/api/scan", json={
            "text": "Engineer salary bands are available on the company's public careers page.",
            "role": "General Employee",
            "destination": "Local AI model",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["action"] == "allow"
        assert data["downstream"]["invoked"] is True

    def test_credential_blocked(self):
        resp = client.post("/api/scan", json={
            "text": "The admin password is Mx7!qR2z.",
            "role": "General Employee",
            "destination": "External AI service",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["action"] == "block"
        assert data["downstream"]["invoked"] is False

    def test_compensation_redacted_for_general_employee(self):
        resp = client.post("/api/scan", json={
            "text": "Anita's salary is being raised to ₹18 lakh.",
            "role": "General Employee",
            "destination": "External AI service",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["action"] == "redact"
        assert "₹18 lakh" not in data["sanitized_output"]

    def test_compensation_allowed_for_hr_internal(self):
        resp = client.post("/api/scan", json={
            "text": "Anita's salary is being raised to ₹18 lakh.",
            "role": "HR Administrator",
            "destination": "Internal reporting system",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["action"] == "allow"

    def test_email_redacted(self):
        resp = client.post("/api/scan", json={
            "text": "Send the customer report to priya@example.com.",
            "role": "General Employee",
            "destination": "External AI service",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["action"] in {"redact", "block"}
        assert "priya@example.com" not in data["sanitized_output"]

    def test_public_password_guidance_allowed(self):
        resp = client.post("/api/scan", json={
            "text": "Passwords must contain at least 12 characters.",
            "role": "General Employee",
            "destination": "Local AI model",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["action"] == "allow"

    def test_blocked_request_not_in_downstream(self):
        resp = client.post("/api/scan", json={
            "text": "The admin password is Mx7!qR2z.",
            "role": "Security Administrator",
            "destination": "External AI service",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["downstream"]["invoked"] is False
        assert data["downstream"]["received_payload"] is None

    def test_redacted_request_sends_sanitized_payload(self):
        resp = client.post("/api/scan", json={
            "text": "Anita's salary is being raised to ₹18 lakh.",
            "role": "General Employee",
            "destination": "External AI service",
        })
        assert resp.status_code == 200
        data = resp.json()
        if data["downstream"]["invoked"]:
            payload = data["downstream"]["received_payload"] or ""
            assert "₹18 lakh" not in payload

    def test_audit_record_created(self):
        AUDIT_LOGS.clear()
        client.post("/api/scan", json={
            "text": "Anita's salary is being raised to ₹18 lakh.",
            "role": "General Employee",
            "destination": "External AI service",
        })
        assert len(AUDIT_LOGS) == 1
        record = AUDIT_LOGS[0]
        # Audit must not contain raw sensitive prompt
        assert "₹18 lakh" not in record.get("sanitized_output", "").replace("[SALARY_REDACTED]", "")

    def test_audit_record_not_blocked_contains_no_raw_credential(self):
        AUDIT_LOGS.clear()
        client.post("/api/scan", json={
            "text": "The admin password is Mx7!qR2z.",
            "role": "General Employee",
            "destination": "External AI service",
        })
        assert len(AUDIT_LOGS) == 1
        record = AUDIT_LOGS[0]
        # Raw credential must not appear in the audit
        assert "Mx7!qR2z" not in str(record.get("sanitized_output", ""))

    def test_role_change_changes_outcome(self):
        text = "Anita's salary is being raised to ₹18 lakh."
        resp_ge = client.post("/api/scan", json={
            "text": text,
            "role": "General Employee",
            "destination": "External AI service",
        })
        resp_hr = client.post("/api/scan", json={
            "text": text,
            "role": "HR Administrator",
            "destination": "Internal reporting system",
        })
        assert resp_ge.json()["action"] == "redact"
        assert resp_hr.json()["action"] == "allow"


class TestPolicyAPI:
    def test_get_policies(self):
        resp = client.get("/api/policies")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["rules"]) >= 3
        assert "roles" in data
        assert "destinations" in data

    def test_put_policy_updates_action(self):
        resp = client.put("/api/policies/comp-role-restrict", json={"default_action": "restrict"})
        assert resp.status_code == 200
        assert resp.json()["default_action"] == "restrict"
        # Restore
        client.put("/api/policies/comp-role-restrict", json={"default_action": "redact"})

    def test_put_policy_invalid_action_rejected(self):
        resp = client.put("/api/policies/comp-role-restrict", json={"default_action": "delete"})
        assert resp.status_code == 422

    def test_put_policy_unknown_rule(self):
        resp = client.put("/api/policies/no-such-rule", json={"default_action": "block"})
        assert resp.status_code == 404


class TestAuditAPI:
    def test_audit_endpoint(self):
        resp = client.get("/api/audit")
        assert resp.status_code == 200
        data = resp.json()
        assert "records" in data
        assert isinstance(data["records"], list)


class TestEvaluationAPI:
    def test_evaluation_returns_metrics(self):
        resp = client.post("/api/evaluate")
        assert resp.status_code == 200
        data = resp.json()
        assert "context_aware" in data
        assert "baseline" in data
        assert "confusion_matrix" in data
        assert "context_aware_confusion_matrix" in data
        assert "baseline_confusion_matrix" in data
        assert "results" in data

    def test_evaluation_metrics_are_calculated(self):
        resp = client.post("/api/evaluate")
        data = resp.json()
        ca = data["context_aware"]
        assert 0.0 <= ca["precision"] <= 1.0
        assert 0.0 <= ca["recall"] <= 1.0
        assert 0.0 <= ca["f1"] <= 1.0

    def test_all_test_cases_have_results(self):
        resp = client.post("/api/evaluate")
        data = resp.json()
        assert len(data["results"]) == len(data["dataset"])

    def test_confusion_matrix_totals(self):
        resp = client.post("/api/evaluate")
        data = resp.json()
        cm = data["confusion_matrix"]
        total = cm["tp"] + cm["fp"] + cm["tn"] + cm["fn"]
        assert total == len(data["dataset"])

    def test_evaluation_metrics_agree_with_confusion_matrix(self):
        """Regression test: verify precision, recall, F1, FPR, FNR strictly match confusion matrix."""
        resp = client.post("/api/evaluate")
        data = resp.json()

        # Context-aware verification
        ca_cm = data["context_aware_confusion_matrix"]
        ca = data["context_aware"]
        c_tp, c_fp, c_tn, c_fn = ca_cm["tp"], ca_cm["fp"], ca_cm["tn"], ca_cm["fn"]

        exp_c_prec = c_tp / (c_tp + c_fp) if (c_tp + c_fp) else 0.0
        exp_c_rec = c_tp / (c_tp + c_fn) if (c_tp + c_fn) else 0.0
        exp_c_f1 = (2 * exp_c_prec * exp_c_rec / (exp_c_prec + exp_c_rec)) if (exp_c_prec + exp_c_rec) else 0.0
        exp_c_fpr = c_fp / (c_fp + c_tn) if (c_fp + c_tn) else 0.0
        exp_c_fnr = c_fn / (c_fn + c_tp) if (c_fn + c_tp) else 0.0

        assert ca["precision"] == pytest.approx(exp_c_prec)
        assert ca["recall"] == pytest.approx(exp_c_rec)
        assert ca["f1"] == pytest.approx(exp_c_f1)
        assert ca["false_positive_rate"] == pytest.approx(exp_c_fpr)
        assert ca["false_negative_rate"] == pytest.approx(exp_c_fnr)

        # Baseline verification
        bl_cm = data["baseline_confusion_matrix"]
        bl = data["baseline"]
        b_tp, b_fp, b_tn, b_fn = bl_cm["tp"], bl_cm["fp"], bl_cm["tn"], bl_cm["fn"]

        exp_b_prec = b_tp / (b_tp + b_fp) if (b_tp + b_fp) else 0.0
        exp_b_rec = b_tp / (b_tp + b_fn) if (b_tp + b_fn) else 0.0
        exp_b_f1 = (2 * exp_b_prec * exp_b_rec / (exp_b_prec + exp_b_rec)) if (exp_b_prec + exp_b_rec) else 0.0
        exp_b_fpr = b_fp / (b_fp + b_tn) if (b_fp + b_tn) else 0.0
        exp_b_fnr = b_fn / (b_fn + b_tp) if (b_fn + b_tp) else 0.0

        assert bl["precision"] == pytest.approx(exp_b_prec)
        assert bl["recall"] == pytest.approx(exp_b_rec)
        assert bl["f1"] == pytest.approx(exp_b_f1)
        assert bl["false_positive_rate"] == pytest.approx(exp_b_fpr)
        assert bl["false_negative_rate"] == pytest.approx(exp_b_fnr)

    def test_both_engines_use_same_ground_truth(self):
        """Ensure both baseline and context-aware evaluate the same 10 test cases."""
        resp = client.post("/api/evaluate")
        data = resp.json()
        assert len(data["dataset"]) == 10
        for r in data["results"]:
            assert "expected_sensitive" in r
            assert "actual_sensitive" in r
            assert "expected_action" in r
            assert "actual_action" in r
            assert "category" in r
            assert "rationale" in r

    def test_evaluation_blocked_result_does_not_leak_raw_credential(self):
        resp = client.post("/api/evaluate")
        data = resp.json()
        cred_results = [r for r in data["results"] if "credential" in r["id"]]
        assert len(cred_results) >= 1
        for cred_r in cred_results:
            assert cred_r["actual_action"] == "block"
            assert "Mx7!qR2z" not in cred_r["sanitized"]
            assert "P@ssw0rd99#" not in cred_r["sanitized"]


class TestBaselineEvaluation:
    def test_baseline_detects_salary(self):
        assert baseline_decision("Anita's salary is being raised to ₹18 lakh.") is True

    def test_baseline_detects_password(self):
        assert baseline_decision("The admin password is Mx7!qR2z.") is True

    def test_baseline_detects_email(self):
        assert baseline_decision("Send the report to priya@example.com.") is True

    def test_baseline_passes_public(self):
        assert baseline_decision("A public announcement was made today.") is False

