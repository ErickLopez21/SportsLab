from typing import Optional
import nflreadpy as nfl
from starlette.concurrency import run_in_threadpool
import polars as pl


async def get_team_home_away_splits_service(team: str, season: Optional[int] = None):
    team = team.upper()
    season_val = int(season) if season else int(nfl.get_current_season())

    def _load():
        return nfl.load_schedules([season_val])

    schedules = await run_in_threadpool(_load)
    cols = set(schedules.columns)

    # Only regular-season games that have been played (scores present)
    reg_mask = (pl.col("game_type") == "REG") if "game_type" in cols else pl.lit(True)
    if "home_score" in cols and "away_score" in cols:
        played_mask = pl.col("home_score").is_not_null() & pl.col("away_score").is_not_null()
    elif "result" in cols:
        played_mask = pl.col("result").is_not_null()
    else:
        played_mask = pl.lit(False)

    df = schedules.filter(reg_mask & played_mask)

    # Build flags on filtered set
    is_home = (pl.col("home_team") == team) if "home_team" in cols else pl.lit(False)
    is_away = (pl.col("away_team") == team) if "away_team" in cols else pl.lit(False)

    df_home = df.filter(is_home)
    df_away = df.filter(is_away)

    def _wins_losses(df: pl.DataFrame, side: str):
        if df.height == 0:
            return 0, 0
        if "home_score" in cols and "away_score" in cols:
            if side == "home":
                wins = int((df["home_score"] > df["away_score"]).sum())
            else:
                wins = int((df["away_score"] > df["home_score"]).sum())
            losses = int(df.height - wins)
            return wins, losses
        if "result" in cols:
            # result > 0 => home win, < 0 => home loss
            if side == "home":
                wins = int((df["result"] > 0).sum())
                losses = int((df["result"] < 0).sum())
                return wins, losses
            else:
                wins = int((df["result"] < 0).sum())
                losses = int((df["result"] > 0).sum())
                return wins, losses
        return 0, 0

    def _points(df: pl.DataFrame, side: str):
        if df.height == 0 or not ("home_score" in cols and "away_score" in cols):
            return 0, 0, 0.0
        if side == "home":
            pf = int(df["home_score"].sum())
            pa = int(df["away_score"].sum())
        else:
            pf = int(df["away_score"].sum())
            pa = int(df["home_score"].sum())
        avg = round(pf / df.height, 1) if df.height else 0.0
        return pf, pa, avg

    home_wins, home_losses = _wins_losses(df_home, "home")
    away_wins, away_losses = _wins_losses(df_away, "away")
    home_pf, home_pa, home_avg = _points(df_home, "home")
    away_pf, away_pa, away_avg = _points(df_away, "away")

    return {
        "status": "success",
        "team": team,
        "season": season_val,
        "home": {
            "games": int(df_home.height),
            "wins": home_wins,
            "losses": home_losses,
            "points_for": home_pf,
            "points_against": home_pa,
            "avg_points_for": home_avg,
        },
        "away": {
            "games": int(df_away.height),
            "wins": away_wins,
            "losses": away_losses,
            "points_for": away_pf,
            "points_against": away_pa,
            "avg_points_for": away_avg,
        },
    }


