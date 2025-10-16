import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSchedule, getStandings } from '../../api/nfl';
import { getTeamLogo } from '../../utils/logos';
import { parseEtToLocalDate } from '../../utils/time';
import { getTeamCity } from '../../utils/nflMeta';

export default function ScoresCard({ season, league = 'NFL' }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('idle');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [recordsMap, setRecordsMap] = useState({});

  const toIsoLocal = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const shiftDate = (dateStr, deltaDays) => {
    const [y, m, d] = dateStr.split('-').map((v) => Number(v));
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    const y2 = dt.getUTCFullYear();
    const m2 = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d2 = String(dt.getUTCDate()).padStart(2, '0');
    return `${y2}-${m2}-${d2}`;
  };

  const findAdjacentGameDay = useCallback(async (direction) => {
    // direction: -1 prev, +1 next
    let probe = selectedDate;
    for (let i = 0; i < 30; i += 1) {
      probe = shiftDate(probe, direction);
      try {
        const d = await getSchedule(probe, probe, season);
        const list = d && Array.isArray(d.games) ? d.games : [];
        if (list.length > 0) {
          setSelectedDate(probe);
          return;
        }
      } catch {
        // ignore and continue probing
      }
    }
  }, [selectedDate, season]);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    getSchedule(selectedDate, selectedDate, season)
      .then((d) => {
        if (!alive) return;
        const list = d && Array.isArray(d.games) ? d.games : [];
        if (list.length === 0) {
          // Auto-avanza al siguiente día con juegos
          findAdjacentGameDay(1).then(() => {}).catch(() => {});
          setStatus('done');
          setRows([]);
          return;
        }
        const enriched = list.map((g) => {
          const localKick = parseEtToLocalDate(g.kickoff || g.game_date);
          return { ...g, _localKick: localKick, _localDateIso: localKick ? toIsoLocal(localKick) : null };
        }).sort((a, b) => {
          const ta = a._localKick ? a._localKick.getTime() : 0;
          const tb = b._localKick ? b._localKick.getTime() : 0;
          return ta - tb;
        });
        setRows(enriched);
        setStatus('done');
      })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [season, selectedDate, findAdjacentGameDay]);

  // load team records once per season to display (W-L)
  useEffect(() => {
    let alive = true;
    getStandings(season).then((d) => {
      if (!alive) return;
      const map = {};
      const conferences = d && d.conferences ? d.conferences : {};
      ['AFC','NFC'].forEach((c) => {
        const rows = conferences[c] || [];
        rows.forEach((r) => { map[r.team] = `${r.w}-${r.l}`; });
      });
      setRecordsMap(map);
    }).catch(() => {});
    return () => { alive = false; };
  }, [season]);


  const getTimeParts = (val) => {
    if (!val) return ['', ''];
    try {
      const localDate = parseEtToLocalDate(val);
      if (!localDate) return [String(val), ''];
      const ts = localDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const [hhmm, ampm] = ts.split(' ');
      return [hhmm, ampm || ''];
    } catch {
      return [String(val), ''];
    }
  };

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const formatSelectedDate = (isoOrDate) => {
    const date = isoOrDate instanceof Date
      ? isoOrDate
      : (() => { const [y, m, d] = String(isoOrDate).split('-').map((v) => Number(v)); return new Date(y, (m || 1) - 1, d || 1); })();
    const dayLong = date.toLocaleDateString('es-MX', { weekday: 'long' });
    const monthLong = date.toLocaleDateString('es-MX', { month: 'long' });
    const dd = date.getDate();
    return `${capitalize(dayLong)}, ${capitalize(monthLong)} ${dd}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4">
      <div className="mb-3">
        <div className="relative flex items-center justify-between">
          <button onClick={() => findAdjacentGameDay(-1)} className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-800" aria-label="Día anterior con juegos">
            <img src="/icons/angle-left.svg" alt="prev" className="w-4 h-4" />
          </button>
          <div className="text-base font-semibold text-zinc-900 select-none">{formatSelectedDate(selectedDate)}</div>
          <button onClick={() => findAdjacentGameDay(1)} className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-800" aria-label="Día siguiente con juegos">
            <img src="/icons/angle-right.svg" alt="next" className="w-4 h-4" />
          </button>
        </div>
      </div>
      {status === 'loading' && <div className="text-zinc-500 text-sm">Cargando…</div>}
      {status === 'error' && <div className="text-rose-500 text-sm">Error al cargar.</div>}
      {status === 'done' && rows.length === 0 && <div className="text-zinc-500 text-sm">Sin juegos en la fecha.</div>}
      {status === 'done' && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {rows.map((g, i) => {
            const [hhmm, ampm] = getTimeParts(g.kickoff || g.game_date);
            const isFinal = g.home_score != null && g.away_score != null;
            const centerTop = isFinal ? '@' : hhmm;
            const venueText = (() => {
              let city = (g.venue_city || '').toString().trim();
              let country = (g.venue_country || '').toString().trim();
              // Normalize country label
              if (country) {
                const c = country.toLowerCase();
                if (c === 'united states' || c === 'unitedstates' || c === 'us') country = 'USA';
              }
              // Fallback: try to parse from g.venue string built by backend
              if (!city || !country) {
                const v = (g.venue || '').toString();
                if (v.includes(',')) {
                  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
                  // Typical forms we generate:
                  //   "Stadium, City, State"  -> city at index 1
                  //   "City, State"           -> city at index 0
                  //   "Stadium, City, Country"-> city at index 1, country last
                  if (!city) {
                    city = parts.length >= 3 ? parts[1] : parts[0] || city;
                  }
                  if (!country && parts.length >= 2) {
                    const last = parts[parts.length - 1];
                    // Treat US states as not-a-country
                    const usStates = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);
                    country = usStates.has(last.toUpperCase()) ? '' : last;
                  }
                }
              }
              // Ultimate fallback: use mapped home city
              if (!city) city = getTeamCity(g.home_team) || '';
              if (country === 'USA') return city || 'USA';
              if (city && country) return `${city}, ${country}`;
              if (city) return city;
              if (country) return country;
              return '';
            })();
            const matchupPath = `/versus/${encodeURIComponent(g.home_team)}/vs/${encodeURIComponent(g.away_team)}`;
            return (
              <div
                key={i}
                role="link"
                tabIndex={0}
                onClick={() => navigate(matchupPath)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(matchupPath); } }}
                className="grid grid-cols-3 items-center py-2 md:py-3 px-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
              >
                <div className="flex justify-end items-center gap-2 md:gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link to={`/teams/${encodeURIComponent(g.away_team)}`} onClick={(e) => e.stopPropagation()} className="shrink-0 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center overflow-hidden">
                      <img src={getTeamLogo(league.toLowerCase(), g.away_team)} alt={g.away_team} className="max-w-full max-h-full object-contain" />
                    </Link>
                    <div className="w-24 md:w-28 text-center">
                      {isFinal ? (
                        <div className="text-zinc-900 text-base md:text-lg font-extrabold">{g.away_score}</div>
                      ) : (
                        <>
                          <div className="truncate text-zinc-900 text-base md:text-lg font-semibold">{g.away_team}</div>
                          <div className="text-[11px] text-zinc-500">{recordsMap[g.away_team] || ''}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-zinc-900 font-extrabold text-base md:text-lg leading-tight">{centerTop}</span>
                  {!isFinal && <span className="text-zinc-900 text-[11px] md:text-xs leading-none font-semibold">{ampm}</span>}
                  <span className="mt-1 text-zinc-500 text-[10px] md:text-xs leading-none truncate" title={venueText}>
                    {venueText}
                  </span>
                </div>
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <div className="w-24 md:w-28 text-center">
                    {isFinal ? (
                      <div className="text-zinc-900 text-base md:text-lg font-extrabold">{g.home_score}</div>
                    ) : (
                      <>
                        <div className="truncate text-zinc-900 text-base md:text-lg font-semibold">{g.home_team}</div>
                        <div className="text-[11px] text-zinc-500">{recordsMap[g.home_team] || ''}</div>
                      </>
                    )}
                  </div>
                  <Link to={`/teams/${encodeURIComponent(g.home_team)}`} onClick={(e) => e.stopPropagation()} className="shrink-0 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center overflow-hidden">
                    <img src={getTeamLogo(league.toLowerCase(), g.home_team)} alt={g.home_team} className="max-w-full max-h-full object-contain" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


