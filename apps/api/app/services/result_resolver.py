# app/services/result_resolver.py
"""
Auto-resolution service.

Fetches completed scores from the Odds API, matches them against stored
predictions by sport + date + fuzzy team name, then calls save_actual_result
so the ML learning pipeline triggers automatically.

Called by the daily scheduler — never touches FastAPI's Motor client directly.
"""
import logging
import re
import time
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple

import requests

from app.config.settings import settings

logger = logging.getLogger(__name__)

# ── Sport key mapping (same as scheduler) ─────────────────────────────────────
_ODDS_SPORT_KEYS = {
    "soccer":     "soccer_epl",
    "basketball": "basketball_nba",
}

# How many past days to look back for completed scores
_DAYS_FROM = 2


# ── Odds API score fetcher ────────────────────────────────────────────────────

def _fetch_completed_scores(sport: str) -> List[Dict]:
    """
    Fetch recently completed games from the Odds API scores endpoint.
    Returns list of dicts: {home_team, away_team, home_score, away_score, date}
    """
    if not settings.ODDS_API_KEY:
        return []

    sport_key = _ODDS_SPORT_KEYS.get(sport, "soccer_epl")

    for attempt in range(3):
        try:
            resp = requests.get(
                f"https://api.the-odds-api.com/v4/sports/{sport_key}/scores",
                params={
                    "apiKey":   settings.ODDS_API_KEY,
                    "daysFrom": _DAYS_FROM,
                },
                timeout=15,
            )

            if resp.status_code == 429:
                wait = [5.0, 15.0][min(attempt, 1)]
                logger.warning(
                    f"[resolver] Odds API 429 [{sport}] — "
                    f"attempt {attempt + 1}/3, retrying in {wait}s"
                )
                time.sleep(wait)
                continue

            if resp.status_code != 200:
                logger.warning(f"[resolver] Odds API scores {resp.status_code} [{sport}]")
                return []

            completed = []
            for game in resp.json():
                if not game.get("completed"):
                    continue

                scores = game.get("scores") or []
                if len(scores) < 2:
                    continue

                # Odds API: scores[0] = home team, scores[1] = away team
                # Each score item: {"name": "Team", "score": "3"}
                home_name  = game.get("home_team", "")
                away_name  = game.get("away_team", "")

                # Match score items to home/away by name
                home_score_val = None
                away_score_val = None
                for s in scores:
                    name = s.get("name", "")
                    val  = s.get("score")
                    if val is None:
                        continue
                    try:
                        val = int(val)
                    except (ValueError, TypeError):
                        continue
                    if _names_match(name, home_name):
                        home_score_val = val
                    elif _names_match(name, away_name):
                        away_score_val = val

                if home_score_val is None or away_score_val is None:
                    continue

                # Parse date from commence_time
                commence = game.get("commence_time", "")
                try:
                    match_date = commence[:10]  # "YYYY-MM-DD"
                except Exception:
                    continue

                completed.append({
                    "home_team":   home_name,
                    "away_team":   away_name,
                    "home_score":  home_score_val,
                    "away_score":  away_score_val,
                    "match_date":  match_date,
                    "sport":       sport,
                })

            return completed

        except requests.exceptions.Timeout:
            wait = [5.0, 15.0][min(attempt, 1)]
            logger.warning(
                f"[resolver] Odds API timeout [{sport}] — "
                f"attempt {attempt + 1}/3, retrying in {wait}s"
            )
            time.sleep(wait)

        except Exception as e:
            logger.error(f"[resolver] Odds API scores error [{sport}]: {e}")
            return []

    return []


# ── Team name fuzzy matching ──────────────────────────────────────────────────

_STRIP_WORDS = frozenset([
    "fc", "cf", "sc", "ac", "rc", "af", "afc", "fk", "sk", "bk",
    "united", "city", "town", "athletic", "athletico", "atletico",
    "sporting", "real", "club", "de", "the",
])


def _normalise(name: str) -> List[str]:
    """Return significant lowercase words from a team name."""
    words = re.sub(r"[^a-z0-9\s]", "", name.lower()).split()
    return [w for w in words if len(w) >= 4 and w not in _STRIP_WORDS]


def _names_match(a: str, b: str) -> bool:
    """True if the two team name strings are plausibly the same team."""
    wa = _normalise(a)
    wb = _normalise(b)
    if not wa or not wb:
        return a.lower().strip() == b.lower().strip()
    return any(w in wb for w in wa) or any(w in wa for w in wb)


def _find_matching_prediction(
    completed: Dict,
    stored_predictions: List[Dict],
) -> Optional[Dict]:
    """
    Find a stored prediction that matches a completed Odds API game.
    Matches on: sport, match_date (±1 day tolerance), fuzzy team names.
    """
    target_date = completed["match_date"]
    target_sport = completed["sport"]

    # Allow ±1 day to handle timezone edge cases
    try:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        candidate_dates = {
            target_date,
            (dt - timedelta(days=1)).strftime("%Y-%m-%d"),
            (dt + timedelta(days=1)).strftime("%Y-%m-%d"),
        }
    except ValueError:
        candidate_dates = {target_date}

    for pred in stored_predictions:
        if pred.get("sport") != target_sport:
            continue
        if pred.get("match_date") not in candidate_dates:
            continue
        if (
            _names_match(completed["home_team"], pred.get("home_team", "")) and
            _names_match(completed["away_team"], pred.get("away_team", ""))
        ):
            return pred

    return None


def _derive_outcome(home_score: int, away_score: int, sport: str) -> str:
    if home_score > away_score:
        return "home_win"
    if away_score > home_score:
        return "away_win"
    return "draw"


# ── Main async resolver ───────────────────────────────────────────────────────

async def resolve_results() -> Dict:
    """
    Main entry point. Fetches completed scores, matches to predictions,
    and persists results. Returns a summary dict for logging.
    """
    from app.config.database import get_db
    from app.services.prediction_service import save_actual_result

    db = get_db()

    # Pre-load predictions from the last 3 days to avoid per-game DB queries
    cutoff = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%d")
    stored: List[Dict] = []
    async for pred in db.predictions.find(
        {"match_date": {"$gte": cutoff}, "deleted_at": None},
        {"match_id": 1, "home_team": 1, "away_team": 1, "sport": 1, "match_date": 1}
    ):
        pred.pop("_id", None)
        stored.append(pred)

    if not stored:
        logger.info("[resolver] No recent predictions found — nothing to resolve")
        return {"resolved": 0, "skipped": 0, "errors": 0}

    # Pre-load already-resolved match IDs to avoid duplicate writes
    already_resolved: set = set()
    async for doc in db.actual_results.find({}, {"match_id": 1}):
        already_resolved.add(doc["match_id"])

    resolved = 0
    skipped  = 0
    errors   = 0

    for sport in ["soccer", "basketball"]:
        logger.info(f"[resolver] Fetching completed {sport} scores…")
        completed_games = _fetch_completed_scores(sport)

        if not completed_games:
            logger.info(f"[resolver] No completed {sport} games found")
            continue

        logger.info(f"[resolver] {len(completed_games)} completed {sport} games to process")

        for game in completed_games:
            try:
                match = _find_matching_prediction(game, stored)
                if not match:
                    logger.debug(
                        f"[resolver] No prediction found for "
                        f"{game['home_team']} vs {game['away_team']} [{sport}]"
                    )
                    skipped += 1
                    continue

                match_id = match["match_id"]

                if match_id in already_resolved:
                    logger.debug(f"[resolver] Already resolved: {match_id}")
                    skipped += 1
                    continue

                outcome = _derive_outcome(game["home_score"], game["away_score"], sport)

                await save_actual_result(
                    match_id      = match_id,
                    home_score    = game["home_score"],
                    away_score    = game["away_score"],
                    actual_outcome= outcome,
                    match_date    = game["match_date"],
                )

                already_resolved.add(match_id)
                resolved += 1
                logger.info(
                    f"[resolver] Resolved: {game['home_team']} {game['home_score']}–"
                    f"{game['away_score']} {game['away_team']} → {outcome}"
                )

            except Exception as e:
                errors += 1
                logger.error(
                    f"[resolver] Failed to resolve "
                    f"{game.get('home_team')} vs {game.get('away_team')}: {e}"
                )

    return {"resolved": resolved, "skipped": skipped, "errors": errors}