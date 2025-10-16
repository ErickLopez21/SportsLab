from fastapi import APIRouter, Query
from app.services.nfl.teams import get_teams_service
from app.services.nfl.splits import get_team_home_away_splits_service


router = APIRouter(tags=["NFL - Teams"])


@router.get("/teams")
async def list_teams():
    return await get_teams_service()


@router.get("/team/{team}/splits")
async def team_splits(team: str, season: int | None = Query(None)):
    return await get_team_home_away_splits_service(team, season)


