# app/services/quota_service.py
import logging
from datetime import datetime, timezone
from app.config.settings import settings

logger = logging.getLogger(__name__)


async def record_serpapi_calls(n: int = 1) -> None:
    """Increment the persistent SerpAPI usage counter by `n`."""
    try:
        from app.config.database import get_db
        db = get_db()

        month_key = datetime.now(timezone.utc).strftime("%Y-%m")
        doc_id    = f"quota:{month_key}"

        await db.serpapi_quota.update_one(
            {"_id": doc_id},
            {
                "$inc": {"used": n},
                "$setOnInsert": {"month": month_key, "budget": settings.SERPAPI_MONTHLY_BUDGET},
            },
            upsert=True,
        )
    except Exception as e:
        logger.warning(f"quota tracking failed: {e}")


async def get_persisted_quota() -> dict:
    """Read the current month's quota doc from MongoDB."""
    try:
        from app.config.database import get_db
        db = get_db()

        month_key = datetime.now(timezone.utc).strftime("%Y-%m")
        doc = await db.serpapi_quota.find_one({"_id": f"quota:{month_key}"})
        if doc:
            used   = int(doc.get("used", 0))
            budget = int(doc.get("budget", settings.SERPAPI_MONTHLY_BUDGET))
            return {
                "month":     month_key,
                "used":      used,
                "budget":    budget,
                "remaining": max(budget - used, 0),
            }
    except Exception as e:
        logger.warning(f"quota read failed: {e}")

    return {
        "month":     datetime.now(timezone.utc).strftime("%Y-%m"),
        "used":      0,
        "budget":    settings.SERPAPI_MONTHLY_BUDGET,
        "remaining": settings.SERPAPI_MONTHLY_BUDGET,
    }