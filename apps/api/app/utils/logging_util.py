# app/utils/logging_util.py
import logging
from datetime import datetime
from app.config.database import get_db

logger = logging.getLogger(__name__)


async def log_system_event(source: str, message: str, level: str = "INFO"):
    try:
        db = get_db()
        if db is None:
            return
        doc = {
            "source": source,
            "message": message,
            "level": level,
            "timestamp": datetime.utcnow().isoformat(),
        }
        await db.system_logs.insert_one(doc)
    except Exception as e:
        logger.warning(f"Failed to write system log: {e}")
