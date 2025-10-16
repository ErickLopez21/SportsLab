from datetime import datetime
from typing import Optional
import nflreadpy as nfl
from starlette.concurrency import run_in_threadpool
import polars as pl

# Minimal home city mapping by team (city only)
TEAM_HOME_CITY = {
    # AFC East
    "BUF": "Buffalo", "MIA": "Miami", "NE": "Foxborough", "NYJ": "East Rutherford",
    # AFC North
    "BAL": "Baltimore", "CIN": "Cincinnati", "CLE": "Cleveland", "PIT": "Pittsburgh",
    # AFC South
    "HOU": "Houston", "IND": "Indianapolis", "JAX": "Jacksonville", "TEN": "Nashville",
    # AFC West
    "DEN": "Denver", "KC": "Kansas City", "LV": "Las Vegas", "LAC": "Inglewood",
    # NFC East
    "DAL": "Arlington", "NYG": "East Rutherford", "PHI": "Philadelphia", "WAS": "Landover",
    # NFC North
    "CHI": "Chicago", "DET": "Detroit", "GB": "Green Bay", "MIN": "Minneapolis",
    # NFC South
    "ATL": "Atlanta", "CAR": "Charlotte", "NO": "New Orleans", "TB": "Tampa",
    # NFC West
    "ARI": "Glendale", "LAR": "Inglewood", "SF": "Santa Clara", "SEA": "Seattle",
}


async def get_schedule_by_date_range_service(start: Optional[str], end: Optional[str], season: Optional[int] = None, week: Optional[int] = None):
    """
    start/end: 'YYYY-MM-DD'
    season: optional, defaults to current season
    """
    season_val = int(season) if season else int(nfl.get_current_season())

    # Parse dates if provided
    start_dt = datetime.fromisoformat(start) if start else None
    end_dt = datetime.fromisoformat(end) if end else None

    def _load():
        return nfl.load_schedules([season_val])

    schedules = await run_in_threadpool(_load)

    # Some schedules have 'gameday' or 'game_date' fields; try both
    if 'gameday' in schedules.columns:
        df = schedules.with_columns(
            pl.col('gameday').str.strptime(pl.Date, strict=False).alias('game_date_pl')
        )
        date_col = 'game_date_pl'
    elif 'game_date' in schedules.columns:
        df = schedules.with_columns(
            pl.col('game_date').str.strptime(pl.Date, strict=False).alias('game_date_pl')
        )
        date_col = 'game_date_pl'
    else:
        # fallback: return empty
        return {"status": "success", "count": 0, "games": []}

    window = df
    if week is not None and 'week' in df.columns:
        window = window.filter(pl.col('week') == int(week))
    elif start_dt and end_dt:
        mask = (pl.col(date_col) >= pl.lit(start_dt.date())) & (pl.col(date_col) <= pl.lit(end_dt.date()))
        window = df.filter(mask)

    # Detect time/location columns if present
    has_gametime = 'gametime' in window.columns
    has_game_time_et = 'game_time_eastern' in window.columns
    venue_candidates = ['stadium', 'stadium_name', 'venue', 'site', 'stadium_location']
    city_candidates = ['stadium_city', 'city']
    state_candidates = ['stadium_state', 'state']
    country_candidates = ['stadium_country', 'country']

    select_cols = [
        pl.col('game_id') if 'game_id' in window.columns else pl.lit(None).alias('game_id'),
        pl.col('home_team') if 'home_team' in window.columns else pl.lit(None).alias('home_team'),
        pl.col('away_team') if 'away_team' in window.columns else pl.lit(None).alias('away_team'),
        pl.col('week') if 'week' in window.columns else pl.lit(None).alias('week'),
        pl.col(date_col).alias('game_date'),
    ]
    if has_gametime:
        select_cols.append(pl.col('gametime'))
    if has_game_time_et:
        select_cols.append(pl.col('game_time_eastern'))
    # include scores if present so frontend can detect finalizados
    if 'home_score' in window.columns:
        select_cols.append(pl.col('home_score'))
    if 'away_score' in window.columns:
        select_cols.append(pl.col('away_score'))

    # add venue-related columns if present
    def _first_existing(cols: list[str]):
        for c in cols:
            if c in window.columns:
                return c
        return None

    venue_col = _first_existing(venue_candidates)
    if venue_col:
        select_cols.append(pl.col(venue_col).alias('venue_raw'))
    city_col = _first_existing(city_candidates)
    if city_col:
        select_cols.append(pl.col(city_col).alias('city_raw'))
    state_col = _first_existing(state_candidates)
    if state_col:
        select_cols.append(pl.col(state_col).alias('state_raw'))
    country_col = _first_existing(country_candidates)
    if country_col:
        select_cols.append(pl.col(country_col).alias('country_raw'))

    games = window.select(select_cols).to_dicts()

    # Compose a human-readable kickoff if possible
    for g in games:
        date_str = str(g.get('game_date')) if g.get('game_date') is not None else None
        time_str = None
        if has_gametime and g.get('gametime'):
            time_str = g.get('gametime')
        elif has_game_time_et and g.get('game_time_eastern'):
            time_str = g.get('game_time_eastern')
        g['kickoff'] = f"{date_str} {time_str} ET" if date_str and time_str else date_str or time_str

        # build venue/location display if available
        venue_parts = []
        if g.get('venue_raw'):
            venue_parts.append(str(g.get('venue_raw')))
        city = g.get('city_raw')
        state = g.get('state_raw')
        country = g.get('country_raw')
        locality_parts = []
        if city:
            locality_parts.append(str(city))
        if state:
            locality_parts.append(str(state))
        if country and country not in (None, 'USA', 'US', 'United States'):
            locality_parts.append(str(country))
        locality = ", ".join(locality_parts) if locality_parts else None
        if venue_parts and locality:
            g['venue'] = f"{venue_parts[0]}, {locality}"
        elif venue_parts:
            g['venue'] = venue_parts[0]
        elif locality:
            g['venue'] = locality
        else:
            g['venue'] = None

        # Expose raw locality fields for frontend logic if needed
        g['venue_city'] = str(city) if city is not None else None
        g['venue_country'] = str(country) if country is not None else None

        # Compute neutral site flag (international or not in home city)
        home = (g.get('home_team') or '').upper()
        expected_city = TEAM_HOME_CITY.get(home)
        v_city_norm = (str(city) if city is not None else '').strip().lower()
        country_norm = (str(country) if country is not None else '').strip().lower()
        venue_norm = (str(g['venue']) if g.get('venue') else '').lower()
        is_international = country_norm not in ('', 'usa', 'us', 'united states', 'unitedstates')
        known_neutral_keywords = ['london', 'wembley', 'tottenham', 'mexico', 'azteca', 'frankfurt', 'munich', 'allianz']
        has_keyword = any(k in venue_norm for k in known_neutral_keywords)
        city_mismatch = bool(expected_city) and expected_city.lower() not in v_city_norm if v_city_norm else False
        g['neutral'] = bool(is_international or has_keyword or city_mismatch)
        # expose final flag
        hs = g.get('home_score')
        as_ = g.get('away_score')
        g['final'] = (hs is not None and as_ is not None)

    return {
        "status": "success",
        "season": season_val,
        "week": int(week) if week is not None else None,
        "count": len(games),
        "games": games
    }


