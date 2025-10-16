from fastapi import APIRouter, Query
from typing import Optional
from app.services.nfl.team_comparison import get_team_vs_team_service


router = APIRouter(tags=["NFL - Team Comparison"])


@router.get("/team/{team_a}/vs/{team_b}")
async def team_vs_team(team_a: str, team_b: str, season: Optional[int] = Query(None)):
    return await get_team_vs_team_service(team_a, team_b, season)

