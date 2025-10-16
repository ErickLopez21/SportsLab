from __future__ import annotations
from typing import Any, Dict, Optional
import polars as pl
import nflreadpy as nfl
from starlette.concurrency import run_in_threadpool


def _to_team(abbr: str) -> str:
    return str((abbr or '').upper())


async def get_team_trends_service(
    team: str,
    season: Optional[int] = None,
    game_types: Optional[str] = None,
    *,
    last_n: Optional[int] = None,
    venue: Optional[str] = None,
    opponent_conf: Optional[str] = None,
    opponent_div: Optional[str] = None,
) -> Dict[str, Any]:
    team_abbr = _to_team(team)
    season_val = int(season) if season is not None else int(nfl.get_current_season())
    game_types = (game_types or 'REG').upper()

    # Load play-by-play and schedules for ordering and filters
    def _load_pbp():
        return nfl.load_pbp([season_val])

    def _load_sched():
        return nfl.load_schedules([season_val])

    pbp, schedules = await run_in_threadpool(lambda: (_load_pbp(), _load_sched()))

    # Normalize columns
    cols = set(pbp.columns)
    game_id_col = 'game_id' if 'game_id' in cols else None
    posteam_col = 'posteam' if 'posteam' in cols else ('possession_team' if 'possession_team' in cols else None)
    qtr_col = 'qtr' if 'qtr' in cols else ('quarter' if 'quarter' in cols else None)
    home_col = 'home_team' if 'home_team' in pbp.columns else None
    away_col = 'away_team' if 'away_team' in pbp.columns else None
    score_home_cols = [c for c in ('home_score', 'total_home_score', 'home_score_post') if c in cols]
    score_away_cols = [c for c in ('away_score', 'total_away_score', 'away_score_post') if c in cols]
    score_home_col = score_home_cols[-1] if score_home_cols else None
    score_away_col = score_away_cols[-1] if score_away_cols else None
    game_date_col = 'game_date' if 'game_date' in schedules.columns else None

    if not (game_id_col and posteam_col and qtr_col and score_home_col and score_away_col and home_col and away_col):
        return {"status": "success", "season": season_val, "team": team_abbr, "games": 0, "counts": {}}

    # Restrict schedules to REG and to this team (for ordering and filters)
    if 'season_type' in schedules.columns:
        schedules = schedules.filter(pl.col('season_type') == game_types)
    elif 'game_type' in schedules.columns:
        schedules = schedules.filter(pl.col('game_type') == game_types)

    sched_sub = schedules.filter((pl.col('home_team') == team_abbr) | (pl.col('away_team') == team_abbr))

    # Opponent filters on schedules (use static maps)
    if opponent_conf or (opponent_div and opponent_div != 'all'):
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

        sched_sub = sched_sub.with_columns([
            pl.when(pl.col('home_team') == team_abbr).then(pl.col('away_team')).otherwise(pl.col('home_team')).alias('opp')
        ])
        if opponent_conf and str(opponent_conf).upper() in {'AFC', 'NFC'}:
            allowed = {x for x, c in TEAM_TO_CONF.items() if c.upper() == str(opponent_conf).upper()}
            sched_sub = sched_sub.filter(pl.col('opp').is_in(list(allowed)))
        if opponent_div and opponent_div != 'all':
            allowdd = {x for x, d in TEAM_TO_DIV.items() if d.upper() == str(opponent_div).upper()}
            if allowdd:
                sched_sub = sched_sub.filter(pl.col('opp').is_in(list(allowdd)))

    # Venue filter
    if str(venue or '').lower() == 'home':
        sched_sub = sched_sub.filter(pl.col('home_team') == team_abbr)
    elif str(venue or '').lower() == 'away':
        sched_sub = sched_sub.filter(pl.col('away_team') == team_abbr)

    # Completed games only (where final score exists on schedules if available)
    if 'home_score' in sched_sub.columns and 'away_score' in sched_sub.columns:
        sched_sub = sched_sub.filter(pl.col('home_score').is_not_null() & pl.col('away_score').is_not_null())

    # Order by date desc and slice last_n
    if game_date_col in sched_sub.columns:
        sched_sub = sched_sub.sort(game_date_col)
    if last_n and last_n > 0:
        sched_sub = sched_sub.tail(last_n)

    # Keep game ids
    sched_gids = sched_sub['game_id'] if 'game_id' in sched_sub.columns else None
    if sched_gids is None or sched_gids.is_empty():
        return {"status": "success", "season": season_val, "team": team_abbr, "games": 0, "counts": {}}

    team_games = pbp.filter(pl.col(game_id_col).is_in(sched_gids))

    # Compute halftime and final scores per game using MAX (monotonic scoreboard) for robustness
    # Halftime: scores at end of Q2 ≈ max score within qtrs <= 2
    h1 = team_games.filter(pl.col(qtr_col) <= 2).group_by(game_id_col).agg([
        pl.col(score_home_col).max().cast(pl.Int64).alias('home_ht'),
        pl.col(score_away_col).max().cast(pl.Int64).alias('away_ht'),
    ])
    # Final: max score over all plays
    fin = team_games.group_by(game_id_col).agg([
        pl.col(score_home_col).max().cast(pl.Int64).alias('home_fin'),
        pl.col(score_away_col).max().cast(pl.Int64).alias('away_fin'),
    ])
    # Join with schedules to know home/away teams reliably
    sched_cols = ['game_id', 'home_team', 'away_team', 'week', 'game_date']
    sched_meta = sched_sub.select([c for c in sched_cols if c in sched_sub.columns]).unique()
    joined = fin.join(h1, on=game_id_col, how='left').join(sched_meta, on='game_id', how='left')

    # Build per game rows for this team
    per_game = joined.select([
        pl.col('game_id'),
        pl.col('week') if 'week' in joined.columns else pl.lit(None).alias('week'),
        pl.col('game_date') if 'game_date' in joined.columns else pl.lit(None).alias('game_date'),
        pl.when(pl.col('home_team') == team_abbr).then(pl.lit(1)).otherwise(pl.lit(0)).alias('is_home'),
        pl.when(pl.col('home_team') == team_abbr).then(pl.col('away_team')).otherwise(pl.col('home_team')).alias('opp'),
        # team points
        pl.when(pl.col('home_team') == team_abbr).then(pl.col('home_ht')).otherwise(pl.col('away_ht')).alias('h1_team'),
        pl.when(pl.col('home_team') == team_abbr).then(pl.col('home_fin')).otherwise(pl.col('away_fin')).alias('final_team'),
        # opponent final
        pl.when(pl.col('home_team') == team_abbr).then(pl.col('away_fin')).otherwise(pl.col('home_fin')).alias('opp_final'),
        # opponent halftime
        pl.when(pl.col('home_team') == team_abbr).then(pl.col('away_ht')).otherwise(pl.col('home_ht')).alias('opp_h1'),
    ]).with_columns([
        (pl.col('final_team') - pl.col('h1_team')).alias('h2_team'),
        (pl.col('opp_final') - pl.col('opp_h1')).alias('opp_h2'),
        (pl.col('final_team') - pl.col('opp_final')).alias('margin')
    ])

    # counts
    def count_over_under(values: pl.Series, thresholds: list[int]) -> Dict[str, Dict[str, int]]:
        out: Dict[str, Dict[str, int]] = {}
        arr = values.to_list()
        for th in thresholds:
            over = sum(1 for v in arr if v is not None and float(v) >= th)
            under = sum(1 for v in arr if v is not None and float(v) < th)
            out[str(th)] = {"over": over, "under": under}
        return out

    game_counts = count_over_under(per_game['final_team'], [17,20,23,24,27,30])
    h1_counts = count_over_under(per_game['h1_team'], [3,6,7,10,13,17])
    h2_counts = count_over_under(per_game['h2_team'], [3,6,7,10,13,17])
    # margin counts: wins by >= th, losses by >= th
    def count_margin(values: pl.Series, thresholds: list[int]) -> Dict[str, Dict[str, int]]:
        out: Dict[str, Dict[str, int]] = {}
        arr = values.to_list()
        for th in thresholds:
            wb = sum(1 for v in arr if v is not None and float(v) >= th)
            lb = sum(1 for v in arr if v is not None and float(v) <= -th)
            out[str(th)] = {"win_by": wb, "lose_by": lb}
        return out
    margin_counts = count_margin(per_game['margin'], [3,4,6,7,10,13])

    # W/L counts for game and halves
    # Use Python sums to avoid dtype edge cases
    margins = per_game['margin'].to_list()
    h1diff = (per_game['h1_team'] - per_game['opp_h1']).to_list()
    h2diff = (per_game['h2_team'] - per_game['opp_h2']).to_list()
    wl_counts = {
        "game": {
            "w": sum(1 for v in margins if v is not None and float(v) > 0),
            "l": sum(1 for v in margins if v is not None and float(v) < 0),
            "t": sum(1 for v in margins if v is not None and float(v) == 0),
        },
        "h1": {
            "w": sum(1 for v in h1diff if v is not None and float(v) > 0),
            "l": sum(1 for v in h1diff if v is not None and float(v) < 0),
            "t": sum(1 for v in h1diff if v is not None and float(v) == 0),
        },
        "h2": {
            "w": sum(1 for v in h2diff if v is not None and float(v) > 0),
            "l": sum(1 for v in h2diff if v is not None and float(v) < 0),
            "t": sum(1 for v in h2diff if v is not None and float(v) == 0),
        },
    }

    # Field goals made per game and per half (by kicking team)
    fg_counts: Dict[str, Any] = {"game": {}, "h1": {}, "h2": {}}
    try:
        made_expr = None
        # Most common schemas across nflverse/nflreadpy
        if 'field_goal_made' in cols:
            made_expr = pl.col('field_goal_made').cast(pl.Int64) == 1
        elif 'field_goal_result' in cols:
            made_expr = pl.col('field_goal_result').str.to_lowercase().is_in(['made', 'good', 'success', 'successful'])
        elif 'fg_result' in cols:
            made_expr = pl.col('fg_result').str.to_lowercase().is_in(['made', 'good'])
        elif 'kick_result' in cols:
            made_expr = pl.col('kick_result').str.to_lowercase().is_in(['good', 'made'])
        elif 'play_type' in cols:
            # Fallback: treat any field_goal play as made if EPA > 0 or yards gained equals 3 (not perfect but rare fallback)
            # Prefer not to rely on this; only used if above columns absent
            made_expr = (pl.col('play_type').str.to_lowercase() == 'field_goal') & (pl.lit(True))
        # If we cannot detect made FGs, skip
        if made_expr is not None and posteam_col and game_id_col and qtr_col:
            team_fg = pbp.filter(
                (pl.col(game_id_col).is_in(sched_gids)) & (pl.col(posteam_col) == team_abbr)
            )
            fgm_all = team_fg.filter(made_expr)
            fgm_total = fgm_all.group_by(game_id_col).agg([pl.len().alias('fgm')])
            fgm_h1 = fgm_all.filter(pl.col(qtr_col) <= 2).group_by(game_id_col).agg([pl.len().alias('fgm_h1')])
            fgm_h2 = fgm_all.filter(pl.col(qtr_col) >= 3).group_by(game_id_col).agg([pl.len().alias('fgm_h2')])

            pg = per_game.select(['game_id']).join(fgm_total, on='game_id', how='left') \
                .with_columns([pl.coalesce([pl.col('fgm'), pl.lit(0)]).alias('fgm')])
            ph1 = per_game.select(['game_id']).join(fgm_h1, on='game_id', how='left') \
                .with_columns([pl.coalesce([pl.col('fgm_h1'), pl.lit(0)]).alias('fgm_h1')])
            ph2 = per_game.select(['game_id']).join(fgm_h2, on='game_id', how='left') \
                .with_columns([pl.coalesce([pl.col('fgm_h2'), pl.lit(0)]).alias('fgm_h2')])

            # helpers
            def count_line(values: pl.Series, over_at: int) -> Dict[str, int]:
                arr = values.to_list()
                over = sum(1 for v in arr if v is not None and int(v) >= over_at)
                under = sum(1 for v in arr if v is not None and int(v) < over_at)
                return {"over": over, "under": under}

            # game: 1.5 (>=2) and 2.5 (>=3)
            fg_counts['game']['1.5'] = count_line(pg['fgm'], 2)
            fg_counts['game']['2.5'] = count_line(pg['fgm'], 3)
            # halves: 0.5 (>=1) and 1.5 (>=2)
            fg_counts['h1']['0.5'] = count_line(ph1['fgm_h1'], 1)
            fg_counts['h1']['1.5'] = count_line(ph1['fgm_h1'], 2)
            fg_counts['h2']['0.5'] = count_line(ph2['fgm_h2'], 1)
            fg_counts['h2']['1.5'] = count_line(ph2['fgm_h2'], 2)
    except Exception:
        # if anything fails, leave fg_counts empty
        pass

    return {
        "status": "success",
        "season": season_val,
        "team": team_abbr,
        "games": int(per_game.height),
        "counts": {
            "game": game_counts,
            "h1": h1_counts,
            "h2": h2_counts,
            "margin": margin_counts,
            "fg": fg_counts,
            "wl": wl_counts,
        },
    }


