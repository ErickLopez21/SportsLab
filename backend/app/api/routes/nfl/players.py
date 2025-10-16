from fastapi import APIRouter, Query
from typing import Optional
from app.services.nfl.players import get_player_vs_team_service, search_players_service, get_player_career_service


router = APIRouter(tags=["NFL - Players"])


@router.get("/player/{player}/vs/{team}")
async def player_vs_team(
    player: str,
    team: str,
    seasons: Optional[str] = Query(None),
    game_types: Optional[str] = Query(None)
):
    return await get_player_vs_team_service(player, team, seasons, game_types)


@router.get("/player/{player}/career")
async def player_career(
    player: str,
    seasons: Optional[str] = Query(None),
    game_types: Optional[str] = Query("REG,POST")
):
    return await get_player_career_service(player, seasons, game_types)


@router.get("/players/search")
async def search_players(q: str = Query(..., min_length=2), limit: int = Query(20, ge=1, le=50)):
    return await search_players_service(q, limit)


@router.get("/players/ranks")
async def get_player_ranks(
    season: Optional[int] = Query(None),
    game_types: Optional[str] = Query(None)
):
    """Get player rankings for current season (2025) by position (QB, RB, WR/TE, DEF, K)"""
    from app.services.nfl.players import get_player_ranks_service
    return await get_player_ranks_service(season, game_types)
