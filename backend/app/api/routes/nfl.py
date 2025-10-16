from fastapi import APIRouter, Query
from typing import Optional
from app.services.nfl.teams import get_teams_service
from app.services.nfl.players import get_player_vs_team_service
from app.services.nfl.splits import get_team_home_away_splits_service
from app.services.nfl.schedule import get_schedule_by_date_range_service
from app.services.nfl.team_comparison import get_team_vs_team_service


router = APIRouter(prefix="/nfl", tags=["nfl"])


@router.get("/teams")
async def teams():
    return await get_teams_service()


@router.get("/player/{player}/vs/{team}")
async def player_vs_team(player: str, team: str, seasons: Optional[str] = Query(None), game_types: Optional[str] = Query(None)):
    return await get_player_vs_team_service(player, team, seasons, game_types)


@router.get("/team/{team_a}/vs/{team_b}")
async def team_vs_team_comparison(team_a: str, team_b: str, season: int | None = Query(None)):
    return await get_team_vs_team_service(team_a, team_b, season)


@router.get("/team/{team}/splits")
async def team_home_away_splits(team: str, season: int | None = Query(None)):
    return await get_team_home_away_splits_service(team, season)


@router.get("/schedule")
async def schedule_by_date_range(start: str = Query(..., description="YYYY-MM-DD"), end: str = Query(..., description="YYYY-MM-DD"), season: int | None = Query(None)):
    return await get_schedule_by_date_range_service(start, end, season)


