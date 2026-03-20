# app/routes/metrics.py
import logging
from fastapi import APIRouter, Query
from app.config.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def get_metrics(limit: int = Query(30, ge=1, le=200)):
    db = get_db()
    results = []
    async for doc in db.model_metrics.find({}).sort("date", -1).limit(limit):
        doc.pop("_id", None)
        results.append(doc)
    return results


@router.get("/latest")
async def get_latest_metrics():
    db = get_db()
    doc = await db.model_metrics.find_one({}, sort=[("date", -1)])
    if doc:
        doc.pop("_id", None)
    return doc or {}


@router.get("/summary")
async def get_metrics_summary():
    from app.ml.prediction_engine import prediction_engine, FEATURE_KEYS
    db = get_db()

    sports = list(FEATURE_KEYS.keys())   # always ["soccer", "basketball", "tennis"]

    # ── Resolved predictions lookup ──────────────────────────────────────────
    actual_results: dict[str, str] = {}
    async for doc in db.actual_results.find({}):
        actual_results[doc["match_id"]] = doc.get("actual_outcome")

    # ── Build evaluation records ─────────────────────────────────────────────
    records = []
    # Count resolved predictions per sport directly from DB
    # (engine.n_training_samples only gets written when retrain() actually runs,
    #  so it stays 0 until the 30-sample threshold is crossed)
    db_sport_counts: dict[str, int] = {s: 0 for s in sports}

    if actual_results:
        async for pred in db.predictions.find(
            {"match_id": {"$in": list(actual_results.keys())}, "deleted_at": None}
        ):
            mid   = pred.get("match_id")
            sport = pred.get("sport", "soccer")
            if sport in db_sport_counts:
                db_sport_counts[sport] += 1
            records.append({
                "home_win_probability": pred.get("home_win_probability", 0.5),
                "actual_outcome":       actual_results.get(mid),
            })

    try:
        metrics = prediction_engine.evaluate(records) if records else {}
    except Exception as e:
        logger.error(f"evaluate() failed in summary: {e}")
        metrics = {}

    total_preds   = await db.predictions.count_documents({})
    total_results = await db.actual_results.count_documents({})

    # n_training_samples: prefer in-memory value (set after a successful retrain),
    # fall back to the live DB count so we always show a non-zero number.
    n_training = {
        s: max(
            int(prediction_engine.n_training_samples.get(s, 0)),
            db_sport_counts.get(s, 0),
        )
        for s in sports
    }

    is_trained = {s: bool(prediction_engine.is_trained.get(s, False)) for s in sports}

    try:
        ml_weights = {s: round(prediction_engine._ml_weight(s), 3) for s in sports}
    except Exception as e:
        logger.error(f"_ml_weight() failed: {e}")
        ml_weights = {s: 0.0 for s in sports}

    return {
        "performance_metrics":  metrics,
        "total_predictions":    total_preds,
        "total_resolved":       total_results,
        "model_version":        prediction_engine.model_version,
        "is_trained":           is_trained,
        "n_training_samples":   n_training,
        "ml_weights":           ml_weights,
    }

@router.get("/confidence-history")
async def get_confidence_history(days: int = Query(30, ge=7, le=180)):
    """
    Returns daily avg/min/max confidence score per sport over the last `days` days.
    Reads directly from the predictions collection — no extra storage needed.
    """
    from datetime import timedelta
    db = get_db()

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")

    pipeline = [
        {
            "$match": {
                "deleted_at": None,
                "match_date":  {"$gte": cutoff},
                "confidence_score": {"$exists": True, "$ne": None},
            }
        },
        {
            "$group": {
                "_id":   {"date": "$match_date", "sport": "$sport"},
                "avg":   {"$avg": "$confidence_score"},
                "min":   {"$min": "$confidence_score"},
                "max":   {"$max": "$confidence_score"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id.date": 1}},
    ]

    rows = []
    async for doc in db.predictions.aggregate(pipeline):
        rows.append({
            "date":  doc["_id"]["date"],
            "sport": doc["_id"]["sport"],
            "avg":   round(doc["avg"], 4),
            "min":   round(doc["min"], 4),
            "max":   round(doc["max"], 4),
            "count": doc["count"],
        })
    return rows

# ── Quota ─────────────────────────────────────────────────────────────────────

@router.get("/quota")
async def get_serpapi_quota():
    """Return SerpAPI monthly quota — sourced from MongoDB, not in-memory."""
    from app.services.quota_service import get_persisted_quota
    return await get_persisted_quota()


@router.post("/quota/increment")
async def increment_quota(calls: int = 1):
    """
    Increment the persisted SerpAPI usage counter.
    Call this from web_search_service after every SerpAPI request instead of
    tracking usage in-memory.
    """
    from app.services.web_search_service import get_serpapi_usage
    db = get_db()

    live      = get_serpapi_usage()
    month_key = live.get("month", "unknown")
    doc_id    = f"quota:{month_key}"
    budget    = int(live.get("budget", 200))

    existing     = await db.serpapi_quota.find_one({"_id": doc_id})
    current_used = existing.get("used", 0) if existing else 0
    new_used     = current_used + calls
    remaining    = max(budget - new_used, 0)

    await db.serpapi_quota.replace_one(
        {"_id": doc_id},
        {"_id": doc_id, "month": month_key, "used": new_used,
         "budget": budget, "remaining": remaining},
        upsert=True,
    )
    return {"used": new_used, "budget": budget, "remaining": remaining}