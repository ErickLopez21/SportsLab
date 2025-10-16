from typing import Optional, Dict, List
import nflreadpy as nfl
from starlette.concurrency import run_in_threadpool
import polars as pl


TEAM_TO_CONFERENCE: Dict[str, str] = {
    # AFC
    "BUF": "AFC", "MIA": "AFC", "NE": "AFC", "NYJ": "AFC",
    "BAL": "AFC", "CIN": "AFC", "CLE": "AFC", "PIT": "AFC",
    "HOU": "AFC", "IND": "AFC", "JAX": "AFC", "TEN": "AFC",
    "DEN": "AFC", "KC": "AFC", "LV": "AFC", "LAC": "AFC",
    # NFC
    "DAL": "NFC", "NYG": "NFC", "PHI": "NFC", "WAS": "NFC",
    "CHI": "NFC", "DET": "NFC", "GB": "NFC", "MIN": "NFC",
    "ATL": "NFC", "CAR": "NFC", "NO": "NFC", "TB": "NFC",
    "ARI": "NFC", "LAR": "NFC", "SF": "NFC", "SEA": "NFC",
}

TEAM_TO_DIVISION: Dict[str, str] = {
    # AFC East
    "BUF": "AFC East", "MIA": "AFC East", "NE": "AFC East", "NYJ": "AFC East",
    # AFC North
    "BAL": "AFC North", "CIN": "AFC North", "CLE": "AFC North", "PIT": "AFC North",
    # AFC South
    "HOU": "AFC South", "IND": "AFC South", "JAX": "AFC South", "TEN": "AFC South",
    # AFC West
    "DEN": "AFC West", "KC": "AFC West", "LV": "AFC West", "LAC": "AFC West",
    # NFC East
    "DAL": "NFC East", "NYG": "NFC East", "PHI": "NFC East", "WAS": "NFC East",
    # NFC North
    "CHI": "NFC North", "DET": "NFC North", "GB": "NFC North", "MIN": "NFC North",
    # NFC South
    "ATL": "NFC South", "CAR": "NFC South", "NO": "NFC South", "TB": "NFC South",
    # NFC West
    "ARI": "NFC West", "LAR": "NFC West", "SF": "NFC West", "SEA": "NFC West",
}


def _ensure_int(val) -> int:
    try:
        return int(val) if val is not None else 0
    except Exception:
        return 0


async def get_standings_service(season: Optional[int] = None) -> dict:
    season_val = int(season) if season else int(nfl.get_current_season())

    def _load():
        return nfl.load_schedules([season_val])

    schedules = await run_in_threadpool(_load)
    cols = set(schedules.columns)

    # Keep only regular season games that have been played (scores available)
    if "game_type" in cols:
        reg_mask = pl.col("game_type") == "REG"
    elif "season_type" in cols:
        reg_mask = pl.col("season_type") == "REG"
    else:
        reg_mask = pl.lit(True)

    if "home_score" in cols and "away_score" in cols:
        played_mask = pl.col("home_score").is_not_null() & pl.col("away_score").is_not_null()
    elif "result" in cols:
        played_mask = pl.col("result").is_not_null()
    else:
        played_mask = pl.lit(False)

    df = schedules.filter(reg_mask & played_mask)

    # Select minimum columns for processing
    sel_cols: List[pl.Expr] = []
    for c in ["home_team", "away_team", "home_score", "away_score"]:
        if c in df.columns:
            sel_cols.append(pl.col(c))
        else:
            sel_cols.append(pl.lit(None).alias(c))

    games = df.select(sel_cols).to_dicts()

    # Aggregate team records
    records: Dict[str, Dict[str, int | float | str]] = {}

    def ensure_team(team: str):
        if team not in records:
            records[team] = {
                "team": team,
                "w": 0, "l": 0, "t": 0,
                "pf": 0, "pa": 0,
            }

    for g in games:
        home = str(g.get("home_team") or "").upper()
        away = str(g.get("away_team") or "").upper()
        hs = _ensure_int(g.get("home_score"))
        as_ = _ensure_int(g.get("away_score"))
        if not home or not away:
            continue
        ensure_team(home)
        ensure_team(away)

        # points for/against
        records[home]["pf"] += hs
        records[home]["pa"] += as_
        records[away]["pf"] += as_
        records[away]["pa"] += hs

        # outcome
        if hs > as_:
            records[home]["w"] += 1
            records[away]["l"] += 1
        elif hs < as_:
            records[away]["w"] += 1
            records[home]["l"] += 1
        else:
            records[home]["t"] += 1
            records[away]["t"] += 1

    # finalize metrics and split by conference
    afc: List[dict] = []
    nfc: List[dict] = []
    for team, r in records.items():
        gp = r["w"] + r["l"] + r["t"]
        pct = (r["w"] + 0.5 * r["t"]) / gp if gp > 0 else 0.0
        diff = r["pf"] - r["pa"]
        pf_pg = (r["pf"] / gp) if gp > 0 else 0.0
        pa_pg = (r["pa"] / gp) if gp > 0 else 0.0
        obj = {
            "team": team,
            "w": r["w"],
            "l": r["l"],
            "t": r["t"],
            "gp": gp,
            "pct": round(pct, 3),
            "pf": r["pf"],
            "pa": r["pa"],
            "pf_pg": round(pf_pg, 1),
            "pa_pg": round(pa_pg, 1),
            "diff": diff,
            "diff_pg": round((diff / gp) if gp > 0 else 0.0, 1),
            "conference": TEAM_TO_CONFERENCE.get(team),
            "division": TEAM_TO_DIVISION.get(team),
        }
        (afc if obj["conference"] == "AFC" else nfc).append(obj)

    def sorter(x):
        # sort by pct desc, diff desc, team asc
        return (-x["pct"], -x["diff"], x["team"])

    afc.sort(key=sorter)
    nfc.sort(key=sorter)

    return {
        "status": "success",
        "season": season_val,
        "conferences": {
            "AFC": afc,
            "NFC": nfc,
        },
    }


