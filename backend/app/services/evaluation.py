from __future__ import annotations

import time
from typing import Any

from app.services.classification import classify_context
from app.services.detection import detect_entities
from app.services.policy import evaluate_policy
from app.services.redaction import sanitize_text

# ─── Evaluation Dataset ────────────────────────────────────────────────────────
# Ground-truth definition:
# `expected_sensitive` indicates whether the privacy policy REQUIRES PROTECTION
# (action is "redact" or "block") for the given role and destination.
# If an authorized role (e.g. HR Administrator in internal system) is permitted
# to view data, protection is not required -> expected_sensitive = False.
TEST_CASES = [
    {
        "id": "public-info",
        "text": "Engineer salary bands are available on the company's public careers page.",
        "role": "General Employee",
        "destination": "Local AI model",
        "expected_action": "allow",
        "expected_sensitive": False,
    },
    {
        "id": "confidential-compensation",
        "text": "Anita's salary is being raised to ₹18 lakh.",
        "role": "General Employee",
        "destination": "External AI service",
        "expected_action": "redact",
        "expected_sensitive": True,
    },
    {
        "id": "credential-exposure",
        "text": "The admin password is Mx7!qR2z.",
        "role": "General Employee",
        "destination": "External AI service",
        "expected_action": "block",
        "expected_sensitive": True,
    },
    {
        "id": "public-password-guidance",
        "text": "Passwords must contain at least 12 characters.",
        "role": "General Employee",
        "destination": "Local AI model",
        "expected_action": "allow",
        "expected_sensitive": False,
    },
    {
        "id": "ambiguous-contextual",
        "text": "Anita's compensation was revised upward during the latest review.",
        "role": "General Employee",
        "destination": "External AI service",
        "expected_action": "redact",
        "expected_sensitive": True,
    },
    {
        "id": "hr-internal-compensation",
        "text": "Anita's salary is being raised to ₹18 lakh.",
        "role": "HR Administrator",
        "destination": "Internal reporting system",
        "expected_action": "allow",
        "expected_sensitive": False,
    },
]


def _safe_div(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def baseline_decision(text: str) -> bool:
    """Keyword-only baseline detector with zero context or role awareness."""
    lowered = text.lower()
    keywords = ["salary", "compensation", "password", "credential", "email", "@", "phone"]
    return any(keyword in lowered for keyword in keywords)


def _summarize_metrics(tp: int, fp: int, tn: int, fn: int) -> dict[str, Any]:
    precision = _safe_div(tp, tp + fp)
    recall = _safe_div(tp, tp + fn)
    f1 = _safe_div(2 * precision * recall, precision + recall)
    false_positive_rate = _safe_div(fp, fp + tn)
    false_negative_rate = _safe_div(fn, fn + tp)
    return {
        "true_positives": tp,
        "false_positives": fp,
        "true_negatives": tn,
        "false_negatives": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "false_positive_rate": false_positive_rate,
        "false_negative_rate": false_negative_rate,
    }


def run_evaluation() -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    baseline_sensitive = [baseline_decision(case["text"]) for case in TEST_CASES]

    for case in TEST_CASES:
        start = time.perf_counter()
        entities = detect_entities(case["text"])
        context = classify_context(case["text"], entities)
        entity_risk = max((entity["confidence"] for entity in entities), default=0.1)
        context_risk = context["confidence"]
        exposure_risk = 0.7 if case["destination"] == "External AI service" else 0.35
        risk_score = 0.4 * entity_risk + 0.4 * context_risk + 0.2 * exposure_risk
        risk_score = min(1.0, max(0.0, risk_score))
        policy = evaluate_policy(case["text"], entities, context, case["role"], case["destination"], risk_score)
        action = policy["action"]
        sanitized = sanitize_text(case["text"], entities) if action in {"redact", "allow"} else "[BLOCKED — content withheld by policy]"
        # Context-aware decision: sensitive = policy triggers protection (redact or block)
        actual_sensitive = action in {"redact", "block"}
        latency_ms = (time.perf_counter() - start) * 1000

        # Ground truth: sensitive = expected action requires protection
        expected_sensitive = case["expected_sensitive"]

        results.append({
            "id": case["id"],
            "expected_action": case["expected_action"],
            "actual_action": action,
            "expected_sensitive": expected_sensitive,
            "actual_sensitive": actual_sensitive,
            "passed": action == case["expected_action"],
            "latency_ms": latency_ms,
            "sanitized": sanitized,
            "context": context,
        })

    # Context-aware confusion matrix & metrics
    tp = sum(1 for r in results if r["expected_sensitive"] and r["actual_sensitive"])
    fp = sum(1 for r in results if not r["expected_sensitive"] and r["actual_sensitive"])
    tn = sum(1 for r in results if not r["expected_sensitive"] and not r["actual_sensitive"])
    fn = sum(1 for r in results if r["expected_sensitive"] and not r["actual_sensitive"])
    context_metrics = _summarize_metrics(tp, fp, tn, fn)

    # Keyword baseline confusion matrix & metrics
    baseline_tp = sum(1 for case, pred in zip(TEST_CASES, baseline_sensitive) if case["expected_sensitive"] and pred)
    baseline_fp = sum(1 for case, pred in zip(TEST_CASES, baseline_sensitive) if not case["expected_sensitive"] and pred)
    baseline_tn = sum(1 for case, pred in zip(TEST_CASES, baseline_sensitive) if not case["expected_sensitive"] and not pred)
    baseline_fn = sum(1 for case, pred in zip(TEST_CASES, baseline_sensitive) if case["expected_sensitive"] and not pred)
    baseline_metrics = _summarize_metrics(baseline_tp, baseline_fp, baseline_tn, baseline_fn)
    average_latency = sum(r["latency_ms"] for r in results) / max(len(results), 1)

    return {
        "dataset": TEST_CASES,
        "results": results,
        "baseline": {
            **baseline_metrics,
            "average_latency_ms": average_latency,
        },
        "context_aware": {
            **context_metrics,
            "average_latency_ms": average_latency,
        },
        "context_aware_confusion_matrix": {
            "tp": tp,
            "fp": fp,
            "tn": tn,
            "fn": fn,
        },
        "baseline_confusion_matrix": {
            "tp": baseline_tp,
            "fp": baseline_fp,
            "tn": baseline_tn,
            "fn": baseline_fn,
        },
        # Backwards-compatible alias for context-aware confusion matrix
        "confusion_matrix": {
            "tp": tp,
            "fp": fp,
            "tn": tn,
            "fn": fn,
        },
    }
