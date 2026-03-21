# app/config/database.py
import logging
from contextvars import ContextVar
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from app.config.settings import settings

logger = logging.getLogger(__name__)

client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None

# Scoped override — set only inside the scheduler's isolated event loop.
# FastAPI's event loop never sees this value; it always reads None → falls
# through to the global `db` bound to uvicorn's loop.
_db_override: ContextVar[Optional[AsyncIOMotorDatabase]] = ContextVar(
    "_db_override", default=None
)


async def connect_db():
    global client, db
    logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI}")
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB]
    await create_indexes()
    logger.info("MongoDB connected and indexes created")


async def disconnect_db():
    global client
    if client:
        client.close()
        logger.info("MongoDB disconnected")


async def create_indexes():
    if db is None:
        raise RuntimeError("Database connection has not been established")
    await db.predictions.create_index([("match_id", ASCENDING)], unique=True)
    await db.predictions.create_index([("date", DESCENDING)])
    await db.predictions.create_index([("sport", ASCENDING)])
    await db.predictions.create_index([("model_version", ASCENDING)])

    await db.actual_results.create_index([("match_id", ASCENDING)], unique=True)
    await db.actual_results.create_index([("date", DESCENDING)])

    await db.model_metrics.create_index([("date", DESCENDING)])
    await db.model_metrics.create_index([("model_version", ASCENDING)])

    await db.feature_snapshots.create_index([("match_id", ASCENDING)])
    await db.feature_snapshots.create_index([("timestamp", DESCENDING)])

    await db.system_logs.create_index([("timestamp", DESCENDING)])
    await db.system_logs.create_index([("level", ASCENDING)])


def get_db() -> Optional[AsyncIOMotorDatabase]:
    """
    Returns the Motor database for the current execution context.

    - Scheduler threads:  returns the per-run client set via _db_override,
                          which is bound to their own event loop.
    - FastAPI handlers:   _db_override is None (ContextVar default), so the
                          global `db` bound to uvicorn's loop is returned.
    """
    override = _db_override.get()
    return override if override is not None else db