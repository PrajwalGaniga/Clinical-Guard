"""
ClinicalGuard — Realistic Fraud Dataset Generator
===================================================
Generates 10,000 rows with THREE realistic insider fraud patterns:

  AUTHENTIC (6000): Consistent vitals + correctly computed HRS
  SFO      (1400): Real high-risk vitals, but HRS zeroed out by fraudster
  VSM      (1600): Vitals deflated just below thresholds, HRS left high
  TSF      (1000): Outcome/experience fields fabricated to hide adverse events

All BP/glucose values are within physiologically POSSIBLE human ranges.
The model learns INTERNAL INCONSISTENCY, not impossible outlier values.

Output: training datasets/clinicalguard_realistic_dataset.csv
"""

import os
import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
OUT = os.path.join(os.path.dirname(__file__), "training datasets", "clinicalguard_realistic_dataset.csv")

DIAG_MAP = {0: "COPD", 1: "Diabetes", 2: "Hypertension", 3: "Tachycardia", 4: "None"}


def compute_hrs(age, sys, dia, glucose, hr, spo2):
    """Exact same formula as frontend check/page.js — the ground truth."""
    bp  = 0.40 if (sys>160 or dia>100) else 0.25 if (sys>140 or dia>90) else 0.10 if (sys>120 or dia>80) else 0.05
    gl  = 0.35 if glucose>200 else 0.20 if glucose>126 else 0.10 if glucose>100 else 0.05
    h   = 0.35 if (hr>130 or hr<45) else 0.20 if (hr>100 or hr<55) else 0.08 if (hr>90 or hr<60) else 0.03
    s   = 0.35 if spo2<88 else 0.25 if spo2<92 else 0.12 if spo2<95 else 0.02
    a   = 0.10 if age>75 else 0.07 if age>65 else 0.04 if age>55 else 0.02
    return round(min(max(bp+gl+h+s+a, 0.05), 1.00), 4)


def row(age, sys, dia, gluc, hr, spo2, diag, pt, pe, lto, hrs, label, mtype):
    adult   = 1 if 18 <= age < 60 else 0
    elderly = 1 if age >= 60 else 0
    return {
        "age": age, "bp_systolic": sys, "bp_diastolic": dia,
        "glucose": gluc, "hr": hr, "spo2": spo2,
        "diagnosis": DIAG_MAP[diag], "diagnosis_encoded": diag,
        "previous_trials": pt, "product_experience": pe,
        "last_trial_outcome": lto, "health_risk_score": hrs,
        "age_grp_adult": adult, "age_grp_elderly": elderly,
        "integrity_label": label, "manipulation_type": mtype,
    }


rows = []

# ── 1. AUTHENTIC (6000) ──────────────────────────────────────────────
for _ in range(6000):
    age  = int(rng.integers(18, 80))
    sys  = int(rng.integers(90, 168))
    dia  = int(rng.integers(60, 102))
    gluc = int(rng.integers(70, 195))
    hr   = int(rng.integers(55, 108))
    spo2 = int(rng.integers(88, 100))
    diag = int(rng.integers(0, 5))
    pt   = int(rng.integers(0, 6))
    pe   = int(rng.integers(0, 2))
    lto  = int(rng.integers(0, 2))
    hrs  = compute_hrs(age, sys, dia, gluc, hr, spo2)
    rows.append(row(age, sys, dia, gluc, hr, spo2, diag, pt, pe, lto, hrs, 1, "authentic"))

# ── 2. SFO — Selective Field Omission (1400) ─────────────────────────
# Patient has genuinely elevated vitals. Fraudster zeroes out HRS to
# make the patient appear low-risk and pass inclusion criteria.
# Signal: HRS is near-zero but vitals clearly indicate elevated risk.
for _ in range(1400):
    age  = int(rng.integers(35, 80))
    sys  = int(rng.integers(142, 168))   # Hypertensive — clearly elevated
    dia  = int(rng.integers(92, 106))
    gluc = int(rng.integers(132, 198))   # Diabetic range
    hr   = int(rng.integers(96, 118))    # Mild tachycardia
    spo2 = int(rng.integers(86, 94))     # Below normal
    diag = int(rng.choice([0, 1, 2]))    # Disease diagnosis
    pt   = int(rng.integers(0, 4))
    pe   = int(rng.integers(0, 2))
    lto  = int(rng.integers(0, 2))
    # Fraudster sets HRS to near-zero — the manipulation
    hrs_fake = round(float(rng.uniform(0.00, 0.09)), 4)
    rows.append(row(age, sys, dia, gluc, hr, spo2, diag, pt, pe, lto, hrs_fake, 0, "sfo"))

# ── 3. VSM — Vital Sign Manipulation (1600) ──────────────────────────
# Fraudster deflates vitals to just below eligibility thresholds.
# But forgets (or doesn't bother) to fully adjust HRS — it still
# reflects the original elevated values.
# Signal: HRS is moderate-high (0.40–0.75) but stated vitals look normal.
for _ in range(1600):
    age = int(rng.integers(28, 75))
    # Real vitals (high) — what they should have recorded:
    real_sys  = int(rng.integers(145, 165))
    real_dia  = int(rng.integers(93, 105))
    real_gluc = int(rng.integers(132, 175))
    real_hr   = int(rng.integers(102, 122))
    real_spo2 = int(rng.integers(86, 93))
    # Fraudster deflates vitals to just below thresholds:
    fake_sys  = int(rng.integers(128, 138))   # real was 145–165, now looks OK
    fake_dia  = int(rng.integers(80, 89))     # real was 93–105, now looks OK
    fake_gluc = int(rng.integers(108, 124))   # real was 132–175, now looks OK
    fake_hr   = int(rng.integers(88, 99))     # real was 102–122
    fake_spo2 = int(rng.integers(94, 98))     # real was 86–93
    diag = int(rng.choice([1, 2, 3]))
    pt   = int(rng.integers(0, 4))
    pe   = int(rng.integers(0, 2))
    lto  = int(rng.integers(0, 2))
    # HRS computed from REAL vitals (fraudster didn't adjust it completely)
    hrs_real = compute_hrs(age, real_sys, real_dia, real_gluc, real_hr, real_spo2)
    # Fraudster may partially adjust HRS (add small random reduction but not enough)
    hrs_partial = round(max(hrs_real - float(rng.uniform(0.05, 0.15)), 0.30), 4)
    rows.append(row(age, fake_sys, fake_dia, fake_gluc, fake_hr, fake_spo2,
                    diag, pt, pe, lto, hrs_partial, 0, "vsm"))

# ── 4. TSF — Trial Score Fabrication (1000) ──────────────────────────
# Patient has adverse history or health risks.
# Fraudster fabricates outcome/experience fields to make them look eligible.
# Patterns: (a) outcome=1 despite high risk, (b) diagnosis inconsistent with BP,
#           (c) product_experience inflated vs previous_trials.
for _ in range(1000):
    age  = int(rng.integers(30, 78))
    sys  = int(rng.integers(138, 168))   # Elevated — patient is genuinely unwell
    dia  = int(rng.integers(88, 102))
    gluc = int(rng.integers(128, 198))
    hr   = int(rng.integers(92, 115))
    spo2 = int(rng.integers(88, 96))
    hrs  = compute_hrs(age, sys, dia, gluc, hr, spo2)  # HRS is correctly high
    diag = int(rng.integers(0, 5))
    pt   = int(rng.integers(0, 3))
    # Fabricated fields — the manipulation:
    pe   = min(int(rng.integers(1, 3)), pt + 1)  # experience > actual trials (impossible)
    lto  = 1    # Claims last trial was SUCCESS despite high-risk profile
    rows.append(row(age, sys, dia, gluc, hr, spo2, diag, pt, pe, lto, hrs, 0, "tsf"))


# ── Assemble and shuffle ─────────────────────────────────────────────
df = pd.DataFrame(rows)
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

print(f"Dataset shape: {df.shape}")
print(f"Class distribution:\n{df['integrity_label'].value_counts()}")
print(f"Manipulation types:\n{df['manipulation_type'].value_counts()}")
print(f"\nAUTHENTIC bp_systolic range: {df[df['integrity_label']==1]['bp_systolic'].min()}–{df[df['integrity_label']==1]['bp_systolic'].max()}")
print(f"MANIPULATED bp_systolic range: {df[df['integrity_label']==0]['bp_systolic'].min()}–{df[df['integrity_label']==0]['bp_systolic'].max()}")
print(f"\nSFO HRS range: {df[df['manipulation_type']=='sfo']['health_risk_score'].min():.3f}–{df[df['manipulation_type']=='sfo']['health_risk_score'].max():.3f}")
print(f"VSM HRS range: {df[df['manipulation_type']=='vsm']['health_risk_score'].min():.3f}–{df[df['manipulation_type']=='vsm']['health_risk_score'].max():.3f}")
print(f"AUTH HRS range: {df[df['manipulation_type']=='authentic']['health_risk_score'].min():.3f}–{df[df['manipulation_type']=='authentic']['health_risk_score'].max():.3f}")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
df.to_csv(OUT, index=False)
print(f"\nSaved to: {OUT}")
