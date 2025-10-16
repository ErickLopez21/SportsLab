from fastapi import APIRouter
from .team_comparison import router as team_comparison_router
from .headshots import router as headshots_router
from .teams import router as teams_router
from .players import router as players_router
from .schedule import router as schedule_router
from .standings import router as standings_router
from .team_stats import router as team_stats_router
from .trends import router as trends_router


router = APIRouter(prefix="/nfl")

# Keep existing paths as-is via sub-routers (order matters for overlapping prefixes)
router.include_router(team_comparison_router)
router.include_router(headshots_router)
router.include_router(teams_router)
router.include_router(players_router)
router.include_router(schedule_router)
router.include_router(standings_router)
router.include_router(team_stats_router)
router.include_router(trends_router)


