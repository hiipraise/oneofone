# app/config/database.py
import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from app.config.settings import settings

logger = logging.getLogger(__name__)

client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None


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
    # make sure the global `db` is set before using it
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
    return db
