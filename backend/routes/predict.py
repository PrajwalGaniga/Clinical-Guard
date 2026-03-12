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
    Detects Selective Field Omission: health_risk_score is 0.00
    while physiological vitals indicate an active patient.
    """
    hrs = record.get("health_risk_score", 0)
    bp_dia = record.get("bp_diastolic", 0)
    glucose = record.get("glucose", 0)
    hr = record.get("hr", 0)

    # A truly healthy patient with normal vitals will have HRS > 0.05
    if hrs == 0.0 and bp_dia > 65 and glucose > 75 and hr > 55:
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

    results = []
    auth_count = 0
    man_count = 0

    for idx, row in df.iterrows():
        try:
            # Map pandas row to dict, replace NaN with None
            record_raw = row.where(pd.notnull(row), None).to_dict()
            
            # Extract features for ML (remove metadata)
            trial_id = record_raw.get("trial_id", "NCT04414150")
            site_id = record_raw.get("site_id", "SITE_001")
            
            # Clean record for model
            clean_keys = ["age", "bp_systolic", "bp_diastolic", "glucose", "hr", "spo2", 
                          "diagnosis_encoded", "previous_trials", "product_experience", 
                          "last_trial_outcome", "health_risk_score", "age_grp_adult", "age_grp_elderly"]
            
            record = {}
            for k in clean_keys:
                if k in record_raw and record_raw[k] is not None:
                    record[k] = float(record_raw[k]) if str(record_raw[k]).replace('.','',1).isdigit() else record_raw[k]
                else:
                    record[k] = 0.0 # Fallback 

            # SHA-256 Hash
            data_hash = hash_service.hash_record(record)

            # SFO Pre-check
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
                ml_result = ml_service.predict(record)
                ml_result["sfo_detected"] = False

            # Gemini Reasoning
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

            # MongoDB Save
            action = ml_result["blockchain_action"]
            status_str = "COMMITTED" if action == "COMMIT_TRANSACTION" else "REJECTED" if action == "REJECT_TRANSACTION" else "PENDING_REVIEW"
            
            doc = {
                "trial_id": trial_id,
                "site_id": site_id,
                "hospital": current_user.get("hospital", "Unknown"),
                "submitted_by": ObjectId(current_user["sub"]),
                "submitted_at": datetime.utcnow(),
                "record": record,
                "ml_result": ml_result,
                "gemini_reasoning": gemini_text,
                "blockchain": {
                    "data_hash": data_hash,
                    "tx_hash": bc_result["tx_hash"],
                    "block_number": bc_result["block_number"],
                    "network": bc_result["network"],
                    "committed": status_str == "COMMITTED",
                },
                "status": status_str,
            }
            res_db = await db.trial_records.insert_one(doc)

            # Audit log for Manipulated
            if ml_result["integrity_label"] == 0:
                await db.audit_logs.insert_one({
                    "action": "SFO_AUTO_DETECTED" if sfo_override else "MANIPULATION_DETECTED",
                    "record_id": res_db.inserted_id,
                    "user_id": ObjectId(current_user["sub"]),
                    "site_id": site_id,
                    "hospital": current_user.get("hospital", "Unknown"),
                    "timestamp": datetime.utcnow(),
                    "details": f"{ml_result['risk_level']} risk — {ml_result['decision']} verdict",
                    "risk_level": ml_result["risk_level"],
                    "data_hash": data_hash,
                    "tx_hash": bc_result["tx_hash"],
                    "sfo_override": sfo_override
                })

            if ml_result["integrity_label"] == 1:
                auth_count += 1
            else:
                man_count += 1

            results.append({
                "original_data": record_raw,
                "verdict": "Authentic" if ml_result["integrity_label"] == 1 else "Manipulated",
                "decision": ml_result["decision"],
                "risk_level": ml_result["risk_level"],
                "data_hash": data_hash,
                "reasoning": gemini_text,
                "metadata": {"blockchain_tx": bc_result["tx_hash"]}
            })

        except Exception as e:
            # Skip rows with heavy parsing errors, or record as failed
            print(f"Batch row error: {e}")

    return {
        "summary": {
            "total_processed": len(results),
            "authentic": auth_count,
            "manipulated": man_count
        },
        "results": results
    }
