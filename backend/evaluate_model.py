"""
ClinicalGuard — ML Model Evaluation Script
==========================================
Produces: confusion matrix, precision, recall, F1, ROC-AUC,
          per-class metrics, and a feature-importance table.

Designed to run WITHOUT the original training dataset.
It builds a structured test grid that exercises the full
feature space of the existing dt_model.pkl, so metrics
reflect real model behaviour — not synthetic accuracy.

Run from ClinicalGuard/ (project root) with the venv active:
    python -m backend.evaluate_model

Or from inside backend/:
    python evaluate_model.py
"""
import os
import sys
import json
import pickle
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    roc_auc_score,
    precision_score,
    recall_score,
    f1_score,
    accuracy_score,
)

# ── Resolve model paths ──────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
_MODELS_DIR = os.path.join(_HERE, "models")

DT_PATH    = os.path.join(_MODELS_DIR, "dt_model.pkl")
SCALER_PATH = os.path.join(_MODELS_DIR, "scaler.pkl")
FEAT_PATH  = os.path.join(_MODELS_DIR, "feature_cols.json")

# ── Load artefacts ───────────────────────────────────────────────────
print("=" * 60)
print("  ClinicalGuard — ML Evaluation Report")
print("=" * 60)

for path, label in [(DT_PATH, "dt_model.pkl"), (SCALER_PATH, "scaler.pkl"), (FEAT_PATH, "feature_cols.json")]:
    if not os.path.exists(path):
        print(f"\n[FATAL] Missing artefact: {path}")
        print("Run retrain_model.py first to generate model files.")
        sys.exit(1)

with open(DT_PATH, "rb") as f:
    dt = pickle.load(f)
with open(SCALER_PATH, "rb") as f:
    scaler = pickle.load(f)
with open(FEAT_PATH) as f:
    FEATURE_COLS = json.load(f)

print(f"\n  Model     : Decision Tree (sklearn)")
print(f"  Depth     : {dt.get_depth()}")
print(f"  Leaves    : {dt.get_n_leaves()}")
print(f"  Features  : {len(FEATURE_COLS)} — {FEATURE_COLS}")

# ── Build a structured test corpus ──────────────────────────────────
# We create explicit authentic and manipulated records covering the
# documented feature space. Each record has a KNOWN ground-truth label
# so we can measure REAL model performance.
#
# AUTHENTIC profile: vitals within normal clinical range.
#   - BP: sys 100-120, dia 65-80
#   - Glucose: 80-110
#   - HR: 60-85
#   - SpO2: 97-100
#   - HRS: 0.05-0.25 (computed from normals)
#
# MANIPULATED profile: abnormal vitals, inconsistent HRS, or
#   clearly implausible combinations.

def _make_authentic(n: int, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for _ in range(n):
        age = rng.integers(22, 58)
        rows.append({
            "age":               float(age),
            "bp_systolic":       float(rng.integers(100, 125)),
            "bp_diastolic":      float(rng.integers(65, 82)),
            "glucose":           float(rng.integers(80, 110)),
            "hr":                float(rng.integers(60, 85)),
            "spo2":              float(rng.integers(97, 100)),
            "diagnosis_encoded": int(rng.integers(0, 5)),
            "previous_trials":   int(rng.integers(0, 4)),
            "product_experience":float(rng.integers(0, 3)),
            "last_trial_outcome":float(rng.integers(0, 2)),
            "health_risk_score": round(float(rng.uniform(0.05, 0.25)), 2),
            "age_grp_adult":     1 if 18 <= age < 60 else 0,
            "age_grp_elderly":   1 if age >= 60 else 0,
        })
    df = pd.DataFrame(rows)[FEATURE_COLS]
    return df


def _make_manipulated(n: int, seed: int = 99) -> pd.DataFrame:
    """Manipulated records cover these sub-patterns:
    - Pattern A: High BP + high glucose, but HRS suspiciously low (SFO)
    - Pattern B: Implausibly low SpO2 with normal HRS
    - Pattern C: Tachycardia + elevated glucose, HRS > 0.6
    - Pattern D: Elderly patient, high BP, HRS=0 (SFO)
    """
    rng = np.random.default_rng(seed)
    rows = []
    quarter = n // 4

    # Pattern A — SFO: high vitals, manipulated-low HRS
    for _ in range(quarter):
        age = rng.integers(40, 70)
        rows.append({
            "age":               float(age),
            "bp_systolic":       float(rng.integers(145, 165)),
            "bp_diastolic":      float(rng.integers(92, 102)),
            "glucose":           float(rng.integers(150, 210)),
            "hr":                float(rng.integers(85, 105)),
            "spo2":              float(rng.integers(93, 97)),
            "diagnosis_encoded": int(rng.integers(0, 3)),
            "previous_trials":   int(rng.integers(1, 4)),
            "product_experience":float(rng.integers(0, 2)),
            "last_trial_outcome":float(0),
            "health_risk_score": round(float(rng.uniform(0.00, 0.08)), 2),  # SFO
            "age_grp_adult":     1 if 18 <= age < 60 else 0,
            "age_grp_elderly":   1 if age >= 60 else 0,
        })

    # Pattern B — Implausible SpO2 / normal HRS
    for _ in range(quarter):
        age = rng.integers(30, 65)
        rows.append({
            "age":               float(age),
            "bp_systolic":       float(rng.integers(110, 130)),
            "bp_diastolic":      float(rng.integers(70, 85)),
            "glucose":           float(rng.integers(90, 120)),
            "hr":                float(rng.integers(58, 72)),
            "spo2":              float(rng.integers(88, 93)),   # dangerously low
            "diagnosis_encoded": 0,
            "previous_trials":   int(rng.integers(0, 3)),
            "product_experience":float(1),
            "last_trial_outcome":float(1),
            "health_risk_score": round(float(rng.uniform(0.60, 0.90)), 2),
            "age_grp_adult":     1 if 18 <= age < 60 else 0,
            "age_grp_elderly":   1 if age >= 60 else 0,
        })

    # Pattern C — Tachycardia + hyperglycemia
    for _ in range(quarter):
        age = rng.integers(35, 60)
        rows.append({
            "age":               float(age),
            "bp_systolic":       float(rng.integers(138, 158)),
            "bp_diastolic":      float(rng.integers(88, 100)),
            "glucose":           float(rng.integers(175, 220)),
            "hr":                float(rng.integers(102, 130)),
            "spo2":              float(rng.integers(94, 97)),
            "diagnosis_encoded": 1,
            "previous_trials":   int(rng.integers(2, 5)),
            "product_experience":float(rng.integers(0, 2)),
            "last_trial_outcome":float(0),
            "health_risk_score": round(float(rng.uniform(0.65, 0.95)), 2),
            "age_grp_adult":     1 if 18 <= age < 60 else 0,
            "age_grp_elderly":   1 if age >= 60 else 0,
        })

    # Pattern D — Elderly SFO
    for _ in range(n - 3 * quarter):
        age = rng.integers(62, 80)
        rows.append({
            "age":               float(age),
            "bp_systolic":       float(rng.integers(148, 170)),
            "bp_diastolic":      float(rng.integers(94, 106)),
            "glucose":           float(rng.integers(155, 200)),
            "hr":                float(rng.integers(88, 115)),
            "spo2":              float(rng.integers(91, 95)),
            "diagnosis_encoded": 2,
            "previous_trials":   int(rng.integers(1, 4)),
            "product_experience":float(rng.integers(0, 3)),
            "last_trial_outcome":float(0),
            "health_risk_score": round(float(rng.uniform(0.00, 0.06)), 2),
            "age_grp_adult":     0,
            "age_grp_elderly":   1,
        })

    df = pd.DataFrame(rows)[FEATURE_COLS]
    return df


# ── Assemble corpus ──────────────────────────────────────────────────
N_EACH = 200
X_auth  = _make_authentic(N_EACH)
X_manip = _make_manipulated(N_EACH)

X = pd.concat([X_auth, X_manip], ignore_index=True)
y = np.array([1] * N_EACH + [0] * N_EACH)   # 1=Authentic, 0=Manipulated

X_scaled = scaler.transform(X)

# ── Predictions ──────────────────────────────────────────────────────
y_pred  = dt.predict(X_scaled)
y_proba = dt.predict_proba(X_scaled)[:, 1]  # prob of AUTHENTIC

# ── Core metrics ─────────────────────────────────────────────────────
acc      = accuracy_score(y, y_pred)
roc_auc  = roc_auc_score(y, y_proba)

# Per-class: pos_label=0 means MANIPULATED is positive
prec_man = precision_score(y, y_pred, pos_label=0, zero_division=0)
rec_man  = recall_score(y, y_pred, pos_label=0, zero_division=0)
f1_man   = f1_score(y, y_pred, pos_label=0, zero_division=0)

prec_auth = precision_score(y, y_pred, pos_label=1, zero_division=0)
rec_auth  = recall_score(y, y_pred, pos_label=1, zero_division=0)
f1_auth   = f1_score(y, y_pred, pos_label=1, zero_division=0)

cm = confusion_matrix(y, y_pred, labels=[0, 1])

# ── Print results ─────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  OVERALL METRICS")
print("=" * 60)
print(f"  Accuracy          : {acc*100:.2f}%")
print(f"  ROC-AUC           : {roc_auc:.4f}")

print("\n" + "=" * 60)
print("  CLASS-LEVEL METRICS  (primary focus: MANIPULATED recall)")
print("=" * 60)
print(f"  {'Class':<22} {'Precision':>10} {'Recall':>10} {'F1':>10}")
print(f"  {'-'*52}")
print(f"  {'MANIPULATED (0)':<22} {prec_man*100:>9.1f}% {rec_man*100:>9.1f}% {f1_man*100:>9.1f}%")
print(f"  {'AUTHENTIC (1)':<22} {prec_auth*100:>9.1f}% {rec_auth*100:>9.1f}% {f1_auth*100:>9.1f}%")

print("\n" + "=" * 60)
print("  CONFUSION MATRIX")
print("  Rows = Actual | Cols = Predicted  [0=MANIPULATED, 1=AUTHENTIC]")
print("=" * 60)
print(f"  {'':20}  Pred MANIP  Pred AUTH")
print(f"  {'Actual MANIP':<20}  {cm[0,0]:>10}  {cm[0,1]:>9}")
print(f"  {'Actual AUTH':<20}  {cm[1,0]:>10}  {cm[1,1]:>9}")

tn, fp, fn, tp = cm[0,0], cm[0,1], cm[1,0], cm[1,1]
print(f"\n  TN (Correct MANIP)  : {tn}")
print(f"  FP (MANIP→AUTH)     : {fp}  ← false clearance (dangerous)")
print(f"  FN (AUTH→MANIP)     : {fn}  ← false flag (nuisance)")
print(f"  TP (Correct AUTH)   : {tp}")

# ── Feature importance ───────────────────────────────────────────────
print("\n" + "=" * 60)
print("  FEATURE IMPORTANCE  (Gini impurity reduction)")
print("=" * 60)
importances = dt.feature_importances_
ranked = sorted(zip(FEATURE_COLS, importances), key=lambda x: x[1], reverse=True)
for feat, imp in ranked:
    bar = "█" * int(imp * 50)
    print(f"  {feat:<25} {imp*100:>6.2f}%  {bar}")

# ── Decision boundary audit ──────────────────────────────────────────
print("\n" + "=" * 60)
print("  BOUNDARY AUDIT  (edge-case records)")
print("=" * 60)
boundary_cases = [
    ("Normal patient (expect AUTH)",
     {"age":35,"bp_systolic":115,"bp_diastolic":75,"glucose":90,
      "hr":68,"spo2":99,"diagnosis_encoded":4,"previous_trials":1,
      "product_experience":2,"last_trial_outcome":1,
      "health_risk_score":0.12,"age_grp_adult":1,"age_grp_elderly":0}, 1),
    ("High-risk manipulated (expect MANIP)",
     {"age":52,"bp_systolic":145,"bp_diastolic":95,"glucose":180,
      "hr":88,"spo2":96,"diagnosis_encoded":2,"previous_trials":2,
      "product_experience":1,"last_trial_outcome":0,
      "health_risk_score":0.74,"age_grp_adult":1,"age_grp_elderly":0}, 0),
    ("SFO case (expect MANIP)",
     {"age":58,"bp_systolic":155,"bp_diastolic":98,"glucose":190,
      "hr":110,"spo2":93,"diagnosis_encoded":1,"previous_trials":3,
      "product_experience":2,"last_trial_outcome":0,
      "health_risk_score":0.00,"age_grp_adult":1,"age_grp_elderly":0}, 0),
    ("Borderline (AUTH with mild elevation)",
     {"age":45,"bp_systolic":130,"bp_diastolic":84,"glucose":115,
      "hr":88,"spo2":97,"diagnosis_encoded":2,"previous_trials":1,
      "product_experience":1,"last_trial_outcome":1,
      "health_risk_score":0.30,"age_grp_adult":1,"age_grp_elderly":0}, 1),
]

all_pass = True
for desc, rec, expected in boundary_cases:
    df_r = pd.DataFrame([rec])[FEATURE_COLS]
    sc_r = scaler.transform(df_r)
    pred = int(dt.predict(sc_r)[0])
    prob = dt.predict_proba(sc_r)[0]
    status = "✓ PASS" if pred == expected else "✗ FAIL"
    if pred != expected:
        all_pass = False
    pred_label = "AUTHENTIC" if pred == 1 else "MANIPULATED"
    print(f"  {status}  {desc}")
    print(f"         Predicted: {pred_label} | Auth {prob[1]*100:.1f}% | Manip {prob[0]*100:.1f}%")

# ── Final summary ────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  EVALUATION SUMMARY")
print("=" * 60)
if rec_man >= 0.85:
    print(f"  ✓ MANIPULATED recall {rec_man*100:.1f}% ≥ 85% — acceptable for V1")
else:
    print(f"  ✗ MANIPULATED recall {rec_man*100:.1f}% < 85% — model needs improvement")
    print(f"    Recommendation: retrain with class_weight='balanced' or use SMOTE")

if roc_auc >= 0.90:
    print(f"  ✓ ROC-AUC {roc_auc:.4f} ≥ 0.90 — discriminative power acceptable")
else:
    print(f"  ✗ ROC-AUC {roc_auc:.4f} < 0.90 — model lacks discriminative power")

if all_pass:
    print(f"  ✓ All boundary-case sanity checks passed")
else:
    print(f"  ✗ Some boundary-case sanity checks FAILED — inspect decision tree")

print(f"\n  NOTE: These metrics are measured on a structured synthetic test set")
print(f"  that was NOT used in training. For a production system, re-run this")
print(f"  evaluation against the HELD-OUT split of the original training dataset")
print(f"  stored at: Research-work/engineered_dataset.csv")
print(f"\n  To evaluate on the real held-out split, run:")
print(f"    python retrain_model.py   # re-saves models and prints train metrics")
print("=" * 60)
