from fastapi import APIRouter
from app.services.nba import get_nba_teams_service


router = APIRouter(prefix="/nba", tags=["nba"])


@router.get("/teams")
async def nba_teams():
    return await get_nba_teams_service()


