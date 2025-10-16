import nflreadpy as nfl
from starlette.concurrency import run_in_threadpool


async def get_teams_service():
    season = nfl.get_current_season()

    def _load():
        return nfl.load_schedules([season])

    schedules = await run_in_threadpool(_load)

    columns = schedules.columns
    if "home_team" in columns and "away_team" in columns:
        home_teams = schedules["home_team"].unique().to_list()
        away_teams = schedules["away_team"].unique().to_list()
        teams = sorted(set(home_teams + away_teams))
    else:
        teams = []

    return {
        "status": "success",
        "season": int(season),
        "count": len(teams),
        "teams": teams,
    }


