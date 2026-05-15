# ClinicalGuard: System Algorithms and Blockchain Architecture Report

## 1. Executive Summary
This report details the algorithmic and blockchain system flows implemented in the ClinicalGuard platform. ClinicalGuard ensures the integrity of clinical trial data by deploying a multi-layered verification system that combines deterministic heuristics, Machine Learning (ML), Generative AI (LLMs), and an immutable ledger on the Polygon Amoy blockchain. 

## 2. System Flow Architecture
The core data verification process for single predictions and batch uploads follows a strict pipeline:
1.  **Data Extraction & Pre-processing:** 13 critical clinical features are extracted and normalized.
2.  **Cryptographic Hashing:** A SHA-256 hash of the raw record is immediately generated.
3.  **Deterministic Heuristic Analysis:** A pre-check flags clear SFO (Selective Field Omission) anomalies.
4.  **Machine Learning Prediction:** A Decision Tree model evaluates complex, subtle manipulation patterns.
5.  **Generative AI Reasoning:** A Gemini-based LLM synthesizes a clinical explanation.
6.  **Blockchain Commitment:** An on-chain validation algorithm enforces consensus and anchors the record immutably.
7.  **Database Persistence & Audit Logging:** Results, blockchain transaction hashes, and metadata are persisted securely to MongoDB for audit trails.

## 3. Algorithm Detail 1: Machine Learning (Decision Tree Classifier)
The primary predictive engine depends on a trained Decision Tree Classifier (`dt_model.pkl`) to differentiate authentic clinical trial patient records from fabricated or manipulated ones.

### 3.1. Feature Engineering
The model consumes 13 standardized features:
*   **Vitals:** `age`, `bp_systolic`, `bp_diastolic`, `glucose`, `hr` (Heart Rate), `spo2` (Oxygen Saturation).
*   **Trial Specific:** `diagnosis_encoded`, `previous_trials`, `product_experience`, `last_trial_outcome`.
*   **Engineered/Aggregate:** `health_risk_score`, `age_grp_adult`, `age_grp_elderly`.

### 3.2. Output and Risk Stratification
The model computes the probabilities of the record being manipulated vs. authentic. It establishes risk levels based on this distribution:
*   **HIGH Risk:** Probability Manipulated ≥ 60.0%
*   **MEDIUM Risk:** Probability Manipulated ≥ 25.0%
*   **LOW Risk:** Probability Manipulated < 25.0%

Based on the confidence of authenticity, it determines a `blockchain_action` (`COMMIT_TRANSACTION`, `REJECT_TRANSACTION`, or `FLAG_FOR_REVIEW`).

## 4. Algorithm Detail 2: Selective Field Omission (SFO) Pre-Check
Before ML evaluation, the system executes deterministic heuristics to catch blatant fabricated manipulation that standard ML might overlook (often created by data entry operators "lazy-filling" fields). 

### 4.1. Detection Logic
The algorithm triggers an automatic `MANIPULATED` classification if:
*   The `health_risk_score` is suspiciously low (< 0.10, indicating the patient is perfectly healthy).
*   **AND** at least 2 distinct vitals fall drastically outside clinically normal clinical ranges (e.g., `bp_systolic > 140` or `bp_diastolic > 90`, `glucose > 126`, `hr < 55` or `> 100`, `spo2 < 95`).
When SFO override is flagged, the record bypasses the ML model directly into a `REJECT_TRANSACTION` state (95% confidence manipulation).

## 5. Algorithm Detail 3: Generative AI Reasoning System Contextualization
To bridge the gap between "black-box" model outputs and the doctors/regulators auditing the records, ClinicalGuard leverages Google's Gemini models (`gemini-2.5-flash`). 
The AI receives a dynamically built context window embedding:
*   The literal variable readings (e.g., "Systolic BP: 145 mmHg").
*   The calculated risk probabilities and ML decisions.
*   Instructions indicating standard normal ranges.
It outputs exactly 3-4 sentences detailing *why* the values point to fabrication or authenticity, making the auditing process clinically actionable.

## 6. Blockchain Infrastructure and Smart Contract Algorithms
Data integrity is ultimately secured via an immutable record on the **Polygon Amoy private blockchain**. The system uses a specialized smart contract written in Solidity: `ClinicalTrialIntegrity.sol`.

### 6.1. Smart Contract Data Anchoring
When validation finishes, the off-chain system submits a transaction mapping the localized data integrity into an immutable structure.
*   **Inputs:** `trialId`, `siteId`, `dataHash` (bytes32 cryptographic evidence of the raw data), `integrityLabel` (1/0), `confidenceAuth`, `riskLevel` and `mlModel`.

### 6.2. On-Chain Consensus & Validation Rules
The function `validateAndCommit` enforces on-chain state changes using strict programmatic rules.
*   **Condition for Committing a Record:** A record is only fully "committed" onto the ledger's valid state if `label == 1` **AND** `confidenceAuth >= minConfidence` (system defaults `minConfidence` to 85.00%).
*   If labeled manipulated (`label == 0`), the transaction hash is generated, the record state marks rejection, and an on-chain event `ManipulationDetected` is explicitly fired. 

### 6.3. Node Trust Scoring Algorithm
To prevent rogue sites from spamming or authorizing manipulated data onto the ledger, the contract enforces a robust **Node Trust Algorithm**:
*   Nodes start with a maximum trust score (`10,000` = 100%).
*   For each validation event handled, `totalValidations` iterates. If the validation matches consensus expectations, `correctValidations` iterates.
*   **Calculation:** `trustScore = (correctValidations * 10000) / totalValidations`.
*   **Access Control (`trustedNode` modifier):** The smart contract automatically rejects any read-write transaction from validator nodes whose trust score falls below 60.00% (`6000`).

## 7. Cryptographic Guarantee
By hashing the raw clinical data (via SHA-256) independently of the predictive models and committing only the data hash directly onto the Polygon blockchain alongside the ML confidence result, ClinicalGuard achieves:
1.  **Zero-Knowledge Integrity:** The blockchain proves that the specific patient metrics existed at a given timestamp without publicizing any HIPAA-protected patient health info. 
2.  **Non-repudiation:** If an institution alters database records post-audit, comparing the newly generated `dataHash` against the blockchain's `records[txHash].dataHash` guarantees the detection of tampering.
