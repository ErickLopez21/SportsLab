from starlette.concurrency import run_in_threadpool


async def get_mlb_teams_service():
    # Import inside to avoid import cost at startup if unused
    from pybaseball import team_ids

    def _load():
        return team_ids()

    df = await run_in_threadpool(_load)

    # Normalize fields if available
    columns = set(df.columns)
    records = df.to_dict("records")
    teams = []
    for r in records:
        teams.append({
            "team_id": r.get("team_id") or r.get("teamID") or r.get("team_id_bbref"),
            "abbreviation": r.get("team_abbr") or r.get("teamIDBR") or r.get("teamIDretro") or r.get("teamIDfg"),
            "name": r.get("team_name") or r.get("teamName") or r.get("name"),
        })

    return {
        "status": "success",
        "count": len(teams),
        "teams": teams,
    }


