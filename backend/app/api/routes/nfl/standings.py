from fastapi import APIRouter, Query
from typing import Optional
from app.services.nfl.standings import get_standings_service


router = APIRouter(tags=["NFL - Standings"])


@router.get("/standings")
async def standings(season: Optional[int] = Query(None)):
  return await get_standings_service(season)


