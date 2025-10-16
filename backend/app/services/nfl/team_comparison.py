from typing import Optional
import nflreadpy as nfl
from starlette.concurrency import run_in_threadpool
import polars as pl


async def get_team_vs_team_service(team_a: str, team_b: str, season: Optional[int] = None):
    """
    Compare two teams: overall season stats and last 5 head-to-head games.
    """
    current_season = nfl.get_current_season()
    season_val = int(season) if season else int(current_season)

    def _load_pbp():
        return nfl.load_pbp([season_val])

    def _load_schedules():
        return nfl.load_schedules([season_val])

    pbp, schedules = await run_in_threadpool(lambda: (_load_pbp(), _load_schedules()))

    team_a_upper = team_a.upper()
    team_b_upper = team_b.upper()

    # Filter regular season games
    if "season_type" in pbp.columns:
        pbp = pbp.filter(pl.col("season_type") == "REG")
    elif "game_type" in pbp.columns:
        pbp = pbp.filter(pl.col("game_type") == "REG")

    # Team A season stats (as offense)
    team_a_off = pbp.filter(pl.col("posteam") == team_a_upper)
    team_a_off_pd = team_a_off.to_pandas() if team_a_off.height > 0 else None

    team_a_points = int(team_a_off_pd.get("posteam_score_post", 0).max()) if team_a_off_pd is not None and "posteam_score_post" in team_a_off_pd else 0
    team_a_plays = int(team_a_off.height)
    team_a_games = int(team_a_off_pd["game_id"].nunique()) if team_a_off_pd is not None and "game_id" in team_a_off_pd else 0
    team_a_pass_yards = int(team_a_off_pd.get("passing_yards", 0).sum()) if team_a_off_pd is not None and "passing_yards" in team_a_off_pd else 0
    team_a_rush_yards = int(team_a_off_pd.get("rushing_yards", 0).sum()) if team_a_off_pd is not None and "rushing_yards" in team_a_off_pd else 0
    team_a_total_yards = team_a_pass_yards + team_a_rush_yards

    # Team B season stats (as offense)
    team_b_off = pbp.filter(pl.col("posteam") == team_b_upper)
    team_b_off_pd = team_b_off.to_pandas() if team_b_off.height > 0 else None

    team_b_points = int(team_b_off_pd.get("posteam_score_post", 0).max()) if team_b_off_pd is not None and "posteam_score_post" in team_b_off_pd else 0
    team_b_plays = int(team_b_off.height)
    team_b_games = int(team_b_off_pd["game_id"].nunique()) if team_b_off_pd is not None and "game_id" in team_b_off_pd else 0
    team_b_pass_yards = int(team_b_off_pd.get("passing_yards", 0).sum()) if team_b_off_pd is not None and "passing_yards" in team_b_off_pd else 0
    team_b_rush_yards = int(team_b_off_pd.get("rushing_yards", 0).sum()) if team_b_off_pd is not None and "rushing_yards" in team_b_off_pd else 0
    team_b_total_yards = team_b_pass_yards + team_b_rush_yards

    # Head-to-head last 5 games (from schedules across multiple seasons)
    def _load_h2h():
        # Load last 10 seasons to find last 5 matchups
        years = list(range(max(1999, season_val - 9), season_val + 1))
        return nfl.load_schedules(years)

    h2h_schedules = await run_in_threadpool(_load_h2h)

    # Filter games where team_a and team_b faced each other
    h2h_games = h2h_schedules.filter(
        ((pl.col("home_team") == team_a_upper) & (pl.col("away_team") == team_b_upper)) |
        ((pl.col("home_team") == team_b_upper) & (pl.col("away_team") == team_a_upper))
    )

    # Only completed games (non-null scores)
    if "home_score" in h2h_games.columns and "away_score" in h2h_games.columns:
        h2h_games = h2h_games.filter(
            pl.col("home_score").is_not_null() & pl.col("away_score").is_not_null()
        )

    # Sort by most recent and take last 5
    if "game_date" in h2h_games.columns or "gameday" in h2h_games.columns:
        date_col = "game_date" if "game_date" in h2h_games.columns else "gameday"
        h2h_games = h2h_games.sort(date_col, descending=True).head(5)
    else:
        h2h_games = h2h_games.head(5)

    h2h_pd = h2h_games.to_pandas() if h2h_games.height > 0 else None

    matchups = []
    if h2h_pd is not None:
        for _, row in h2h_pd.iterrows():
            home = row.get("home_team", "")
            away = row.get("away_team", "")
            home_score = int(row.get("home_score", 0)) if row.get("home_score") is not None else 0
            away_score = int(row.get("away_score", 0)) if row.get("away_score") is not None else 0
            winner = home if home_score > away_score else (away if away_score > home_score else "TIE")
            matchups.append({
                "season": int(row.get("season", season_val)),
                "week": int(row.get("week", 0)) if row.get("week") is not None else 0,
                "home_team": home,
                "away_team": away,
                "home_score": home_score,
                "away_score": away_score,
                "winner": winner,
                "date": str(row.get("game_date", row.get("gameday", "")))
            })

    # Field goals made per game (offense attempts)
    def _fg_per_game(df_pd, games):
        if df_pd is None or games == 0:
            return 0.0
        col = df_pd.get("field_goal_result")
        if col is None:
            return 0.0
        try:
            made = int((col == "made").sum())
        except Exception:
            return 0.0
        return round(made / games, 2)

    team_a_fg_pg = _fg_per_game(team_a_off_pd, team_a_games)
    team_b_fg_pg = _fg_per_game(team_b_off_pd, team_b_games)

    return {
        "status": "success",
        "season": season_val,
        "team_a": team_a_upper,
        "team_b": team_b_upper,
        "team_a_stats": {
            "total_yards": team_a_total_yards,
            "pass_yards": team_a_pass_yards,
            "rush_yards": team_a_rush_yards,
            "plays": team_a_plays,
            "points": team_a_points,
            "fg_per_game": team_a_fg_pg,
        },
        "team_b_stats": {
            "total_yards": team_b_total_yards,
            "pass_yards": team_b_pass_yards,
            "rush_yards": team_b_rush_yards,
            "plays": team_b_plays,
            "points": team_b_points,
            "fg_per_game": team_b_fg_pg,
        },
        "head_to_head": {
            "count": len(matchups),
            "games": matchups
        }
    }

