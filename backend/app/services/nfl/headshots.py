from typing import Optional
import nflreadpy as nfl
from starlette.concurrency import run_in_threadpool
import polars as pl
import re


def _normalize_query(q: str) -> str:
  return re.sub(r"\s+", " ", q.strip()).lower()


async def resolve_headshot_service(q: str, season: Optional[int] = None) -> dict:
  """
  Very simple resolver: tries to find a player's ESPN ID from rosters
  and returns an ESPN headshot URL. This is a lightweight MVP, not fuzzy.
  """
  current = nfl.get_current_season()
  year = int(season) if season else int(current)

  def _load_rosters():
    # nflreadpy exposes roster via load_rosters in newer versions; fallback to schedules players via pbp if needed
    try:
      return nfl.load_rosters([year])
    except Exception:
      return pl.DataFrame([])

  rosters = await run_in_threadpool(_load_rosters)
  if rosters is None or rosters.height == 0:
    return {"status": "not_found", "message": "rosters unavailable", "query": q}

  norm = _normalize_query(q)
  name_col = "full_name" if "full_name" in rosters.columns else ("player_name" if "player_name" in rosters.columns else None)
  espn_col = "espn_id" if "espn_id" in rosters.columns else None

  if not name_col or not espn_col:
    return {"status": "not_found", "message": "columns not available", "query": q}

  df = rosters.with_columns(
    pl.col(name_col)
      .cast(pl.Utf8)
      .str.replace(r"^\s+|\s+$", "", literal=False)
      .alias("_name")
  )
  df = df.filter(pl.col("_name").str.to_lowercase().str.contains(re.escape(norm)))

  if df.height == 0:
    return {"status": "not_found", "query": q}

  # take first match
  row = df.select(["_name", espn_col]).head(1).to_dicts()[0]
  espn_id = str(row.get(espn_col)) if row.get(espn_col) is not None else None

  if not espn_id or espn_id in ("None", "nan"):
    return {"status": "not_found", "query": q}

  headshot = f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png"
  thumb = f"https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/{espn_id}.png&w=96&h=96"
  return {
    "status": "success",
    "query": q,
    "season": year,
    "match": {
      "name": row.get("_name"),
      "espn_id": espn_id,
      "headshot_url": headshot,
      "thumbnail_url": thumb,
    },
  }


