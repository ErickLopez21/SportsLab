from fastapi import APIRouter, Query, Path
from typing import Optional
from app.services.nfl.team_stats import (
    get_team_offense_service,
    get_offense_league_service,
    get_team_defense_service,
    get_defense_league_service,
    get_team_special_teams_service,
    get_special_teams_league_service,
)

router = APIRouter(tags=["NFL - Team Stats"], prefix="/team")


@router.get("/offense/ranks")
async def get_league_offense(
    season: Optional[int] = Query(None),
    game_types: Optional[str] = Query(None),
    last_n: Optional[int] = Query(None),
    venue: Optional[str] = Query(None),
    opponent_conf: Optional[str] = Query(None),
    opponent_div: Optional[str] = Query(None),
):
    return await get_offense_league_service(season, game_types, last_n=last_n, venue=venue, opponent_conf=opponent_conf, opponent_div=opponent_div)


@router.get("/{team}/offense")
async def get_team_offense(
    team: str = Path(..., min_length=2, max_length=4),
    season: Optional[int] = Query(None),
    game_types: Optional[str] = Query(None),
    last_n: Optional[int] = Query(None),
    venue: Optional[str] = Query(None),
    opponent_conf: Optional[str] = Query(None),
    opponent_div: Optional[str] = Query(None),
):
    return await get_team_offense_service(team, season, game_types, last_n=last_n, venue=venue, opponent_conf=opponent_conf, opponent_div=opponent_div)


@router.get("/defense/ranks")
async def get_league_defense(
    season: Optional[int] = Query(None),
    game_types: Optional[str] = Query(None),
    last_n: Optional[int] = Query(None),
    venue: Optional[str] = Query(None),
    opponent_conf: Optional[str] = Query(None),
    opponent_div: Optional[str] = Query(None),
):
    return await get_defense_league_service(season, game_types, last_n=last_n, venue=venue, opponent_conf=opponent_conf, opponent_div=opponent_div)


@router.get("/{team}/defense")
async def get_team_defense(
    team: str = Path(..., min_length=2, max_length=4),
    season: Optional[int] = Query(None),
    game_types: Optional[str] = Query(None),
    last_n: Optional[int] = Query(None),
    venue: Optional[str] = Query(None),
    opponent_conf: Optional[str] = Query(None),
    opponent_div: Optional[str] = Query(None),
):
    return await get_team_defense_service(team, season, game_types, last_n=last_n, venue=venue, opponent_conf=opponent_conf, opponent_div=opponent_div)


@router.get("/st/ranks")
async def get_league_special_teams(
    season: Optional[int] = Query(None),
    game_types: Optional[str] = Query(None),
    last_n: Optional[int] = Query(None),
    venue: Optional[str] = Query(None),
    opponent_conf: Optional[str] = Query(None),
    opponent_div: Optional[str] = Query(None),
):
    return await get_special_teams_league_service(season, game_types, last_n=last_n, venue=venue, opponent_conf=opponent_conf, opponent_div=opponent_div)


@router.get("/{team}/st")
async def get_team_special_teams(
    team: str = Path(..., min_length=2, max_length=4),
    season: Optional[int] = Query(None),
    game_types: Optional[str] = Query(None),
    last_n: Optional[int] = Query(None),
    venue: Optional[str] = Query(None),
    opponent_conf: Optional[str] = Query(None),
    opponent_div: Optional[str] = Query(None),
):
    return await get_team_special_teams_service(team, season, game_types, last_n=last_n, venue=venue, opponent_conf=opponent_conf, opponent_div=opponent_div)


