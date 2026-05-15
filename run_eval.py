import os, json, pickle, warnings
warnings.filterwarnings("ignore")
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix, roc_auc_score
from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score

MODELS_DIR = r"C:\Users\ASUS\Desktop\Projects\Sailesh SIr\ClinicalGuard\backend\models"
with open(os.path.join(MODELS_DIR, "dt_model.pkl"), "rb") as f: dt = pickle.load(f)
with open(os.path.join(MODELS_DIR, "scaler.pkl"), "rb") as f: scaler = pickle.load(f)
with open(os.path.join(MODELS_DIR, "feature_cols.json")) as f: FEAT = json.load(f)

print("Model depth:", dt.get_depth(), "| leaves:", dt.get_n_leaves())

rng_a = np.random.default_rng(0)
rng_m = np.random.default_rng(99)

def mk_auth(n):
    rows = []
    for _ in range(n):
        age = int(rng_a.integers(22, 58))
        rows.append({"age": float(age), "bp_systolic": float(rng_a.integers(100,125)),
            "bp_diastolic": float(rng_a.integers(65,82)), "glucose": float(rng_a.integers(80,110)),
            "hr": float(rng_a.integers(60,85)), "spo2": float(rng_a.integers(97,100)),
            "diagnosis_encoded": int(rng_a.integers(0,5)), "previous_trials": int(rng_a.integers(0,4)),
            "product_experience": float(rng_a.integers(0,3)), "last_trial_outcome": float(rng_a.integers(0,2)),
            "health_risk_score": round(float(rng_a.uniform(0.05,0.25)),2),
            "age_grp_adult": 1 if 18<=age<60 else 0, "age_grp_elderly": 1 if age>=60 else 0})
    return pd.DataFrame(rows)[FEAT]

def mk_man(n):
    rows = []
    q = n // 4
    for _ in range(q):  # SFO pattern
        age = int(rng_m.integers(40,70))
        rows.append({"age": float(age), "bp_systolic": float(rng_m.integers(145,165)),
            "bp_diastolic": float(rng_m.integers(92,102)), "glucose": float(rng_m.integers(150,210)),
            "hr": float(rng_m.integers(85,105)), "spo2": float(rng_m.integers(93,97)),
            "diagnosis_encoded": int(rng_m.integers(0,3)), "previous_trials": int(rng_m.integers(1,4)),
            "product_experience": float(rng_m.integers(0,2)), "last_trial_outcome": 0.0,
            "health_risk_score": round(float(rng_m.uniform(0.00,0.08)),2),
            "age_grp_adult": 1 if 18<=age<60 else 0, "age_grp_elderly": 1 if age>=60 else 0})
    for _ in range(q):  # low SpO2
        age = int(rng_m.integers(30,65))
        rows.append({"age": float(age), "bp_systolic": float(rng_m.integers(110,130)),
            "bp_diastolic": float(rng_m.integers(70,85)), "glucose": float(rng_m.integers(90,120)),
            "hr": float(rng_m.integers(58,72)), "spo2": float(rng_m.integers(88,93)),
            "diagnosis_encoded": 0, "previous_trials": int(rng_m.integers(0,3)),
            "product_experience": 1.0, "last_trial_outcome": 1.0,
            "health_risk_score": round(float(rng_m.uniform(0.60,0.90)),2),
            "age_grp_adult": 1 if 18<=age<60 else 0, "age_grp_elderly": 1 if age>=60 else 0})
    for _ in range(q):  # tachycardia
        age = int(rng_m.integers(35,60))
        rows.append({"age": float(age), "bp_systolic": float(rng_m.integers(138,158)),
            "bp_diastolic": float(rng_m.integers(88,100)), "glucose": float(rng_m.integers(175,220)),
            "hr": float(rng_m.integers(102,130)), "spo2": float(rng_m.integers(94,97)),
            "diagnosis_encoded": 1, "previous_trials": int(rng_m.integers(2,5)),
            "product_experience": float(rng_m.integers(0,2)), "last_trial_outcome": 0.0,
            "health_risk_score": round(float(rng_m.uniform(0.65,0.95)),2),
            "age_grp_adult": 1 if 18<=age<60 else 0, "age_grp_elderly": 1 if age>=60 else 0})
    for _ in range(n - 3*q):  # elderly SFO
        age = int(rng_m.integers(62,80))
        rows.append({"age": float(age), "bp_systolic": float(rng_m.integers(148,170)),
            "bp_diastolic": float(rng_m.integers(94,106)), "glucose": float(rng_m.integers(155,200)),
            "hr": float(rng_m.integers(88,115)), "spo2": float(rng_m.integers(91,95)),
            "diagnosis_encoded": 2, "previous_trials": int(rng_m.integers(1,4)),
            "product_experience": float(rng_m.integers(0,3)), "last_trial_outcome": 0.0,
            "health_risk_score": round(float(rng_m.uniform(0.00,0.06)),2),
            "age_grp_adult": 0, "age_grp_elderly": 1})
    return pd.DataFrame(rows)[FEAT]

X = pd.concat([mk_auth(200), mk_man(200)], ignore_index=True)
y = np.array([1]*200 + [0]*200)
Xs = scaler.transform(X)
yp = dt.predict(Xs)
ypr = dt.predict_proba(Xs)[:,1]

acc = accuracy_score(y, yp)
roc = roc_auc_score(y, ypr)
pm = precision_score(y, yp, pos_label=0, zero_division=0)
rm = recall_score(y, yp, pos_label=0, zero_division=0)
fm = f1_score(y, yp, pos_label=0, zero_division=0)
pa = precision_score(y, yp, pos_label=1, zero_division=0)
ra = recall_score(y, yp, pos_label=1, zero_division=0)
fa = f1_score(y, yp, pos_label=1, zero_division=0)
cm = confusion_matrix(y, yp, labels=[0,1])
tn, fp, fn, tp = cm[0,0], cm[0,1], cm[1,0], cm[1,1]

SEP = "=" * 56
print(SEP)
print("  OVERALL METRICS")
print(SEP)
print("  Accuracy  :", round(acc*100, 2), "%")
print("  ROC-AUC   :", round(roc, 4))
print(SEP)
print("  CLASS-LEVEL (primary focus: MANIPULATED recall)")
print(SEP)
print("  MANIPULATED  Prec:", round(pm*100,1), "%  Recall:", round(rm*100,1), "%  F1:", round(fm*100,1), "%")
print("  AUTHENTIC    Prec:", round(pa*100,1), "%  Recall:", round(ra*100,1), "%  F1:", round(fa*100,1), "%")
print(SEP)
print("  CONFUSION MATRIX  [0=MANIP, 1=AUTH]")
print("                     Pred MANIP   Pred AUTH")
print("  Actual MANIP      ", cm[0,0], "         ", cm[0,1])
print("  Actual AUTH       ", cm[1,0], "         ", cm[1,1])
print("  FP (MANIP->AUTH, dangerous):", fp)
print("  FN (AUTH->MANIP, nuisance) :", fn)
print(SEP)
print("  FEATURE IMPORTANCE")
print(SEP)
for feat, imp in sorted(zip(FEAT, dt.feature_importances_), key=lambda x: -x[1]):
    bar = "#" * int(imp * 50)
    print("  " + feat.ljust(25) + str(round(imp*100, 2)).rjust(7) + "%  " + bar)
print(SEP)
if rm >= 0.85:
    print("  PASS  MANIPULATED recall", round(rm*100,1), "% >= 85% - acceptable for V1")
else:
    print("  FAIL  MANIPULATED recall", round(rm*100,1), "% < 85% - needs improvement")
