import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { getTeamLogo } from '../utils/logos';
import { getSchedule } from '../api/nfl';
import { parseEtToLocalDate } from '../utils/time';
import { getTeamPrimaryColor, getTeamFullName, getTeamNickname, getTeamCity } from '../utils/nflMeta';
import { getStandings, getTeamOffense, getLeagueOffenseRanks, getTeamDefense, getLeagueDefenseRanks, getTeamSpecialTeams, getLeagueSpecialTeamsRanks } from '../api/nfl';

export default function TeamPage() {
  const { team } = useParams();
  const [league] = useState('nfl');
  const color = useMemo(() => getTeamPrimaryColor(team), [team]);
  // const fullName = useMemo(() => getTeamFullName(team), [team]);
  
  // Normalize team code for API calls (LAR -> LA for backend compatibility)
  const normalizedTeam = useMemo(() => {
    const t = String(team || '').toUpperCase();
    return t === 'LAR' ? 'LA' : t;
  }, [team]);

  const teamsList = [
    'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'
  ];

  const [recordText, setRecordText] = useState('');
  const [rankText, setRankText] = useState('');
  const [teamRow, setTeamRow] = useState(null);
  const [leagueRows, setLeagueRows] = useState([]);
  // selector helpers (match Versus compact style)
  const displayTeam = getTeamNickname(team) || getTeamFullName(team) || team;
  const nameSize = (n) => {
    const len = String(n || '').length;
    if (len > 16) return 'text-[11px] md:text-sm';
    if (len > 12) return 'text-xs md:text-sm';
    return 'text-sm md:text-base';
  };
  const [offMetrics, setOffMetrics] = useState(null);
  const [offRanks, setOffRanks] = useState(null);
  const [defMetrics, setDefMetrics] = useState(null);
  const [defRanks, setDefRanks] = useState(null);
  const [stMetrics, setStMetrics] = useState(null);
  const [stRanks, setStRanks] = useState(null);
  const navigate = useNavigate();
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [monthGames, setMonthGames] = useState([]);
  const [monthStatus, setMonthStatus] = useState('idle');

  const textClass = useMemo(() => {
    // Choose text color based on background brightness for contrast
    try {
      const hex = String(color || '').replace('#','');
      const h = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
      const r = parseInt(h.substring(0,2), 16) || 0;
      const g = parseInt(h.substring(2,4), 16) || 0;
      const b = parseInt(h.substring(4,6), 16) || 0;
      const brightness = (r * 299 + g * 587 + b * 114) / 1000; // 0-255
      return brightness > 186 ? 'text-zinc-900' : 'text-white';
    } catch {
      return 'text-white';
    }
  }, [color]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await getStandings(new Date().getFullYear());
        if (!alive || !d || !d.conferences) return;
        const all = [...(d.conferences.AFC || []), ...(d.conferences.NFC || [])];
        const row = all.find((r) => r.team === normalizedTeam);
        if (!row) return;
        const wl = `${row.w}-${row.l}${row.t ? `-${row.t}` : ''}`;
        const div = row.division || '';
        const confKey = row.conference || (div && div.includes(' ') ? div.split(' ')[0] : '');
        const conferences = d.conferences || {};
        const confRows = conferences[confKey] || [];
        // Rank helpers: 1-based; if not found, default 1 (handles ties edge-cases from merges)
        const rankOf = (rowsArr) => {
          const idx = (rowsArr || []).findIndex((r) => r.team === normalizedTeam);
          return idx >= 0 ? (idx + 1) : 1;
        };
        const divRows = (confRows || []).filter((r) => r.division === div);
        const rankDiv = rankOf(divRows);
        const rankConf = rankOf(confRows);
        const ordinalEs = (n) => `${n}.º`;
        const segMap = { East: 'Este', North: 'Norte', South: 'Sur', West: 'Oeste' };
        const confMap = { AFC: 'Conferencia Americana', NFC: 'Conferencia Nacional' };
        let divEs = div;
        if (div && div.includes(' ')) {
          const [conf, seg] = div.split(' ');
          divEs = `${confMap[conf] || conf} ${segMap[seg] || seg}`;
        }
        setRecordText(wl);
        setRankText(div ? `${ordinalEs(rankDiv)} en ${divEs}` : `${ordinalEs(rankConf)} en Conferencia`);
        setTeamRow(row);
        setLeagueRows(all);
      } catch {}
    };
    load();
    return () => { alive = false; };
  }, [normalizedTeam]);

  // Load team schedule for current month (monthly calendar)
  useEffect(() => {
    let alive = true;
    const season = new Date().getFullYear();
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setMonthStatus('loading');
    getSchedule(iso(start), iso(end), season)
      .then((d) => {
        if (!alive) return;
        const list = Array.isArray(d?.games) ? d.games : [];
        const filtered = list
          .filter((g) => g.home_team === normalizedTeam || g.away_team === normalizedTeam)
          .map((g) => {
            const localKick = parseEtToLocalDate(g.kickoff || g.game_date);
            return { ...g, _localKick: localKick };
          });
        setMonthGames(filtered);
        setMonthStatus('done');
      })
      .catch(() => alive && setMonthStatus('error'));
    return () => { alive = false; };
  }, [normalizedTeam, monthDate]);

  // Load offensive metrics (REG season 2025)
  useEffect(() => {
    let alive = true;
    getTeamOffense(normalizedTeam, 2025, 'REG')
      .then((d) => { if (!alive) return; setOffMetrics(d && d.metrics ? d.metrics : null); })
      .catch(() => {});
    getLeagueOffenseRanks(2025, 'REG')
      .then((d) => { if (!alive) return; setOffRanks(d && Array.isArray(d.teams) ? d.teams : null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [normalizedTeam]);

  // Load defensive metrics (REG season 2025)
  useEffect(() => {
    let alive = true;
    getTeamDefense(normalizedTeam, 2025, 'REG')
      .then((d) => { if (!alive) return; setDefMetrics(d && d.metrics ? d.metrics : null); })
      .catch(() => {});
    getLeagueDefenseRanks(2025, 'REG')
      .then((d) => { if (!alive) return; setDefRanks(d && Array.isArray(d.teams) ? d.teams : null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [normalizedTeam]);

  // Load special teams metrics (REG season 2025)
  useEffect(() => {
    let alive = true;
    getTeamSpecialTeams(normalizedTeam, 2025, 'REG')
      .then((d) => { if (!alive) return; setStMetrics(d && d.metrics ? d.metrics : null); })
      .catch(() => {});
    getLeagueSpecialTeamsRanks(2025, 'REG')
      .then((d) => { if (!alive) return; setStRanks(d && Array.isArray(d.teams) ? d.teams : null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [normalizedTeam]);

  return (
    <div className="" style={{ backgroundColor: '#FAFAFA', minHeight: 'var(--minvh)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <div className="max-w-screen-xl mx-auto px-2 md:px-4 lg:px-6 py-4">
        <div className="mb-3"><Link to="/app" className="text-sm text-zinc-600 hover:underline">← Volver</Link></div>

        <div className="relative rounded-2xl shadow-sm border border-zinc-200" style={{ backgroundColor: color }}>
          {/* Top bar: selector at left, empty at right */}
          <div className="p-2 md:p-3 flex items-center justify-between">
            <div className={`relative ${textClass}`}>
              <details className="relative">
                <summary className="list-none inline-flex items-center gap-1.5 cursor-pointer select-none h-8">
                  <img src={getTeamLogo(league, team)} alt={team} className="w-7 h-7 shrink-0" />
                  <span className={`${nameSize(displayTeam)} font-semibold leading-none`}>{displayTeam}</span>
                  <img src="/icons/angle-down.svg" alt="abrir" className="w-3 h-3 shrink-0" />
                </summary>
                <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                <div className="absolute left-0 mt-1 w-60 max-h-80 overflow-auto bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                  {teamsList.map((t) => (
                    <button key={t} type="button" onClick={(e) => { const d=e.currentTarget.closest('details'); if (d) d.open=false; navigate(`/teams/${t}`); }} className={`flex items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-md ${String(team).toUpperCase()===t?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>
                      <img src={getTeamLogo(league, t)} alt={t} className="w-5 h-5" />
                      {getTeamNickname(t) || getTeamFullName(t) || t}
                    </button>
                  ))}
                </div>
              </details>
            </div>
            <div />
          </div>
          {/* Centered logo and record */}
          <div className="pt-0 pb-3 md:pt-2 md:pb-4 flex flex-col items-center justify-center gap-1.5">
            <img src={getTeamLogo(league, team)} alt={team} className="w-20 h-20 md:w-24 md:h-24 drop-shadow-md" />
            <div className={`${textClass} text-xs md:text-sm font-medium tracking-tight`}>
              {recordText || '—'} <span className="mx-1">·</span> {rankText || ''}
            </div>
          </div>
        </div>


        {/* Ofensiva - tarjeta de ancho completo */}
        <div className="mt-3 bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4">
          <div className="text-center text-sm md:text-base font-extrabold text-zinc-900 mb-2">Ofensiva</div>
          {(() => {
            const ord = (n) => `${n}.º`;
            let ppg = teamRow && (teamRow.pf_pg ?? teamRow.pf);
            if (ppg && ppg.toFixed) ppg = ppg.toFixed(1);
            let ppgRank = null;
            if (leagueRows && leagueRows.length) {
              const sorted = [...leagueRows].sort((a, b) => ((b.pf_pg ?? 0) - (a.pf_pg ?? 0)));
              const idx = sorted.findIndex((r) => r.team === normalizedTeam);
              ppgRank = idx >= 0 ? ord(idx + 1) : null;
            }
            const rankOf = (key) => {
              if (!offRanks) return '—';
              const sorted = [...offRanks].sort((a, b) => {
                const av = a[key] ?? 0; const bv = b[key] ?? 0;
                if (key === 'to_pg') {
                  if (av !== bv) return av - bv; // menor es mejor
                } else if (bv !== av) {
                  return bv - av; // mayor es mejor
                }
                return String(a.team).localeCompare(String(b.team)); // desempate estable
              });
              const idx = sorted.findIndex((r) => r.team === normalizedTeam);
              return idx >= 0 ? `${idx + 1}.º` : '—';
            };
            const fmt1 = (x) => (x == null ? '—' : Number(x).toFixed(1));
            const totalTdVal = offMetrics ? ((offMetrics.td_total ?? 0) + (offMetrics.td_def_total ?? 0)) : null;
            const itemsTop = [
              { k: 'PTS/P', v: ppg ?? '—', r: ppgRank ?? '—' },
              { k: 'YDS PASE/P', v: fmt1(offMetrics?.pyds_pg), r: rankOf('pyds_pg') },
              { k: 'YDS CARR/P', v: fmt1(offMetrics?.ruyds_pg), r: rankOf('ruyds_pg') },
              { k: 'TD TOT', v: (totalTdVal != null ? totalTdVal : '—'), r: rankOf('td_total') },
              { k: 'PERD/P', v: fmt1(offMetrics?.to_pg), r: rankOf('to_pg') },
            ];
            const rankOfBottom = (key) => {
              if (!offRanks) return '—';
              const sorted = [...offRanks].sort((a, b) => {
                const av = a[key] ?? 0; const bv = b[key] ?? 0;
                if (key === 'plays_pg' || key === 'to_margin_pg') {
                  if (bv !== av) return bv - av; // mayor es mejor
                } else if (bv !== av) {
                  return bv - av; // mayor es mejor
                }
                return String(a.team).localeCompare(String(b.team));
              });
              const idx = sorted.findIndex((r) => r.team === normalizedTeam);
              return idx >= 0 ? `${idx + 1}.º` : '—';
            };
            const itemsBottom = [
              { k: '3RA %', v: offMetrics?.third_pct != null ? `${offMetrics.third_pct}%` : '—', r: rankOfBottom('third_pct') },
              { k: '4TA %', v: offMetrics?.fourth_pct != null ? `${offMetrics.fourth_pct}%` : '—', r: rankOfBottom('fourth_pct') },
              { k: 'TD ZR %', v: offMetrics?.rz_td_pct != null ? `${offMetrics.rz_td_pct}%` : '—', r: rankOfBottom('rz_td_pct') },
              { k: 'EXPL/P', v: fmt1(offMetrics?.explosive_pg), r: rankOfBottom('explosive_pg') },
              { k: 'YDS/JUG', v: fmt1(offMetrics?.ypp), r: rankOfBottom('ypp') },
            ];
            return (
              <div>
                <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                  {itemsTop.map((it) => (
                    <div key={it.k} className="text-center px-1 py-1">
                      <div className="text-[10px] md:text-xs text-zinc-500 mb-0.5 uppercase tracking-wide">{it.k}</div>
                      <div className="text-base md:text-xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                      <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{it.r}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 grid grid-cols-5 gap-1.5 md:gap-2">
                  {itemsBottom.map((it) => (
                    <div key={it.k} className="text-center px-1 py-1">
                      <div className="text-[10px] md:text-xs text-zinc-500 mb-0.5 uppercase tracking-wide">{it.k}</div>
                      <div className="text-base md:text-xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                      <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{it.r || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Defensiva - tarjeta de ancho completo */}
        <div className="mt-3 bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4">
          <div className="text-center text-sm md:text-base font-extrabold text-zinc-900 mb-2">Defensiva</div>
          {(() => {
            const rankOf = (key, smallerIsBetter = false) => {
              if (!defRanks) return '—';
              const sorted = [...defRanks].sort((a, b) => {
                const va = a[key] ?? (smallerIsBetter ? Infinity : -Infinity);
                const vb = b[key] ?? (smallerIsBetter ? Infinity : -Infinity);
                if (va !== vb) return smallerIsBetter ? va - vb : vb - va;
                return String(a.team).localeCompare(String(b.team));
              });
              const idx = sorted.findIndex((r) => r.team === normalizedTeam);
              return idx >= 0 ? `${idx + 1}.º` : '—';
            };
            const fmt1 = (x) => (x == null ? '—' : Number(x).toFixed(1));
            const fmtPct = (x) => (x == null ? '—' : `${Number(x).toFixed(1)}%`);

            const top = [
              { k: 'PTS CONC/P', v: fmt1(defMetrics?.pa_pg), r: rankOf('pa_pg', true) },
              { k: 'YDS PASE CONC/P', v: fmt1(defMetrics?.pyds_allowed_pg), r: rankOf('pyds_allowed_pg', true) },
              { k: 'YDS CARR CONC/P', v: fmt1(defMetrics?.ruyds_allowed_pg), r: rankOf('ruyds_allowed_pg', true) },
              { k: 'TD CONC', v: defMetrics?.td_allowed_total ?? defMetrics?.td_allowed ?? '—', r: rankOf('td_allowed', true) },
              { k: 'SACKS/P', v: fmt1(defMetrics?.sacks_pg), r: rankOf('sacks_pg') },
            ];
            const bottom = [
              { k: '3RA CONC %', v: fmtPct(defMetrics?.third_allowed_pct), r: rankOf('third_allowed_pct', true) },
              { k: '4TA CONC %', v: fmtPct(defMetrics?.fourth_allowed_pct), r: rankOf('fourth_allowed_pct', true) },
              { k: 'TD ZR CONC %', v: fmtPct(defMetrics?.rz_td_allowed_pct), r: rankOf('rz_td_allowed_pct', true) },
              { k: 'RECUP/P', v: fmt1(defMetrics?.takeaways_pg), r: rankOf('takeaways_pg') },
              { k: 'YDS/JUG CONC', v: fmt1(defMetrics?.yppa), r: rankOf('yppa', true) },
            ];

            return (
              <div>
                <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                  {top.map((it) => (
                    <div key={it.k} className="text-center px-1 py-1">
                      <div className="text-[10px] md:text-xs text-zinc-500 mb-0.5 uppercase tracking-wide">{it.k}</div>
                      <div className="text-base md:text-xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                      <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{it.r}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 grid grid-cols-5 gap-1.5 md:gap-2">
                  {bottom.map((it) => (
                    <div key={it.k} className="text-center px-1 py-1">
                      <div className="text-[10px] md:text-xs text-zinc-500 mb-0.5 uppercase tracking-wide">{it.k}</div>
                      <div className="text-base md:text-xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                      <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{it.r}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Equipos Especiales - tarjeta */}
        <div className="mt-3 bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4">
          <div className="text-center text-sm md:text-base font-extrabold text-zinc-900 mb-2">Pateadores</div>
          {(() => {
            const rankOf = (key, smallerIsBetter = false) => {
              if (!stRanks) return '—';
              const sorted = [...stRanks].sort((a, b) => {
                const va = a[key] ?? (smallerIsBetter ? Infinity : -Infinity);
                const vb = b[key] ?? (smallerIsBetter ? Infinity : -Infinity);
                if (va !== vb) return smallerIsBetter ? va - vb : vb - va;
                return String(a.team).localeCompare(String(b.team));
              });
              const idx = sorted.findIndex((r) => r.team === normalizedTeam);
              return idx >= 0 ? `${idx + 1}.º` : '—';
            };
            const fmt1 = (x) => (x == null ? '—' : Number(x).toFixed(1));
            const fmtPct = (x) => (x == null ? '—' : `${Number(x).toFixed(1)}%`);

            const top = [
              { k: '% GC', v: fmtPct(stMetrics?.fg_pct), r: rankOf('fg_pct') },
              { k: 'GC/P', v: fmt1(stMetrics?.fg_made_pg), r: rankOf('fg_made_pg') },
              { k: 'INT GC/P', v: fmt1(stMetrics?.fg_att_pg), r: rankOf('fg_att_pg') },
              { k: '% PTO EX', v: fmtPct(stMetrics?.xp_pct), r: rankOf('xp_pct') },
            ];
            const bottom = [
              { k: 'PTO EX/P', v: fmt1(stMetrics?.xp_made_pg), r: rankOf('xp_made_pg') },
              { k: 'INT PTO EX/P', v: fmt1(stMetrics?.xp_att_pg), r: rankOf('xp_att_pg') },
              { k: 'DESPEJ/P', v: fmt1(stMetrics?.punts_pg), r: rankOf('punts_pg', true) },
              { k: 'DESPEJ PROM', v: fmt1(stMetrics?.punt_avg), r: rankOf('punt_avg') },
            ];

            return (
              <div>
                <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                  {top.map((it) => (
                    <div key={it.k} className="text-center px-1 py-1">
                      <div className="text-[10px] md:text-xs text-zinc-500 mb-0.5 uppercase tracking-wide">{it.k}</div>
                      <div className="text-base md:text-xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                      <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{it.r}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5 md:gap-2">
                  {bottom.map((it) => (
                    <div key={it.k} className="text-center px-1 py-1">
                      <div className="text-[10px] md:text-xs text-zinc-500 mb-0.5 uppercase tracking-wide">{it.k}</div>
                      <div className="text-base md:text-xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                      <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{it.r}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Juegos del mes (lista estilo inicio) */}
        <div className="mt-3 bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600" aria-label="Mes anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div className="text-sm md:text-base font-semibold text-zinc-900">
              {monthDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </div>
            <button type="button" onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600" aria-label="Mes siguiente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          {(() => {
            const byDay = new Map();
            const fmtDate = (d) => d.toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' });
            monthGames.forEach((g) => {
              const ld = g._localKick || parseEtToLocalDate(g.kickoff || g.game_date);
              const key = ld ? `${ld.getFullYear()}-${ld.getMonth()}-${ld.getDate()}` : 'sin-fecha';
              if (!byDay.has(key)) byDay.set(key, { date: ld, games: [] });
              byDay.get(key).games.push(g);
            });
            const groups = Array.from(byDay.values()).sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
            const records = (() => {
              const m = {};
              (leagueRows || []).forEach((r) => { m[r.team] = `${r.w}-${r.l}`; });
              return m;
            })();
            const timeParts = (g) => {
              if (g.home_score != null && g.away_score != null) return [`${g.away_score}-${g.home_score}`, ''];
              const ld = g._localKick || parseEtToLocalDate(g.kickoff || g.game_date);
              if (!ld) return ['', ''];
              const ts = ld.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
              return [ts, ''];
            };
            return (
              <div className="flex flex-col gap-2">
                {groups.map((grp, gi) => (
                  <div key={gi}>
                    <div className="text-xs md:text-sm font-semibold text-zinc-800 mb-1">
                      {grp.date ? fmtDate(grp.date) : 'Sin fecha'}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {grp.games.sort((a,b)=> (a._localKick?.getTime()||0)-(b._localKick?.getTime()||0)).map((g, i) => {
                        const [centerTop] = timeParts(g);
                        const isFinal = g.home_score != null && g.away_score != null;
                        const centerText = isFinal ? '@' : centerTop;
                        const venueText = (() => {
                          let city = (g.venue_city || '').toString().trim();
                          let country = (g.venue_country || '').toString().trim();
                          if (country) {
                            const c = country.toLowerCase();
                            if (c === 'united states' || c === 'unitedstates' || c === 'us') country = 'USA';
                          }
                          if (!city || !country) {
                            const v = (g.venue || '').toString();
                            if (v.includes(',')) {
                              const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
                              if (!city) city = parts.length >= 3 ? parts[1] : parts[0] || city;
                              if (!country && parts.length >= 2) {
                                const last = parts[parts.length - 1];
                                const usStates = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);
                                country = usStates.has((last || '').toUpperCase()) ? '' : last;
                              }
                            }
                          }
                          if (!city) city = (getTeamCity(g.home_team) || '').split(',').slice(0,2).join(', ');
                          if (country === 'USA') return city || 'USA';
                          if (city && country) return `${city}, ${country}`;
                          if (city) return city;
                          if (country) return country;
                          return '';
                        })();
                        const matchupPath = `/versus/${encodeURIComponent(g.home_team)}/vs/${encodeURIComponent(g.away_team)}`;
                        return (
                          <div key={i} role="link" tabIndex={0} onClick={() => navigate(matchupPath)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(matchupPath); } }} className="grid grid-cols-3 items-center py-2 px-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                            <div className="flex justify-end items-center gap-2 md:gap-3 min-w-0">
                              <div className="flex items-center gap-3 min-w-0">
                                <Link to={`/teams/${encodeURIComponent(g.away_team)}`} onClick={(e) => e.stopPropagation()} className="shrink-0 w-7 h-7 md:w-8 md:h-8 flex items-center justify-center overflow-hidden">
                                  <img src={getTeamLogo(league, g.away_team)} alt={g.away_team} className="max-w-full max-h-full object-contain" />
                                </Link>
                                <div className="w-24 md:w-28 text-center">
                                  {isFinal ? (
                                    <div className="text-zinc-900 text-base md:text-lg font-extrabold">{g.away_score}</div>
                                  ) : (
                                    <>
                                      <div className="truncate text-zinc-900 text-sm md:text-base font-semibold">{g.away_team}</div>
                                      <div className="text-[10px] text-zinc-500">{records[g.away_team] || ''}</div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-center justify-center text-center">
                              <span className="text-zinc-900 font-extrabold text-sm md:text-base leading-tight">{centerText}</span>
                              <span className="mt-1 text-zinc-500 text-[10px] md:text-xs leading-none truncate" title={venueText}>{venueText}</span>
                            </div>
                            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                              <div className="w-24 md:w-28 text-center">
                                {isFinal ? (
                                  <div className="text-zinc-900 text-base md:text-lg font-extrabold">{g.home_score}</div>
                                ) : (
                                  <>
                                    <div className="truncate text-zinc-900 text-sm md:text-base font-semibold">{g.home_team}</div>
                                    <div className="text-[10px] text-zinc-500">{records[g.home_team] || ''}</div>
                                  </>
                                )}
                              </div>
                              <Link to={`/teams/${encodeURIComponent(g.home_team)}`} onClick={(e) => e.stopPropagation()} className="shrink-0 w-7 h-7 md:w-8 md:h-8 flex items-center justify-center overflow-hidden">
                                <img src={getTeamLogo(league, g.home_team)} alt={g.home_team} className="max-w-full max-h-full object-contain" />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {groups.length === 0 && monthStatus === 'done' && (
                  <div className="text-xs text-zinc-500">Sin juegos este mes.</div>
                )}
                {monthStatus === 'loading' && <div className="text-xs text-zinc-500">Cargando…</div>}
                {monthStatus === 'error' && <div className="text-xs text-rose-500">Error al cargar calendario.</div>}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}


