from fastapi import APIRouter, Query
from app.services.nfl.schedule import get_schedule_by_date_range_service


router = APIRouter(tags=["NFL - Schedule"])


@router.get("/schedule")
async def schedule_by_date_range(
    start: str | None = Query(None, description="YYYY-MM-DD"),
    end: str | None = Query(None, description="YYYY-MM-DD"),
    season: int | None = Query(None),
    week: int | None = Query(None),
):
    return await get_schedule_by_date_range_service(start, end, season, week)


