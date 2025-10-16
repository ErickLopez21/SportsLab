from typing import List, Optional, Dict, Any
import re
import unicodedata

import nflreadpy as nfl
from starlette.concurrency import run_in_threadpool
import polars as pl
import pandas as pd


def _normalize_text(text: str) -> str:
    """Normalize text for search: remove accents, apostrophes, and special chars.
    Examples: "Ja'Marr" -> "jamarr", "José" -> "jose"
    """
    if not text:
        return ""
    # Lowercase
    text = text.lower()
    # Remove accents/diacritics
    text = unicodedata.normalize('NFD', text)
    text = ''.join(char for char in text if unicodedata.category(char) != 'Mn')
    # Remove apostrophes, hyphens, dots, etc.
    text = re.sub(r"['\-\.]", "", text)
    # Keep only alphanumeric and spaces
    text = re.sub(r"[^a-z0-9\s]", "", text)
    return text.strip()


def _parse_seasons(raw: Optional[str], current_season: int) -> List[int]:
    """Parse seasons input into a validated list of years within [1999, current].
    Accepts formats like "2022-2024" or "2019,2020,2021". Invalid inputs fall back to last 5 years.
    """
    default = [current_season - 4, current_season - 3, current_season - 2, current_season - 1, current_season]
    if not raw or not raw.strip():
        return default
    raw = raw.strip()
    try:
        if "-" in raw:
            start, end = raw.split("-", 1)
            start = start.strip()
            end = end.strip()
            if not (start.isdigit() and end.isdigit()):
                return default
            start_i = max(1999, int(start))
            end_i = min(int(end), int(current_season))
            if start_i > end_i:
                return default
            return [y for y in range(start_i, end_i + 1)]

        parts = [p.strip() for p in raw.split(",") if p.strip()]
        seasons: List[int] = []
        for p in parts:
            if not p.isdigit():
                continue
            val = int(p)
            if 1999 <= val <= int(current_season):
                seasons.append(val)
        seasons = sorted(set(seasons))
        return seasons if seasons else default
    except Exception:
        return default


def _parse_game_types(raw: Optional[str]) -> List[str]:
    if not raw:
        return ["REG"]
    parts = [p.strip().upper() for p in raw.split(",") if p.strip()]
    valid = {"REG", "POST", "PRE"}
    return [p for p in parts if p in valid] or ["REG"]


def _last_n_seasons(n: int, current_season: int) -> List[int]:
    start = max(1999, int(current_season) - (n - 1))
    return list(range(start, int(current_season) + 1))


def _aggregate_player_stats(st_pd, chosen_player_id=None, headshot=None):
    """Helper to aggregate player stats from pandas DataFrame.
    Returns seasons array, aggregate blocks, and role guess.
    """
    # Normalize column access helpers
    def get(g, key_list, default=0):
        for k in key_list:
            if k in g:
                return g[k]
        return default

    # Get unique seasons from the season column
    if "season" in st_pd.columns:
        seasons_vals = sorted(st_pd["season"].dropna().unique().astype(int).tolist())
    else:
        seasons_vals = []
    
    rec_seasons, rush_seasons, pass_seasons, def_seasons, kick_seasons = [], [], [], [], []
    for s in seasons_vals:
        g = st_pd[st_pd["season"] == s]
        # games count from week column if exists, else len rows
        games = int(g["week"].nunique()) if "week" in g.columns else int(len(g))
        # Receiving
        rec_yds = int(get(g.sum(numeric_only=True), ["receiving_yards", "rec_yards"]))
        rec_tds = int(get(g.sum(numeric_only=True), ["receiving_tds", "rec_tds", "receiving_touchdowns"]))
        targets = int(get(g.sum(numeric_only=True), ["targets", "receiving_targets"]))
        recs = int(get(g.sum(numeric_only=True), ["receptions"]))
        ypr = round(rec_yds / recs, 2) if recs > 0 else 0
        ypt = round(rec_yds / targets, 2) if targets > 0 else 0
        if rec_yds or recs or targets or rec_tds:
            rec_seasons.append({"season": int(s), "games": games, "targets": targets, "receptions": recs, "yards": rec_yds, "td": rec_tds, "yards_per_reception": ypr, "yards_per_target": ypt})
        # Rushing
        ru_yds = int(get(g.sum(numeric_only=True), ["rushing_yards", "carries_yards"]))
        ru_tds = int(get(g.sum(numeric_only=True), ["rushing_tds", "rush_tds", "rushing_touchdowns"]))
        ru_att = int(get(g.sum(numeric_only=True), ["carries", "rushing_attempts", "rush_attempts", "rushing_att"]))
        ypc = round(ru_yds / ru_att, 2) if ru_att > 0 else 0
        if ru_yds or ru_att or ru_tds:
            rush_seasons.append({"season": int(s), "games": games, "attempts": ru_att, "yards": ru_yds, "td": ru_tds, "yards_per_carry": ypc})
        # Passing
        pa_yds = int(get(g.sum(numeric_only=True), ["passing_yards"]))
        pa_tds = int(get(g.sum(numeric_only=True), ["passing_tds"]))
        pa_int = int(get(g.sum(numeric_only=True), ["passing_interceptions"]))
        att = int(get(g.sum(numeric_only=True), ["attempts", "passing_attempts"]))
        cmp_ = int(get(g.sum(numeric_only=True), ["completions", "passing_completions"]))
        ypa = round(pa_yds / att, 2) if att > 0 else 0
        sacks = int(get(g.sum(numeric_only=True), ["sacks_suffered", "sacks"]))
        sack_yds = int(get(g.sum(numeric_only=True), ["sack_yards_lost"]))
        if pa_yds or att or pa_tds or pa_int:
            pass_seasons.append({"season": int(s), "games": games, "attempts": att, "completions": cmp_, "yards": pa_yds, "td": pa_tds, "interceptions": pa_int, "completion_pct": round((cmp_/att*100),1) if att>0 else 0, "yards_per_attempt": ypa, "sacks": sacks, "sack_yards": sack_yds})
        # Defense
        def_tackles_solo = int(get(g.sum(numeric_only=True), ["def_tackles_solo"]))
        def_tackles_assist = int(get(g.sum(numeric_only=True), ["def_tackles_with_assist"]))
        def_tackles = def_tackles_solo + def_tackles_assist  # Total tackles = solo + assisted
        def_tfl = int(get(g.sum(numeric_only=True), ["def_tackles_for_loss"]))
        def_qb_hits = int(get(g.sum(numeric_only=True), ["def_qb_hits"]))
        def_sacks = int(get(g.sum(numeric_only=True), ["def_sacks"]))
        def_sack_yds = int(get(g.sum(numeric_only=True), ["def_sack_yards"]))
        def_ints = int(get(g.sum(numeric_only=True), ["def_interceptions"]))
        def_int_yds = int(get(g.sum(numeric_only=True), ["def_interception_yards"]))
        def_tds = int(get(g.sum(numeric_only=True), ["def_tds"]))
        def_fumbles = int(get(g.sum(numeric_only=True), ["def_fumbles"]))
        def_fumbles_forced = int(get(g.sum(numeric_only=True), ["def_fumbles_forced"]))
        def_pass_def = int(get(g.sum(numeric_only=True), ["def_pass_defended"]))
        yps = round(def_sack_yds / def_sacks, 1) if def_sacks > 0 else 0
        if def_tackles or def_sacks or def_ints or def_tfl or def_qb_hits:
            def_seasons.append({"season": int(s), "games": games, "tackles": def_tackles, "tackles_solo": def_tackles_solo, "tfl": def_tfl, "qb_hits": def_qb_hits, "sacks": def_sacks, "sack_yards": def_sack_yds, "interceptions": def_ints, "int_yards": def_int_yds, "tds": def_tds, "fumbles_rec": def_fumbles, "fumbles_forced": def_fumbles_forced, "pass_defended": def_pass_def, "yards_per_sack": yps})
        # Kicking
        try:
            fg_made = int(get(g.sum(numeric_only=True), ["fg_made", "field_goals_made"]))
            fg_att = int(get(g.sum(numeric_only=True), ["fg_att", "field_goals_attempted", "fg_attempts"]))
            fg_pct = round((fg_made / fg_att * 100), 1) if fg_att > 0 else 0
            pat_made = int(get(g.sum(numeric_only=True), ["pat_made", "extra_points_made"]))
            pat_att = int(get(g.sum(numeric_only=True), ["pat_att", "extra_points_attempted", "pat_attempts"]))
            pat_pct = round((pat_made / pat_att * 100), 1) if pat_att > 0 else 0
            try:
                fg_long = int(get(g.max(numeric_only=True), ["fg_long", "fg_longest"]))
            except:
                fg_long = 0
            fg_made_30_39 = int(get(g.sum(numeric_only=True), ["fg_made_30_39"]))
            fg_made_40_49 = int(get(g.sum(numeric_only=True), ["fg_made_40_49"]))
            # Aggregate all 50+ field goals: 50-59 + 60+
            fg_made_50_59 = int(get(g.sum(numeric_only=True), ["fg_made_50_59"]))
            fg_made_60_plus = int(get(g.sum(numeric_only=True), ["fg_made_60_", "fg_made_60_plus"]))
            fg_made_50_plus = fg_made_50_59 + fg_made_60_plus
            if fg_made or fg_att or pat_made or pat_att:
                kick_seasons.append({"season": int(s), "games": games, "fg_made": fg_made, "fg_att": fg_att, "fg_pct": fg_pct, "pat_made": pat_made, "pat_att": pat_att, "pat_pct": pat_pct, "fg_long": fg_long, "fg_made_30_39": fg_made_30_39, "fg_made_40_49": fg_made_40_49, "fg_made_50_plus": fg_made_50_plus})
        except Exception:
            pass  # Skip kicking stats if there's any error

    # Build aggregates
    def _sum(lst, key):
        return sum(int(x.get(key, 0)) for x in lst)
    def _games(lst):
        return sum(int(x.get("games", 0)) for x in lst)

    qb_block = None
    if pass_seasons:
        g = _games(pass_seasons) or 1
        total_yards = _sum(pass_seasons, "yards")
        total_tds = _sum(pass_seasons, "td")
        total_int = _sum(pass_seasons, "interceptions")
        total_att = _sum(pass_seasons, "attempts") or 1
        total_cmp = _sum(pass_seasons, "completions")
        ypg = round(total_yards / g, 1)
        td_pg = round(total_tds / g, 2)
        ypa = round(total_yards / total_att, 2)
        att_pg = round(total_att / g, 1)
        cmp_pg = round(total_cmp / g, 1)
        total_sacks = _sum(pass_seasons, "sacks")
        total_sack_yds = _sum(pass_seasons, "sack_yards")
        sacks_pg = round(total_sacks / g, 2)
        yds_per_sack = round(total_sack_yds / total_sacks, 1) if total_sacks > 0 else 0
        qb_block = {
            "attempts_per_game": att_pg,
            "completions_per_game": cmp_pg,
            "yards_per_game": ypg,
            "yards_total": total_yards,
            "td_per_game": td_pg,
            "td_total": total_tds,
            "interceptions": total_int,
            "yards_per_attempt": ypa,
            "sacks_per_game": sacks_pg,
            "yards_per_sack": yds_per_sack
        }

    rb_block = None
    if rush_seasons:
        g = _games(rush_seasons) or 1
        total_yards = _sum(rush_seasons, "yards")
        total_tds = _sum(rush_seasons, "td")
        total_att = _sum(rush_seasons, "attempts") or 1
        ypg = round(total_yards / g, 1)
        att_pg = round(total_att / g, 1)
        ypc = round(total_yards / total_att, 2)
        rb_block = {
            "yards_per_game": ypg,
            "yards_total": total_yards,
            "td_total": total_tds,
            "attempts_per_game": att_pg,
            "yards_per_carry": ypc
        }

    wr_block = None
    if rec_seasons:
        g = _games(rec_seasons) or 1
        total_yards = _sum(rec_seasons, "yards")
        total_tds = _sum(rec_seasons, "td")
        total_targets = _sum(rec_seasons, "targets")
        total_rec = _sum(rec_seasons, "receptions")
        ypg = round(total_yards / g, 1)
        tgt_pg = round(total_targets / g, 1)
        rec_pg = round(total_rec / g, 1)
        ypr = round(total_yards / total_rec, 2) if total_rec > 0 else 0
        ypt = round(total_yards / total_targets, 2) if total_targets > 0 else 0
        wr_block = {"yards_per_game": ypg, "yards_total": total_yards, "td_total": total_tds, "targets_per_game": tgt_pg, "receptions_per_game": rec_pg, "yards_per_reception": ypr, "yards_per_target": ypt}

    def_block = None
    if def_seasons:
        g = _games(def_seasons) or 1
        total_tackles = _sum(def_seasons, "tackles")
        total_tackles_solo = _sum(def_seasons, "tackles_solo")
        total_tfl = _sum(def_seasons, "tfl")
        total_qb_hits = _sum(def_seasons, "qb_hits")
        total_sacks = _sum(def_seasons, "sacks")
        total_sack_yds = _sum(def_seasons, "sack_yards")
        total_ints = _sum(def_seasons, "interceptions")
        total_int_yds = _sum(def_seasons, "int_yards")
        total_def_tds = _sum(def_seasons, "tds")
        total_fumbles_rec = _sum(def_seasons, "fumbles_rec")
        total_fumbles_forced = _sum(def_seasons, "fumbles_forced")
        total_pass_def = _sum(def_seasons, "pass_defended")
        tackles_pg = round(total_tackles / g, 1)
        tackles_solo_pg = round(total_tackles_solo / g, 1)
        tfl_pg = round(total_tfl / g, 1)
        qb_hits_pg = round(total_qb_hits / g, 1)
        sacks_pg = round(total_sacks / g, 1)
        ints_pg = round(total_ints / g, 1)
        yps = round(total_sack_yds / total_sacks, 1) if total_sacks > 0 else 0
        def_block = {
            "tackles_total": total_tackles,
            "tackles_per_game": tackles_pg,
            "tackles_solo_per_game": tackles_solo_pg,
            "tfl_per_game": tfl_pg,
            "qb_hits_per_game": qb_hits_pg,
            "sacks_total": total_sacks,
            "sacks_per_game": sacks_pg,
            "sack_yards_total": total_sack_yds,
            "yards_per_sack": yps,
            "interceptions_total": total_ints,
            "interceptions_per_game": ints_pg,
            "interception_yards": total_int_yds,
            "def_td": total_def_tds,
            "fumbles_recovered": total_fumbles_rec,
            "fumbles_forced": total_fumbles_forced,
            "pass_defended": total_pass_def
        }

    kick_block = None
    if kick_seasons:
        g = _games(kick_seasons) or 1
        total_fg_made = _sum(kick_seasons, "fg_made")
        total_fg_att = _sum(kick_seasons, "fg_att")
        fg_pct = round((total_fg_made / total_fg_att * 100), 1) if total_fg_att > 0 else 0
        total_pat_made = _sum(kick_seasons, "pat_made")
        total_pat_att = _sum(kick_seasons, "pat_att")
        pat_pct = round((total_pat_made / total_pat_att * 100), 1) if total_pat_att > 0 else 0
        fg_long = max((x.get("fg_long", 0) for x in kick_seasons), default=0)
        total_fg_30_39 = _sum(kick_seasons, "fg_made_30_39")
        total_fg_40_49 = _sum(kick_seasons, "fg_made_40_49")
        total_fg_50_plus = _sum(kick_seasons, "fg_made_50_plus")
        kick_block = {
            "fg_made": total_fg_made,
            "fg_att": total_fg_att,
            "fg_pct": fg_pct,
            "pat_made": total_pat_made,
            "pat_att": total_pat_att,
            "pat_pct": pat_pct,
            "fg_long": fg_long,
            "fg_made_30_39": total_fg_30_39,
            "fg_made_40_49": total_fg_40_49,
            "fg_made_50_plus": total_fg_50_plus
        }

    # seasons_out combining
    seasons_out = []
    seasons_set = set()
    for lst in (rec_seasons or []):
        seasons_set.add(int(lst.get("season")))
    for lst in (rush_seasons or []):
        seasons_set.add(int(lst.get("season")))
    for lst in (pass_seasons or []):
        seasons_set.add(int(lst.get("season")))
    for lst in (def_seasons or []):
        seasons_set.add(int(lst.get("season")))
    for lst in (kick_seasons or []):
        seasons_set.add(int(lst.get("season")))
    unique = sorted(seasons_set)
    for s in unique:
        row = {"season": int(s)}
        for lst, key in ((rec_seasons, "receiving"), (rush_seasons, "rushing"), (pass_seasons, "passing"), (def_seasons, "defense"), (kick_seasons, "kicking")):
            found = next((x for x in lst if x["season"] == s), None) if lst else None
            if found:
                row[key] = found
        seasons_out.append(row)

    # Role guess
    counts = {
        "passing": _sum(pass_seasons, "attempts"), 
        "rushing": _sum(rush_seasons, "attempts"), 
        "receiving": _sum(rec_seasons, "targets"),
        "defense": _sum(def_seasons, "tackles"),
        "kicking": _sum(kick_seasons, "fg_att")
    }
    best = max(counts, key=lambda k: counts[k]) if any(v>0 for v in counts.values()) else None
    role_guess = ("QB" if best == "passing" else ("RB" if best == "rushing" else ("WR/TE" if best == "receiving" else ("DEF" if best == "defense" else ("K" if best == "kicking" else None)))))

    # Total games across all activities
    total_games = _games(rec_seasons) + _games(rush_seasons) + _games(pass_seasons) + _games(def_seasons) + _games(kick_seasons)
    if "week" in st_pd.columns:
        total_games = int(st_pd["week"].nunique())

    return {
        "seasons": seasons_out,
        "aggregate": {
            "role_guess": role_guess,
            "qb": qb_block,
            "rb": rb_block,
            "wr_te": wr_block,
            "def": def_block,
            "kick": kick_block,
        },
        "total_games": total_games,
        "player_id": chosen_player_id,
        "headshot_url": headshot,
    }


async def get_player_career_service(
    player_name: str,
    seasons: Optional[str],
    game_types: Optional[str] = None
):
    """Career-style aggregates for a player across seasons with role-aware blocks.
    Defaults: seasons = last 10, game_types = REG,POST.
    """
    current_season = nfl.get_current_season()
    season_list = _parse_seasons(seasons, current_season) if seasons else _last_n_seasons(10, current_season)
    game_type_list = _parse_game_types(game_types or "REG,POST")

    # First try player-level stats (more robust: includes player_id)
    try:
        def _load_stats():
            # Load player stats without stat_type filter - get all positions
            return nfl.load_player_stats(season_list)
        stats = await run_in_threadpool(_load_stats)
        
        cols = stats.columns
        # Filter by game types if column exists
        if "season_type" in cols:
            stats = stats.filter(pl.col("season_type").is_in(game_type_list))
        
        # Match by player name (try multiple column names)
        name_l = player_name.strip().lower()
        
        conds = []
        if "player_display_name" in cols:
            conds.append(pl.col("player_display_name").str.to_lowercase() == name_l)
        if "player_name" in cols:
            conds.append(pl.col("player_name").str.to_lowercase() == name_l)
        
        st = stats
        if conds:
            st = stats.filter(conds[0] if len(conds)==1 else conds[0] | conds[1])
        
        # If not found, try fuzzy: first+last tokens in order
        if st.height == 0 and ("player_display_name" in cols or "player_name" in cols):
            import re as _re
            tokens = [tok for tok in _re.split(r"\s+", player_name.strip()) if tok]
            first = tokens[0] if tokens else player_name.strip()
            last = tokens[-1] if tokens else player_name.strip()
            patt = rf"(?i)\b{_re.escape(first)}\b.*\b{_re.escape(last)}\b"
            cond_list = []
            if "player_display_name" in cols:
                cond_list.append(pl.col("player_display_name").str.contains(patt))
            if "player_name" in cols:
                cond_list.append(pl.col("player_name").str.contains(patt))
            if cond_list:
                st = stats.filter(cond_list[0] if len(cond_list)==1 else cond_list[0] | cond_list[1])
        
        chosen_player_id = None
        headshot = None
        if "player_id" in st.columns and st.height > 0:
            # Choose most frequent player_id (prioritize by most recent activity)
            # Group by player_id and get the one with most recent games
            st_pd_temp = st.to_pandas()
            if "season" in st_pd_temp.columns and "player_id" in st_pd_temp.columns:
                # Get player_id with most recent activity
                grouped = st_pd_temp.groupby("player_id").agg({
                    "season": ["max", "count"]
                }).reset_index()
                grouped.columns = ["player_id", "latest_season", "game_count"]
                # Sort by latest season desc, then by game count desc
                grouped = grouped.sort_values(["latest_season", "game_count"], ascending=[False, False])
                chosen_player_id = grouped.iloc[0]["player_id"] if len(grouped) > 0 else None
            else:
                # Fallback: most frequent player_id
                pid_rows = st.select(pl.col("player_id")).to_series().to_list()
                freq = {}
                for pid in pid_rows:
                    if pid is None:
                        continue
                    freq[pid] = freq.get(pid, 0) + 1
                chosen_player_id = max(freq, key=freq.get) if freq else None
            
            if chosen_player_id:
                st = st.filter(pl.col("player_id") == chosen_player_id)
                
                # Get headshot URL
                if "headshot_url" in st.columns:
                    headshot_series = st.select(pl.col("headshot_url")).to_series()
                    headshot = next((url for url in headshot_series if url and str(url) != "None"), None)

        if st.height > 0:
            # Convert to pandas and use helper to aggregate
            st_pd = st.to_pandas()
            result = _aggregate_player_stats(st_pd, chosen_player_id, headshot)
            
            return {
                "status": "success",
                "player": player_name.title(),
                "player_id": result["player_id"],
                "headshot_url": result["headshot_url"],
                "game_types": game_type_list,
                "seasons": result["seasons"],
                "aggregate": result["aggregate"],
            }
    except Exception:
        pass

    # Fallback to PBP if player_stats is unavailable
    def _load_pbp():
        return nfl.load_pbp(season_list)

    pbp = await run_in_threadpool(_load_pbp)

    # Filter by season type (regular/post/pre)
    if "season_type" in pbp.columns:
        pbp = pbp.filter(pl.col("season_type").is_in(game_type_list))
    elif "game_type" in pbp.columns:
        pbp = pbp.filter(pl.col("game_type").is_in(game_type_list))

    # Strict full name (case-insensitive) to avoid mixing (e.g., Tyreek vs Taysom Hill)
    name_eq = player_name.strip().lower()

    def name_condition(column: str):
        return pl.col(column).str.to_lowercase() == name_eq

    cols = pbp.columns
    rec_df = pbp.filter(name_condition("receiver_player_name")) if "receiver_player_name" in cols else pbp.head(0)
    rush_df = pbp.filter(name_condition("rusher_player_name")) if "rusher_player_name" in cols else pbp.head(0)
    pass_df = pbp.filter(name_condition("passer_player_name")) if "passer_player_name" in cols else pbp.head(0)

    rec_pd = rec_df.to_pandas() if rec_df.height > 0 else None
    rush_pd = rush_df.to_pandas() if rush_df.height > 0 else None
    pass_pd = pass_df.to_pandas() if pass_df.height > 0 else None

    # Helpers
    def _grp(df_pd, season_col: str = "season"):
        return df_pd.groupby(season_col) if (df_pd is not None and season_col in df_pd.columns) else None

    # Build consolidated games per season across any role to cap at real schedule
    season_games: dict[int, set] = {}
    def _accumulate_games(df_pd):
        if df_pd is None:
            return
        if "season" in df_pd.columns and "game_id" in df_pd.columns:
            for season, g in df_pd.groupby("season"):
                s = int(season)
                ids = set(g["game_id"].dropna().tolist())
                if s not in season_games:
                    season_games[s] = set()
                season_games[s].update(ids)

    _accumulate_games(rec_pd)
    _accumulate_games(rush_pd)
    _accumulate_games(pass_pd)

    # Receiving season aggregates
    rec_seasons = []
    if rec_pd is not None:
        grp = _grp(rec_pd)
        if grp is not None:
            for season, g in grp:
                s = int(season)
                games = len(season_games.get(s, set()))
                targets = int(g.get("pass", 0).sum()) if "pass" in g else 0
                comps = int(g.get("complete_pass", 0).sum()) if "complete_pass" in g else 0
                yds = int(g.get("receiving_yards", 0).sum()) if "receiving_yards" in g else 0
                tds = int(g.get("pass_touchdown", 0).sum()) if "pass_touchdown" in g else int(g.get("touchdown", 0).sum()) if "touchdown" in g else 0
                ypr = round(yds / comps, 2) if comps > 0 else 0
                ypt = round(yds / targets, 2) if targets > 0 else 0
                rec_seasons.append({"season": s, "games": int(games), "targets": targets, "receptions": comps, "yards": yds, "td": tds, "yards_per_reception": ypr, "yards_per_target": ypt})

    # Rushing season aggregates
    rush_seasons = []
    if rush_pd is not None:
        grp = _grp(rush_pd)
        if grp is not None:
            for season, g in grp:
                s = int(season)
                games = len(season_games.get(s, set()))
                att = int(g.get("rush", 0).sum()) if "rush" in g else 0
                yds = int(g.get("rushing_yards", 0).sum()) if "rushing_yards" in g else 0
                tds = int(g.get("rush_touchdown", 0).sum()) if "rush_touchdown" in g else int(g.get("touchdown", 0).sum()) if "touchdown" in g else 0
                ypc = round(yds / att, 2) if att > 0 else 0
                rush_seasons.append({"season": s, "games": int(games), "attempts": att, "yards": yds, "td": tds, "yards_per_carry": ypc})

    # Passing season aggregates
    pass_seasons = []
    if pass_pd is not None:
        grp = _grp(pass_pd)
        if grp is not None:
            for season, g in grp:
                s = int(season)
                games = len(season_games.get(s, set()))
                att = int(g.get("pass", 0).sum()) if "pass" in g else 0
                cmp_ = int(g.get("complete_pass", 0).sum()) if "complete_pass" in g else 0
                yds = int(g.get("passing_yards", 0).sum()) if "passing_yards" in g else 0
                tds = int(g.get("pass_touchdown", 0).sum()) if "pass_touchdown" in g else 0
                ints = int(g.get("interception", 0).sum()) if "interception" in g else 0
                cmp_pct = round((cmp_ / att * 100), 1) if att > 0 else 0
                ypa = round(yds / att, 2) if att > 0 else 0
                sacks = int(g.get("sack", 0).sum()) if "sack" in g else 0
                sack_yds = int(g.get("yards_gained", 0)[g.get("sack", 0) == 1].abs().sum()) if "sack" in g and "yards_gained" in g else 0
                pass_seasons.append({"season": s, "games": int(games), "attempts": att, "completions": cmp_, "yards": yds, "td": tds, "interceptions": ints, "completion_pct": cmp_pct, "yards_per_attempt": ypa, "sacks": sacks, "sack_yards": sack_yds})

    # Role guess by volume
    counts = {"receiving": (rec_pd is not None and len(rec_pd) or 0), "rushing": (rush_pd is not None and len(rush_pd) or 0), "passing": (pass_pd is not None and len(pass_pd) or 0)}
    role_guess = max(counts, key=counts.get) if any(v > 0 for v in counts.values()) else None

    # Aggregate blocks for requested metrics
    def _sum(lst, key):
        return sum(int(x.get(key, 0)) for x in lst)
    def _games(lst):
        return sum(int(x.get("games", 0)) for x in lst)

    # QB block
    qb_block = None
    if pass_seasons:
        g = _games(pass_seasons) or 1
        total_yards = _sum(pass_seasons, "yards")
        total_tds = _sum(pass_seasons, "td")
        total_int = _sum(pass_seasons, "interceptions")
        total_att = _sum(pass_seasons, "attempts") or 1
        ypg = round(total_yards / g, 1)
        td_pg = round(total_tds / g, 2)
        ypa = round(total_yards / total_att, 2)
        total_sacks = _sum(pass_seasons, "sacks")
        total_sack_yds = _sum(pass_seasons, "sack_yards")
        sacks_pg = round(total_sacks / g, 2)
        yds_per_sack = round(total_sack_yds / total_sacks, 1) if total_sacks > 0 else 0
        qb_block = {
            "yards_per_game": ypg,
            "yards_total": total_yards,
            "td_per_game": td_pg,
            "td_total": total_tds,
            "interceptions": total_int,
            "yards_per_attempt": ypa,
            "sacks_per_game": sacks_pg,
            "yards_per_sack": yds_per_sack,
        }

    # RB block
    rb_block = None
    if rush_seasons:
        g = _games(rush_seasons) or 1
        total_yards = _sum(rush_seasons, "yards")
        total_tds = _sum(rush_seasons, "td")
        total_att = _sum(rush_seasons, "attempts") or 1
        ypg = round(total_yards / g, 1)
        att_pg = round(total_att / g, 1)
        ypc = round(total_yards / total_att, 2)
        rb_block = {
            "yards_per_game": ypg,
            "yards_total": total_yards,
            "td_total": total_tds,
            "attempts_per_game": att_pg,
            "yards_per_attempt": ypc,
        }

    # WR/TE block
    wr_block = None
    if rec_seasons:
        g = _games(rec_seasons) or 1
        total_yards = _sum(rec_seasons, "yards")
        total_tds = _sum(rec_seasons, "td")
        total_targets = _sum(rec_seasons, "targets")
        total_rec = _sum(rec_seasons, "receptions")
        ypg = round(total_yards / g, 1)
        tgt_pg = round(total_targets / g, 1)
        rec_pg = round(total_rec / g, 1)
        ypr = round(total_yards / total_rec, 2) if total_rec > 0 else 0
        ypt = round(total_yards / total_targets, 2) if total_targets > 0 else 0
        wr_block = {
            "yards_per_game": ypg,
            "yards_total": total_yards,
            "td_total": total_tds,
            "targets_per_game": tgt_pg,
            "receptions_per_game": rec_pg,
            "yards_per_reception": ypr,
            "yards_per_target": ypt,
        }

    # DEF and KICK blocks not available in PBP fallback
    def_block = None
    kick_block = None

    # Per-season timeline merge for frontend charts
    seasons_out = []
    unique_seasons: set[int] = set()
    for lst in (rec_seasons or []), (rush_seasons or []), (pass_seasons or []):
        for x in lst:
            try:
                unique_seasons.add(int(x.get("season")))
            except Exception:
                pass
    for s in sorted(unique_seasons):
        row = {"season": int(s)}
        for lst, key in ((rec_seasons, "receiving"), (rush_seasons, "rushing"), (pass_seasons, "passing")):
            found = next((x for x in lst if x["season"] == s), None) if lst else None
            if found:
                row[key] = found
        seasons_out.append(row)

    return {
        "status": "success",
        "player": player_name.title(),
        "player_id": None,  # PBP fallback doesn't have reliable player_id
        "headshot_url": None,  # PBP fallback doesn't have headshot
        "game_types": game_type_list,
        "seasons": seasons_out,
        "aggregate": {
            "role_guess": ("QB" if role_guess == "passing" else ("RB" if role_guess == "rushing" else ("WR/TE" if role_guess == "receiving" else ("DEF" if role_guess == "defense" else ("K" if role_guess == "kicking" else None))))),
            "qb": qb_block,
            "rb": rb_block,
            "wr_te": wr_block,
            "def": def_block,
            "kick": kick_block,
        },
    }

async def get_player_vs_team_service(
    player_name: str,
    team: str,
    seasons: Optional[str],
    game_types: Optional[str] = None
):
    """Player stats vs specific team using load_player_stats for accuracy.
    Defaults: game_types = REG,POST
    """
    current_season = nfl.get_current_season()
    season_list = _parse_seasons(seasons, current_season)
    game_type_list = _parse_game_types(game_types or "REG,POST")
    
    # Use load_player_stats (same as career)
    try:
        def _load_stats():
            return nfl.load_player_stats(season_list)
        
        stats = await run_in_threadpool(_load_stats)
        
        cols = stats.columns
        # Filter by game types
        if "season_type" in cols:
            stats = stats.filter(pl.col("season_type").is_in(game_type_list))
        
        # Filter by opponent_team
        if "opponent_team" in cols:
            stats = stats.filter(pl.col("opponent_team") == team.upper())
        else:
            # If opponent_team not available, return not found
            return {
                "status": "not_found",
                "message": f"opponent_team column not available",
                "player": player_name,
                "team": team.upper(),
            }
        
        # Match by player name (exact or fuzzy)
        name_l = player_name.strip().lower()
        
        conds = []
        if "player_display_name" in cols:
            conds.append(pl.col("player_display_name").str.to_lowercase() == name_l)
        if "player_name" in cols:
            conds.append(pl.col("player_name").str.to_lowercase() == name_l)
        
        st = stats
        if conds:
            st = stats.filter(conds[0] if len(conds)==1 else conds[0] | conds[1])
        
        # If not found, try fuzzy: first+last tokens in order
        if st.height == 0 and ("player_display_name" in cols or "player_name" in cols):
            import re as _re
            tokens = [tok for tok in _re.split(r"\s+", player_name.strip()) if tok]
            first = tokens[0] if tokens else player_name.strip()
            last = tokens[-1] if tokens else player_name.strip()
            patt = rf"(?i)\b{_re.escape(first)}\b.*\b{_re.escape(last)}\b"
            cond_list = []
            if "player_display_name" in cols:
                cond_list.append(pl.col("player_display_name").str.contains(patt))
            if "player_name" in cols:
                cond_list.append(pl.col("player_name").str.contains(patt))
            if cond_list:
                st = stats.filter(cond_list[0] if len(cond_list)==1 else cond_list[0] | cond_list[1])
        
        if st.height == 0:
            return {
                "status": "not_found",
                "message": f"No data found for {player_name} vs {team}",
                "player": player_name,
                "team": team.upper(),
            }
        
        chosen_player_id = None
        headshot = None
        if "player_id" in st.columns and st.height > 0:
            # Choose most frequent player_id (prioritize by most recent activity)
            st_pd_temp = st.to_pandas()
            if "season" in st_pd_temp.columns and "player_id" in st_pd_temp.columns:
                # Get player_id with most recent activity
                grouped = st_pd_temp.groupby("player_id").agg({
                    "season": ["max", "count"]
                }).reset_index()
                grouped.columns = ["player_id", "latest_season", "game_count"]
                # Sort by latest season desc, then by game count desc
                grouped = grouped.sort_values(["latest_season", "game_count"], ascending=[False, False])
                chosen_player_id = grouped.iloc[0]["player_id"] if len(grouped) > 0 else None
            else:
                # Fallback: most frequent player_id
                pid_rows = st.select(pl.col("player_id")).to_series().to_list()
                freq = {}
                for pid in pid_rows:
                    if pid is None:
                        continue
                    freq[pid] = freq.get(pid, 0) + 1
                chosen_player_id = max(freq, key=freq.get) if freq else None
            
            if chosen_player_id:
                st = st.filter(pl.col("player_id") == chosen_player_id)
                
                # Get headshot URL
                if "headshot_url" in st.columns:
                    headshot_series = st.select(pl.col("headshot_url")).to_series()
                    headshot = next((url for url in headshot_series if url and str(url) != "None"), None)
        
        if st.height > 0:
            # Convert to pandas and use helper to aggregate
            st_pd = st.to_pandas()
            result = _aggregate_player_stats(st_pd, chosen_player_id, headshot)
            
            return {
                "status": "success",
                "player": player_name.title(),
                "player_id": result["player_id"],
                "headshot_url": result["headshot_url"],
                "opponent_team": team.upper(),
                "game_types": game_type_list,
                "games": result["total_games"],
                "seasons": result["seasons"],
                "aggregate": result["aggregate"],
            }
    except Exception as e:
        # If player_stats fails, return error
        return {
            "status": "error",
            "message": f"Failed to load player stats: {str(e)}",
            "player": player_name,
            "team": team.upper(),
        }


async def search_players_service(query: str, seasons: Optional[str], game_types: Optional[str] = None):
    current_season = nfl.get_current_season()
    season_list = _parse_seasons(seasons, current_season)
    game_type_list = _parse_game_types(game_types)

    def _load_pbp():
        return nfl.load_pbp(season_list)

    pbp = await run_in_threadpool(_load_pbp)

    # Filter by season type
    if "season_type" in pbp.columns:
        pbp = pbp.filter(pl.col("season_type").is_in(game_type_list))
    elif "game_type" in pbp.columns:
        pbp = pbp.filter(pl.col("game_type").is_in(game_type_list))

    pattern = f"(?i){re.escape(query)}"

    # Search across multiple name columns
    name_cols = [c for c in [
        "receiver_player_name",
        "rusher_player_name",
        "passer_player_name"
    ] if c in pbp.columns]

    if not name_cols:
        return {"status": "success", "count": 0, "players": []}

    cond = None
    for col in name_cols:
        c = pl.col(col).str.contains(pattern)
        cond = c if cond is None else (cond | c)

    subset = pbp.filter(cond)
    # Gather unique names with counts
    rows = []
    for col in name_cols:
        if col in subset.columns:
            names = subset.select(pl.col(col)).drop_nulls().to_series().to_list()
            rows.extend(names)

    # Count and return unique names sorted
    counts = {}
    for n in rows:
        key = n.strip()
        if not key:
            continue
        counts[key] = counts.get(key, 0) + 1

    players = [
        {"name": name, "count": counts[name]}
        for name in sorted(counts.keys(), key=lambda k: counts[k], reverse=True)
    ][:50]

    return {"status": "success", "count": len(players), "players": players}


async def search_players_service(query: str, limit: int = 20) -> Dict[str, Any]:
    """Search for players by name with normalized fuzzy matching.
    Returns player_id, name, position, team, and headshot for autocomplete/disambiguation.
    Normalizes both query and names to ignore apostrophes, accents, etc.
    """
    if not query or len(query.strip()) < 2:
        return {"status": "error", "message": "Query must be at least 2 characters", "results": []}
    
    # Normalize query for flexible matching
    query_normalized = _normalize_text(query.strip())
    current_season = nfl.get_current_season()
    
    try:
        # Load player stats for recent seasons to get active players
        def _load_stats():
            return nfl.load_player_stats([current_season, current_season - 1])
        
        stats = await run_in_threadpool(_load_stats)
        
        # Filter by name match (contains query)
        if "player_display_name" not in stats.columns:
            return {"status": "error", "message": "Player data unavailable", "results": []}
        
        # Convert to pandas for easier string manipulation with normalization
        df = stats.to_pandas()
        
        # Create normalized name column
        df['name_normalized'] = df['player_display_name'].apply(lambda x: _normalize_text(str(x)) if pd.notna(x) else "")
        
        # Filter matches: normalized name contains normalized query
        df = df[df['name_normalized'].str.contains(query_normalized, case=False, na=False)]
        
        if df.empty:
            return {"status": "success", "results": []}
        
        # Convert back to polars for consistency
        matches = pl.from_pandas(df)
        
        if matches.height == 0:
            return {"status": "success", "results": []}
        
        # Convert to pandas for easier grouping
        df = matches.to_pandas()
        
        # Group by player_id to get unique players with their latest info
        if "player_id" not in df.columns:
            return {"status": "success", "results": []}
        
        # For each player_id, get most recent season data
        results = []
        seen_ids = set()
        
        for _, row in df.sort_values(["season", "week"], ascending=[False, False]).iterrows():
            pid = row.get("player_id")
            if not pid or pid in seen_ids:
                continue
            
            seen_ids.add(pid)
            
            player_info = {
                "player_id": pid,
                "name": row.get("player_display_name") or row.get("player_name", "Unknown"),
                "position": row.get("position", ""),
                "position_group": row.get("position_group", ""),
                "team": row.get("team", ""),
                "headshot_url": row.get("headshot_url") if pd.notna(row.get("headshot_url")) else None,
                "season": int(row.get("season", 0)) if pd.notna(row.get("season")) else None,
            }
            
            results.append(player_info)
            
            if len(results) >= limit:
                break
        
        return {
            "status": "success",
            "query": query,
            "count": len(results),
            "results": results
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Search failed: {str(e)}",
            "results": []
        }


async def get_player_ranks_service(season: Optional[int] = None, game_types: Optional[str] = None) -> Dict[str, Any]:
    """Get player rankings for season (default current) by position.
    Returns rankings for QB, RB, and WR/TE metrics.
    """
    current_season = nfl.get_current_season()
    target_season = season if season else current_season
    
    # Parse game_types
    game_type_list = _parse_game_types(game_types or "REG,POST")
    
    try:
        def _load_stats():
            return nfl.load_player_stats([target_season])
        
        stats = await run_in_threadpool(_load_stats)
        
        # Filter by game types
        if "season_type" in stats.columns:
            stats = stats.filter(pl.col("season_type").is_in(game_type_list))
        
        # Convert to pandas for easier aggregation
        df = stats.to_pandas()
        
        if df.empty:
            return {"status": "success", "season": target_season, "qb": [], "rb": [], "wr_te": [], "def": []}
        
        # Group by player_id and aggregate stats
        # QB Rankings (passing stats)
        qb_df = df[df["passing_yards"].notna() & (df["passing_yards"] > 0)].copy()
        if not qb_df.empty:
            # Check which sack columns exist
            sack_col = None
            sack_yds_col = None
            for col in df.columns:
                if col in ["sacks_suffered", "sacks"] and sack_col is None:
                    sack_col = col
                if col in ["sack_yards_lost", "sack_yards"] and sack_yds_col is None:
                    sack_yds_col = col
            
            agg_dict = {
                "week": "nunique",  # games
                "passing_yards": "sum",
                "passing_tds": "sum",
                "attempts": "sum",
                "completions": "sum",
                "passing_interceptions": "sum",
            }
            if sack_col:
                agg_dict[sack_col] = "sum"
            if sack_yds_col:
                agg_dict[sack_yds_col] = "sum"
            
            qb_agg = qb_df.groupby(["player_id", "player_display_name"]).agg(agg_dict).reset_index()
            
            # Rename columns
            col_names = ["player_id", "player_name", "games", "yards_total", "td_total", "attempts_total", "completions_total", "interceptions"]
            if sack_col:
                col_names.append("sacks_total")
            if sack_yds_col:
                col_names.append("sack_yards_total")
            qb_agg.columns = col_names
            
            qb_agg["yards_per_game"] = (qb_agg["yards_total"] / qb_agg["games"]).round(1)
            qb_agg["attempts_per_game"] = (qb_agg["attempts_total"] / qb_agg["games"]).round(1)
            qb_agg["completions_per_game"] = (qb_agg["completions_total"] / qb_agg["games"]).round(1)
            qb_agg["yards_per_attempt"] = (qb_agg["yards_total"] / qb_agg["attempts_total"]).round(2)
            qb_agg["td_per_game"] = (qb_agg["td_total"] / qb_agg["games"]).round(2)
            
            # Add sack metrics if data exists
            if sack_col:
                qb_agg["sacks_per_game"] = (qb_agg["sacks_total"] / qb_agg["games"]).round(2)
            if sack_yds_col and sack_col:
                qb_agg["yards_per_sack"] = (qb_agg["sack_yards_total"] / qb_agg["sacks_total"]).fillna(0).round(1)
            
            # Filter: min 75 attempts (allows QBs with fewer games to qualify)
            qb_agg = qb_agg[qb_agg["attempts_total"] >= 75]
            qb_ranks = qb_agg.to_dict("records")
        else:
            qb_ranks = []
        
        # RB Rankings (rushing stats)
        rb_df = df[df["rushing_yards"].notna() & (df["rushing_yards"] > 0)].copy()
        if not rb_df.empty:
            rb_agg = rb_df.groupby(["player_id", "player_display_name"]).agg({
                "week": "nunique",
                "rushing_yards": "sum",
                "rushing_tds": "sum",
                "carries": "sum",
            }).reset_index()
            rb_agg.columns = ["player_id", "player_name", "games", "yards_total", "td_total", "attempts_total"]
            rb_agg["yards_per_game"] = (rb_agg["yards_total"] / rb_agg["games"]).round(1)
            rb_agg["attempts_per_game"] = (rb_agg["attempts_total"] / rb_agg["games"]).round(1)
            rb_agg["yards_per_carry"] = (rb_agg["yards_total"] / rb_agg["attempts_total"]).round(2)
            
            # Filter: min 35 carries (allows QBs like Mahomes to qualify)
            rb_agg = rb_agg[rb_agg["attempts_total"] >= 35]
            rb_ranks = rb_agg.to_dict("records")
        else:
            rb_ranks = []
        
        # WR/TE Rankings (receiving stats)
        wr_df = df[df["receiving_yards"].notna() & (df["receiving_yards"] > 0)].copy()
        if not wr_df.empty:
            wr_agg = wr_df.groupby(["player_id", "player_display_name"]).agg({
                "week": "nunique",
                "receiving_yards": "sum",
                "receiving_tds": "sum",
                "targets": "sum",
                "receptions": "sum",
            }).reset_index()
            wr_agg.columns = ["player_id", "player_name", "games", "yards_total", "td_total", "targets_total", "receptions_total"]
            wr_agg["yards_per_game"] = (wr_agg["yards_total"] / wr_agg["games"]).round(1)
            wr_agg["targets_per_game"] = (wr_agg["targets_total"] / wr_agg["games"]).round(1)
            wr_agg["receptions_per_game"] = (wr_agg["receptions_total"] / wr_agg["games"]).round(1)
            wr_agg["yards_per_reception"] = (wr_agg["yards_total"] / wr_agg["receptions_total"]).round(2)
            wr_agg["yards_per_target"] = (wr_agg["yards_total"] / wr_agg["targets_total"]).round(2)
            
            # Filter: min 20 targets
            wr_agg = wr_agg[wr_agg["targets_total"] >= 20]
            wr_ranks = wr_agg.to_dict("records")
        else:
            wr_ranks = []
        
        # DEF Rankings (defensive stats)
        def_df = df[(df["def_tackles_solo"].notna()) | (df["def_tackles_with_assist"].notna())].copy()
        if not def_df.empty:
            def_agg = def_df.groupby(["player_id", "player_display_name"]).agg({
                "week": "nunique",  # games
                "def_tackles_solo": "sum",
                "def_tackles_with_assist": "sum",
                "def_tackles_for_loss": "sum",
                "def_qb_hits": "sum",
                "def_sacks": "sum",
                "def_sack_yards": "sum",
                "def_interceptions": "sum",
                "def_interception_yards": "sum",
                "def_tds": "sum",
                "def_fumbles": "sum",
                "def_fumbles_forced": "sum",
                "def_pass_defended": "sum",
            }).reset_index()
            def_agg.columns = ["player_id", "player_name", "games", "tackles_solo_total", "tackles_assist_total", "tfl_total", "qb_hits_total", "sacks_total", "sack_yards_total", "interceptions_total", "int_yards_total", "def_td", "fumbles_recovered", "fumbles_forced", "pass_defended"]
            # Calculate total tackles = solo + assisted
            def_agg["tackles_total"] = def_agg["tackles_solo_total"] + def_agg["tackles_assist_total"]
            def_agg["tackles_per_game"] = (def_agg["tackles_total"] / def_agg["games"]).round(1)
            def_agg["tackles_solo_per_game"] = (def_agg["tackles_solo_total"] / def_agg["games"]).round(1)
            def_agg["tfl_per_game"] = (def_agg["tfl_total"] / def_agg["games"]).round(1)
            def_agg["qb_hits_per_game"] = (def_agg["qb_hits_total"] / def_agg["games"]).round(1)
            def_agg["sacks_per_game"] = (def_agg["sacks_total"] / def_agg["games"]).round(1)
            def_agg["interceptions_per_game"] = (def_agg["interceptions_total"] / def_agg["games"]).round(1)
            def_agg["yards_per_sack"] = (def_agg["sack_yards_total"] / def_agg["sacks_total"]).round(1).fillna(0)
            
            # Filter: min 3 total tackles
            def_agg = def_agg[def_agg["tackles_total"] >= 3]
            def_ranks = def_agg.to_dict("records")
        else:
            def_ranks = []
        
        # KICKER Rankings (kicking stats)
        kick_ranks = []
        try:
            # Check if kicking columns exist
            if "fg_made" in df.columns and "fg_att" in df.columns:
                kick_df = df[(df["fg_made"].notna()) | (df["fg_att"].notna())].copy()
            else:
                kick_df = pl.DataFrame()  # Empty dataframe
            
            if not kick_df.is_empty():
                # Need to aggregate individual kick attempts by distance
                # For 50+ yardas, we'll sum fg_made from multiple columns
                kick_agg = kick_df.groupby(["player_id", "player_display_name"]).agg({
                    "week": "nunique",  # games
                    "fg_made": "sum",
                    "fg_att": "sum",
                    "pat_made": "sum",
                    "pat_att": "sum",
                    "fg_made_30_39": "sum",
                    "fg_made_40_49": "sum",
                    "fg_made_50_plus": "sum",
                }).reset_index()
                kick_agg.columns = ["player_id", "player_name", "games", "fg_made", "fg_att", "pat_made", "pat_att", "fg_30_39", "fg_40_49", "fg_50_plus"]
                
                # Calculate percentages
                kick_agg["fg_pct"] = (kick_agg["fg_made"] / kick_agg["fg_att"] * 100).round(1)
                kick_agg["pat_pct"] = (kick_agg["pat_made"] / kick_agg["pat_att"] * 100).round(1)
                
                # For 50+ bucket: sum 50-59 and 60+ if they exist as separate columns
                if "fg_made_50_59" in kick_df.columns and "fg_made_60_" in kick_df.columns:
                    extra_agg = kick_df.groupby(["player_id", "player_display_name"]).agg({
                        "fg_made_50_59": "sum",
                        "fg_made_60_": "sum"
                    }).reset_index()
                    kick_agg = kick_agg.merge(extra_agg, on=["player_id", "player_name"], how="left")
                    kick_agg["fg_50_plus"] = kick_agg["fg_50_plus"].fillna(0) + kick_agg["fg_made_50_59"].fillna(0) + kick_agg["fg_made_60_"].fillna(0)
                    kick_agg = kick_agg.drop(columns=["fg_made_50_59", "fg_made_60_"])
                
                # Filter: min 10 field goal attempts
                kick_agg = kick_agg[kick_agg["fg_att"] >= 10]
                kick_ranks = kick_agg.to_dict("records")
        except Exception:
            pass  # Skip kicking rankings if there's any error
        
        return {
            "status": "success",
            "season": target_season,
            "qb": qb_ranks,
            "rb": rb_ranks,
            "wr_te": wr_ranks,
            "def": def_ranks,
            "kick": kick_ranks,
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to load player ranks: {str(e)}",
            "season": target_season,
            "qb": [],
            "rb": [],
            "wr_te": [],
            "def": [],
            "kick": [],
        }


