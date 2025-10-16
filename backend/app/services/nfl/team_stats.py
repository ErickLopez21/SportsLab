from typing import Optional, Dict, Any, List, Set
import polars as pl
import nflreadpy as nfl
from starlette.concurrency import run_in_threadpool


def _safe_int(val: Optional[str | int]) -> Optional[int]:
    try:
        if val is None:
            return None
        return int(val)
    except Exception:
        return None


async def get_team_offense_service(team: str, season: Optional[int] = None, game_types: Optional[str] = None, *, last_n: Optional[int] = None, venue: Optional[str] = None, opponent_conf: Optional[str] = None, opponent_div: Optional[str] = None) -> Dict[str, Any]:
    """Aggregate offensive metrics for a team from play-by-play.

    Returns per-game rates where applicable.

    Metrics:
      - ppg: points per game (fallback to schedules if necessary)
      - pyds_pg: passing yards per game
      - ruyds_pg: rushing yards per game
      - td_pg: offensive touchdowns per game (approx)
      - ypp: yards per offensive play
      - to_pg: turnovers per game (INT + Fumble lost)
    """
    team_abbr = (team or '').upper()
    if not team_abbr:
        return {"status": "error", "message": "team required"}

    current_season = nfl.get_current_season()
    season_val = _safe_int(season) or int(current_season)

    def _load_pbp():
        return nfl.load_pbp([season_val])

    # Load PBP for the season
    pbp = await run_in_threadpool(_load_pbp)

    # Filter season type (REG default)
    if game_types:
        # expect comma separated like "REG,POST"
        types = {s.strip().upper() for s in str(game_types).split(',') if s.strip()}
        if 'REG' in pbp.columns and 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type').str.to_uppercase().is_in(list(types)))
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type').str.to_uppercase().is_in(list(types)))
    else:
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type') == 'REG')
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type') == 'REG')

    # Keep only plays where this team had possession
    posteam_col = 'posteam' if 'posteam' in pbp.columns else ('possession_team' if 'possession_team' in pbp.columns else None)
    defteam_col = 'defteam' if 'defteam' in pbp.columns else ('def_team' if 'def_team' in pbp.columns else None)
    if not posteam_col:
        return {"status": "success", "season": season_val, "team": team_abbr, "metrics": {}}

    df = pbp.filter(pl.col(posteam_col) == team_abbr)

    # Optional: restrict by venue/last_n using schedules subset of final REG games
    if (last_n is not None and last_n > 0) or (venue is not None and str(venue).lower() in {"home", "away"}) or (opponent_conf is not None) or (opponent_div is not None):
        def _load_sched():
            return nfl.load_schedules([season_val])
        sched = await run_in_threadpool(_load_sched)
        if 'season_type' in sched.columns:
            sched = sched.filter(pl.col('season_type') == 'REG')
        elif 'game_type' in sched.columns:
            sched = sched.filter(pl.col('game_type') == 'REG')
        # completed only
        if 'home_score' in sched.columns and 'away_score' in sched.columns:
            sched = sched.filter(pl.col('home_score').is_not_null() & pl.col('away_score').is_not_null())
        # filter by team and venue
        filt = (pl.col('home_team') == team_abbr) | (pl.col('away_team') == team_abbr)
        if str(venue or '').lower() == 'home':
            filt = (pl.col('home_team') == team_abbr)
        elif str(venue or '').lower() == 'away':
            filt = (pl.col('away_team') == team_abbr)
        sub = sched.filter(filt)
        # Apply opponent conference/division if provided
        TEAM_TO_DIV = {
            'BUF': 'AFC East','MIA': 'AFC East','NE': 'AFC East','NYJ': 'AFC East',
            'BAL': 'AFC North','CIN': 'AFC North','CLE': 'AFC North','PIT': 'AFC North',
            'HOU': 'AFC South','IND': 'AFC South','JAX': 'AFC South','TEN': 'AFC South',
            'DEN': 'AFC West','KC': 'AFC West','LV': 'AFC West','LAC': 'AFC West',
            'DAL': 'NFC East','NYG': 'NFC East','PHI': 'NFC East','WAS': 'NFC East',
            'CHI': 'NFC North','DET': 'NFC North','GB': 'NFC North','MIN': 'NFC North',
            'ATL': 'NFC South','CAR': 'NFC South','NO': 'NFC South','TB': 'NFC South',
            'ARI': 'NFC West','LA': 'NFC West','LAR': 'NFC West','SEA': 'NFC West','SF': 'NFC West',
        }
        TEAM_TO_CONF = {t: dv.split(' ')[0] for t, dv in TEAM_TO_DIV.items()}
        if opponent_conf or opponent_div:
            opp_col = pl.when(pl.col('home_team') == team_abbr).then(pl.col('away_team')).otherwise(pl.col('home_team')).alias('opp')
            sub = sub.with_columns([opp_col])
            if opponent_conf and str(opponent_conf).upper() in {'AFC','NFC'}:
                allowed = {t for t, c in TEAM_TO_CONF.items() if c.upper() == str(opponent_conf).upper()}
                sub = sub.filter(pl.col('opp').is_in(list(allowed)))
            if opponent_div:
                allowedd = {t for t, d in TEAM_TO_DIV.items() if d.upper() == str(opponent_div).upper()}
                if allowedd:
                    sub = sub.filter(pl.col('opp').is_in(list(allowedd)))
        if 'game_date' in sub.columns:
            sub = sub.sort('game_date')
        if last_n and last_n > 0:
            sub = sub.tail(last_n)
        ids = set(sub['game_id']) if 'game_id' in sub.columns else set()
        if ids:
            df = df.filter(pl.col('game_id').is_in(list(ids)))
        else:
            # Con filtros pero sin juegos válidos: forzar subconjunto vacío
            df = df.head(0)

    # Identify columns defensively
    yards_col = 'yards_gained' if 'yards_gained' in df.columns else None
    pass_col = 'pass' if 'pass' in df.columns else ('is_pass' if 'is_pass' in df.columns else None)
    rush_col = 'rush' if 'rush' in df.columns else ('is_rush' if 'is_rush' in df.columns else None)
    scramble_col = 'qb_scramble' if 'qb_scramble' in df.columns else None
    kneel_col = 'qb_kneel' if 'qb_kneel' in df.columns else None
    spike_col = 'qb_spike' if 'qb_spike' in df.columns else None
    no_play_col = 'no_play' if 'no_play' in df.columns else None
    two_pt_col = 'two_point_attempt' if 'two_point_attempt' in df.columns else None
    td_col = 'touchdown' if 'touchdown' in df.columns else None
    pass_td_col = 'pass_touchdown' if 'pass_touchdown' in df.columns else None
    rush_td_col = 'rush_touchdown' if 'rush_touchdown' in df.columns else None
    td_team_col = 'td_team' if 'td_team' in df.columns else None
    int_col = 'interception' if 'interception' in df.columns else ('interception_player_id' if 'interception_player_id' in df.columns else None)
    fuml_col = 'fumble_lost' if 'fumble_lost' in df.columns else ('fumble_lost_team' if 'fumble_lost_team' in df.columns else None)
    down_col = 'down' if 'down' in df.columns else None
    first_down_col = 'first_down' if 'first_down' in df.columns else ('firstdown' if 'firstdown' in df.columns else None)
    yardline100_col = 'yardline_100' if 'yardline_100' in df.columns else None
    drive_col = 'drive' if 'drive' in df.columns else None
    drive_play_num_col = 'drive_play_number' if 'drive_play_number' in df.columns else None
    game_id_col = 'game_id' if 'game_id' in df.columns else None

    if df.height == 0:
        return {"status": "success", "season": season_val, "team": team_abbr, "games": 0, "metrics": {}}

    # Valid plays (exclude spikes, kneels, no_play, 2pt)
    valid = pl.lit(True)
    if no_play_col:
        valid &= (pl.col(no_play_col).cast(pl.Int64) != 1)
    if two_pt_col:
        valid &= (pl.col(two_pt_col).cast(pl.Int64) != 1)
    if spike_col:
        valid &= (pl.col(spike_col).cast(pl.Int64) != 1)
    if kneel_col:
        valid &= (pl.col(kneel_col).cast(pl.Int64) != 1)

    dfv = df.filter(valid)

    # Games played with possession
    games_played = None
    if game_id_col:
        games_played = dfv.select(pl.col(game_id_col)).unique().height

    # Yardage aggregations
    total_yards = dfv.select(pl.col(yards_col)).to_series().sum() if yards_col else 0
    pass_yards = 0
    rush_yards = 0
    if yards_col and pass_col:
        # dropbacks sin scrambles
        pass_yards = (
            dfv.filter((pl.col(pass_col).cast(pl.Int64) == 1) & (~(pl.col(scramble_col).cast(pl.Int64) == 1) if scramble_col else True))
            .select(pl.col(yards_col)).to_series().sum()
        )
    if yards_col and (rush_col or scramble_col):
        rush_cond = (pl.col(rush_col).cast(pl.Int64) == 1) if rush_col else pl.lit(False)
        scr_cond = (pl.col(scramble_col).cast(pl.Int64) == 1) if scramble_col else pl.lit(False)
        rush_yards = (
            dfv.filter(rush_cond | scr_cond)
            .select(pl.col(yards_col)).to_series().sum()
        )

    # Touchdowns for the offensive team
    td_total = 0
    pass_td_count = 0
    rush_td_count = 0
    if pass_td_col or rush_td_col:
        td_total = 0
        if pass_td_col:
            pass_td_count = df.filter(pl.col(pass_td_col).cast(pl.Int64) == 1).height
            td_total += pass_td_count
        if rush_td_col:
            rush_td_count = df.filter(pl.col(rush_td_col).cast(pl.Int64) == 1).height
            td_total += rush_td_count
    elif td_col and td_team_col:
        td_total = df.filter((pl.col(td_col).cast(pl.Int64) == 1) & (pl.col(td_team_col) == team_abbr)).height
    elif td_col:
        # Fallback: count touchdowns only on offensive plays (approx)
        td_total = df.filter(pl.col(td_col).cast(pl.Int64) == 1).height

    # Defensive touchdowns scored by this team (when opponent had possession)
    td_def_total = 0
    if ('touchdown' in pbp.columns) and ('td_team' in pbp.columns) and posteam_col:
        td_def_total = pbp.filter(
            (pl.col('touchdown').cast(pl.Int64) == 1)
            & (pl.col('td_team') == team_abbr)
            & (pl.col(posteam_col) != team_abbr)
        ).height

    # Turnovers: INT or Fumble Lost when team had possession
    turnovers = 0
    if int_col:
        if int_col == 'interception':
            turnovers += df.filter(pl.col(int_col) == 1).height
        else:
            turnovers += df.filter(pl.col(int_col).is_not_null()).height
    if fuml_col:
        if fuml_col == 'fumble_lost':
            turnovers += df.filter(pl.col(fuml_col) == 1).height
        else:
            turnovers += df.filter(pl.col(fuml_col).is_not_null()).height

    # Takeaways when opponent had possession
    takeaways = 0
    if posteam_col:
        opp_dfv = pbp.filter((pl.col(posteam_col) != team_abbr) & valid)
        if int_col:
            if int_col == 'interception':
                takeaways += opp_dfv.filter(pl.col(int_col) == 1).height
            else:
                takeaways += opp_dfv.filter(pl.col(int_col).is_not_null()).height
        if fuml_col:
            if fuml_col == 'fumble_lost':
                takeaways += opp_dfv.filter(pl.col(fuml_col) == 1).height
            else:
                takeaways += opp_dfv.filter(pl.col(fuml_col).is_not_null()).height

    # Points For per game from PBP (robust): for each game take max of posteam score column
    pf_pg = 0.0
    if game_id_col:
        score_col = None
        if 'posteam_score_post' in df.columns:
            score_col = 'posteam_score_post'
        elif 'posteam_score' in df.columns:
            score_col = 'posteam_score'
        elif 'total_home_score' in df.columns and 'home_team' in df.columns and 'away_team' in df.columns:
            # rare fallback, not expected
            score_col = None
        if score_col:
            by_game = df.group_by(game_id_col).agg([pl.col(score_col).max().alias('pts')])
            if by_game.height:
                pf_pg = round(float(by_game['pts'].mean() or 0.0), 1)

    # Build per-game metrics
    gp = games_played or 0
    def per_game(x: float) -> float:
        if not gp:
            return 0.0
        return round(float(x) / float(gp), 1)

    pass_plays = dfv.filter(pl.col(pass_col).cast(pl.Int64) == 1).height if pass_col else 0
    rush_plays = dfv.filter(((pl.col(rush_col).cast(pl.Int64) == 1) if rush_col else pl.lit(False)) | ((pl.col(scramble_col).cast(pl.Int64) == 1) if scramble_col else pl.lit(False))).height
    plays = pass_plays + rush_plays
    ypp = round(float(total_yards) / float(plays), 1) if plays else 0.0

    # 3rd & 4th down conversion
    third_pct = None
    fourth_pct = None
    if down_col and first_down_col:
        third_att = dfv.filter(pl.col(down_col) == 3).height
        third_conv = dfv.filter((pl.col(down_col) == 3) & (pl.col(first_down_col).cast(pl.Int64) == 1)).height
        fourth_att = dfv.filter(pl.col(down_col) == 4).height
        fourth_conv = dfv.filter((pl.col(down_col) == 4) & (pl.col(first_down_col).cast(pl.Int64) == 1)).height
        third_pct = round((third_conv / third_att) * 100, 1) if third_att else 0.0
        fourth_pct = round((fourth_conv / fourth_att) * 100, 1) if fourth_att else 0.0

    # Red zone TD% (aprox): TDs en plays dentro de la y20 / primeras jugadas en RZ (down==1)
    rz_td_pct = None
    if yardline100_col:
        rz_entries = dfv.filter((pl.col(yardline100_col) <= 20) & ((pl.col(down_col) == 1) if down_col else True)).height
        rz_tds = 0
        if pass_td_col:
            rz_tds += dfv.filter((pl.col(pass_td_col).cast(pl.Int64) == 1) & (pl.col(yardline100_col) <= 20)).height
        if rush_td_col:
            rz_tds += dfv.filter((pl.col(rush_td_col).cast(pl.Int64) == 1) & (pl.col(yardline100_col) <= 20)).height
        rz_td_pct = round((rz_tds / rz_entries) * 100, 1) if rz_entries else 0.0

    # Explosive plays per game (20+)
    explosive_pg = per_game(dfv.filter(pl.col(yards_col) >= 20).height) if yards_col else 0.0

    # Plays per game
    plays_pg = per_game(plays)

    # Avg starting field position (yardline_100) del primer snap de cada drive
    start_pos_avg = None
    if yardline100_col and drive_col and drive_play_num_col:
        start_pos_avg = df.filter(pl.col(drive_play_num_col) == 1).select(pl.col(yardline100_col)).to_series().mean()
        start_pos_avg = round(float(start_pos_avg), 1) if start_pos_avg is not None else None

    # Points per game – fallback: approximate from touchdowns * 6 (excludes FGs)
    ppg_est = per_game(td_total * 6)

    return {
        "status": "success",
        "season": season_val,
        "team": team_abbr,
        "games": gp,
        "metrics": {
            "pf_pg": pf_pg,
            "pyds_pg": per_game(pass_yards),
            "ruyds_pg": per_game(rush_yards),
            "td_total": float(td_total),
            "td_pg": per_game(td_total),
            "pass_td_pg": per_game(pass_td_count),
            "rush_td_pg": per_game(rush_td_count),
            "td_def_total": float(td_def_total),
            "ypp": ypp,
            "to_pg": per_game(turnovers),
            "takeaways_pg": per_game(takeaways),
            "to_margin_pg": per_game(takeaways - turnovers),
            "third_pct": third_pct,
            "fourth_pct": fourth_pct,
            "rz_td_pct": rz_td_pct,
            "explosive_pg": explosive_pg,
            "plays_pg": plays_pg,
            "start_pos_avg": start_pos_avg,
            "ppg_est": ppg_est,
        }
    }


async def get_offense_league_service(season: Optional[int] = None, game_types: Optional[str] = None, *, last_n: Optional[int] = None, venue: Optional[str] = None, opponent_conf: Optional[str] = None, opponent_div: Optional[str] = None) -> Dict[str, Any]:
    """Aggregate offensive metrics for all teams in a season from PBP (regular by default)."""
    current_season = nfl.get_current_season()
    season_val = _safe_int(season) or int(current_season)

    def _load_pbp():
        return nfl.load_pbp([season_val])

    pbp = await run_in_threadpool(_load_pbp)

    # Season type filter (REG default)
    if game_types:
        types = {s.strip().upper() for s in str(game_types).split(',') if s.strip()}
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type').str.to_uppercase().is_in(list(types)))
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type').str.to_uppercase().is_in(list(types)))
    else:
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type') == 'REG')
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type') == 'REG')

    posteam_col = 'posteam' if 'posteam' in pbp.columns else ('possession_team' if 'possession_team' in pbp.columns else None)
    defteam_col = 'defteam' if 'defteam' in pbp.columns else ('def_team' if 'def_team' in pbp.columns else None)
    if not posteam_col:
        return {"status": "success", "season": season_val, "teams": []}

    yards_col = 'yards_gained' if 'yards_gained' in pbp.columns else None
    pass_mask = (pl.col('pass').cast(pl.Int64) == 1) if 'pass' in pbp.columns else ((pl.col('is_pass').cast(pl.Int64) == 1) if 'is_pass' in pbp.columns else None)
    rush_mask = (pl.col('rush').cast(pl.Int64) == 1) if 'rush' in pbp.columns else ((pl.col('is_rush').cast(pl.Int64) == 1) if 'is_rush' in pbp.columns else None)
    scramble_mask = (pl.col('qb_scramble').cast(pl.Int64) == 1) if 'qb_scramble' in pbp.columns else None
    kneel_mask = (pl.col('qb_kneel').cast(pl.Int64) == 1) if 'qb_kneel' in pbp.columns else None
    spike_mask = (pl.col('qb_spike').cast(pl.Int64) == 1) if 'qb_spike' in pbp.columns else None
    no_play_mask = (pl.col('no_play').cast(pl.Int64) == 1) if 'no_play' in pbp.columns else None
    two_pt_mask = (pl.col('two_point_attempt').cast(pl.Int64) == 1) if 'two_point_attempt' in pbp.columns else None
    td_col = 'touchdown' if 'touchdown' in pbp.columns else None
    int_col = 'interception' if 'interception' in pbp.columns else ('interception_player_id' if 'interception_player_id' in pbp.columns else None)
    fuml_col = 'fumble_lost' if 'fumble_lost' in pbp.columns else ('fumble_lost_team' if 'fumble_lost_team' in pbp.columns else None)
    game_id_col = 'game_id' if 'game_id' in pbp.columns else None

    df = pbp

    # Prepare helpers
    valid = pl.lit(True)
    if no_play_mask is not None:
        valid &= (no_play_mask == 0)
    if two_pt_mask is not None:
        valid &= (two_pt_mask == 0)
    if spike_mask is not None:
        valid &= (spike_mask == 0)
    if kneel_mask is not None:
        valid &= (kneel_mask == 0)

    # dropbacks sin scrambles para pase; rush incluye scrambles
    pass_yards_expr = pl.when(valid & (pass_mask if pass_mask is not None else pl.lit(False)) & (~(scramble_mask) if scramble_mask is not None else pl.lit(True))).then(pl.col(yards_col)).otherwise(0) if yards_col else pl.lit(0)
    rush_yards_expr = pl.when(valid & ((rush_mask if rush_mask is not None else pl.lit(False)) | (scramble_mask if scramble_mask is not None else pl.lit(False)))).then(pl.col(yards_col)).otherwise(0) if yards_col else pl.lit(0)
    plays_expr = (
        (pl.when(valid & (pass_mask if pass_mask is not None else pl.lit(False))).then(1).otherwise(0)) +
        (pl.when(valid & ((rush_mask if rush_mask is not None else pl.lit(False)) | (scramble_mask if scramble_mask is not None else pl.lit(False)))).then(1).otherwise(0))
    )
    expr_td = (pl.col(td_col) == 1).cast(pl.Int64) if td_col else pl.lit(0)

    # Turnovers: interception or fumble lost
    expr_int = (pl.col(int_col) == 1).cast(pl.Int64) if int_col == 'interception' else (pl.col(int_col).is_not_null().cast(pl.Int64) if int_col else pl.lit(0))
    expr_fuml = (pl.col(fuml_col) == 1).cast(pl.Int64) if fuml_col == 'fumble_lost' else (pl.col(fuml_col).is_not_null().cast(pl.Int64) if fuml_col else pl.lit(0))

    group_cols = [pl.col(posteam_col).alias('team')]
    aggs = [
        pass_yards_expr.sum().alias('pass_yards'),
        rush_yards_expr.sum().alias('rush_yards'),
        (pass_yards_expr + rush_yards_expr).sum().alias('total_yards'),
        expr_td.sum().alias('tds'),
        # TD breakdowns (offense)
        (pl.when(valid & ((pl.col('pass_touchdown').cast(pl.Int64) == 1) if 'pass_touchdown' in pbp.columns else pl.lit(False))).then(1).otherwise(0)).sum().alias('pass_td'),
        (pl.when(valid & ((pl.col('rush_touchdown').cast(pl.Int64) == 1) if 'rush_touchdown' in pbp.columns else pl.lit(False))).then(1).otherwise(0)).sum().alias('rush_td'),
        (expr_int + expr_fuml).sum().alias('turnovers'),
        plays_expr.sum().alias('plays'),
        # third/fourth conversion
        pl.when(valid & (pl.col('down') == 3)).then(1).otherwise(0).sum().alias('third_att') if 'down' in pbp.columns else pl.lit(0).alias('third_att'),
        pl.when(valid & (pl.col('down') == 3) & (pl.col('first_down').cast(pl.Int64) == 1 if 'first_down' in pbp.columns else (pl.col('firstdown').cast(pl.Int64) == 1))).then(1).otherwise(0).sum().alias('third_conv') if ('down' in pbp.columns and ('first_down' in pbp.columns or 'firstdown' in pbp.columns)) else pl.lit(0).alias('third_conv'),
        pl.when(valid & (pl.col('down') == 4)).then(1).otherwise(0).sum().alias('fourth_att') if 'down' in pbp.columns else pl.lit(0).alias('fourth_att'),
        pl.when(valid & (pl.col('down') == 4) & (pl.col('first_down').cast(pl.Int64) == 1 if 'first_down' in pbp.columns else (pl.col('firstdown').cast(pl.Int64) == 1))).then(1).otherwise(0).sum().alias('fourth_conv') if ('down' in pbp.columns and ('first_down' in pbp.columns or 'firstdown' in pbp.columns)) else pl.lit(0).alias('fourth_conv'),
        # red zone
        pl.when(valid & ((pl.col('yardline_100') <= 20) if 'yardline_100' in pbp.columns else pl.lit(False)) & ((pl.col('down') == 1) if 'down' in pbp.columns else pl.lit(True))).then(1).otherwise(0).sum().alias('rz_entries'),
        pl.when(valid & ((pl.col('yardline_100') <= 20) if 'yardline_100' in pbp.columns else pl.lit(False)) & (pl.col('pass_touchdown').cast(pl.Int64) == 1 if 'pass_touchdown' in pbp.columns else pl.lit(False))).then(1).otherwise(0).sum().alias('rz_pass_td'),
        pl.when(valid & ((pl.col('yardline_100') <= 20) if 'yardline_100' in pbp.columns else pl.lit(False)) & (pl.col('rush_touchdown').cast(pl.Int64) == 1 if 'rush_touchdown' in pbp.columns else pl.lit(False))).then(1).otherwise(0).sum().alias('rz_rush_td'),
        # explosive
        pl.when(valid & ((pl.col('yards_gained') >= 20) if 'yards_gained' in pbp.columns else pl.lit(False))).then(1).otherwise(0).sum().alias('explosive'),
        # start field position
        (pl.when((pl.col('drive_play_number') == 1) if 'drive_play_number' in pbp.columns else pl.lit(False)).then(pl.col('yardline_100')).otherwise(None)).mean().alias('start_pos_avg') if 'yardline_100' in pbp.columns else pl.lit(None).alias('start_pos_avg'),
    ]

    if game_id_col:
        # count distinct games per team
        aggs.append(pl.col(game_id_col).n_unique().alias('games'))
    else:
        aggs.append(pl.lit(0).alias('games'))

    # If no last_n/venue/opponent filters -> fast vectorized path
    if not last_n and not venue and not opponent_conf and not opponent_div:
        grouped = df.group_by(group_cols).agg(aggs)
        # takeaways grouped by defensive team if available
        if defteam_col is not None:
            def_aggs = [
                ( ( (pl.col('interception') == 1).cast(pl.Int64) if 'interception' in pbp.columns else (pl.col('interception_player_id').is_not_null().cast(pl.Int64) if 'interception_player_id' in pbp.columns else pl.lit(0)))
                  + ( (pl.col('fumble_lost') == 1).cast(pl.Int64) if 'fumble_lost' in pbp.columns else (pl.col('fumble_lost_team').is_not_null().cast(pl.Int64) if 'fumble_lost_team' in pbp.columns else pl.lit(0))) ).sum().alias('takeaways')
            ]
            def_group = pbp.group_by([pl.col(defteam_col).alias('team')]).agg(def_aggs)
            grouped = grouped.join(def_group, on='team', how='left')
        else:
            grouped = grouped.with_columns([pl.lit(0).alias('takeaways')])

        result = grouped.with_columns([
            (pl.col('pass_yards') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('pyds_pg'),
            (pl.col('rush_yards') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('ruyds_pg'),
            (pl.col('tds') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('td_pg'),
            (pl.col('pass_td') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('pass_td_pg'),
            (pl.col('rush_td') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('rush_td_pg'),
            (pl.col('turnovers') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('to_pg'),
            (pl.col('total_yards') / pl.when(pl.col('plays') == 0).then(1).otherwise(pl.col('plays'))).round(1).alias('ypp'),
            ( (pl.col('takeaways') - pl.col('turnovers')) / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games')) ).round(1).alias('to_margin_pg'),
            ( (pl.col('third_conv') / pl.when(pl.col('third_att') == 0).then(1).otherwise(pl.col('third_att'))) * 100 ).round(1).alias('third_pct'),
            ( (pl.col('fourth_conv') / pl.when(pl.col('fourth_att') == 0).then(1).otherwise(pl.col('fourth_att'))) * 100 ).round(1).alias('fourth_pct'),
            ( ((pl.col('rz_pass_td') + pl.col('rz_rush_td')) / pl.when(pl.col('rz_entries') == 0).then(1).otherwise(pl.col('rz_entries'))) * 100 ).round(1).alias('rz_td_pct'),
            ( pl.col('explosive') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games')) ).round(1).alias('explosive_pg'),
            ( pl.col('plays') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games')) ).round(1).alias('plays_pg'),
        ])

        # Derive PF per game from PBP (mean of max posteam score per game)
        pf_df = None
        score_col = 'posteam_score_post' if 'posteam_score_post' in pbp.columns else ('posteam_score' if 'posteam_score' in pbp.columns else None)
        if score_col and posteam_col and game_id_col:
            tmp = pbp.select([pl.col(game_id_col).alias('gid'), pl.col(posteam_col).alias('team'), pl.col(score_col).alias('pts')]).group_by(['gid','team']).agg([pl.col('pts').max().alias('max_pts')])
            pf_df = tmp.group_by('team').agg([pl.col('max_pts').mean().round(1).alias('pf_pg')])
        result = pl.DataFrame(result)
        if pf_df is not None:
            result = result.join(pf_df, on='team', how='left')
        else:
            result = result.with_columns([pl.lit(0.0).alias('pf_pg')])

        teams = result.select([
            'team', 'pf_pg', 'pyds_pg', 'ruyds_pg', 'td_pg', 'pass_td_pg', 'rush_td_pg', 'to_pg', 'ypp', pl.col('tds').alias('td_total'),
            'to_margin_pg', 'third_pct', 'fourth_pct', 'rz_td_pct', 'explosive_pg', 'plays_pg', 'start_pos_avg'
        ]).to_dicts()
        return {"status": "success", "season": season_val, "teams": teams}

    # Slow path: per-team subset by venue/last_n/opponent using schedules
    def _load_sched():
        return nfl.load_schedules([season_val])
    sched = await run_in_threadpool(_load_sched)
    if 'season_type' in sched.columns:
        sched = sched.filter(pl.col('season_type') == 'REG')
    elif 'game_type' in sched.columns:
        sched = sched.filter(pl.col('game_type') == 'REG')
    if 'home_score' in sched.columns and 'away_score' in sched.columns:
        sched = sched.filter(pl.col('home_score').is_not_null() & pl.col('away_score').is_not_null())

    teams_list = pbp.select(pl.col(posteam_col)).unique().to_series().to_list()

    # Static maps for NFL 2025
    TEAM_TO_DIV: Dict[str, str] = {
        # AFC East
        'BUF': 'AFC East','MIA': 'AFC East','NE': 'AFC East','NYJ': 'AFC East',
        # AFC North
        'BAL': 'AFC North','CIN': 'AFC North','CLE': 'AFC North','PIT': 'AFC North',
        # AFC South
        'HOU': 'AFC South','IND': 'AFC South','JAX': 'AFC South','TEN': 'AFC South',
        # AFC West
        'DEN': 'AFC West','KC': 'AFC West','LV': 'AFC West','LAC': 'AFC West',
        # NFC East
        'DAL': 'NFC East','NYG': 'NFC East','PHI': 'NFC East','WAS': 'NFC East',
        # NFC North
        'CHI': 'NFC North','DET': 'NFC North','GB': 'NFC North','MIN': 'NFC North',
        # NFC South
        'ATL': 'NFC South','CAR': 'NFC South','NO': 'NFC South','TB': 'NFC South',
        # NFC West
        'ARI': 'NFC West','LA': 'NFC West','LAR': 'NFC West','SEA': 'NFC West','SF': 'NFC West',
    }
    TEAM_TO_CONF: Dict[str, str] = {t: dv.split(' ')[0] for t, dv in TEAM_TO_DIV.items()}
    def allowed_by_conf(conf: Optional[str]) -> Set[str]:
        if not conf:
            return set()
        u = str(conf).upper()
        return {t for t, c in TEAM_TO_CONF.items() if c.upper() == u}
    def allowed_by_div(div: Optional[str]) -> Set[str]:
        if not div:
            return set()
        u = str(div).upper()
        return {t for t, d in TEAM_TO_DIV.items() if d.upper() == u}
    out_rows: List[Dict[str, Any]] = []
    for t in teams_list:
        t_str = str(t)
        filt = (pl.col('home_team') == t_str) | (pl.col('away_team') == t_str)
        if str(venue or '').lower() == 'home':
            filt = (pl.col('home_team') == t_str)
        elif str(venue or '').lower() == 'away':
            filt = (pl.col('away_team') == t_str)
        sub = sched.filter(filt)
        # Filter by opponent conference/division if provided
        if opponent_conf or opponent_div:
            allowed_conf = allowed_by_conf(opponent_conf)
            allowed_div = allowed_by_div(opponent_div)
            if allowed_conf or allowed_div:
                sub = sub.with_columns([
                    pl.when(pl.col('home_team') == t_str).then(pl.col('away_team')).otherwise(pl.col('home_team')).alias('opp')
                ])
                allow_set = set()
                if allowed_conf:
                    allow_set |= allowed_conf
                if allowed_div:
                    allow_set |= allowed_div
                if allow_set:
                    sub = sub.filter(pl.col('opp').is_in(list(allow_set)))
        if 'game_date' in sub.columns:
            sub = sub.sort('game_date')
        if last_n and last_n > 0:
            sub = sub.tail(last_n)
        ids = set(sub['game_id']) if 'game_id' in sub.columns else set()

        t_df = df.filter((pl.col(posteam_col) == t_str) & (pl.col('game_id').is_in(list(ids)) if ids else pl.lit(False)))
        # compute plays/yds
        pass_yards = t_df.filter(valid & (pass_mask if pass_mask is not None else pl.lit(False)) & (~(scramble_mask) if scramble_mask is not None else pl.lit(True))).select(pl.col(yards_col)).to_series().sum() if yards_col else 0
        rush_yards = t_df.filter(valid & ((rush_mask if rush_mask is not None else pl.lit(False)) | (scramble_mask if scramble_mask is not None else pl.lit(False)))).select(pl.col(yards_col)).to_series().sum() if yards_col else 0
        plays = t_df.filter(valid & ((pass_mask if pass_mask is not None else pl.lit(False)) | (rush_mask if rush_mask is not None else pl.lit(False)) | (scramble_mask if scramble_mask is not None else pl.lit(False)))).height
        td_total = t_df.filter(valid & (pl.col(td_col) == 1) if td_col else pl.lit(False)).height if td_col else 0
        to_count = 0
        if int_col:
            to_count += t_df.filter(valid & ((pl.col(int_col) == 1) if int_col == 'interception' else pl.col(int_col).is_not_null())).height
        if fuml_col:
            to_count += t_df.filter(valid & ((pl.col(fuml_col) == 1) if fuml_col == 'fumble_lost' else pl.col(fuml_col).is_not_null())).height
        # third/fourth
        third_att = t_df.filter(valid & (pl.col('down') == 3) if 'down' in pbp.columns else pl.lit(False)).height
        third_conv = t_df.filter(valid & (pl.col('down') == 3) & ((pl.col('first_down').cast(pl.Int64) == 1) if 'first_down' in pbp.columns else ((pl.col('firstdown').cast(pl.Int64) == 1) if 'firstdown' in pbp.columns else pl.lit(False)))).height
        fourth_att = t_df.filter(valid & (pl.col('down') == 4) if 'down' in pbp.columns else pl.lit(False)).height
        fourth_conv = t_df.filter(valid & (pl.col('down') == 4) & ((pl.col('first_down').cast(pl.Int64) == 1) if 'first_down' in pbp.columns else ((pl.col('firstdown').cast(pl.Int64) == 1) if 'firstdown' in pbp.columns else pl.lit(False)))).height
        rz_entries = t_df.filter(valid & ((pl.col('yardline_100') <= 20) if 'yardline_100' in pbp.columns else pl.lit(False)) & ((pl.col('down') == 1) if 'down' in pbp.columns else pl.lit(True))).height
        rz_pass_td = t_df.filter(valid & ((pl.col('yardline_100') <= 20) if 'yardline_100' in pbp.columns else pl.lit(False)) & ((pl.col('pass_touchdown').cast(pl.Int64) == 1) if 'pass_touchdown' in pbp.columns else pl.lit(False))).height
        rz_rush_td = t_df.filter(valid & ((pl.col('yardline_100') <= 20) if 'yardline_100' in pbp.columns else pl.lit(False)) & ((pl.col('rush_touchdown').cast(pl.Int64) == 1) if 'rush_touchdown' in pbp.columns else pl.lit(False))).height
        explosive = t_df.filter(valid & ((pl.col('yards_gained') >= 20) if 'yards_gained' in pbp.columns else pl.lit(False))).height
        # games count: from schedules subset size
        gp = sub.height
        def per_game(x: float) -> float:
            return round(float(x) / float(gp or 1), 1)
        # compute PF/J from PBP subset for team
        pf_pg_val = 0.0
        score_col = 'posteam_score_post' if 'posteam_score_post' in t_df.columns else ('posteam_score' if 'posteam_score' in t_df.columns else None)
        if score_col and 'game_id' in t_df.columns:
            by_game = t_df.group_by('game_id').agg([pl.col(score_col).max().alias('pts')])
            if by_game.height:
                pf_pg_val = round(float(by_game['pts'].mean() or 0.0), 1)

        row = {
            'team': t_str,
            'pf_pg': pf_pg_val,
            'pyds_pg': per_game(pass_yards),
            'ruyds_pg': per_game(rush_yards),
            'td_pg': per_game(td_total),
            'pass_td_pg': per_game(t_df.filter(valid & ((pl.col('pass_touchdown').cast(pl.Int64) == 1) if 'pass_touchdown' in pbp.columns else pl.lit(False))).height),
            'rush_td_pg': per_game(t_df.filter(valid & ((pl.col('rush_touchdown').cast(pl.Int64) == 1) if 'rush_touchdown' in pbp.columns else pl.lit(False))).height),
            'to_pg': per_game(to_count),
            'ypp': round(float(pass_yards + rush_yards) / float(plays or 1), 1) if (pass_yards or rush_yards) else 0.0,
            'td_total': float(td_total),
            'to_margin_pg': 0.0,  # omitted here for simplicity
            'third_pct': round((third_conv / (third_att or 1)) * 100, 1) if third_att else 0.0,
            'fourth_pct': round((fourth_conv / (fourth_att or 1)) * 100, 1) if fourth_att else 0.0,
            'rz_td_pct': round(((rz_pass_td + rz_rush_td) / (rz_entries or 1)) * 100, 1) if rz_entries else 0.0,
            'explosive_pg': per_game(explosive),
            'plays_pg': per_game(plays),
            'start_pos_avg': None,
        }
        out_rows.append(row)

    return {"status": "success", "season": season_val, "teams": out_rows}



async def get_team_defense_service(
    team: str,
    season: Optional[int] = None,
    game_types: Optional[str] = None,
    *,
    last_n: Optional[int] = None,
    venue: Optional[str] = None,
    opponent_conf: Optional[str] = None,
    opponent_div: Optional[str] = None,
) -> Dict[str, Any]:
    """Aggregate defensive metrics for a team from play-by-play and schedules (REG by default).

    Metrics (per-game unless noted):
      - pa_pg: points allowed per game (from schedules)
      - pyds_allowed_pg: passing yards allowed per game (dropbacks, excludes scrambles)
      - ruyds_allowed_pg: rushing yards allowed per game (includes scrambles)
      - td_allowed_total: total TDs allowed (pbp)
      - sacks_pg: sacks made per game (pbp)
      - takeaways_pg: interceptions + fumbles forced lost by opponent per game (pbp)
      - third_allowed_pct: opponent 3rd down conversion % allowed
      - fourth_allowed_pct: opponent 4th down conversion % allowed
      - rz_td_allowed_pct: opponent red zone TD % allowed
      - yppa: yards per play allowed
    """
    team_abbr = (team or '').upper()
    if not team_abbr:
        return {"status": "error", "message": "team required"}

    current_season = nfl.get_current_season()
    season_val = _safe_int(season) or int(current_season)

    def _load_pbp():
        return nfl.load_pbp([season_val])

    pbp = await run_in_threadpool(_load_pbp)

    # Season type filter (REG default)
    if game_types:
        types = {s.strip().upper() for s in str(game_types).split(',') if s.strip()}
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type').str.to_uppercase().is_in(list(types)))
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type').str.to_uppercase().is_in(list(types)))
    else:
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type') == 'REG')
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type') == 'REG')

    posteam_col = 'posteam' if 'posteam' in pbp.columns else ('possession_team' if 'possession_team' in pbp.columns else None)
    defteam_col = 'defteam' if 'defteam' in pbp.columns else ('def_team' if 'def_team' in pbp.columns else None)
    if not defteam_col or not posteam_col:
        return {"status": "success", "season": season_val, "team": team_abbr, "metrics": {}}

    # Valid plays (exclude no_play, 2pt, kneel, spike)
    valid = pl.lit(True)
    if 'no_play' in pbp.columns:
        valid &= (pl.col('no_play').cast(pl.Int64) != 1)
    if 'two_point_attempt' in pbp.columns:
        valid &= (pl.col('two_point_attempt').cast(pl.Int64) != 1)
    if 'qb_kneel' in pbp.columns:
        valid &= (pl.col('qb_kneel').cast(pl.Int64) != 1)
    if 'qb_spike' in pbp.columns:
        valid &= (pl.col('qb_spike').cast(pl.Int64) != 1)

    df_def = pbp.filter((pl.col(defteam_col) == team_abbr) & valid)

    # Optional subset by venue/last_n
    if (last_n is not None and last_n > 0) or (venue is not None and str(venue).lower() in {"home", "away"}) or (opponent_conf is not None) or (opponent_div is not None):
        def _load_sched():
            return nfl.load_schedules([season_val])
        sched = await run_in_threadpool(_load_sched)
        if 'season_type' in sched.columns:
            sched = sched.filter(pl.col('season_type') == 'REG')
        elif 'game_type' in sched.columns:
            sched = sched.filter(pl.col('game_type') == 'REG')
        if 'home_score' in sched.columns and 'away_score' in sched.columns:
            sched = sched.filter(pl.col('home_score').is_not_null() & pl.col('away_score').is_not_null())
        filt = (pl.col('home_team') == team_abbr) | (pl.col('away_team') == team_abbr)
        if str(venue or '').lower() == 'home':
            filt = (pl.col('home_team') == team_abbr)
        elif str(venue or '').lower() == 'away':
            filt = (pl.col('away_team') == team_abbr)
        sub = sched.filter(filt)
        # Apply opponent filters if provided
        TEAM_TO_DIV = {
            'BUF': 'AFC East','MIA': 'AFC East','NE': 'AFC East','NYJ': 'AFC East',
            'BAL': 'AFC North','CIN': 'AFC North','CLE': 'AFC North','PIT': 'AFC North',
            'HOU': 'AFC South','IND': 'AFC South','JAX': 'AFC South','TEN': 'AFC South',
            'DEN': 'AFC West','KC': 'AFC West','LV': 'AFC West','LAC': 'AFC West',
            'DAL': 'NFC East','NYG': 'NFC East','PHI': 'NFC East','WAS': 'NFC East',
            'CHI': 'NFC North','DET': 'NFC North','GB': 'NFC North','MIN': 'NFC North',
            'ATL': 'NFC South','CAR': 'NFC South','NO': 'NFC South','TB': 'NFC South',
            'ARI': 'NFC West','LA': 'NFC West','LAR': 'NFC West','SEA': 'NFC West','SF': 'NFC West',
        }
        TEAM_TO_CONF = {t: dv.split(' ')[0] for t, dv in TEAM_TO_DIV.items()}
        if opponent_conf or opponent_div:
            sub = sub.with_columns([
                pl.when(pl.col('home_team') == team_abbr).then(pl.col('away_team')).otherwise(pl.col('home_team')).alias('opp')
            ])
            if opponent_conf and str(opponent_conf).upper() in {'AFC','NFC'}:
                allowed = {t for t, c in TEAM_TO_CONF.items() if c.upper() == str(opponent_conf).upper()}
                sub = sub.filter(pl.col('opp').is_in(list(allowed)))
            if opponent_div:
                allowedd = {t for t, d in TEAM_TO_DIV.items() if d.upper() == str(opponent_div).upper()}
                if allowedd:
                    sub = sub.filter(pl.col('opp').is_in(list(allowedd)))
        if 'game_date' in sub.columns:
            sub = sub.sort('game_date')
        if last_n and last_n > 0:
            sub = sub.tail(last_n)
        ids = set(sub['game_id']) if 'game_id' in sub.columns else set()
        if ids:
            df_def = df_def.filter(pl.col('game_id').is_in(list(ids)))
        else:
            # Con filtros pero sin juegos válidos: subconjunto vacío
            df_def = df_def.head(0)
    if df_def.height == 0:
        return {"status": "success", "season": season_val, "team": team_abbr, "games": 0, "metrics": {}}

    game_id_col = 'game_id' if 'game_id' in df_def.columns else None
    games = df_def.select(pl.col(game_id_col)).unique().height if game_id_col else 0

    yards_col = 'yards_gained' if 'yards_gained' in df_def.columns else None
    is_pass = (pl.col('pass').cast(pl.Int64) == 1) if 'pass' in df_def.columns else ((pl.col('is_pass').cast(pl.Int64) == 1) if 'is_pass' in df_def.columns else None)
    is_rush = (pl.col('rush').cast(pl.Int64) == 1) if 'rush' in df_def.columns else ((pl.col('is_rush').cast(pl.Int64) == 1) if 'is_rush' in df_def.columns else None)
    scramble = (pl.col('qb_scramble').cast(pl.Int64) == 1) if 'qb_scramble' in df_def.columns else None
    down_col = 'down' if 'down' in df_def.columns else None
    first_down_col = 'first_down' if 'first_down' in df_def.columns else ('firstdown' if 'firstdown' in df_def.columns else None)
    yardline100_col = 'yardline_100' if 'yardline_100' in df_def.columns else None

    # Yardage allowed
    pass_yards_allowed = 0
    rush_yards_allowed = 0
    if yards_col and is_pass is not None:
        pass_yards_allowed = df_def.filter(is_pass & (~scramble if scramble is not None else pl.lit(True))).select(pl.col(yards_col)).to_series().sum()
    if yards_col and (is_rush is not None or scramble is not None):
        rush_yards_allowed = df_def.filter((is_rush if is_rush is not None else pl.lit(False)) | (scramble if scramble is not None else pl.lit(False))).select(pl.col(yards_col)).to_series().sum()

    plays_against = 0
    if is_pass is not None or is_rush is not None or scramble is not None:
        plays_against = df_def.filter((is_pass if is_pass is not None else pl.lit(False)) | (is_rush if is_rush is not None else pl.lit(False)) | (scramble if scramble is not None else pl.lit(False))).height
    yppa = round(float(pass_yards_allowed + rush_yards_allowed) / float(plays_against), 1) if plays_against else 0.0

    # TDs allowed (touchdown on a play where opponent had possession)
    td_allowed_total = 0
    pass_td_allowed = 0
    rush_td_allowed = 0
    if 'touchdown' in df_def.columns:
        td_allowed_total = df_def.filter(pl.col('touchdown').cast(pl.Int64) == 1).height
    if 'pass_touchdown' in df_def.columns:
        pass_td_allowed = df_def.filter(pl.col('pass_touchdown').cast(pl.Int64) == 1).height
    if 'rush_touchdown' in df_def.columns:
        rush_td_allowed = df_def.filter(pl.col('rush_touchdown').cast(pl.Int64) == 1).height

    # Sacks made by defense
    sacks_pg = 0.0
    if 'sack' in df_def.columns:
        sacks_pg = round(df_def.filter(pl.col('sack').cast(pl.Int64) == 1).height / (games or 1), 1)

    # Takeaways (INT + fumble lost by opponent)
    takeaways = 0
    if 'interception' in df_def.columns:
        takeaways += df_def.filter(pl.col('interception') == 1).height
    elif 'interception_player_id' in df_def.columns:
        takeaways += df_def.filter(pl.col('interception_player_id').is_not_null()).height
    if 'fumble_lost' in df_def.columns:
        takeaways += df_def.filter(pl.col('fumble_lost') == 1).height
    elif 'fumble_lost_team' in df_def.columns:
        takeaways += df_def.filter(pl.col('fumble_lost_team').is_not_null()).height
    takeaways_pg = round(takeaways / (games or 1), 1)

    # 3rd/4th down allowed
    third_allowed_pct = None
    fourth_allowed_pct = None
    if down_col and first_down_col:
        third_att = df_def.filter(pl.col(down_col) == 3).height
        third_conv = df_def.filter((pl.col(down_col) == 3) & (pl.col(first_down_col).cast(pl.Int64) == 1)).height
        fourth_att = df_def.filter(pl.col(down_col) == 4).height
        fourth_conv = df_def.filter((pl.col(down_col) == 4) & (pl.col(first_down_col).cast(pl.Int64) == 1)).height
        third_allowed_pct = round((third_conv / third_att) * 100, 1) if third_att else 0.0
        fourth_allowed_pct = round((fourth_conv / fourth_att) * 100, 1) if fourth_att else 0.0

    # Red zone TD % allowed
    rz_td_allowed_pct = None
    if yardline100_col:
        rz_entries = df_def.filter((pl.col(yardline100_col) <= 20) & ((pl.col(down_col) == 1) if down_col else True)).height
        rz_tds = df_def.filter((pl.col('touchdown').cast(pl.Int64) == 1) & (pl.col(yardline100_col) <= 20)).height if 'touchdown' in df_def.columns else 0
        rz_td_allowed_pct = round((rz_tds / rz_entries) * 100, 1) if rz_entries else 0.0

    # Points allowed per game from schedules – use the same subset 'sub' if it exists (respect filters)
    # If no filtered subset was built above, build a general subset without opponent filters
    def _load_sched():
        return nfl.load_schedules([season_val])
    sched_all = await run_in_threadpool(_load_sched)
    if 'season_type' in sched_all.columns:
        sched_all = sched_all.filter(pl.col('season_type') == 'REG')
    elif 'game_type' in sched_all.columns:
        sched_all = sched_all.filter(pl.col('game_type') == 'REG')
    sched_all = sched_all.filter(pl.col('home_score').is_not_null() & pl.col('away_score').is_not_null())
    # Reconstruct a basic subset if we didn't go through the earlier subset path
    if 'sub' not in locals():
        base = (pl.col('home_team') == team_abbr) | (pl.col('away_team') == team_abbr)
        sub = sched_all.filter(base)
        if str(venue or '').lower() == 'home':
            sub = sched_all.filter(pl.col('home_team') == team_abbr)
        elif str(venue or '').lower() == 'away':
            sub = sched_all.filter(pl.col('away_team') == team_abbr)
        if last_n and last_n > 0 and 'game_date' in sub.columns:
            sub = sub.sort('game_date').tail(last_n)

    games_played = sub.height if isinstance(sub, pl.DataFrame) else 0
    if games_played:
        pa_total = sub.with_columns(
            pl.when(pl.col('home_team') == team_abbr).then(pl.col('away_score')).otherwise(pl.col('home_score')).alias('pa')
        )['pa'].sum()
        pa_pg = round(float(pa_total) / float(games_played), 1)
    else:
        pa_pg = 0.0

    return {
        "status": "success",
        "season": season_val,
        "team": team_abbr,
        "games": games,
        "metrics": {
            "pa_pg": pa_pg,
            "pyds_allowed_pg": round((pass_yards_allowed / (games or 1)), 1),
            "ruyds_allowed_pg": round((rush_yards_allowed / (games or 1)), 1),
            "td_allowed_total": float(td_allowed_total),
            "pass_td_allowed_pg": round(pass_td_allowed / (games or 1), 1),
            "rush_td_allowed_pg": round(rush_td_allowed / (games or 1), 1),
            "sacks_pg": sacks_pg,
            "takeaways_pg": takeaways_pg,
            "third_allowed_pct": third_allowed_pct,
            "fourth_allowed_pct": fourth_allowed_pct,
            "rz_td_allowed_pct": rz_td_allowed_pct,
            "yppa": yppa,
        }
    }


async def get_defense_league_service(
    season: Optional[int] = None,
    game_types: Optional[str] = None,
    *,
    last_n: Optional[int] = None,
    venue: Optional[str] = None,
    opponent_conf: Optional[str] = None,
    opponent_div: Optional[str] = None,
) -> Dict[str, Any]:
    """League-wide defensive metrics per team for rankings (REG by default)."""
    current_season = nfl.get_current_season()
    season_val = _safe_int(season) or int(current_season)

    def _load_pbp():
        return nfl.load_pbp([season_val])

    pbp = await run_in_threadpool(_load_pbp)

    # Season type filter
    if game_types:
        types = {s.strip().upper() for s in str(game_types).split(',') if s.strip()}
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type').str.to_uppercase().is_in(list(types)))
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type').str.to_uppercase().is_in(list(types)))
    else:
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type') == 'REG')
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type') == 'REG')

    posteam_col = 'posteam' if 'posteam' in pbp.columns else ('possession_team' if 'possession_team' in pbp.columns else None)
    defteam_col = 'defteam' if 'defteam' in pbp.columns else ('def_team' if 'def_team' in pbp.columns else None)
    game_id_col = 'game_id' if 'game_id' in pbp.columns else None
    if not defteam_col or not posteam_col:
        return {"status": "success", "season": season_val, "teams": []}

    # Valid plays
    valid = pl.lit(True)
    for c in ['no_play', 'two_point_attempt', 'qb_kneel', 'qb_spike']:
        if c in pbp.columns:
            valid &= (pl.col(c).cast(pl.Int64) != 1)

    is_pass = (pl.col('pass').cast(pl.Int64) == 1) if 'pass' in pbp.columns else ((pl.col('is_pass').cast(pl.Int64) == 1) if 'is_pass' in pbp.columns else None)
    is_rush = (pl.col('rush').cast(pl.Int64) == 1) if 'rush' in pbp.columns else ((pl.col('is_rush').cast(pl.Int64) == 1) if 'is_rush' in pbp.columns else None)
    scramble = (pl.col('qb_scramble').cast(pl.Int64) == 1) if 'qb_scramble' in pbp.columns else None
    yards_col = 'yards_gained' if 'yards_gained' in pbp.columns else None

    # Aggregations by defensive team
    group_cols = [pl.col(defteam_col).alias('team')]
    aggs = []
    if yards_col is not None:
        aggs.extend([
            pl.when(valid & (is_pass if is_pass is not None else pl.lit(False)) & (~(scramble) if scramble is not None else pl.lit(True))).then(pl.col(yards_col)).otherwise(0).sum().alias('pass_yards_allowed'),
            pl.when(valid & ((is_rush if is_rush is not None else pl.lit(False)) | (scramble if scramble is not None else pl.lit(False)))).then(pl.col(yards_col)).otherwise(0).sum().alias('rush_yards_allowed'),
            pl.when(valid & ((is_pass if is_pass is not None else pl.lit(False)) | (is_rush if is_rush is not None else pl.lit(False)) | (scramble if scramble is not None else pl.lit(False)))).then(1).otherwise(0).sum().alias('plays_against'),
        ])
    aggs.append(pl.when(valid & (pl.col('sack').cast(pl.Int64) == 1) if 'sack' in pbp.columns else pl.lit(False)).then(1).otherwise(0).sum().alias('sacks'))
    aggs.append(pl.when(valid & (pl.col('touchdown').cast(pl.Int64) == 1) if 'touchdown' in pbp.columns else pl.lit(False)).then(1).otherwise(0).sum().alias('td_allowed'))
    # TD allowed breakdowns (for rankings)
    aggs.append((pl.when(valid & ((pl.col('pass_touchdown').cast(pl.Int64) == 1) if 'pass_touchdown' in pbp.columns else pl.lit(False))).then(1).otherwise(0)).sum().alias('pass_td_allowed'))
    aggs.append((pl.when(valid & ((pl.col('rush_touchdown').cast(pl.Int64) == 1) if 'rush_touchdown' in pbp.columns else pl.lit(False))).then(1).otherwise(0)).sum().alias('rush_td_allowed'))
    # 3rd/4th down allowed components
    aggs.append((pl.when(valid & (pl.col('down') == 3) if 'down' in pbp.columns else pl.lit(False)).then(1).otherwise(0)).sum().alias('third_att'))
    aggs.append((pl.when(valid & (pl.col('down') == 3) & ((pl.col('first_down').cast(pl.Int64) == 1) if 'first_down' in pbp.columns else ((pl.col('firstdown').cast(pl.Int64) == 1) if 'firstdown' in pbp.columns else pl.lit(False)))).then(1).otherwise(0)).sum().alias('third_conv'))
    aggs.append((pl.when(valid & (pl.col('down') == 4) if 'down' in pbp.columns else pl.lit(False)).then(1).otherwise(0)).sum().alias('fourth_att'))
    aggs.append((pl.when(valid & (pl.col('down') == 4) & ((pl.col('first_down').cast(pl.Int64) == 1) if 'first_down' in pbp.columns else ((pl.col('firstdown').cast(pl.Int64) == 1) if 'firstdown' in pbp.columns else pl.lit(False)))).then(1).otherwise(0)).sum().alias('fourth_conv'))
    # red zone allowed
    aggs.append((pl.when(valid & ((pl.col('yardline_100') <= 20) if 'yardline_100' in pbp.columns else pl.lit(False)) & ((pl.col('down') == 1) if 'down' in pbp.columns else pl.lit(True))).then(1).otherwise(0)).sum().alias('rz_entries'))
    aggs.append((pl.when(valid & ((pl.col('yardline_100') <= 20) if 'yardline_100' in pbp.columns else pl.lit(False)) & ((pl.col('touchdown').cast(pl.Int64) == 1) if 'touchdown' in pbp.columns else pl.lit(False))).then(1).otherwise(0)).sum().alias('rz_td_allowed'))
    # takeaways
    take_int = (pl.col('interception') == 1).cast(pl.Int64) if 'interception' in pbp.columns else (pl.col('interception_player_id').is_not_null().cast(pl.Int64) if 'interception_player_id' in pbp.columns else pl.lit(0))
    take_fuml = (pl.col('fumble_lost') == 1).cast(pl.Int64) if 'fumble_lost' in pbp.columns else (pl.col('fumble_lost_team').is_not_null().cast(pl.Int64) if 'fumble_lost_team' in pbp.columns else pl.lit(0))
    aggs.append((take_int + take_fuml).sum().alias('takeaways'))
    if game_id_col:
        aggs.append(pl.col(game_id_col).n_unique().alias('games'))
    else:
        aggs.append(pl.lit(0).alias('games'))

    # If no last_n/venue/opponent filters -> vectorized path
    if not last_n and not venue and not opponent_conf and not opponent_div:
        grouped = pbp.group_by(group_cols).agg(aggs)
        result = grouped.with_columns([
            (pl.col('pass_yards_allowed') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('pyds_allowed_pg') if 'pass_yards_allowed' in grouped.columns else pl.lit(0).alias('pyds_allowed_pg'),
            (pl.col('rush_yards_allowed') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('ruyds_allowed_pg') if 'rush_yards_allowed' in grouped.columns else pl.lit(0).alias('ruyds_allowed_pg'),
            (pl.col('sacks') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('sacks_pg'),
            (pl.col('takeaways') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('takeaways_pg'),
            ( 
                ( ((pl.col('pass_yards_allowed') + pl.col('rush_yards_allowed')) / pl.when(pl.col('plays_against') == 0).then(1).otherwise(pl.col('plays_against'))).round(1) )
                if 'pass_yards_allowed' in grouped.columns else pl.lit(0)
            ).alias('yppa'),
            (pl.col('pass_td_allowed') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('pass_td_allowed_pg'),
            (pl.col('rush_td_allowed') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('rush_td_allowed_pg'),
            ((pl.col('third_conv') / pl.when(pl.col('third_att') == 0).then(1).otherwise(pl.col('third_att'))) * 100).round(1).alias('third_allowed_pct'),
            ((pl.col('fourth_conv') / pl.when(pl.col('fourth_att') == 0).then(1).otherwise(pl.col('fourth_att'))) * 100).round(1).alias('fourth_allowed_pct'),
            (((pl.col('rz_td_allowed')) / pl.when(pl.col('rz_entries') == 0).then(1).otherwise(pl.col('rz_entries'))) * 100).round(1).alias('rz_td_allowed_pct'),
        ])

        def _load_sched():
            return nfl.load_schedules([season_val])
        sched = await run_in_threadpool(_load_sched)
        if 'season_type' in sched.columns:
            sched = sched.filter(pl.col('season_type') == 'REG')
        elif 'game_type' in sched.columns:
            sched = sched.filter(pl.col('game_type') == 'REG')
        sched = sched.filter(pl.col('home_score').is_not_null() & pl.col('away_score').is_not_null())

        pa_rows = []
        for row in result.select('team', 'games').to_dicts():
            t = row['team']
            team_games = sched.filter((pl.col('home_team') == t) | (pl.col('away_team') == t))
            gp = team_games.height
            if gp == 0:
                pa_pg = 0.0
            else:
                pa_pg = team_games.with_columns(
                    pl.when(pl.col('home_team') == t).then(pl.col('away_score')).otherwise(pl.col('home_score')).alias('pa')
                )['pa'].sum() / gp
            pa_rows.append({'team': t, 'pa_pg': round(float(pa_pg), 1)})
        pa_df = pl.DataFrame(pa_rows)
        merged = pl.DataFrame(result).join(pa_df, on='team', how='left')
        teams = merged.select(['team','pa_pg','pyds_allowed_pg','ruyds_allowed_pg','td_allowed','pass_td_allowed_pg','rush_td_allowed_pg','sacks_pg','takeaways_pg','yppa','third_allowed_pct','fourth_allowed_pct','rz_td_allowed_pct']).to_dicts()
        return {"status": "success", "season": season_val, "teams": teams}

    # Slow path: per-team subset by venue/last_n/opponent filters via schedules
    def _load_sched():
        return nfl.load_schedules([season_val])
    sched = await run_in_threadpool(_load_sched)
    if 'season_type' in sched.columns:
        sched = sched.filter(pl.col('season_type') == 'REG')
    elif 'game_type' in sched.columns:
        sched = sched.filter(pl.col('game_type') == 'REG')
    sched = sched.filter(pl.col('home_score').is_not_null() & pl.col('away_score').is_not_null())

    teams_list = pbp.select(pl.col(defteam_col)).unique().to_series().to_list()
    # Opponent maps
    TEAM_TO_DIV: Dict[str, str] = {
        'BUF': 'AFC East','MIA': 'AFC East','NE': 'AFC East','NYJ': 'AFC East',
        'BAL': 'AFC North','CIN': 'AFC North','CLE': 'AFC North','PIT': 'AFC North',
        'HOU': 'AFC South','IND': 'AFC South','JAX': 'AFC South','TEN': 'AFC South',
        'DEN': 'AFC West','KC': 'AFC West','LV': 'AFC West','LAC': 'AFC West',
        'DAL': 'NFC East','NYG': 'NFC East','PHI': 'NFC East','WAS': 'NFC East',
        'CHI': 'NFC North','DET': 'NFC North','GB': 'NFC North','MIN': 'NFC North',
        'ATL': 'NFC South','CAR': 'NFC South','NO': 'NFC South','TB': 'NFC South',
        'ARI': 'NFC West','LA': 'NFC West','LAR': 'NFC West','SEA': 'NFC West','SF': 'NFC West',
    }
    TEAM_TO_CONF: Dict[str, str] = {t: dv.split(' ')[0] for t, dv in TEAM_TO_DIV.items()}
    out_rows: List[Dict[str, Any]] = []
    for t in teams_list:
        t_str = str(t)
        filt = (pl.col('home_team') == t_str) | (pl.col('away_team') == t_str)
        if str(venue or '').lower() == 'home':
            filt = (pl.col('home_team') == t_str)
        elif str(venue or '').lower() == 'away':
            filt = (pl.col('away_team') == t_str)
        sub = sched.filter(filt)
        # Apply opponent filters if provided
        if opponent_conf or opponent_div:
            sub = sub.with_columns([
                pl.when(pl.col('home_team') == t_str).then(pl.col('away_team')).otherwise(pl.col('home_team')).alias('opp')
            ])
            if opponent_conf and str(opponent_conf).upper() in {'AFC','NFC'}:
                allowed = {x for x, c in TEAM_TO_CONF.items() if c.upper() == str(opponent_conf).upper()}
                sub = sub.filter(pl.col('opp').is_in(list(allowed)))
            if opponent_div:
                allowdd = {x for x, d in TEAM_TO_DIV.items() if d.upper() == str(opponent_div).upper()}
                if allowdd:
                    sub = sub.filter(pl.col('opp').is_in(list(allowdd)))
        if 'game_date' in sub.columns:
            sub = sub.sort('game_date')
        if last_n and last_n > 0:
            sub = sub.tail(last_n)
        ids = set(sub['game_id']) if 'game_id' in sub.columns else set()
        t_df = pbp.filter((pl.col(defteam_col) == t_str) & valid & (pl.col('game_id').is_in(list(ids)) if ids else pl.lit(False)))

        yards_col = 'yards_gained' if 'yards_gained' in t_df.columns else None
        is_pass = (pl.col('pass').cast(pl.Int64) == 1) if 'pass' in t_df.columns else ((pl.col('is_pass').cast(pl.Int64) == 1) if 'is_pass' in t_df.columns else None)
        is_rush = (pl.col('rush').cast(pl.Int64) == 1) if 'rush' in t_df.columns else ((pl.col('is_rush').cast(pl.Int64) == 1) if 'is_rush' in t_df.columns else None)
        scramble = (pl.col('qb_scramble').cast(pl.Int64) == 1) if 'qb_scramble' in t_df.columns else None
        pass_yards_allowed = t_df.filter((is_pass if is_pass is not None else pl.lit(False)) & (~scramble if scramble is not None else pl.lit(True))).select(pl.col(yards_col)).to_series().sum() if yards_col and is_pass is not None else 0
        rush_yards_allowed = t_df.filter((is_rush if is_rush is not None else pl.lit(False)) | (scramble if scramble is not None else pl.lit(False))).select(pl.col(yards_col)).to_series().sum() if yards_col and (is_rush is not None or scramble is not None) else 0
        plays_against = t_df.filter((is_pass if is_pass is not None else pl.lit(False)) | (is_rush if is_rush is not None else pl.lit(False)) | (scramble if scramble is not None else pl.lit(False))).height if (is_pass is not None or is_rush is not None or scramble is not None) else 0
        yppa = round(float(pass_yards_allowed + rush_yards_allowed) / float(plays_against or 1), 1) if (pass_yards_allowed or rush_yards_allowed) else 0.0
        td_allowed = t_df.filter((pl.col('touchdown').cast(pl.Int64) == 1) if 'touchdown' in t_df.columns else pl.lit(False)).height
        ptd_allowed = t_df.filter((pl.col('pass_touchdown').cast(pl.Int64) == 1) if 'pass_touchdown' in t_df.columns else pl.lit(False)).height
        rtd_allowed = t_df.filter((pl.col('rush_touchdown').cast(pl.Int64) == 1) if 'rush_touchdown' in t_df.columns else pl.lit(False)).height
        sacks = t_df.filter((pl.col('sack').cast(pl.Int64) == 1) if 'sack' in t_df.columns else pl.lit(False)).height
        take_int = t_df.filter((pl.col('interception') == 1) if 'interception' in t_df.columns else (pl.col('interception_player_id').is_not_null() if 'interception_player_id' in t_df.columns else pl.lit(False))).height
        take_fuml = t_df.filter((pl.col('fumble_lost') == 1) if 'fumble_lost' in t_df.columns else (pl.col('fumble_lost_team').is_not_null() if 'fumble_lost_team' in t_df.columns else pl.lit(False))).height
        third_att = t_df.filter((pl.col('down') == 3) if 'down' in t_df.columns else pl.lit(False)).height
        third_conv = t_df.filter((pl.col('down') == 3) & ((pl.col('first_down').cast(pl.Int64) == 1) if 'first_down' in t_df.columns else ((pl.col('firstdown').cast(pl.Int64) == 1) if 'firstdown' in t_df.columns else pl.lit(False)))).height
        fourth_att = t_df.filter((pl.col('down') == 4) if 'down' in t_df.columns else pl.lit(False)).height
        fourth_conv = t_df.filter((pl.col('down') == 4) & ((pl.col('first_down').cast(pl.Int64) == 1) if 'first_down' in t_df.columns else ((pl.col('firstdown').cast(pl.Int64) == 1) if 'firstdown' in t_df.columns else pl.lit(False)))).height
        rz_entries = t_df.filter(((pl.col('yardline_100') <= 20) if 'yardline_100' in t_df.columns else pl.lit(False)) & ((pl.col('down') == 1) if 'down' in t_df.columns else pl.lit(True))).height
        rz_td = t_df.filter(((pl.col('yardline_100') <= 20) if 'yardline_100' in t_df.columns else pl.lit(False)) & ((pl.col('touchdown').cast(pl.Int64) == 1) if 'touchdown' in t_df.columns else pl.lit(False))).height
        gp = sub.height
        def per_game(x: float) -> float:
            return round(float(x) / float(gp or 1), 1)
        # points allowed from schedules subset
        if gp == 0:
            pa_pg = 0.0
        else:
            pa_pg = sub.with_columns(
                pl.when(pl.col('home_team') == t_str).then(pl.col('away_score')).otherwise(pl.col('home_score')).alias('pa')
            )['pa'].sum() / gp
        out_rows.append({
            'team': t_str,
            'pa_pg': round(float(pa_pg), 1),
            'pyds_allowed_pg': per_game(pass_yards_allowed),
            'ruyds_allowed_pg': per_game(rush_yards_allowed),
            'td_allowed': float(td_allowed),
            'pass_td_allowed_pg': per_game(ptd_allowed),
            'rush_td_allowed_pg': per_game(rtd_allowed),
            'sacks_pg': per_game(sacks),
            'takeaways_pg': per_game(take_int + take_fuml),
            'yppa': yppa,
            'third_allowed_pct': round((third_conv / (third_att or 1)) * 100, 1) if third_att else 0.0,
            'fourth_allowed_pct': round((fourth_conv / (fourth_att or 1)) * 100, 1) if fourth_att else 0.0,
            'rz_td_allowed_pct': round((rz_td / (rz_entries or 1)) * 100, 1) if rz_entries else 0.0,
        })

    return {"status": "success", "season": season_val, "teams": out_rows}

    result = grouped.with_columns([
        (pl.col('pass_yards_allowed') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('pyds_allowed_pg') if 'pass_yards_allowed' in grouped.columns else pl.lit(0).alias('pyds_allowed_pg'),
        (pl.col('rush_yards_allowed') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('ruyds_allowed_pg') if 'rush_yards_allowed' in grouped.columns else pl.lit(0).alias('ruyds_allowed_pg'),
        (pl.col('sacks') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('sacks_pg'),
        (pl.col('takeaways') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('takeaways_pg'),
        ( 
            ( ((pl.col('pass_yards_allowed') + pl.col('rush_yards_allowed')) / pl.when(pl.col('plays_against') == 0).then(1).otherwise(pl.col('plays_against'))).round(1) )
            if 'pass_yards_allowed' in grouped.columns else pl.lit(0)
        ).alias('yppa'),
        ((pl.col('third_conv') / pl.when(pl.col('third_att') == 0).then(1).otherwise(pl.col('third_att'))) * 100).round(1).alias('third_allowed_pct'),
        ((pl.col('fourth_conv') / pl.when(pl.col('fourth_att') == 0).then(1).otherwise(pl.col('fourth_att'))) * 100).round(1).alias('fourth_allowed_pct'),
        (((pl.col('rz_td_allowed')) / pl.when(pl.col('rz_entries') == 0).then(1).otherwise(pl.col('rz_entries'))) * 100).round(1).alias('rz_td_allowed_pct'),
    ])

    # points allowed per game from schedules for ranking
    def _load_sched():
        return nfl.load_schedules([season_val])
    sched = await run_in_threadpool(_load_sched)
    if 'season_type' in sched.columns:
        sched = sched.filter(pl.col('season_type') == 'REG')
    elif 'game_type' in sched.columns:
        sched = sched.filter(pl.col('game_type') == 'REG')
    sched = sched.filter(pl.col('home_score').is_not_null() & pl.col('away_score').is_not_null())

    # compute pa_pg per team
    pa_rows = []
    for row in result.select('team', 'games').to_dicts():
        t = row['team']
        team_games = sched.filter((pl.col('home_team') == t) | (pl.col('away_team') == t))
        gp = team_games.height
        if gp == 0:
            pa_pg = 0.0
        else:
            pa_pg = team_games.with_columns(
                pl.when(pl.col('home_team') == t).then(pl.col('away_score')).otherwise(pl.col('home_score')).alias('pa')
            )['pa'].sum() / gp
        pa_rows.append({'team': t, 'pa_pg': round(float(pa_pg), 1)})
    pa_df = pl.DataFrame(pa_rows)
    merged = pl.DataFrame(result).join(pa_df, on='team', how='left')

    teams = merged.select([
        'team',
        'pa_pg',
        'pyds_allowed_pg',
        'ruyds_allowed_pg',
        'td_allowed',
        'sacks_pg',
        'takeaways_pg',
        'yppa',
        'third_allowed_pct',
        'fourth_allowed_pct',
        'rz_td_allowed_pct',
    ]).to_dicts()

    return {"status": "success", "season": season_val, "teams": teams}


async def get_team_special_teams_service(
    team: str,
    season: Optional[int] = None,
    game_types: Optional[str] = None,
    *,
    last_n: Optional[int] = None,
    venue: Optional[str] = None,
    opponent_conf: Optional[str] = None,
    opponent_div: Optional[str] = None,
) -> Dict[str, Any]:
    """Special teams metrics for one team (REG by default). Safe against missing columns.

    Metrics:
      - fg_pct: FG made / attempts * 100
      - fg_made_pg: FG made per game
      - fg_50_pct: FG >=50 made / FG >=50 attempts * 100
      - xp_pct: extra point made %
      - punt_net_avg: net punt yards per punt
      - punt_in20_pct: % of punts inside 20
      - ret_explosive_pg: punt+kick returns >=20 yd per game (by team)
      - ret_td_pg: return touchdowns per game (by team)
      - touchback_pct: % of our kickoffs that are touchbacks
      - st_penalties_pg: special teams penalties per game (on ST plays)
    """
    team_abbr = (team or '').upper()
    if not team_abbr:
        return {"status": "error", "message": "team required"}

    current_season = nfl.get_current_season()
    season_val = _safe_int(season) or int(current_season)

    def _load_pbp():
        return nfl.load_pbp([season_val])

    pbp = await run_in_threadpool(_load_pbp)

    # Season type filter
    if game_types:
        types = {s.strip().upper() for s in str(game_types).split(',') if s.strip()}
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type').str.to_uppercase().is_in(list(types)))
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type').str.to_uppercase().is_in(list(types)))
    else:
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type') == 'REG')
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type') == 'REG')

    posteam_col = 'posteam' if 'posteam' in pbp.columns else ('possession_team' if 'possession_team' in pbp.columns else None)
    game_id_col = 'game_id' if 'game_id' in pbp.columns else None
    if not posteam_col:
        return {"status": "success", "season": season_val, "team": team_abbr, "metrics": {}}

    # Identify ST plays
    def is_fg():
        return (pl.col('field_goal_result').is_not_null() if 'field_goal_result' in pbp.columns else (pl.col('field_goal_attempt').cast(pl.Int64) == 1 if 'field_goal_attempt' in pbp.columns else pl.lit(False)))
    def is_xp():
        return (pl.col('extra_point_result').is_not_null() if 'extra_point_result' in pbp.columns else (pl.col('extra_point_attempt').cast(pl.Int64) == 1 if 'extra_point_attempt' in pbp.columns else pl.lit(False)))
    def is_punt():
        return (pl.col('punt').cast(pl.Int64) == 1) if 'punt' in pbp.columns else (pl.col('punt_attempt').cast(pl.Int64) == 1 if 'punt_attempt' in pbp.columns else pl.lit(False))
    def is_kickoff():
        return (pl.col('kickoff_attempt').cast(pl.Int64) == 1) if 'kickoff_attempt' in pbp.columns else pl.lit(False)
    def is_return():
        # any return yards present on KO or punt
        base = (pl.col('return_yards').is_not_null()) if 'return_yards' in pbp.columns else pl.lit(False)
        return base & (is_kickoff() | is_punt())

    # Filter to rows where this team es el equipo ejecutor (posteam)
    team_pbp = pbp.filter(pl.col(posteam_col) == team_abbr)

    # Games played: prefer schedules (REG), fallback to PBP distinct game_id for this team
    def _load_sched():
        return nfl.load_schedules([season_val])
    sched = await run_in_threadpool(_load_sched)
    if 'season_type' in sched.columns:
        sched = sched.filter(pl.col('season_type') == 'REG')
    elif 'game_type' in sched.columns:
        sched = sched.filter(pl.col('game_type') == 'REG')
    team_sched = sched.filter((pl.col('home_team') == team_abbr) | (pl.col('away_team') == team_abbr))
    # apply opponent_conf/opponent_div on schedule subset
    if opponent_conf or opponent_div:
        TEAM_TO_DIV = {
            'BUF': 'AFC East','MIA': 'AFC East','NE': 'AFC East','NYJ': 'AFC East',
            'BAL': 'AFC North','CIN': 'AFC North','CLE': 'AFC North','PIT': 'AFC North',
            'HOU': 'AFC South','IND': 'AFC South','JAX': 'AFC South','TEN': 'AFC South',
            'DEN': 'AFC West','KC': 'AFC West','LV': 'AFC West','LAC': 'AFC West',
            'DAL': 'NFC East','NYG': 'NFC East','PHI': 'NFC East','WAS': 'NFC East',
            'CHI': 'NFC North','DET': 'NFC North','GB': 'NFC North','MIN': 'NFC North',
            'ATL': 'NFC South','CAR': 'NFC South','NO': 'NFC South','TB': 'NFC South',
            'ARI': 'NFC West','LA': 'NFC West','LAR': 'NFC West','SEA': 'NFC West','SF': 'NFC West',
        }
        TEAM_TO_CONF = {t: dv.split(' ')[0] for t, dv in TEAM_TO_DIV.items()}
        team_sched = team_sched.with_columns([
            pl.when(pl.col('home_team') == team_abbr).then(pl.col('away_team')).otherwise(pl.col('home_team')).alias('opp')
        ])
        if opponent_conf and str(opponent_conf).upper() in {'AFC','NFC'}:
            allow = {t for t, c in TEAM_TO_CONF.items() if c.upper() == str(opponent_conf).upper()}
            team_sched = team_sched.filter(pl.col('opp').is_in(list(allow)))
        if opponent_div:
            allowd = {t for t, d in TEAM_TO_DIV.items() if d.upper() == str(opponent_div).upper()}
            if allowd:
                team_sched = team_sched.filter(pl.col('opp').is_in(list(allowd)))
    # apply venue/last_n on schedule subset
    if str(venue or '').lower() == 'home':
        team_sched = team_sched.filter(pl.col('home_team') == team_abbr)
    elif str(venue or '').lower() == 'away':
        team_sched = team_sched.filter(pl.col('away_team') == team_abbr)
    # IMPORTANT: restrict to completed games BEFORE slicing last_n so IDs have PBP
    if 'home_score' in team_sched.columns and 'away_score' in team_sched.columns:
        team_sched = team_sched.filter(pl.col('home_score').is_not_null() & pl.col('away_score').is_not_null())
    if 'game_date' in team_sched.columns:
        team_sched = team_sched.sort('game_date')
    if last_n and last_n > 0:
        team_sched = team_sched.tail(last_n)
    # Only count games actually played (scores present)
    if 'home_score' in team_sched.columns and 'away_score' in team_sched.columns:
        games_sched_played = team_sched.height
    else:
        games_sched_played = 0
    games_pbp = team_pbp.filter(pl.col('game_id').is_in(team_sched['game_id']) if 'game_id' in team_sched.columns else pl.lit(True)).select(pl.col(game_id_col)).unique().height if game_id_col else 0
    # Prefer PBP-derived game count; fallback a schedules-played; para divisiones evitar 0
    gp_internal = games_pbp or games_sched_played or 1

    # Field goals (by kicking team = posteam)
    fg_rows = team_pbp.filter((pl.col('game_id').is_in(team_sched['game_id']) if 'game_id' in team_sched.columns else pl.lit(True)) & is_fg())
    fg_att = fg_rows.height
    fg_made = 0
    if 'field_goal_result' in fg_rows.columns:
        fg_made = fg_rows.filter(pl.col('field_goal_result').str.to_lowercase() == 'made').height
    elif 'field_goal_made' in fg_rows.columns:
        fg_made = fg_rows.filter(pl.col('field_goal_made').cast(pl.Int64) == 1).height
    fg_pct = round((fg_made / fg_att) * 100, 1) if fg_att else 0.0
    fg_made_pg = round(fg_made / gp_internal, 1)
    fg_att_pg = round(fg_att / gp_internal, 1)

    # FG <50 and 50+
    fg_u50_rows = fg_rows.filter((pl.col('kick_distance') < 50) if 'kick_distance' in fg_rows.columns else pl.lit(False))
    fg_u50_att = fg_u50_rows.height
    fg_u50_made = 0
    if fg_u50_att:
        if 'field_goal_result' in fg_u50_rows.columns:
            fg_u50_made = fg_u50_rows.filter(pl.col('field_goal_result').str.to_lowercase() == 'made').height
        elif 'field_goal_made' in fg_u50_rows.columns:
            fg_u50_made = fg_u50_rows.filter(pl.col('field_goal_made').cast(pl.Int64) == 1).height
    fg_u50_pct = round((fg_u50_made / fg_u50_att) * 100, 1) if fg_u50_att else 0.0

    # FG 50+
    fg50_rows = fg_rows.filter((pl.col('kick_distance') >= 50) if 'kick_distance' in fg_rows.columns else pl.lit(False))
    fg50_att = fg50_rows.height
    fg50_made = 0
    if fg50_att:
        if 'field_goal_result' in fg50_rows.columns:
            fg50_made = fg50_rows.filter(pl.col('field_goal_result').str.to_lowercase() == 'made').height
        elif 'field_goal_made' in fg50_rows.columns:
            fg50_made = fg50_rows.filter(pl.col('field_goal_made').cast(pl.Int64) == 1).height
    fg_50_pct = round((fg50_made / fg50_att) * 100, 1) if fg50_att else 0.0

    # Extra points
    xp_rows = team_pbp.filter((pl.col('game_id').is_in(team_sched['game_id']) if 'game_id' in team_sched.columns else pl.lit(True)) & is_xp())
    xp_att = xp_rows.height
    xp_made = 0
    if 'extra_point_result' in xp_rows.columns:
        xp_made = xp_rows.filter(pl.col('extra_point_result').str.to_lowercase().is_in(['good','made','successful'])).height
    elif 'extra_point_made' in xp_rows.columns:
        xp_made = xp_rows.filter(pl.col('extra_point_made').cast(pl.Int64) == 1).height
    xp_pct = round((xp_made / xp_att) * 100, 1) if xp_att else 0.0
    xp_made_pg = round(xp_made / gp_internal, 1)
    xp_att_pg = round(xp_att / gp_internal, 1)

    # Punts
    punt_rows = team_pbp.filter((pl.col('game_id').is_in(team_sched['game_id']) if 'game_id' in team_sched.columns else pl.lit(True)) & is_punt())
    punt_att = punt_rows.height
    punt_net_avg = 0.0
    punt_avg = 0.0
    if 'punt_net' in punt_rows.columns and punt_att:
        punt_net_avg = float(punt_rows.select(pl.col('punt_net').mean()).to_series()[0] or 0.0)
        punt_net_avg = round(punt_net_avg, 1)
    if ('punt_yards' in punt_rows.columns or 'punt_distance' in punt_rows.columns) and punt_att:
        if 'punt_yards' in punt_rows.columns:
            punt_avg = float(punt_rows.select(pl.col('punt_yards').mean()).to_series()[0] or 0.0)
        else:
            punt_avg = float(punt_rows.select(pl.col('punt_distance').mean()).to_series()[0] or 0.0)
        punt_avg = round(punt_avg, 1)
    punt_in20_pct = 0.0
    if 'punt_inside_twenty' in punt_rows.columns and punt_att:
        inside = punt_rows.filter(pl.col('punt_inside_twenty').cast(pl.Int64) == 1).height
        punt_in20_pct = round((inside / punt_att) * 100, 1)
    punts_pg = round(punt_att / gp_internal, 1)

    # Returns by our team
    ret_rows = team_pbp.filter((pl.col('game_id').is_in(team_sched['game_id']) if 'game_id' in team_sched.columns else pl.lit(True)) & is_return())
    explosive_returns = ret_rows.filter((pl.col('return_yards') >= 20) if 'return_yards' in ret_rows.columns else pl.lit(False)).height if 'return_yards' in ret_rows.columns else 0
    ret_explosive_pg = round(explosive_returns / gp_internal, 1)
    ret_td_pg = 0.0
    if 'return_touchdown' in ret_rows.columns:
        ret_td_pg = round(ret_rows.filter(pl.col('return_touchdown').cast(pl.Int64) == 1).height / gp_internal, 1)

    # Kickoff touchbacks by our team
    ko_rows = team_pbp.filter((pl.col('game_id').is_in(team_sched['game_id']) if 'game_id' in team_sched.columns else pl.lit(True)) & is_kickoff())
    ko_att = ko_rows.height
    touchbacks = 0
    if 'kickoff_touchback' in ko_rows.columns:
        touchbacks = ko_rows.filter(pl.col('kickoff_touchback').cast(pl.Int64) == 1).height
    elif 'touchback' in ko_rows.columns:
        touchbacks = ko_rows.filter(pl.col('touchback').cast(pl.Int64) == 1).height
    touchback_pct = round((touchbacks / ko_att) * 100, 1) if ko_att else 0.0

    # Penalties on ST plays
    st_mask = is_fg() | is_xp() | is_punt() | is_kickoff()
    pen_rows = team_pbp.filter((pl.col(posteam_col) == team_abbr) & st_mask & ((pl.col('penalty').cast(pl.Int64) == 1) if 'penalty' in team_pbp.columns else pl.lit(False)))
    st_penalties_pg = round(pen_rows.height / gp_internal, 1)

    return {
        "status": "success",
        "season": season_val,
        "team": team_abbr,
        # Exponer el conteo real filtrado (puede ser 0)
        "games": (games_pbp or games_sched_played),
        "metrics": {
            "fg_pct": fg_pct,
            "fg_made_pg": fg_made_pg,
            "fg_att_pg": fg_att_pg,
            "fg_u50_pct": fg_u50_pct,
            "fg_50_pct": fg_50_pct,
            "xp_pct": xp_pct,
            "xp_made_pg": xp_made_pg,
            "xp_att_pg": xp_att_pg,
            "punt_net_avg": punt_net_avg,
            "punt_avg": punt_avg,
            "punts_pg": punts_pg,
            "punt_in20_pct": punt_in20_pct,
            "ret_explosive_pg": ret_explosive_pg,
            "ret_td_pg": ret_td_pg,
            "touchback_pct": touchback_pct,
            "st_penalties_pg": st_penalties_pg,
        }
    }


async def get_special_teams_league_service(
    season: Optional[int] = None,
    game_types: Optional[str] = None,
    *,
    last_n: Optional[int] = None,
    venue: Optional[str] = None,
    opponent_conf: Optional[str] = None,
    opponent_div: Optional[str] = None,
) -> Dict[str, Any]:
    """League-wide special teams metrics per team for rankings."""
    current_season = nfl.get_current_season()
    season_val = _safe_int(season) or int(current_season)

    def _load_pbp():
        return nfl.load_pbp([season_val])

    pbp = await run_in_threadpool(_load_pbp)

    # Season type filter
    if game_types:
        types = {s.strip().upper() for s in str(game_types).split(',') if s.strip()}
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type').str.to_uppercase().is_in(list(types)))
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type').str.to_uppercase().is_in(list(types)))
    else:
        if 'season_type' in pbp.columns:
            pbp = pbp.filter(pl.col('season_type') == 'REG')
        elif 'game_type' in pbp.columns:
            pbp = pbp.filter(pl.col('game_type') == 'REG')

    posteam_col = 'posteam' if 'posteam' in pbp.columns else ('possession_team' if 'possession_team' in pbp.columns else None)
    game_id_col = 'game_id' if 'game_id' in pbp.columns else None
    if not posteam_col:
        return {"status": "success", "season": season_val, "teams": []}

    def is_fg():
        return (pl.col('field_goal_result').is_not_null() if 'field_goal_result' in pbp.columns else (pl.col('field_goal_attempt').cast(pl.Int64) == 1 if 'field_goal_attempt' in pbp.columns else pl.lit(False)))
    def is_xp():
        return (pl.col('extra_point_result').is_not_null() if 'extra_point_result' in pbp.columns else (pl.col('extra_point_attempt').cast(pl.Int64) == 1 if 'extra_point_attempt' in pbp.columns else pl.lit(False)))
    def is_punt():
        return (pl.col('punt').cast(pl.Int64) == 1) if 'punt' in pbp.columns else (pl.col('punt_attempt').cast(pl.Int64) == 1 if 'punt_attempt' in pbp.columns else pl.lit(False))
    def is_kickoff():
        return (pl.col('kickoff_attempt').cast(pl.Int64) == 1) if 'kickoff_attempt' in pbp.columns else pl.lit(False)
    def is_return():
        return ((pl.col('return_yards').is_not_null()) if 'return_yards' in pbp.columns else pl.lit(False)) & (is_kickoff() | is_punt())

    # Compute per-team aggregates in one pass, grouping by posteam
    group_cols = [pl.col(posteam_col).alias('team')]
    aggs: list = []

    # Game count per team
    if game_id_col:
        aggs.append(pl.col(game_id_col).n_unique().alias('games'))
    else:
        aggs.append(pl.lit(1).alias('games'))

    # FG
    if 'field_goal_result' in pbp.columns or 'field_goal_attempt' in pbp.columns:
        aggs.extend([
            pl.when(is_fg()).then(1).otherwise(0).sum().alias('fg_att'),
            pl.when(is_fg() & ((pl.col('field_goal_result').str.to_lowercase() == 'made') if 'field_goal_result' in pbp.columns else (pl.col('field_goal_made').cast(pl.Int64) == 1 if 'field_goal_made' in pbp.columns else pl.lit(False)))).then(1).otherwise(0).sum().alias('fg_made'),
            pl.when(is_fg() & ((pl.col('kick_distance') < 50) if 'kick_distance' in pbp.columns else pl.lit(False))).then(1).otherwise(0).sum().alias('fg_u50_att'),
            pl.when(is_fg() & ((pl.col('kick_distance') < 50) if 'kick_distance' in pbp.columns else pl.lit(False)) & ((pl.col('field_goal_result').str.to_lowercase() == 'made') if 'field_goal_result' in pbp.columns else (pl.col('field_goal_made').cast(pl.Int64) == 1 if 'field_goal_made' in pbp.columns else pl.lit(False)))).then(1).otherwise(0).sum().alias('fg_u50_made'),
            pl.when(is_fg() & ((pl.col('kick_distance') >= 50) if 'kick_distance' in pbp.columns else pl.lit(False))).then(1).otherwise(0).sum().alias('fg50_att'),
            pl.when(is_fg() & ((pl.col('kick_distance') >= 50) if 'kick_distance' in pbp.columns else pl.lit(False)) & ((pl.col('field_goal_result').str.to_lowercase() == 'made') if 'field_goal_result' in pbp.columns else (pl.col('field_goal_made').cast(pl.Int64) == 1 if 'field_goal_made' in pbp.columns else pl.lit(False)))).then(1).otherwise(0).sum().alias('fg50_made'),
        ])

    # XP
    if 'extra_point_result' in pbp.columns or 'extra_point_attempt' in pbp.columns:
        aggs.extend([
            pl.when(is_xp()).then(1).otherwise(0).sum().alias('xp_att'),
            pl.when(is_xp() & ((pl.col('extra_point_result').str.to_lowercase().is_in(['good','made','successful'])) if 'extra_point_result' in pbp.columns else (pl.col('extra_point_made').cast(pl.Int64) == 1 if 'extra_point_made' in pbp.columns else pl.lit(False)))).then(1).otherwise(0).sum().alias('xp_made'),
        ])

    # Punts
    if 'punt' in pbp.columns or 'punt_attempt' in pbp.columns:
        aggs.extend([
            pl.when(is_punt()).then(1).otherwise(0).sum().alias('punt_att'),
            (pl.when(is_punt()).then(pl.col('punt_net')).otherwise(None)).mean().alias('punt_net_avg') if 'punt_net' in pbp.columns else pl.lit(0).alias('punt_net_avg'),
            pl.when(is_punt() & ((pl.col('punt_inside_twenty').cast(pl.Int64) == 1) if 'punt_inside_twenty' in pbp.columns else pl.lit(False))).then(1).otherwise(0).sum().alias('punt_in20'),
        ])
        if 'punt_yards' in pbp.columns:
            aggs.append((pl.when(is_punt()).then(pl.col('punt_yards')).otherwise(None)).mean().alias('punt_avg'))
        elif 'punt_distance' in pbp.columns:
            aggs.append((pl.when(is_punt()).then(pl.col('punt_distance')).otherwise(None)).mean().alias('punt_avg'))

    # Returns (by posteam)
    if 'return_yards' in pbp.columns:
        aggs.extend([
            pl.when(is_return() & (pl.col('return_yards') >= 20)).then(1).otherwise(0).sum().alias('explosive_returns'),
        ])
    if 'return_touchdown' in pbp.columns:
        aggs.append(pl.when(is_return() & (pl.col('return_touchdown').cast(pl.Int64) == 1)).then(1).otherwise(0).sum().alias('return_td'))

    # Kickoff touchbacks
    aggs.append(pl.when(is_kickoff()).then(1).otherwise(0).sum().alias('ko_att'))
    if 'kickoff_touchback' in pbp.columns:
        aggs.append(pl.when(is_kickoff() & (pl.col('kickoff_touchback').cast(pl.Int64) == 1)).then(1).otherwise(0).sum().alias('ko_tb'))
    elif 'touchback' in pbp.columns:
        aggs.append(pl.when(is_kickoff() & (pl.col('touchback').cast(pl.Int64) == 1)).then(1).otherwise(0).sum().alias('ko_tb'))

    # Penalties on ST plays
    if 'penalty' in pbp.columns:
        st_mask = is_fg() | is_xp() | is_punt() | is_kickoff()
        aggs.append(pl.when(st_mask & (pl.col('penalty').cast(pl.Int64) == 1)).then(1).otherwise(0).sum().alias('st_penalties'))

    # Vectorized path si no hay filtros (ni last_n, ni venue, ni filtros de oponente)
    if not last_n and not venue and not opponent_conf and not opponent_div:
        grouped = pbp.group_by(group_cols).agg(aggs)
        result = grouped.with_columns([
            (pl.col('fg_made') / pl.when(pl.col('fg_att') == 0).then(1).otherwise(pl.col('fg_att')) * 100).round(1).alias('fg_pct') if 'fg_made' in grouped.columns else pl.lit(0).alias('fg_pct'),
            (pl.col('fg_u50_made') / pl.when(pl.col('fg_u50_att') == 0).then(1).otherwise(pl.col('fg_u50_att')) * 100).round(1).alias('fg_u50_pct') if 'fg_u50_made' in grouped.columns else pl.lit(0).alias('fg_u50_pct'),
            (pl.col('fg50_made') / pl.when(pl.col('fg50_att') == 0).then(1).otherwise(pl.col('fg50_att')) * 100).round(1).alias('fg_50_pct') if 'fg50_made' in grouped.columns else pl.lit(0).alias('fg_50_pct'),
            (pl.col('xp_made') / pl.when(pl.col('xp_att') == 0).then(1).otherwise(pl.col('xp_att')) * 100).round(1).alias('xp_pct') if 'xp_made' in grouped.columns else pl.lit(0).alias('xp_pct'),
            (pl.col('fg_made') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('fg_made_pg') if 'fg_made' in grouped.columns else pl.lit(0).alias('fg_made_pg'),
            (pl.col('fg_att') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('fg_att_pg') if 'fg_att' in grouped.columns else pl.lit(0).alias('fg_att_pg'),
            (pl.col('xp_made') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('xp_made_pg') if 'xp_made' in grouped.columns else pl.lit(0).alias('xp_made_pg'),
            (pl.col('xp_att') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('xp_att_pg') if 'xp_att' in grouped.columns else pl.lit(0).alias('xp_att_pg'),
            (pl.col('punt_att') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('punts_pg') if 'punt_att' in grouped.columns else pl.lit(0).alias('punts_pg'),
            (pl.col('punt_in20') / pl.when(pl.col('punt_att') == 0).then(1).otherwise(pl.col('punt_att')) * 100).round(1).alias('punt_in20_pct') if 'punt_in20' in grouped.columns else pl.lit(0).alias('punt_in20_pct'),
            (pl.col('explosive_returns') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('ret_explosive_pg') if 'explosive_returns' in grouped.columns else pl.lit(0).alias('ret_explosive_pg'),
            (pl.col('return_td') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('ret_td_pg') if 'return_td' in grouped.columns else pl.lit(0).alias('ret_td_pg'),
            (pl.col('ko_tb') / pl.when(pl.col('ko_att') == 0).then(1).otherwise(pl.col('ko_att')) * 100).round(1).alias('touchback_pct') if 'ko_tb' in grouped.columns else pl.lit(0).alias('touchback_pct'),
            (pl.col('st_penalties') / pl.when(pl.col('games') == 0).then(1).otherwise(pl.col('games'))).round(1).alias('st_penalties_pg') if 'st_penalties' in grouped.columns else pl.lit(0).alias('st_penalties_pg'),
            ((pl.col('punt_avg')) if 'punt_avg' in grouped.columns else pl.lit(0)).alias('punt_avg'),
        ])
        teams = result.select(['team','fg_pct','fg_made_pg','fg_att_pg','xp_pct','xp_made_pg','xp_att_pg','punts_pg','punt_avg']).to_dicts()
        return {"status": "success", "season": season_val, "teams": teams}

    # Slow path: per-team subset via schedules
    def _load_sched():
        return nfl.load_schedules([season_val])
    sched = await run_in_threadpool(_load_sched)
    if 'season_type' in sched.columns:
        sched = sched.filter(pl.col('season_type') == 'REG')
    elif 'game_type' in sched.columns:
        sched = sched.filter(pl.col('game_type') == 'REG')
    if 'home_score' in sched.columns and 'away_score' in sched.columns:
        sched = sched.filter(pl.col('home_score').is_not_null() & pl.col('away_score').is_not_null())

    teams_list = pbp.select(pl.col(posteam_col)).unique().to_series().to_list()
    out_rows: List[Dict[str, Any]] = []
    # Mapas para oponente
    TEAM_TO_DIV = {
        'BUF': 'AFC East','MIA': 'AFC East','NE': 'AFC East','NYJ': 'AFC East',
        'BAL': 'AFC North','CIN': 'AFC North','CLE': 'AFC North','PIT': 'AFC North',
        'HOU': 'AFC South','IND': 'AFC South','JAX': 'AFC South','TEN': 'AFC South',
        'DEN': 'AFC West','KC': 'AFC West','LV': 'AFC West','LAC': 'AFC West',
        'DAL': 'NFC East','NYG': 'NFC East','PHI': 'NFC East','WAS': 'NFC East',
        'CHI': 'NFC North','DET': 'NFC North','GB': 'NFC North','MIN': 'NFC North',
        'ATL': 'NFC South','CAR': 'NFC South','NO': 'NFC South','TB': 'NFC South',
        'ARI': 'NFC West','LA': 'NFC West','LAR': 'NFC West','SEA': 'NFC West','SF': 'NFC West',
    }
    TEAM_TO_CONF = {t: dv.split(' ')[0] for t, dv in TEAM_TO_DIV.items()}
    for t in teams_list:
        t_str = str(t)
        filt = (pl.col('home_team') == t_str) | (pl.col('away_team') == t_str)
        if str(venue or '').lower() == 'home':
            filt = (pl.col('home_team') == t_str)
        elif str(venue or '').lower() == 'away':
            filt = (pl.col('away_team') == t_str)
        sub = sched.filter(filt)
        # Filtros por oponente si vienen
        if opponent_conf or opponent_div:
            sub = sub.with_columns([
                pl.when(pl.col('home_team') == t_str).then(pl.col('away_team')).otherwise(pl.col('home_team')).alias('opp')
            ])
            if opponent_conf and str(opponent_conf).upper() in {'AFC','NFC'}:
                allow_conf = {x for x, c in TEAM_TO_CONF.items() if c.upper() == str(opponent_conf).upper()}
                sub = sub.filter(pl.col('opp').is_in(list(allow_conf)))
            if opponent_div:
                allow_div = {x for x, d in TEAM_TO_DIV.items() if d.upper() == str(opponent_div).upper()}
                if allow_div:
                    sub = sub.filter(pl.col('opp').is_in(list(allow_div)))
        if 'game_date' in sub.columns:
            sub = sub.sort('game_date')
        if last_n and last_n > 0:
            sub = sub.tail(last_n)
        ids = set(sub['game_id']) if 'game_id' in sub.columns else set()
        gp = sub.height or 1
        t_rows = pbp.filter((pl.col(posteam_col) == t_str) & (pl.col('game_id').is_in(list(ids)) if ids else pl.lit(False)))
        # compute
        fg_att = t_rows.filter((pl.col('field_goal_result').is_not_null() if 'field_goal_result' in pbp.columns else (pl.col('field_goal_attempt').cast(pl.Int64) == 1 if 'field_goal_attempt' in pbp.columns else pl.lit(False)))).height
        fg_made = 0
        if 'field_goal_result' in pbp.columns:
            fg_made = t_rows.filter(pl.col('field_goal_result').str.to_lowercase() == 'made').height
        elif 'field_goal_made' in pbp.columns:
            fg_made = t_rows.filter(pl.col('field_goal_made').cast(pl.Int64) == 1).height
        xp_att = t_rows.filter((pl.col('extra_point_result').is_not_null() if 'extra_point_result' in pbp.columns else (pl.col('extra_point_attempt').cast(pl.Int64) == 1 if 'extra_point_attempt' in pbp.columns else pl.lit(False)))).height
        xp_made = 0
        if 'extra_point_result' in pbp.columns:
            xp_made = t_rows.filter(pl.col('extra_point_result').str.to_lowercase().is_in(['good','made','successful'])).height
        elif 'extra_point_made' in pbp.columns:
            xp_made = t_rows.filter(pl.col('extra_point_made').cast(pl.Int64) == 1).height
        punts = t_rows.filter((pl.col('punt').cast(pl.Int64) == 1) if 'punt' in pbp.columns else (pl.col('punt_attempt').cast(pl.Int64) == 1 if 'punt_attempt' in pbp.columns else pl.lit(False))).height
        punt_avg = 0.0
        if 'punt_yards' in pbp.columns:
            punt_avg = float(t_rows.filter((pl.col('punt').cast(pl.Int64) == 1) if 'punt' in pbp.columns else pl.lit(False)).select(pl.col('punt_yards').mean()).to_series()[0] or 0.0)
        elif 'punt_distance' in pbp.columns:
            punt_avg = float(t_rows.filter((pl.col('punt_attempt').cast(pl.Int64) == 1) if 'punt_attempt' in pbp.columns else pl.lit(False)).select(pl.col('punt_distance').mean()).to_series()[0] or 0.0)
        punt_avg = round(punt_avg, 1)
        out_rows.append({
            'team': t_str,
            'fg_pct': round((fg_made / (fg_att or 1)) * 100, 1) if fg_att else 0.0,
            'fg_made_pg': round(fg_made / float(gp), 1),
            'fg_att_pg': round(fg_att / float(gp), 1),
            'xp_pct': round((xp_made / (xp_att or 1)) * 100, 1) if xp_att else 0.0,
            'xp_made_pg': round(xp_made / float(gp), 1),
            'xp_att_pg': round(xp_att / float(gp), 1),
            'punts_pg': round(punts / float(gp), 1),
            'punt_avg': punt_avg,
        })

    return {"status": "success", "season": season_val, "teams": out_rows}
