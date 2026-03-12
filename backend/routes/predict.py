from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from ..database import get_database
from ..auth_utils import get_current_user
from ..services import ml_service, hash_service, gemini_service, blockchain_service

router = APIRouter(prefix="/predict", tags=["Predict"])


class TrialRecord(BaseModel):
    age: float
    bp_systolic: float
    bp_diastolic: float
    glucose: float
    hr: float
    spo2: float
    diagnosis_encoded: int
    previous_trials: int
    product_experience: float
    last_trial_outcome: float
    health_risk_score: float
    age_grp_adult: int
    age_grp_elderly: int

    # Optional trial metadata
    trial_id: str = "NCT04414150"
    site_id: str = "SITE_001"
    hospital: str = "General Hospital"


def detect_sfo_pattern(record: dict) -> bool:
    """
    Detects Selective Field Omission:
    health_risk_score is suspiciously low (< 0.10) WHILE
    at least 2 vitals are clearly outside normal clinical ranges.
    A genuinely healthy patient will never have HRS < 0.10 after Fix 1.
    """
    hrs      = float(record.get("health_risk_score", 0))
    bp_sys   = float(record.get("bp_systolic", 0))
    bp_dia   = float(record.get("bp_diastolic", 0))
    glucose  = float(record.get("glucose", 0))
    hr       = float(record.get("hr", 0))
    spo2     = float(record.get("spo2", 100))

    abnormal_count = 0
    if bp_sys > 140 or bp_dia > 90:  abnormal_count += 1
    if glucose > 126:                 abnormal_count += 1
    if hr > 100 or hr < 55:          abnormal_count += 1
    if spo2 < 95:                     abnormal_count += 1

    # SFO: score is suspiciously low but ≥2 vitals are clearly abnormal
    if hrs < 0.10 and abnormal_count >= 2:
        return True
    return False


@router.post("/single")
async def predict_single(
    payload: TrialRecord,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()

    # 1️⃣ Extract 13 features
    record = payload.model_dump(exclude={"trial_id", "site_id", "hospital"})

    # 2️⃣ SHA-256 Hash of RAW record
    data_hash = hash_service.hash_record(record)

    # 3️⃣ Pre-check for SFO Pattern
    sfo_override = detect_sfo_pattern(record)
    
    if sfo_override:
        ml_result = {
            "integrity_label": 0,
            "decision": "MANIPULATED",
            "confidence_authentic": 5.0,
            "confidence_manipulated": 95.0,
            "risk_level": "HIGH",
            "blockchain_action": "REJECT_TRANSACTION",
            "sfo_detected": True
        }
    else:
        # 4️⃣ Run ML Prediction
        ml_result = ml_service.predict(record)
        ml_result["sfo_detected"] = False

    # 5️⃣ Call Gemini AI Reasoning
    gemini_text = gemini_service.generate_reasoning(record, ml_result)

    # 6️⃣ Call Blockchain
    bc_result = blockchain_service.submit_to_blockchain(
        data_hash=data_hash,
        label=ml_result["integrity_label"],
        confidence=ml_result["confidence_authentic"] / 100,
        risk=ml_result["risk_level"],
        trial_id=payload.trial_id,
        site_id=payload.site_id,
    )

    # 7️⃣ Determine status and Save to MongoDB
    action = ml_result["blockchain_action"]
    if action == "COMMIT_TRANSACTION":
        status_str = "COMMITTED"
    elif action == "REJECT_TRANSACTION":
        status_str = "REJECTED"
    else:
        status_str = "PENDING_REVIEW"

    doc = {
        "trial_id":      payload.trial_id,
        "site_id":       payload.site_id,
        "hospital":      payload.hospital,
        "submitted_by":  ObjectId(current_user["sub"]),
        "submitted_at":  datetime.utcnow(),
        "record":        record,
        "ml_result":     ml_result,
        "gemini_reasoning": gemini_text,
        "blockchain": {
            "data_hash":    data_hash,
            "tx_hash":      bc_result["tx_hash"],
            "block_number": bc_result["block_number"],
            "network":      bc_result["network"],
            "committed":    status_str == "COMMITTED",
        },
        "status": status_str,
    }
    result = await db.trial_records.insert_one(doc)
    record_id = str(result.inserted_id)

    # 8️⃣ Save audit log for MANIPULATED records (FIX-3/V2)
    if ml_result["integrity_label"] == 0:
        await db.audit_logs.insert_one({
            "action":     "SFO_AUTO_DETECTED" if sfo_override else "MANIPULATION_DETECTED",
            "record_id":  result.inserted_id,
            "user_id":    ObjectId(current_user["sub"]),
            "site_id":    payload.site_id,
            "hospital":   payload.hospital,
            "timestamp":  datetime.utcnow(),
            "details":    f"{ml_result['risk_level']} risk — {ml_result['decision']} verdict",
            "risk_level": ml_result["risk_level"],
            "data_hash":  data_hash,
            "tx_hash":    bc_result["tx_hash"],
            "sfo_override": sfo_override
        })

    # 9️⃣ Return response
    return {
        **ml_result,
        "data_hash":        data_hash,
        "tx_hash":          bc_result["tx_hash"],
        "gemini_reasoning": gemini_text,
        "record_id":        record_id,
    }


from fastapi import UploadFile, File
import pandas as pd
import io

# Common alternative column names → canonical names
_COL_ALIASES = {
    "blood_pressure_systolic":  "bp_systolic",
    "blood_pressure_diastolic": "bp_diastolic",
    "heart_rate":               "hr",
    "oxygen_saturation":        "spo2",
    "oxygen":                   "spo2",
    "blood_glucose":            "glucose",
    "risk_score":               "health_risk_score",
    "age_group_adult":          "age_grp_adult",
    "age_group_elderly":        "age_grp_elderly",
}

_REQUIRED_COLS = [
    "age", "bp_systolic", "bp_diastolic", "glucose", "hr", "spo2",
    "diagnosis_encoded", "previous_trials", "product_experience",
    "last_trial_outcome", "health_risk_score", "age_grp_adult", "age_grp_elderly"
]


@router.post("/batch")
async def predict_batch(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Run batch predictions from a CSV file."""
    db = get_database()
    content = await file.read()

    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file format: {e}")

    # Normalize column names: strip whitespace, lowercase, spaces/hyphens → underscore
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(" ", "_", regex=False)
        .str.replace("-", "_", regex=False)
    )

    # Remap common alternative column names
    df.rename(columns=_COL_ALIASES, inplace=True)

    # Verify required columns are present
    missing_cols = [c for c in _REQUIRED_COLS if c not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=422,
            detail=f"CSV is missing required columns: {missing_cols}. "
                   f"Available columns: {list(df.columns)}"
        )

    results = []
    auth_count  = 0
    man_count   = 0
    pend_count  = 0
    failed_rows = []

    for idx, row in df.iterrows():
        row_label = f"Row {idx + 2}"  # +2 because idx is 0-based, row 1 is header
        try:
            record_raw = row.where(pd.notnull(row), None).to_dict()

            trial_id = str(record_raw.get("trial_id", "UNKNOWN") or "UNKNOWN")
            site_id  = str(record_raw.get("site_id",  "SITE_001") or "SITE_001")

            # Build clean record with numeric coercion
            record = {}
            for k in _REQUIRED_COLS:
                val = record_raw.get(k)
                if val is None:
                    failed_rows.append(f"{row_label}: missing value for '{k}'")
                    record[k] = 0.0
                else:
                    try:
                        record[k] = float(val)
                    except (ValueError, TypeError):
                        failed_rows.append(f"{row_label}: invalid value '{val}' for '{k}'")
                        record[k] = 0.0

            # SHA-256 hash
            data_hash = hash_service.hash_record(record)

            # SFO pre-check
            sfo_override = detect_sfo_pattern(record)
            if sfo_override:
                ml_result = {
                    "integrity_label":        0,
                    "decision":               "MANIPULATED",
                    "confidence_authentic":   5.0,
                    "confidence_manipulated": 95.0,
                    "risk_level":             "HIGH",
                    "blockchain_action":      "REJECT_TRANSACTION",
                    "sfo_detected":           True
                }
            else:
                ml_result = ml_service.predict(record)
                ml_result["sfo_detected"] = False

            # Gemini reasoning
            gemini_text = gemini_service.generate_reasoning(record, ml_result)

            # Blockchain
            bc_result = blockchain_service.submit_to_blockchain(
                data_hash=data_hash,
                label=ml_result["integrity_label"],
                confidence=ml_result["confidence_authentic"] / 100,
                risk=ml_result["risk_level"],
                trial_id=trial_id,
                site_id=site_id,
            )

            # MongoDB save
            action = ml_result["blockchain_action"]
            status_str = (
                "COMMITTED"     if action == "COMMIT_TRANSACTION"  else
                "REJECTED"      if action == "REJECT_TRANSACTION"  else
                "PENDING_REVIEW"
            )

            doc = {
                "trial_id":     trial_id,
                "site_id":      site_id,
                "hospital":     current_user.get("hospital", "Unknown"),
                "submitted_by": ObjectId(current_user["sub"]),
                "submitted_at": datetime.utcnow(),
                "record":       record,
                "ml_result":    ml_result,
                "gemini_reasoning": gemini_text,
                "blockchain": {
                    "data_hash":    data_hash,
                    "tx_hash":      bc_result["tx_hash"],
                    "block_number": bc_result["block_number"],
                    "network":      bc_result["network"],
                    "committed":    status_str == "COMMITTED",
                },
                "status": status_str,
            }
            res_db = await db.trial_records.insert_one(doc)

            # Audit log for manipulated records
            if ml_result["integrity_label"] == 0:
                await db.audit_logs.insert_one({
                    "action":     "SFO_AUTO_DETECTED" if sfo_override else "MANIPULATION_DETECTED",
                    "record_id":  res_db.inserted_id,
                    "user_id":    ObjectId(current_user["sub"]),
                    "site_id":    site_id,
                    "hospital":   current_user.get("hospital", "Unknown"),
                    "timestamp":  datetime.utcnow(),
                    "details":    f"{ml_result['risk_level']} risk — {ml_result['decision']} verdict",
                    "risk_level": ml_result["risk_level"],
                    "data_hash":  data_hash,
                    "tx_hash":    bc_result["tx_hash"],
                    "sfo_override": sfo_override
                })

            # Tally
            if status_str == "COMMITTED":
                auth_count += 1
            elif status_str == "REJECTED":
                man_count += 1
            else:
                pend_count += 1

            results.append({
                "original_data": record_raw,
                "verdict":       "Authentic" if ml_result["integrity_label"] == 1 else "Manipulated",
                "decision":      ml_result["decision"],
                "risk_level":    ml_result["risk_level"],
                "confidence_authentic":   ml_result["confidence_authentic"],
                "confidence_manipulated": ml_result["confidence_manipulated"],
                "blockchain_action":      ml_result["blockchain_action"],
                "data_hash":     data_hash,
                "reasoning":     gemini_text,
                "metadata": {"blockchain_tx": bc_result["tx_hash"]},
            })

        except Exception as e:
            print(f"[BATCH] {row_label} error: {e}")
            failed_rows.append(f"{row_label}: unexpected error — {e}")

    return {
        "summary": {
            "total":          len(results),
            "authentic":      auth_count,
            "manipulated":    man_count,
            "pending":        pend_count,
            "failed_rows":    len(failed_rows),
            "failed_details": failed_rows,
        },
        "results": results
    }


