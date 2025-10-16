from fastapi import APIRouter, Query
from typing import Optional
from app.services.nfl.trends import get_team_trends_service


router = APIRouter(prefix="/team", tags=["nfl-trends"])


@router.get("/{team}/trends")
async def team_trends(
    team: str,
    season: int | None = Query(None),
    game_types: str | None = Query(None),
    last_n: int | None = Query(None),
    venue: str | None = Query(None),
    opponent_conf: str | None = Query(None),
    opponent_div: str | None = Query(None),
):
    return await get_team_trends_service(
        team,
        season,
        game_types,
        last_n=last_n,
        venue=venue,
        opponent_conf=opponent_conf,
        opponent_div=opponent_div,
    )


