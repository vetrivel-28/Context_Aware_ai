"""Independent metric verification script."""
from __future__ import annotations
from app.services.evaluation import TEST_CASES, baseline_decision, run_evaluation

print("=== BASELINE PREDICTION PER CASE ===")
baseline_preds = [baseline_decision(c["text"]) for c in TEST_CASES]
for case, pred in zip(TEST_CASES, baseline_preds):
    expected = case["expected_sensitive"]
    if expected and pred:
        outcome = "TP"
    elif not expected and pred:
        outcome = "FP"
    elif not expected and not pred:
        outcome = "TN"
    else:
        outcome = "FN"
    print(f"  {outcome} | expected_sensitive={expected} | baseline_pred={pred} | id={case['id']}")

btp = sum(1 for c, p in zip(TEST_CASES, baseline_preds) if c["expected_sensitive"] and p)
bfp = sum(1 for c, p in zip(TEST_CASES, baseline_preds) if not c["expected_sensitive"] and p)
btn = sum(1 for c, p in zip(TEST_CASES, baseline_preds) if not c["expected_sensitive"] and not p)
bfn = sum(1 for c, p in zip(TEST_CASES, baseline_preds) if c["expected_sensitive"] and not p)
prec = btp / (btp + bfp) if (btp + bfp) else 0.0
rec  = btp / (btp + bfn) if (btp + bfn) else 0.0
f1   = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
fpr  = bfp / (bfp + btn) if (bfp + btn) else 0.0
fnr  = bfn / (bfn + btp) if (bfn + btp) else 0.0

print()
print("=== BASELINE CONFUSION MATRIX (hand-calculated) ===")
print(f"  TP={btp}  FP={bfp}  TN={btn}  FN={bfn}  (total={btp+bfp+btn+bfn})")
print(f"  Precision  = {btp}/({btp}+{bfp}) = {prec:.6f}")
print(f"  Recall     = {btp}/({btp}+{bfn}) = {rec:.6f}")
print(f"  F1         = {f1:.6f}")
print(f"  FPR        = {bfp}/({bfp}+{btn}) = {fpr:.6f}")
print(f"  FNR        = {bfn}/({bfn}+{btp}) = {fnr:.6f}")

print()
print("=== CONTEXT-AWARE PREDICTION PER CASE ===")
result = run_evaluation()
for r in result["results"]:
    exp_s = r["expected_sensitive"]
    act_s = r["actual_sensitive"]
    if exp_s and act_s:
        outcome = "TP"
    elif not exp_s and act_s:
        outcome = "FP"
    elif not exp_s and not act_s:
        outcome = "TN"
    else:
        outcome = "FN"
    print(f"  {outcome} | exp_sensitive={exp_s} | actual_action={r['actual_action']} | id={r['id']}")

cm = result["confusion_matrix"]
ca = result["context_aware"]
print()
print("=== CONTEXT-AWARE CONFUSION MATRIX (from run_evaluation) ===")
print(f"  TP={cm['tp']}  FP={cm['fp']}  TN={cm['tn']}  FN={cm['fn']}")
print(f"  Precision  = {ca['precision']:.6f}")
print(f"  Recall     = {ca['recall']:.6f}")
print(f"  F1         = {ca['f1']:.6f}")
print(f"  FPR        = {ca['false_positive_rate']:.6f}")
print(f"  FNR        = {ca['false_negative_rate']:.6f}")

bl = result["baseline"]
print()
print("=== BASELINE METRICS (from run_evaluation) ===")
print(f"  TP={bl['true_positives']}  FP={bl['false_positives']}  TN={bl['true_negatives']}  FN={bl['false_negatives']}")
print(f"  Precision  = {bl['precision']:.6f}")
print(f"  Recall     = {bl['recall']:.6f}")
print(f"  F1         = {bl['f1']:.6f}")
print(f"  FPR        = {bl['false_positive_rate']:.6f}")
print(f"  FNR        = {bl['false_negative_rate']:.6f}")

# Cross-check: do the metrics embedded in baseline match hand-calculated?
print()
print("=== CROSS-CHECK ===")
print(f"  Hand-calc F1={f1:.6f}  API F1={bl['f1']:.6f}  Match={abs(f1-bl['f1'])<1e-9}")
print(f"  API returns single 'confusion_matrix' key — it contains CONTEXT-AWARE values only.")
print(f"  Baseline confusion matrix is NOT in the 'confusion_matrix' top-level key.")
