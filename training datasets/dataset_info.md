# Dataset Information for Machine Learning

This document provides a Data Engineering and Machine Learning analysis of the datasets available in the cloned `med-block-guard-internship` repository, now stored in `dataset-1`.

## Target Machine Learning Models
| # | Model | Purpose |
|---|---|---|
| 1 | Logistic Regression (LR) | Linear baseline classifier |
| 2 | Support Vector Machine (SVM) | Non-linear boundary classifier |
| 3 | Decision Tree (DT) | Primary production classifier (best performer) |

---

## 1. `trials_with_bias_scores.csv`

**Description:** Clinical trials records processed to include a generated blockchain hash and a derived bias risk level.
**Sample Size:** 11 rows
**Features:** `nct_id` (String), `title` (String), `gender` (Null/Empty), `min_age` (String, e.g., "40 Years"), `status` (Categorical), `blockchain_hash` (String)
**Target:** `bias_risk_level` (Categorical: "low risk")

| Criteria | Status | Explanation |
|---|---|---|
| Has binary target variable | ❌ No | `bias_risk_level` only has one class present ("low risk") in the sample. Not suitable for binary classification. |
| Feature richness | ❌ Poor | Primarily text/ID fields (`title`, `nct_id`, `blockchain_hash`). `min_age` needs parsing. `gender` is entirely null. Very difficult for standard LR/SVM without heavy NLP extraction. |
| Sample size risk | ❌ High Risk | Only 10-11 rows of data. Severe overfitting is guaranteed for any algorithmic model. |
| Clinical depth | ❌ Low | Contains only high-level trial metadata (title, status, age) and cryptographic hashes. |
| Derived/synthetic data | ⚠️ Caution | The bias scores and blockchain hashes appear to be synthetically attached or generated from the core trial data. |

---

## 2. `trials_for_blockchain.csv`

**Description:** The intermediate clinical trials dataset where a blockchain hash has been computed, but before bias risk evaluation.
**Sample Size:** 11 rows
**Features:** `nct_id`, `title`, `gender`, `min_age`, `status`, `blockchain_hash`
**Target:** None defined / Unsupervised

| Criteria | Status | Explanation |
|---|---|---|
| Has binary target variable | ❌ No | Lacks any target variable (no decision, label, or risk score). |
| Feature richness | ❌ Poor | Same as above. `gender` is completely empty. `title` requires NLP. |
| Sample size risk | ❌ High Risk | 11 rows is negligible for model training. |
| Clinical depth | ❌ Low | Only high-level descriptive metadata plus a blockchain hash. |
| Derived/synthetic data | ✅ Real Base | Base data appears pulled from actual ClinicalTrials.gov (NCT IDs), but it is too small to be useful. |

---

## 3. `sample_trials.csv`

**Description:** The rawest form of the dataset containing basic trial descriptive information before any blockchain or bias processing.
**Sample Size:** 11 rows
**Features:** `nct_id`, `title`, `gender`, `min_age`, `status`
**Target:** None defined / Unsupervised

| Criteria | Status | Explanation |
|---|---|---|
| Has binary target variable | ❌ No | Completely lacks a target column. |
| Feature richness | ❌ Poor | 4 readable columns. `gender` is null. `min_age` requires regex parsing to extract integers. |
| Sample size risk | ❌ High Risk | 11 rows. |
| Clinical depth | ❌ Low | Basic metadata only. |
| Derived/synthetic data | ✅ Real Base | Likely raw export or API pull from ClinicalTrials.gov. |

---

### Summary Conclusion
The datasets in this repository are **not suitable for traditional supervised ML classification** (Logistic Regression, SVM, Decision Trees) in their current state. They contain fewer than 20 rows, lack varied/binary target variables, have completely null features (like `gender`), and consist primarily of unstructured text (titles) and hashes.
