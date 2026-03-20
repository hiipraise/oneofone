# app/services/prediction_service.py
"""
Prediction service.

SerpAPI call budget per prediction: ~3 calls (was ~9)
  - fetch_team_stats(home)    → 1 combined SerpAPI call (form+injuries+stats)
  - fetch_team_stats(away)    → 1 combined SerpAPI call
  - _fetch_h2h_venue(h, a)    → 1 combined SerpAPI call  [H2H + venue together]
  - fetch_betting_odds        → Odds API only (no SerpAPI)
  - ESPN calls                → free, no quota

The old code called fetch_injury_report + fetch_venue_stats again AFTER
fetch_team_stats already retrieved them internally — this is now fixed.
All data comes from team_stats (which uses the combined query internally).
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, List, Any

from app.config.database import get_db
from app.schemas.prediction_schema import PredictionRequest, PredictionOutput
from app.services.web_search_service import (
    fetch_team_stats,
    fetch_head_to_head,
    fetch_betting_odds,
    fetch_venue_stats,
    _fetch_combined_h2h_venue,   # internal — gives H2H + venue in one call
)
from app.services.market_service import compute_all_markets
from app.ml.prediction_engine import prediction_engine
from app.utils.logging_util import log_system_event

_PREDICTION_TTL_HOURS = 12

logger = logging.getLogger(__name__)


def _generate_match_id(home: str, away: str, sport: str, date: str = "") -> str:
    raw = f"{home.lower()}-{away.lower()}-{sport.lower()}-{date}"
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, raw))


async def create_prediction(request: PredictionRequest) -> PredictionOutput:
    db = get_db()
    match_date = request.match_date or datetime.utcnow().strftime("%Y-%m-%d")
    sport      = str(request.sport.value)
    match_id   = _generate_match_id(request.home_team, request.away_team, sport, match_date)

    existing = await db.predictions.find_one({"match_id": match_id, "deleted_at": None})
    if existing:
        ts = existing.get("timestamp")
        is_fresh = False
        if ts:
            try:
                if isinstance(ts, str):
                    ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                else:
                    ts_dt = ts
                # Ensure timezone-aware for comparison
                if ts_dt.tzinfo is None:
                    ts_dt = ts_dt.replace(tzinfo=timezone.utc)
                age_hours = (datetime.now(timezone.utc) - ts_dt).total_seconds() / 3600
                is_fresh  = age_hours < _PREDICTION_TTL_HOURS
                if not is_fresh:
                    logger.info(
                        f"Prediction {match_id} is {age_hours:.1f}h old "
                        f"(>{_PREDICTION_TTL_HOURS}h) — regenerating"
                    )
            except Exception as e:
                logger.warning(f"Could not parse prediction timestamp [{match_id}]: {e}")
                is_fresh = True  # parse failure → assume fresh, don't regenerate

        if is_fresh:
            existing.pop("_id", None)
            logger.info(f"Returning cached prediction for {match_id}")
            return PredictionOutput(**existing)

    logger.info(f"Generating: {request.home_team} vs {request.away_team} [{sport}]")

    # ── Data fetching — minimised SerpAPI calls ──────────────────────────────
    # fetch_team_stats: 1 SerpAPI call per team (combined form+injuries+stats)
    home_stats = fetch_team_stats(request.home_team, sport)
    away_stats = fetch_team_stats(request.away_team, sport)

    # One combined call for both H2H and venue (was 2 separate calls)
    h2h_venue = _fetch_combined_h2h_venue(request.home_team, request.away_team, sport)
    h2h   = h2h_venue["h2h"]
    venue = h2h_venue["venue"]

    # Odds API — no SerpAPI quota impact
    odds = fetch_betting_odds(request.home_team, request.away_team, sport)

    # ── Build feature vector ──────────────────────────────────────────────────
    # features_from_data now preserves raw goal averages (e.g. 1.40) without
    # clipping them to [0, 1], so xG and BTTS markets compute correctly.
    features = prediction_engine.features_from_data(
        home_stats, away_stats, h2h, odds, venue, sport=sport
    )
    result = prediction_engine.predict(features, sport=sport)

    # ── Extended markets ──────────────────────────────────────────────────────
    try:
        markets = compute_all_markets(features, sport)
    except Exception as e:
        logger.warning(f"Market calculation error: {e}")
        markets = None

    output = PredictionOutput(
        match_id=match_id,
        home_team=request.home_team,
        away_team=request.away_team,
        sport=sport,
        league=request.league,
        match_date=match_date,
        home_win_probability=result["home_win_probability"],
        draw_probability=result["draw_probability"],
        away_win_probability=result["away_win_probability"],
        confidence_score=result["confidence_score"],
        confidence_interval_low=result["confidence_interval_low"],
        confidence_interval_high=result["confidence_interval_high"],
        predicted_outcome=result["predicted_outcome"],
        model_version=result["model_version"],
        timestamp=datetime.now(timezone.utc),
        features_used=features,
        data_sources=[
            "ESPN Public API", "The Odds API",
            "SerpAPI Web Search (combined)", "Venue Statistics",
        ],
        extended_markets=markets,
    )

    doc = output.model_dump()
    doc["timestamp"]  = doc["timestamp"].isoformat()
    doc["deleted_at"] = None
    doc["match_date_indexed"] = match_date   # for TTL index if desired
    await db.predictions.replace_one({"match_id": match_id}, doc, upsert=True)

    snapshot = {
        "match_id": match_id, "sport": sport,
        "timestamp": datetime.utcnow().isoformat(),
        "match_date": match_date,
        "home_raw": home_stats, "away_raw": away_stats,
        "h2h_raw": h2h, "odds_raw": odds, "features": features,
    }
    await db.feature_snapshots.replace_one({"match_id": match_id}, snapshot, upsert=True)

    await log_system_event("prediction_created", f"Prediction generated for {match_id}", "INFO")
    return output


async def get_predictions(
    sport: Optional[str] = None,
    limit: int = 50,
    include_deleted: bool = False,
) -> List[Dict]:
    db = get_db()
    query: Dict = {}
    if sport:
        query["sport"] = sport
    if not include_deleted:
        query["deleted_at"] = None
    cursor = db.predictions.find(query).sort("timestamp", -1).limit(limit)
    results = []
    async for doc in cursor:
        doc.pop("_id", None)
        results.append(doc)
    return results


async def get_prediction_by_id(match_id: str) -> Optional[Dict]:
    db = get_db()
    doc = await db.predictions.find_one({"match_id": match_id})
    if doc:
        doc.pop("_id", None)
    return doc


async def soft_delete_prediction(match_id: str) -> bool:
    db = get_db()
    result = await db.predictions.update_one(
        {"match_id": match_id},
        {"$set": {"deleted_at": datetime.utcnow().isoformat()}},
    )
    return result.matched_count > 0


async def restore_prediction(match_id: str) -> bool:
    db = get_db()
    result = await db.predictions.update_one(
        {"match_id": match_id},
        {"$set": {"deleted_at": None}},
    )
    return result.matched_count > 0


async def save_actual_result(
    match_id: str, home_score: int, away_score: int,
    actual_outcome: str, match_date: str,
):
    db = get_db()
    if not actual_outcome:
        actual_outcome = (
            "home_win" if home_score > away_score
            else "away_win" if away_score > home_score
            else "draw"
        )
    doc = {
        "match_id": match_id, "home_score": home_score, "away_score": away_score,
        "actual_outcome": actual_outcome, "match_date": match_date,
        "recorded_at": datetime.utcnow().isoformat(),
    }
    await db.actual_results.replace_one({"match_id": match_id}, doc, upsert=True)
    await trigger_learning_update()
    return doc


async def trigger_learning_update():
    db = get_db()
    actual_results: Dict[str, str] = {}
    async for doc in db.actual_results.find({}):
        actual_results[doc["match_id"]] = doc.get("actual_outcome", "")

    if not actual_results:
        return

    sport_records: Dict[str, List[Dict]] = {}
    async for pred in db.predictions.find({
        "match_id": {"$in": list(actual_results.keys())},
        "deleted_at": None,
    }):
        mid    = pred.get("match_id")
        actual = actual_results.get(mid)
        if not actual:
            continue
        sport = pred.get("sport", "soccer")
        snap  = await db.feature_snapshots.find_one({"match_id": mid})
        features = snap.get("features", pred.get("features_used", {})) if snap else pred.get("features_used", {})
        sport_records.setdefault(sport, []).append({
            "features": features,
            "actual_outcome": actual,
            "predicted_outcome": pred.get("predicted_outcome"),
            "home_win_probability": pred.get("home_win_probability"),
            "match_date": snap.get("match_date", "") if snap else "",
        })

    for sport, records in sport_records.items():
        retrain_result = prediction_engine.retrain(records, sport=sport)
        metrics        = prediction_engine.evaluate(records, sport=sport)
        if metrics:
            await db.model_metrics.insert_one({
                "model_version": prediction_engine.model_version,
                "sport": sport,
                "date": datetime.utcnow().isoformat(),
                **{k: metrics.get(k, 0) for k in (
                    "brier_score", "log_loss", "calibration_error",
                    "accuracy", "total_predictions", "ml_weight", "n_training_samples"
                )},
                "retrain_result": retrain_result,
            })
            logger.info(f"[{sport}] Metrics saved: {metrics}")


async def generate_prediction(
    home_team:  str,
    away_team:  str,
    sport:      str,
    match_date: str | None = None,
    league:     str | None = None,
) -> "PredictionOutput":
    """
    Keyword-arg wrapper called by the daily scheduler.
    Builds a PredictionRequest and delegates to create_prediction().
    """
    from app.schemas.prediction_schema import SportType

    try:
        sport_enum = SportType(sport.lower())
    except ValueError:
        sport_enum = SportType.SOCCER  # safe default

    request = PredictionRequest(
        home_team  = home_team,
        away_team  = away_team,
        sport      = sport_enum,
        match_date = match_date,
        league     = league,
    )
    return await create_prediction(request)