"""
Re-train the Decision Tree with the EXACT same parameters used in the original training.
This script re-generates dt_model.pkl, scaler.pkl, and feature_cols.json
compatible with the currently installed scikit-learn version.

Run from: ClinicalGuard/
  python retrain_model.py
"""
import warnings
warnings.filterwarnings("ignore")

import json
import pickle
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, recall_score

# ── Feature columns (EXACT ORDER — never change) ─────────────────
FEATURE_COLS = [
    "age",
    "bp_systolic",
    "bp_diastolic",
    "glucose",
    "hr",
    "spo2",
    "diagnosis_encoded",
    "previous_trials",
    "product_experience",
    "last_trial_outcome",
    "health_risk_score",
    "age_grp_adult",
    "age_grp_elderly",
]
TARGET_COL = "integrity_label"

# ── Best params from original GridSearchCV ─────────────────────────
BEST_PARAMS = {
    "criterion":         "gini",
    "max_depth":         7,
    "min_samples_leaf":  1,
    "min_samples_split": 2,
    "max_features":      None,
    "splitter":          "best",
    "random_state":      42,
}

# ── Load dataset ──────────────────────────────────────────────────
DATASET_PATH = r"C:\Users\ASUS\Desktop\Projects\Sailesh SIr\Research-work\engineered_dataset.csv"
print(f"Loading dataset: {DATASET_PATH}")
df = pd.read_csv(DATASET_PATH)
print(f"  Rows: {len(df)} | Columns: {list(df.columns)}")

# Check target column
if TARGET_COL not in df.columns:
    raise ValueError(f"Target column '{TARGET_COL}' not found. Available: {list(df.columns)}")

# Drop rows with missing features
df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])

X = df[FEATURE_COLS]
y = df[TARGET_COL].astype(int)

print(f"  Class distribution: {dict(y.value_counts().sort_index())}")
print(f"    0=MANIPULATED: {(y==0).sum()} | 1=AUTHENTIC: {(y==1).sum()}")

# ── Split (same 70/30 ratio as original) ──────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.30, random_state=42, stratify=y
)
print(f"  Train: {len(X_train)} | Test: {len(X_test)}")

# ── Fit MinMaxScaler ──────────────────────────────────────────────
scaler = MinMaxScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled  = scaler.transform(X_test)

# ── Train Decision Tree ────────────────────────────────────────────
print(f"\nTraining Decision Tree with params: {BEST_PARAMS}")
dt = DecisionTreeClassifier(**BEST_PARAMS)
dt.fit(X_train_scaled, y_train)

# ── Evaluate ──────────────────────────────────────────────────────
y_pred  = dt.predict(X_test_scaled)
y_proba = dt.predict_proba(X_test_scaled)[:, 1]

acc     = round(accuracy_score(y_test, y_pred) * 100, 2)
f1      = round(f1_score(y_test, y_pred) * 100, 2)
roc     = round(roc_auc_score(y_test, y_proba), 4)
manip_r = round(recall_score(y_test, y_pred, pos_label=0) * 100, 2)

print(f"\n  Accuracy        : {acc}%  (expected ≈99.63%)")
print(f"  F1-Score        : {f1}%  (expected ≈99.77%)")
print(f"  ROC-AUC         : {roc}  (expected ≈0.9974)")
print(f"  Manip Recall    : {manip_r}%  (expected ≈98.33%)")
print(f"  Tree Depth      : {dt.get_depth()} (expected 7)")
print(f"  Leaf Nodes      : {dt.get_n_leaves()} (expected 15)")

# ── Verify demo record gives MANIPULATED ──────────────────────────
DEMO_RECORD = {
    "age": 52, "bp_systolic": 145, "bp_diastolic": 95,
    "glucose": 180, "hr": 88, "spo2": 96,
    "diagnosis_encoded": 2, "previous_trials": 2,
    "product_experience": 1, "last_trial_outcome": 0,
    "health_risk_score": 0.74, "age_grp_adult": 1, "age_grp_elderly": 0,
}
demo_df  = pd.DataFrame([DEMO_RECORD])[FEATURE_COLS]
demo_sc  = scaler.transform(demo_df)
demo_lab = int(dt.predict(demo_sc)[0])
demo_pr  = dt.predict_proba(demo_sc)[0]
print(f"\n  Demo Record Verification:")
print(f"    Label     : {demo_lab} ({'AUTHENTIC' if demo_lab==1 else 'MANIPULATED'})")
print(f"    Conf Auth : {round(demo_pr[1]*100,2)}%")
print(f"    Conf Manip: {round(demo_pr[0]*100,2)}%")

if demo_lab != 0:
    print("  ⚠️  WARNING: Demo record returned AUTHENTIC — investigate dataset")
else:
    print("  ✅ Demo record correctly returns MANIPULATED")

# ── Save updated PKL files ────────────────────────────────────────
OUT_DIR = r"C:\Users\ASUS\Desktop\Projects\Sailesh SIr\ClinicalGuard\backend\models"

with open(f"{OUT_DIR}/dt_model.pkl", "wb") as f:
    pickle.dump(dt, f)

with open(f"{OUT_DIR}/scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)

with open(f"{OUT_DIR}/feature_cols.json", "w") as f:
    json.dump(FEATURE_COLS, f, indent=2)

print(f"\n  ✅ Saved to {OUT_DIR}/")
print("     - dt_model.pkl")
print("     - scaler.pkl")
print("     - feature_cols.json")
print("\n  ✅ RETRAINING COMPLETE")
