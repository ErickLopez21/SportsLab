from starlette.concurrency import run_in_threadpool


async def get_nba_teams_service():
    # Import inside to avoid import cost at startup if unused
    from nba_api.stats.static import teams as nba_teams

    def _load():
        return nba_teams.get_teams()

    teams = await run_in_threadpool(_load)

    # Normalize minimal fields
    teams_list = [
        {
            "abbreviation": t.get("abbreviation"),
            "full_name": t.get("full_name"),
            "city": t.get("city"),
            "id": t.get("id"),
        }
        for t in teams
    ]

    return {
        "status": "success",
        "count": len(teams_list),
        "teams": teams_list,
    }


