from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from ..database import get_database
from ..auth_utils import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    db = get_database()

    # Role-based filtering: investigator sees only their site
    match_filter = {}
    if current_user.get("role") == "investigator":
        match_filter["site_id"] = current_user.get("site_id", "")

    # Totals
    total      = await db.trial_records.count_documents(match_filter)
    authentic  = await db.trial_records.count_documents({**match_filter, "ml_result.decision": "AUTHENTIC"})
    manipulated = await db.trial_records.count_documents({**match_filter, "ml_result.decision": "MANIPULATED"})
    pending    = await db.trial_records.count_documents({**match_filter, "status": "PENDING_REVIEW"})

    auth_pct   = round(authentic  / total * 100, 1) if total else 0
    manip_pct  = round(manipulated / total * 100, 1) if total else 0

    # Daily data — last 14 days
    daily_data = []
    for i in range(13, -1, -1):
        day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        day_end   = day_start + timedelta(days=1)
        day_filter = {**match_filter, "submitted_at": {"$gte": day_start, "$lt": day_end}}
        auth_day  = await db.trial_records.count_documents({**day_filter, "ml_result.decision": "AUTHENTIC"})
        manip_day = await db.trial_records.count_documents({**day_filter, "ml_result.decision": "MANIPULATED"})
        daily_data.append({
            "date":       day_start.strftime("%b %d"),
            "authentic":  auth_day,
            "flagged":    manip_day,
        })

    # Per-site stats
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id":        "$site_id",
            "total":      {"$sum": 1},
            "authentic":  {"$sum": {"$cond": [{"$eq": ["$ml_result.decision", "AUTHENTIC"]}, 1, 0]}},
            "manipulated":{"$sum": {"$cond": [{"$eq": ["$ml_result.decision", "MANIPULATED"]}, 1, 0]}},
        }},
        {"$project": {
            "site_id":    "$_id",
            "total":      1,
            "authentic":  1,
            "manipulated":1,
            "integrity_score": {
                "$round": [{"$multiply": [{"$divide": ["$authentic", "$total"]}, 100]}, 1]
            },
        }},
    ]
    site_cursor = db.trial_records.aggregate(pipeline)
    site_stats = [doc async for doc in site_cursor]
    for s in site_stats:
        s.pop("_id", None)

    # Recent alerts (last 5 HIGH/MEDIUM risk)
    alert_cursor = db.trial_records.find(
        {**match_filter, "ml_result.risk_level": {"$in": ["HIGH", "MEDIUM"]}},
        {"_id": 1, "site_id": 1, "submitted_at": 1, "ml_result.risk_level": 1, "blockchain.data_hash": 1}
    ).sort("submitted_at", -1).limit(5)

    recent_alerts = []
    async for doc in alert_cursor:
        recent_alerts.append({
            "record_id":  str(doc["_id"]),
            "site_id":    doc.get("site_id"),
            "timestamp":  doc.get("submitted_at", "").isoformat() if doc.get("submitted_at") else "",
            "risk_level": doc.get("ml_result", {}).get("risk_level"),
            "hash_preview": (doc.get("blockchain", {}).get("data_hash", "")[:16] + "..."),
        })

    return {
        "total":           total,
        "authentic":       authentic,
        "manipulated":     manipulated,
        "pending":         pending,
        "authentic_pct":   auth_pct,
        "manipulated_pct": manip_pct,
        "daily_data":      daily_data,
        "site_stats":      site_stats,
        "recent_alerts":   recent_alerts,
    }
