from fastapi import APIRouter, Query
from typing import Optional
from app.services.nfl.headshots import resolve_headshot_service


router = APIRouter(tags=["NFL - Headshots"])


@router.get("/players/headshot")
async def resolve_headshot(q: str = Query(..., min_length=2), season: Optional[int] = Query(None)):
  return await resolve_headshot_service(q, season)


