from fastapi import APIRouter, Depends, Query
from bson import ObjectId
from ..database import get_database
from ..auth_utils import get_current_user

router = APIRouter(prefix="/records", tags=["Records"])


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    if "submitted_by" in doc and isinstance(doc["submitted_by"], ObjectId):
        doc["submitted_by"] = str(doc["submitted_by"])
    if "submitted_at" in doc:
        doc["submitted_at"] = doc["submitted_at"].isoformat()
    return doc


@router.get("")
async def list_records(
    page:     int   = Query(1, ge=1),
    limit:    int   = Query(20, ge=1, le=100),
    decision: str   = Query("ALL"),  # ALL | AUTHENTIC | MANIPULATED
    risk:     str   = Query("ALL"),  # ALL | HIGH | MEDIUM | LOW
    site_id:  str   = Query(None),
    current_user: dict = Depends(get_current_user),
):
    db = get_database()

    # Role-based filtering
    query: dict = {}
    role = current_user.get("role")
    if role == "investigator":
        query["site_id"] = current_user.get("site_id")

    if decision and decision != "ALL":
        query["ml_result.decision"] = decision
    if risk and risk != "ALL":
        query["ml_result.risk_level"] = risk
    if site_id and role != "investigator":
        query["site_id"] = site_id

    skip = (page - 1) * limit
    total = await db.trial_records.count_documents(query)

    cursor = db.trial_records.find(query).sort("submitted_at", -1).skip(skip).limit(limit)
    docs = [_serialize(doc) async for doc in cursor]

    return {
        "total":    total,
        "page":     page,
        "limit":    limit,
        "pages":    (total + limit - 1) // limit,
        "records":  docs,
    }


@router.get("/{record_id}")
async def get_record(
    record_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    try:
        oid = ObjectId(record_id)
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid record ID format")

    doc = await db.trial_records.find_one({"_id": oid})
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Record not found")

    # Investigator can only view own site records
    role = current_user.get("role")
    if role == "investigator" and doc.get("site_id") != current_user.get("site_id"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied to this record")

    return _serialize(doc)
