from fastapi import APIRouter
from app.services.mlb import get_mlb_teams_service


router = APIRouter(prefix="/mlb", tags=["mlb"])


@router.get("/teams")
async def mlb_teams():
    return await get_mlb_teams_service()


