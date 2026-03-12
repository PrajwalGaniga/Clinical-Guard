from fastapi import APIRouter, Depends, Query, HTTPException
from bson import ObjectId
from ..database import get_database
from ..auth_utils import require_roles

router = APIRouter(prefix="/audit", tags=["Audit"])

AUDIT_ROLES = require_roles("admin", "regulator", "monitor")


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    for key in ("record_id", "user_id"):
        if key in doc and isinstance(doc[key], ObjectId):
            doc[key] = str(doc[key])
    if "timestamp" in doc:
        doc["timestamp"] = doc["timestamp"].isoformat()
    return doc


@router.get("")
async def get_audit_log(
    page:     int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    action:   str = Query(None),
    site_id:  str = Query(None),
    risk:     str = Query(None),
    current_user: dict = Depends(AUDIT_ROLES),
):
    db = get_database()

    query: dict = {}
    if action:
        query["action"] = action
    if site_id:
        query["site_id"] = site_id
    if risk:
        query["risk_level"] = risk

    skip  = (page - 1) * per_page
    total = await db.audit_logs.count_documents(query)
    cursor = db.audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(per_page)
    docs = [_serialize(doc) async for doc in cursor]

    return {
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "pages":    (total + per_page - 1) // per_page,
        "logs":     docs,
    }


@router.get("/verify/{data_hash}")
async def verify_by_hash(
    data_hash: str,
    current_user: dict = Depends(AUDIT_ROLES),
):
    """Verify a record by its SHA-256 data hash — for regulators."""
    db = get_database()
    doc = await db.trial_records.find_one({"blockchain.data_hash": data_hash})
    if not doc:
        raise HTTPException(status_code=404, detail="No record found with that hash.")

    from ..services.hash_service import hash_record
    recomputed = hash_record(doc["record"])
    hash_match = recomputed == data_hash

    return {
        "record_id":   str(doc["_id"]),
        "trial_id":    doc.get("trial_id"),
        "site_id":     doc.get("site_id"),
        "decision":    doc.get("ml_result", {}).get("decision"),
        "risk_level":  doc.get("ml_result", {}).get("risk_level"),
        "data_hash":   data_hash,
        "hash_match":  hash_match,
        "committed":   doc.get("blockchain", {}).get("committed", False),
        "submitted_at":doc.get("submitted_at", "").isoformat() if doc.get("submitted_at") else "",
    }
