import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { getSchedule, getTeamTrends } from '../api/nfl';
import { parseEtToLocalDate } from '../utils/time';
import { getTeamLogo } from '../utils/logos';
import { getTeamFullName, getTeamNickname } from '../utils/nflMeta';
import { getTeamOffense, getTeamDefense, getTeamSpecialTeams, getLeagueOffenseRanks, getLeagueDefenseRanks, getLeagueSpecialTeamsRanks } from '../api/nfl';

// Team lists and maps hoisted to module scope to avoid useEffect dependency warnings
const TEAMS = [
  'BUF','MIA','NE','NYJ',
  'BAL','CIN','CLE','PIT',
  'HOU','IND','JAX','TEN',
  'DEN','KC','LV','LAC',
  'DAL','NYG','PHI','WAS',
  'CHI','DET','GB','MIN',
  'ATL','CAR','NO','TB',
  'ARI','LA','SEA','SF',
];
const TEAM_TO_DIV = {
  BUF: 'AFC East', MIA: 'AFC East', NE: 'AFC East', NYJ: 'AFC East',
  BAL: 'AFC North', CIN: 'AFC North', CLE: 'AFC North', PIT: 'AFC North',
  HOU: 'AFC South', IND: 'AFC South', JAX: 'AFC South', TEN: 'AFC South',
  DEN: 'AFC West', KC: 'AFC West', LV: 'AFC West', LAC: 'AFC West',
  DAL: 'NFC East', NYG: 'NFC East', PHI: 'NFC East', WAS: 'NFC East',
  CHI: 'NFC North', DET: 'NFC North', GB: 'NFC North', MIN: 'NFC North',
  ATL: 'NFC South', CAR: 'NFC South', NO: 'NFC South', TB: 'NFC South',
  ARI: 'NFC West', LA: 'NFC West', LAR: 'NFC West', SEA: 'NFC West', SF: 'NFC West',
};
const TEAM_TO_CONF = Object.fromEntries(Object.entries(TEAM_TO_DIV).map(([t, dv]) => [t, (dv || '').split(' ')[0]]));
const DIV_TO_ES = {
  'AFC East': 'AFC E',
  'AFC North': 'AFC N',
  'AFC South': 'AFC S',
  'AFC West': 'AFC O',
  'NFC East': 'NFC E',
  'NFC North': 'NFC N',
  'NFC South': 'NFC S',
  'NFC West': 'NFC O',
};
const divToEs = (v) => DIV_TO_ES[v] || v;

export default function MatchupPage() {
  const { home, away } = useParams();
  const navigate = useNavigate();

  const hasLeft = Boolean(away);
  const hasRight = Boolean(home);
  const selAway = String(away || '');
  const selHome = String(home || '');
  const displayAway = selAway ? (getTeamNickname(selAway) || getTeamFullName(selAway) || selAway) : null;
  const displayHome = selHome ? (getTeamNickname(selHome) || getTeamFullName(selHome) || selHome) : null;
  const nameSize = (n) => {
    const len = String(n || '').length;
    if (len > 16) return 'text-[11px] md:text-sm';
    if (len > 12) return 'text-xs md:text-sm';
    return 'text-sm md:text-base';
  };
  const [offA, setOffA] = useState(null); const [offB, setOffB] = useState(null);
  const [defA, setDefA] = useState(null); const [defB, setDefB] = useState(null);
  const [stA, setStA] = useState(null); const [stB, setStB] = useState(null);
  const [offRanksLeft, setOffRanksLeft] = useState(null);
  const [defRanksLeft, setDefRanksLeft] = useState(null);
  const [stRanksLeft, setStRanksLeft] = useState(null);
  const [offRanksRight, setOffRanksRight] = useState(null);
  const [defRanksRight, setDefRanksRight] = useState(null);
  const [stRanksRight, setStRanksRight] = useState(null);
  const [gamesL, setGamesL] = useState(null); // juegos disponibles en subset izquierdo
  const [gamesR, setGamesR] = useState(null); // juegos disponibles en subset derecho
  const [wlL, setWlL] = useState({ w: null, l: null });
  const [wlR, setWlR] = useState({ w: null, l: null });
  const [wlRanksLeft, setWlRanksLeft] = useState(null);
  const [wlRanksRight, setWlRanksRight] = useState(null);
  const schedCacheRef = useRef(null); // cache de schedule exitoso (no-trigger re-render)
  const [schedAll, setSchedAll] = useState(null); // calendario amplio para tendencias (todas las temporadas)
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [teamTrendsLeft, setTeamTrendsLeft] = useState(null); // away
  const [teamTrendsRight, setTeamTrendsRight] = useState(null); // home
  const trendsCacheRef = useRef(new Map()); // cache por par de equipos para tendencias
  const [spanL, setSpanL] = useState('all'); // 'all' | 'last3' | 'last5'
  const [venueL, setVenueL] = useState('all'); // 'all' | 'home' | 'away'
  const [spanR, setSpanR] = useState('all');
  const [venueR, setVenueR] = useState('all');
  const [oppConfL, setOppConfL] = useState('all'); // 'all' | 'AFC' | 'NFC'
  const [oppConfR, setOppConfR] = useState('all');
  const [oppDivL, setOppDivL] = useState('all'); // 'all' | 'AFC East' | ...
  const [oppDivR, setOppDivR] = useState('all');
  const [tab, setTab] = useState('stats'); // 'stats' | 'trends'

  const season = 2025;
  const gameTypes = 'REG';

  useEffect(() => {
    let alive = true;
    const leftExtra = {};
    if (spanL === 'last3') leftExtra.last_n = 3; if (spanL === 'last5') leftExtra.last_n = 5;
    if (venueL === 'home') leftExtra.venue = 'home'; if (venueL === 'away') leftExtra.venue = 'away';
    if (oppDivL !== 'all') {
      leftExtra.opponent_div = oppDivL;
    } else if (oppConfL === 'AFC' || oppConfL === 'NFC') {
      leftExtra.opponent_conf = oppConfL;
    }
    const rightExtra = {};
    if (spanR === 'last3') rightExtra.last_n = 3; if (spanR === 'last5') rightExtra.last_n = 5;
    if (venueR === 'home') rightExtra.venue = 'home'; if (venueR === 'away') rightExtra.venue = 'away';
    if (oppDivR !== 'all') {
      rightExtra.opponent_div = oppDivR;
    } else if (oppConfR === 'AFC' || oppConfR === 'NFC') {
      rightExtra.opponent_conf = oppConfR;
    }
    const seasonStart = `${season}-08-01`;
    const seasonEnd = `${season + 1}-02-15`;
    const pOffA = away ? getTeamOffense(String(away).toUpperCase(), season, gameTypes, leftExtra) : Promise.resolve({ metrics: null });
    const pOffB = home ? getTeamOffense(String(home).toUpperCase(), season, gameTypes, rightExtra) : Promise.resolve({ metrics: null });
    const pDefA = away ? getTeamDefense(String(away).toUpperCase(), season, gameTypes, leftExtra) : Promise.resolve({ metrics: null });
    const pDefB = home ? getTeamDefense(String(home).toUpperCase(), season, gameTypes, rightExtra) : Promise.resolve({ metrics: null });
    const pStA  = away ? getTeamSpecialTeams(String(away).toUpperCase(), season, gameTypes, leftExtra) : Promise.resolve({ metrics: null });
    const pStB  = home ? getTeamSpecialTeams(String(home).toUpperCase(), season, gameTypes, rightExtra) : Promise.resolve({ metrics: null });

    const reqs = [
      pOffA,
      pOffB,
      pDefA,
      pDefB,
      pStA,
      pStB,
      getLeagueOffenseRanks(season, gameTypes, leftExtra),
      getLeagueDefenseRanks(season, gameTypes, leftExtra),
      getLeagueSpecialTeamsRanks(season, gameTypes, leftExtra),
      getLeagueOffenseRanks(season, gameTypes, rightExtra),
      getLeagueDefenseRanks(season, gameTypes, rightExtra),
      getLeagueSpecialTeamsRanks(season, gameTypes, rightExtra),
      getSchedule(seasonStart, seasonEnd, season),
    ];
    Promise.allSettled(reqs).then((res) => {
      if (!alive) return;
      const val = (i, fb) => (res[i]?.status === 'fulfilled' ? res[i].value : fb);
      const oA = val(0, { metrics: null, games: 0 });
      const oB = val(1, { metrics: null, games: 0 });
      const dA = val(2, { metrics: null, games: 0 });
      const dB = val(3, { metrics: null, games: 0 });
      const sA = val(4, { metrics: null, games: 0 });
      const sB = val(5, { metrics: null, games: 0 });
      const oRL = val(6, { teams: [] });
      const dRL = val(7, { teams: [] });
      const sRL = val(8, { teams: [] });
      const oRR = val(9, { teams: [] });
      const dRR = val(10, { teams: [] });
      const sRR = val(11, { teams: [] });
      const sched = val(12, { games: [] });

      setOffA(oA?.metrics || null); setOffB(oB?.metrics || null);
      setDefA(dA?.metrics || null); setDefB(dB?.metrics || null);
      setStA(sA?.metrics || null); setStB(sB?.metrics || null);
      // Agregar robustez al conteo de juegos por lado
      const gLlist = [oA?.games, dA?.games, sA?.games].filter((x) => typeof x === 'number');
      const gRlist = [oB?.games, dB?.games, sB?.games].filter((x) => typeof x === 'number');
      setGamesL(gLlist.length ? Math.max(...gLlist) : null);
      setGamesR(gRlist.length ? Math.max(...gRlist) : null);
      setOffRanksLeft(Array.isArray(oRL?.teams) ? oRL.teams : null);
      setDefRanksLeft(Array.isArray(dRL?.teams) ? dRL.teams : null);
      setStRanksLeft(Array.isArray(sRL?.teams) ? sRL.teams : null);
      setOffRanksRight(Array.isArray(oRR?.teams) ? oRR.teams : null);
      setDefRanksRight(Array.isArray(dRR?.teams) ? dRR.teams : null);
      setStRanksRight(Array.isArray(sRR?.teams) ? sRR.teams : null);

      // Compute W-L with filters using schedule (con respaldo en cache si falla)
      const newGames = Array.isArray(sched?.games) ? sched.games : null;
      const games = (Array.isArray(newGames) && newGames.length)
        ? newGames
        : (Array.isArray(schedCacheRef.current) ? schedCacheRef.current : []);
      if (Array.isArray(newGames) && newGames.length) schedCacheRef.current = newGames;
      const toDate = (g) => parseEtToLocalDate(g.kickoff || g.game_date);
      const finished = (g) => g.home_score != null && g.away_score != null;
      const computeWL = (teamAbbr, filters) => {
        const T = String(teamAbbr || '').toUpperCase();
        let list = games.filter((g) => g.home_team === T || g.away_team === T);
        if (filters.venue === 'home') list = list.filter((g) => g.home_team === T);
        if (filters.venue === 'away') list = list.filter((g) => g.away_team === T);
        // Opponent filters
        if (filters.opponent_div && filters.opponent_div !== 'all') {
          list = list.filter((g) => {
            const opp = g.home_team === T ? g.away_team : g.home_team;
            return TEAM_TO_DIV[opp] === filters.opponent_div;
          });
        } else if (filters.opponent_conf && (filters.opponent_conf === 'AFC' || filters.opponent_conf === 'NFC')) {
          list = list.filter((g) => {
            const opp = g.home_team === T ? g.away_team : g.home_team;
            return TEAM_TO_CONF[opp] === filters.opponent_conf;
          });
        }
        list = list.filter(finished).map((g) => ({ ...g, _d: toDate(g) })).sort((a, b) => (b._d?.getTime() || 0) - (a._d?.getTime() || 0));
        const want = filters.last_n;
        const used = want ? list.slice(0, want) : list;
        const w = used.reduce((acc, g) => acc + ((g.home_team === T ? g.home_score > g.away_score : g.away_score > g.home_score) ? 1 : 0), 0);
        const l = used.reduce((acc, g) => acc + ((g.home_team === T ? g.home_score < g.away_score : g.away_score < g.home_score) ? 1 : 0), 0);
        return { w, l, games: used.length };
      };

      const wlLeftFilters = {
        last_n: leftExtra.last_n,
        venue: leftExtra.venue,
        opponent_conf: leftExtra.opponent_conf,
        opponent_div: leftExtra.opponent_div,
      };
      const wlRightFilters = {
        last_n: rightExtra.last_n,
        venue: rightExtra.venue,
        opponent_conf: rightExtra.opponent_conf,
        opponent_div: rightExtra.opponent_div,
      };
      const leftTeams = TEAMS.map((t) => ({ team: t, ...computeWL(t, wlLeftFilters) }));
      const rightTeams = TEAMS.map((t) => ({ team: t, ...computeWL(t, wlRightFilters) }));
      setWlRanksLeft(leftTeams.map((r) => ({ team: r.team, wins: r.w, losses: r.l })));
      setWlRanksRight(rightTeams.map((r) => ({ team: r.team, wins: r.w, losses: r.l })));
      setWlL(computeWL(String(away || '').toUpperCase(), wlLeftFilters));
      setWlR(computeWL(String(home || '').toUpperCase(), wlRightFilters));
    }).catch(() => {});
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, spanL, venueL, spanR, venueR, oppConfL, oppConfR, oppDivL, oppDivR]);

  // Carga de calendario histórico para Tendencias (todas las temporadas)
  useEffect(() => {
    if (tab !== 'trends') return;
    if (!(home && away)) return;
    setTrendsLoading(true);
    (async () => {
      // Cache por par de equipos
      const key = `${String(home).toUpperCase()}-${String(away).toUpperCase()}`;
      const cached = trendsCacheRef.current.get(key);
      if (cached && Array.isArray(cached.games)) {
        setSchedAll(cached);
        // además cargar conteos por mitad para cada equipo
        try {
          const leftExtra = {};
          if (spanL === 'last3') leftExtra.last_n = 3; if (spanL === 'last5') leftExtra.last_n = 5;
          if (venueL === 'home') leftExtra.venue = 'home'; if (venueL === 'away') leftExtra.venue = 'away';
          if (oppDivL !== 'all') leftExtra.opponent_div = oppDivL; else if (oppConfL === 'AFC' || oppConfL === 'NFC') leftExtra.opponent_conf = oppConfL;
          const rightExtra = {};
          if (spanR === 'last3') rightExtra.last_n = 3; if (spanR === 'last5') rightExtra.last_n = 5;
          if (venueR === 'home') rightExtra.venue = 'home'; if (venueR === 'away') rightExtra.venue = 'away';
          if (oppDivR !== 'all') rightExtra.opponent_div = oppDivR; else if (oppConfR === 'AFC' || oppConfR === 'NFC') rightExtra.opponent_conf = oppConfR;
          const [lt, rt] = await Promise.allSettled([
            getTeamTrends(String(away).toUpperCase(), season, gameTypes, leftExtra),
            getTeamTrends(String(home).toUpperCase(), season, gameTypes, rightExtra),
          ]);
          setTeamTrendsLeft(lt.status==='fulfilled'?lt.value:null);
          setTeamTrendsRight(rt.status==='fulfilled'?rt.value:null);
        } catch (_) {
          setTeamTrendsLeft(null); setTeamTrendsRight(null);
        } finally {
          setTrendsLoading(false);
        }
        return;
      }
      try {
        // Cargar por temporadas para cubrir años históricos (evitar que el backend devuelva solo 2025)
        const startYear = 2000;
        const endYear = season; // hasta la temporada actual configurada
        const seasons = Array.from({ length: (endYear - startYear + 1) }, (_, i) => startYear + i);
        const reqs = seasons.map((y) => getSchedule(null, null, y));
        const res = await Promise.allSettled(reqs);
        const gamesRaw = res.flatMap((r) => (r.status === 'fulfilled' && Array.isArray(r.value?.games)) ? r.value.games : []);
        // De-dup por game_id (o por fecha+equipos si no viene id)
        const seen = new Set();
        const games = [];
        for (const g of gamesRaw) {
          const gid = g.game_id || `${g.game_date || g.kickoff}-${g.home_team}-${g.away_team}`;
          if (seen.has(gid)) continue;
          seen.add(gid);
          games.push(g);
        }
        const mergedAll = { games };
        setSchedAll(mergedAll);
        trendsCacheRef.current.set(key, mergedAll);
        // Fetch team trends
        const leftExtra = {};
        if (spanL === 'last3') leftExtra.last_n = 3; if (spanL === 'last5') leftExtra.last_n = 5;
        if (venueL === 'home') leftExtra.venue = 'home'; if (venueL === 'away') leftExtra.venue = 'away';
        if (oppDivL !== 'all') leftExtra.opponent_div = oppDivL; else if (oppConfL === 'AFC' || oppConfL === 'NFC') leftExtra.opponent_conf = oppConfL;
        const rightExtra = {};
        if (spanR === 'last3') rightExtra.last_n = 3; if (spanR === 'last5') rightExtra.last_n = 5;
        if (venueR === 'home') rightExtra.venue = 'home'; if (venueR === 'away') rightExtra.venue = 'away';
        if (oppDivR !== 'all') rightExtra.opponent_div = oppDivR; else if (oppConfR === 'AFC' || oppConfR === 'NFC') rightExtra.opponent_conf = oppConfR;
        const [lt, rt] = await Promise.allSettled([
          getTeamTrends(String(away).toUpperCase(), season, gameTypes, leftExtra),
          getTeamTrends(String(home).toUpperCase(), season, gameTypes, rightExtra),
        ]);
        setTeamTrendsLeft(lt.status==='fulfilled'?lt.value:null);
        setTeamTrendsRight(rt.status==='fulfilled'?rt.value:null);
      } catch (_) {
        // noop
      } finally {
        setTrendsLoading(false);
      }
    })();
  }, [tab, home, away, season, spanL, spanR, venueL, venueR, oppConfL, oppConfR, oppDivL, oppDivR]);

  // No query param persistence for filters (requested)

  const ord = (n) => `${n}.º`;
  const rankFrom = (list, team, key, smallerIsBetter = false) => {
    if (!list) return '—';
    const norm = (v) => (v == null ? (smallerIsBetter ? Infinity : -Infinity) : Number(v));
    const targetTeam = String(team || '').toUpperCase();
    const teamRow = (list || []).find((r) => r.team === targetTeam);
    if (!teamRow) return '—';
    const teamVal = norm(teamRow[key]);
    const sorted = [...list].sort((a, b) => {
      const va = norm(a[key]);
      const vb = norm(b[key]);
      return smallerIsBetter ? va - vb : vb - va;
    });
    const idx = sorted.findIndex((r) => Math.abs(norm(r[key]) - teamVal) <= 1e-9);
    return idx >= 0 ? ord(idx + 1) : '—';
  };

  const buildRow = (label, key, listPair, opts = {}) => {
    const { fmt = (v) => (v == null ? '—' : (v?.toFixed ? v.toFixed(1) : v)), smallerIsBetter = false, overrideValues, overrideRanks } = opts;
    const aValRaw = overrideValues ? overrideValues.a : (offA?.[key] ?? defA?.[key] ?? stA?.[key]);
    const bValRaw = overrideValues ? overrideValues.b : (offB?.[key] ?? defB?.[key] ?? stB?.[key]);
    const aVal = aValRaw; const bVal = bValRaw;
    const rankKey = key;
    const [listLeft, listRight] = Array.isArray(listPair) ? listPair : [listPair, listPair];
    const ar = overrideRanks?.ar ?? rankFrom(listLeft, away, rankKey, smallerIsBetter);
    const br = overrideRanks?.br ?? rankFrom(listRight, home, rankKey, smallerIsBetter);
    return { label, a: fmt(aVal), b: fmt(bVal), ar, br, aRaw: aVal, bRaw: bVal, smallerIsBetter };
  };

  // no standings-based ppg; use pf_pg from API and ranks

  // Performance (W-L) rows
  const wlRows = (() => {
    const fmt = (x) => (x == null ? '—' : String(x));
    const a = wlL; const b = wlR;
    // Build ranks: sort by more wins (desc), then fewer losses (asc)
    const rankWL = (arr, team) => {
      if (!Array.isArray(arr)) return '—';
      const sorted = [...arr].sort((x, y) => {
        if (x.wins !== y.wins) return y.wins - x.wins;
        return x.losses - y.losses;
      });
      const idx = sorted.findIndex((r) => r.team === String(team || '').toUpperCase());
      return idx >= 0 ? `${idx + 1}.º` : '—';
    };
    const ar = rankWL(wlRanksLeft, away);
    const br = rankWL(wlRanksRight, home);
    return [
      { label: 'Ganados', a: fmt(a?.w), b: fmt(b?.w), ar, br, aRaw: a?.w, bRaw: b?.w, smallerIsBetter: false },
      { label: 'Perdidos', a: fmt(a?.l), b: fmt(b?.l), ar, br, aRaw: a?.l, bRaw: b?.l, smallerIsBetter: true },
    ];
  })();

  const offenseRows = [
    buildRow('PTS/P', 'pf_pg', [offRanksLeft, offRanksRight]),
    buildRow('YDSP/P', 'pyds_pg', [offRanksLeft, offRanksRight]),
    buildRow('YDSC/P', 'ruyds_pg', [offRanksLeft, offRanksRight]),
    buildRow('TD TOT', 'td_total', [offRanksLeft, offRanksRight]),
    buildRow('TDP/P', 'pass_td_pg', [offRanksLeft, offRanksRight]),
    buildRow('TDC/P', 'rush_td_pg', [offRanksLeft, offRanksRight]),
    buildRow('YDS/JUG', 'ypp', [offRanksLeft, offRanksRight]),
    buildRow('3RA %', 'third_pct', [offRanksLeft, offRanksRight]),
    buildRow('4TA %', 'fourth_pct', [offRanksLeft, offRanksRight]),
    buildRow('TD ZR %', 'rz_td_pct', [offRanksLeft, offRanksRight]),
    buildRow('EXPL/P', 'explosive_pg', [offRanksLeft, offRanksRight]),
    buildRow('PERD/P', 'to_pg', [offRanksLeft, offRanksRight], { smallerIsBetter: true }),
  ];
  const defenseRows = [
    buildRow('PTS CONC/P', 'pa_pg', [defRanksLeft, defRanksRight], { smallerIsBetter: true }),
    buildRow('YDSP CONC/P', 'pyds_allowed_pg', [defRanksLeft, defRanksRight], { smallerIsBetter: true }),
    buildRow('YDSC CONC/P', 'ruyds_allowed_pg', [defRanksLeft, defRanksRight], { smallerIsBetter: true }),
    buildRow('TD CONC', 'td_allowed_total', [defRanksLeft, defRanksRight], {
      smallerIsBetter: true,
      overrideRanks: {
        ar: rankFrom(defRanksLeft, away, 'td_allowed', true),
        br: rankFrom(defRanksRight, home, 'td_allowed', true),
      },
    }),
    buildRow('TDP CONC/P', 'pass_td_allowed_pg', [defRanksLeft, defRanksRight], { smallerIsBetter: true }),
    buildRow('TDC CONC/P', 'rush_td_allowed_pg', [defRanksLeft, defRanksRight], { smallerIsBetter: true }),
    buildRow('YDS/JUG CONC', 'yppa', [defRanksLeft, defRanksRight], { smallerIsBetter: true }),
    buildRow('SACKS/P', 'sacks_pg', [defRanksLeft, defRanksRight]),
    buildRow('RECUP/P', 'takeaways_pg', [defRanksLeft, defRanksRight]),
  ];
  const stRows = [
    buildRow('% GC', 'fg_pct', [stRanksLeft, stRanksRight]),
    buildRow('GC/P', 'fg_made_pg', [stRanksLeft, stRanksRight]),
    buildRow('INT GC/P', 'fg_att_pg', [stRanksLeft, stRanksRight]),
    buildRow('% PTO EX', 'xp_pct', [stRanksLeft, stRanksRight]),
    buildRow('INT PTO EX/P', 'xp_att_pg', [stRanksLeft, stRanksRight]),
    buildRow('DESPEJ/P', 'punts_pg', [stRanksLeft, stRanksRight], { smallerIsBetter: true }),
  ];

  const Section = ({ title, rows, noArrows = false, showRanks = true, centerHighlight = false, numbersMono = false, headerLeft, headerRight }) => (
    <>
      {title ? (<div className="text-center text-sm md:text-base font-extrabold text-zinc-900 mb-2 mt-1">{title}</div>) : null}
      {(headerLeft || headerRight) ? (
        <div className="grid grid-cols-3 items-center pb-1">
          <div className="px-2 text-center text-[10px] md:text-xs font-semibold text-zinc-500">{headerLeft || ''}</div>
          <div />
          <div className="px-2 text-center text-[10px] md:text-xs font-semibold text-zinc-500">{headerRight || ''}</div>
        </div>
      ) : null}
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-3 items-center py-1">
            <div className="px-2 flex flex-col items-center justify-center">
              <div className={`text-base md:text-lg leading-none font-extrabold ${r.aHL ? 'bg-sky-600 text-white rounded px-1.5 ring-1 ring-sky-600' : 'text-zinc-900'}`}>{r.a ?? '—'}</div>
              {showRanks ? (<div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{r.ar}</div>) : null}
            </div>
            <div className="relative flex items-center justify-center text-center">
              {noArrows ? null : (() => {
                const a = Number(r.aRaw); const b = Number(r.bRaw);
                if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
                if (!(hasLeft && hasRight)) return null;
                const leftWins = r.smallerIsBetter ? a < b : a > b;
                return leftWins ? (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-t-transparent border-r-[10px] border-r-sky-600 border-b-[7px] border-b-transparent pointer-events-none" />
                ) : null;
              })()}
              {(() => {
                const full = (() => {
                  const map = {
                    'Ganados': 'Partidos ganados',
                    'Perdidos': 'Partidos perdidos',
                    'PTS/P': 'Puntos por partido',
                    'YDSP/P': 'Yardas por pase por partido',
                    'YDSC/P': 'Yardas por carrera por partido',
                    'TD TOT': 'Touchdowns totales',
                    'TDP/P': 'Touchdowns de pase por partido',
                    'TDC/P': 'Touchdowns de carrera por partido',
                    'YDS/JUG': 'Yardas por jugada',
                    '3RA %': 'Porcentaje de conversión en 3ª oportunidad',
                    '4TA %': 'Porcentaje de conversión en 4ª oportunidad',
                    'TD ZR %': 'Porcentaje de touchdown en zona roja',
                    'EXPL/P': 'Jugadas explosivas por partido',
                    'PERD/P': 'Pérdidas por partido',
                    'PTS CONC/P': 'Puntos concedidos por partido',
                    'YDSP CONC/P': 'Yardas de pase concedidas por partido',
                    'YDSC CONC/P': 'Yardas de carrera concedidas por partido',
                    'TD CONC': 'Touchdowns concedidos',
                    'TDP CONC/P': 'Touchdowns de pase concedidos por partido',
                    'TDC CONC/P': 'Touchdowns de carrera concedidos por partido',
                    'YDS/JUG CONC': 'Yardas por jugada concedidas',
                    'SACKS/P': 'Capturas por partido',
                    'RECUP/P': 'Recuperaciones por partido',
                    '% GC': 'Porcentaje de goles de campo convertidos',
                    'GC/P': 'Goles de campo anotados por partido',
                    'INT GC/P': 'Intentos de gol de campo por partido',
                    '% PTO EX': 'Porcentaje de puntos extra convertidos',
                    'INT PTO EX/P': 'Intentos de puntos extra por partido',
                    'DESPEJ/P': 'Despejes por partido',
                  };
                  return map[r.label] || r.label;
                })();
                return (
                  <span className="relative block text-center text-[11px] md:text-xs text-zinc-500 font-semibold tracking-wide w-full" title={full} aria-label={full}>
                    <span className={`${centerHighlight ? `flex items-center justify-center rounded-full bg-zinc-50 px-2 py-0.5 w-full text-zinc-700 ${/(Ganan|Pierden)/.test(String(r.label)) ? 'text-[8.5px] md:text-[11px]' : ''}` : ''}`}>{r.label}</span>
                  </span>
                );
              })()}
              {noArrows ? null : (() => {
                const a = Number(r.aRaw); const b = Number(r.bRaw);
                if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
                if (!(hasLeft && hasRight)) return null;
                const rightWins = r.smallerIsBetter ? b < a : b > a;
                return rightWins ? (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-t-transparent border-l-[10px] border-l-sky-600 border-b-[7px] border-b-transparent pointer-events-none" />
                ) : null;
              })()}
            </div>
            <div className="px-2 flex flex-col items-center justify-center">
              <div className={`text-base md:text-lg leading-none font-extrabold ${r.bHL ? 'bg-sky-600 text-white rounded px-1.5 ring-1 ring-sky-600' : 'text-zinc-900'}`}>{r.b ?? '—'}</div>
              {showRanks ? (<div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{r.br}</div>) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="" style={{ backgroundColor: '#FAFAFA', minHeight: 'var(--minvh)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <div className="max-w-screen-xl mx-auto px-2 md:px-4 lg:px-6 py-4">
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-zinc-200 mb-2">
          <div className="grid grid-cols-3 items-center h-10">
            <div className="justify-self-start">
              <Link to="/app" className="text-sm text-zinc-600 hover:underline">← Volver</Link>
            </div>
            <div className="justify-self-center text-sm md:text-base font-extrabold text-zinc-800">SportsLab</div>
            <div className="justify-self-end" />
          </div>
        </div>
        <div className="sticky top-10 z-30 bg-white/95 backdrop-blur rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4 mb-3">
          <div className="grid grid-cols-3 items-center">
            <div className="flex items-center gap-2 justify-start">
              <details className="relative">
                <summary className="list-none inline-flex items-center gap-1.5 cursor-pointer select-none h-8">
                  {selAway ? (
                    <img src={getTeamLogo('nfl', selAway)} alt={selAway} className="w-7 h-7 shrink-0" />
                  ) : (
                    <img src="/icons/mas.svg" alt="Agregar" className="w-5 h-5 shrink-0 opacity-70" />
                  )}
                  <span className={`${nameSize(displayAway || 'Selecciona')} font-semibold text-zinc-900 leading-none`}>{displayAway || 'Selecciona'}</span>
                  <img src="/icons/angle-down.svg" alt="abrir" className="w-3 h-3 shrink-0" />
                </summary>
                <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                <div className="absolute left-0 mt-1 w-60 max-h-80 overflow-auto bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                  {TEAMS.map((t) => (
                    <button key={t} type="button" onClick={(e) => {
                      const d = e.currentTarget.closest('details'); if (d) d.open = false;
                      const newAway = String(t).toUpperCase();
                      if (selHome) {
                        navigate(`/versus/${encodeURIComponent(selHome)}/vs/${encodeURIComponent(newAway)}`);
                      } else {
                        navigate(`/versus/vs/${encodeURIComponent(newAway)}`);
                      }
                    }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left ${(selAway||'').toUpperCase()===t?'bg-zinc-100 font-semibold text-zinc-900':'hover:bg-zinc-50 text-zinc-800'}`}>
                      <img src={getTeamLogo('nfl', t)} alt={t} className="w-5 h-5" />
                      <span className="text-sm">{getTeamNickname(t) || getTeamFullName(t) || t}</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>
            <div className="text-center">
              <div className="text-sm md:text-base font-extrabold text-zinc-700">VS</div>
              <div className="text-[10px] md:text-xs text-zinc-500 mt-0.5">Temporada 25/26</div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <details className="relative">
                <summary className="list-none inline-flex items-center gap-1.5 cursor-pointer select-none h-8" aria-label="Cambiar equipo derecho">
                  <img src="/icons/angle-down.svg" alt="abrir" className="w-3 h-3 shrink-0" />
                  <span className={`${nameSize(displayHome || 'Selecciona')} font-semibold text-zinc-900 leading-none`}>{displayHome || 'Selecciona'}</span>
                  {selHome ? (
                    <img src={getTeamLogo('nfl', selHome)} alt={selHome} className="w-7 h-7 shrink-0" />
                  ) : (
                    <img src="/icons/mas.svg" alt="Agregar" className="w-5 h-5 shrink-0 opacity-70" />
                  )}
                </summary>
                <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                <div className="absolute right-0 mt-1 w-60 max-h-80 overflow-auto bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                  {TEAMS.map((t) => (
                    <button key={t} type="button" onClick={(e) => {
                      const d = e.currentTarget.closest('details'); if (d) d.open = false;
                      const newHome = String(t).toUpperCase();
                      if (selAway) {
                        navigate(`/versus/${encodeURIComponent(newHome)}/vs/${encodeURIComponent(selAway)}`);
                      } else {
                        navigate(`/versus/${encodeURIComponent(newHome)}`);
                      }
                    }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left ${(selHome||'').toUpperCase()===t?'bg-zinc-100 font-semibold text-zinc-900':'hover:bg-zinc-50 text-zinc-800'}`}>
                      <img src={getTeamLogo('nfl', t)} alt={t} className="w-5 h-5" />
                      <span className="text-sm">{getTeamNickname(t) || getTeamFullName(t) || t}</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </div>
          {(!hasLeft || !hasRight) && (
            <div className="mt-2 text-center text-[12px] md:text-sm text-zinc-600 font-bold">Elige dos equipos para comparar sus estadísticas.</div>
          )}
        </div>

        {/* sin barra global de filtros */}

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4 mt-3">
          {/* Tabs compactos: Estadísticas / Tendencias */}
          <div className="mb-1 flex items-center justify-center">
            <div className="inline-flex rounded-full bg-zinc-100 border border-zinc-200 p-0.5">
              <button type="button" onClick={() => setTab('stats')} className={`px-2.5 h-6 rounded-full text-[10px] md:text-[11px] ${tab==='stats'?'bg-white text-zinc-900 font-bold shadow-sm':'text-zinc-600'}`}>Estadísticas</button>
              <button type="button" onClick={() => setTab('trends')} className={`px-2.5 h-6 rounded-full text-[10px] md:text-[11px] ${tab==='trends'?'bg-white text-zinc-900 font-bold shadow-sm':'text-zinc-600'}`}>Tendencias</button>
            </div>
          </div>
          {tab === 'stats' ? (() => {
            const spanText = (v) => (v === 'last3' ? 'Últ. 3' : (v === 'last5' ? 'Últ. 5' : 'Todos'));
            const venueText = (v) => (v === 'home' ? 'Casa' : (v === 'away' ? 'Visita' : 'Todas'));
            const noResultsLeft = (typeof gamesL === 'number' && gamesL === 0);
            const noResultsRight = (typeof gamesR === 'number' && gamesR === 0);
            return (
              <div className="grid grid-cols-3 items-start mb-2 gap-x-1">
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{spanL !== 'all' ? spanText(spanL) : 'Split'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute left-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        <button type="button" onClick={(e) => { setSpanL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanL==='all'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todo</button>
                        <button type="button" onClick={(e) => { setSpanL('last3'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanL==='last3'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Últimos 3</button>
                        <button type="button" onClick={(e) => { setSpanL('last5'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanL==='last5'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Últimos 5</button>
                      </div>
                    </details>
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{venueL !== 'all' ? venueText(venueL) : 'Sede'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute left-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        <button type="button" onClick={(e) => { setVenueL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueL==='all'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todas</button>
                        <button type="button" onClick={(e) => { setVenueL('home'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueL==='home'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Casa</button>
                        <button type="button" onClick={(e) => { setVenueL('away'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueL==='away'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Visita</button>
                      </div>
                    </details>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{oppConfL !== 'all' ? oppConfL : 'Conf.'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute left-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        <button type="button" onClick={(e) => { setOppConfL('all'); setOppDivL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfL==='all'&&oppDivL==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todas</button>
                        <button type="button" onClick={(e) => { setOppConfL('AFC'); setOppDivL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfL==='AFC'&&oppDivL==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Americana</button>
                        <button type="button" onClick={(e) => { setOppConfL('NFC'); setOppDivL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfL==='NFC'&&oppDivL==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Nacional</button>
                      </div>
                    </details>
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{oppDivL !== 'all' ? divToEs(oppDivL) : 'Div.'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute left-0 mt-1 w-48 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        {[
                          {val:'AFC East',label:'Americana Este'},
                          {val:'AFC North',label:'Americana Norte'},
                          {val:'AFC South',label:'Americana Sur'},
                          {val:'AFC West',label:'Americana Oeste'},
                          {val:'NFC East',label:'Nacional Este'},
                          {val:'NFC North',label:'Nacional Norte'},
                          {val:'NFC South',label:'Nacional Sur'},
                          {val:'NFC West',label:'Nacional Oeste'}
                        ].map((dv) => (
                          <button key={dv.val} type="button" onClick={(e) => { setOppDivL(dv.val); setOppConfL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${oppDivL===dv.val?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>{dv.label}</button>
                        ))}
                      </div>
                    </details>
                  </div>
                  {(() => {
                    const want = spanL === 'last3' ? 3 : (spanL === 'last5' ? 5 : null);
                    if (noResultsLeft) return <div className="text-[10px] text-amber-600">Sin resultados con esta combinación de filtros</div>;
                    return (want && typeof gamesL === 'number' && gamesL < want)
                      ? <div className="text-[10px] text-amber-600">Insuficientes juegos ({gamesL} de {want})</div>
                      : null;
                  })()}
                </div>
                <div />
                <div className="flex flex-col gap-2 w-full ml-auto justify-self-end">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{spanR !== 'all' ? spanText(spanR) : 'Split'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute right-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        <button type="button" onClick={(e) => { setSpanR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanR==='all'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todo</button>
                        <button type="button" onClick={(e) => { setSpanR('last3'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanR==='last3'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Últimos 3</button>
                        <button type="button" onClick={(e) => { setSpanR('last5'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanR==='last5'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Últimos 5</button>
                      </div>
                    </details>
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{venueR !== 'all' ? venueText(venueR) : 'Sede'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute right-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        <button type="button" onClick={(e) => { setVenueR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueR==='all'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todas</button>
                        <button type="button" onClick={(e) => { setVenueR('home'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueR==='home'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Casa</button>
                        <button type="button" onClick={(e) => { setVenueR('away'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueR==='away'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Visita</button>
                      </div>
                    </details>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{oppConfR !== 'all' ? oppConfR : 'Conf.'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute right-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        <button type="button" onClick={(e) => { setOppConfR('all'); setOppDivR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfR==='all'&&oppDivR==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todas</button>
                        <button type="button" onClick={(e) => { setOppConfR('AFC'); setOppDivR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfR==='AFC'&&oppDivR==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Americana</button>
                        <button type="button" onClick={(e) => { setOppConfR('NFC'); setOppDivR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfR==='NFC'&&oppDivR==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Nacional</button>
                      </div>
                    </details>
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{oppDivR !== 'all' ? divToEs(oppDivR) : 'Div.'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        {[
                          {val:'AFC East',label:'Americana Este'},
                          {val:'AFC North',label:'Americana Norte'},
                          {val:'AFC South',label:'Americana Sur'},
                          {val:'AFC West',label:'Americana Oeste'},
                          {val:'NFC East',label:'Nacional Este'},
                          {val:'NFC North',label:'Nacional Norte'},
                          {val:'NFC South',label:'Nacional Sur'},
                          {val:'NFC West',label:'Nacional Oeste'}
                        ].map((dv) => (
                          <button key={dv.val} type="button" onClick={(e) => { setOppDivR(dv.val); setOppConfR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${oppDivR===dv.val?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>{dv.label}</button>
                        ))}
                      </div>
                    </details>
                  </div>
                  {(() => {
                    const want = spanR === 'last3' ? 3 : (spanR === 'last5' ? 5 : null);
                    if (noResultsRight) return <div className="text-[10px] text-amber-600 text-right">Sin resultados con esta combinación de filtros</div>;
                    return (want && typeof gamesR === 'number' && gamesR < want)
                      ? <div className="text-[10px] text-amber-600 text-right">Insuficientes juegos ({gamesR} de {want})</div>
                      : null;
                  })()}
                </div>
              </div>
            );
          })() : null}
          {tab === 'stats' ? (
            (hasLeft || hasRight ? (
              <>
                <Section title="Rendimiento" rows={wlRows} />
                <div className="my-2 h-px bg-zinc-200" />
                <Section title="Ofensiva" rows={offenseRows} />
                <div className="my-2 h-px bg-zinc-200" />
                <Section title="Defensiva" rows={defenseRows} />
                <div className="my-2 h-px bg-zinc-200" />
                <Section title="Pateadores" rows={stRows} />
              </>
            ) : (
              <>
                <Section title="Rendimiento" rows={[{label:'Ganados',a:'—',b:'—'},{label:'Perdidos',a:'—',b:'—'}]} />
                <div className="my-2 h-px bg-zinc-200" />
                <Section title="Ofensiva" rows={[
                  {label:'PTS/P',a:'—',b:'—'}, {label:'YDSP/P',a:'—',b:'—'}, {label:'YDSC/P',a:'—',b:'—'}, {label:'TD TOT',a:'—',b:'—'}, {label:'YDS/JUG',a:'—',b:'—'},
                  {label:'3RA %',a:'—',b:'—'}, {label:'4TA %',a:'—',b:'—'}, {label:'TD ZR %',a:'—',b:'—'}, {label:'EXPL/P',a:'—',b:'—'}, {label:'PERD/P',a:'—',b:'—'}
                ]} />
                <div className="my-2 h-px bg-zinc-200" />
                <Section title="Defensiva" rows={[
                  {label:'PTS CONC/P',a:'—',b:'—'}, {label:'YDSP CONC/P',a:'—',b:'—'}, {label:'YDSC CONC/P',a:'—',b:'—'}, {label:'TD CONC',a:'—',b:'—'}, {label:'YDS/JUG CONC',a:'—',b:'—'},
                  {label:'SACKS/P',a:'—',b:'—'}, {label:'RECUP/P',a:'—',b:'—'}
                ]} />
                <div className="my-2 h-px bg-zinc-200" />
                <Section title="Pateadores" rows={[
                  {label:'% GC',a:'—',b:'—'}, {label:'GC/P',a:'—',b:'—'}, {label:'INT GC/P',a:'—',b:'—'}, {label:'% PTO EX',a:'—',b:'—'}, {label:'INT PTO EX/P',a:'—',b:'—'}, {label:'DESPEJ/P',a:'—',b:'—'}
                ]} />
              </>
            ))
          ) : (
            (() => {
              if (!(hasLeft && hasRight)) {
                return <div className="py-2 text-center text-[12px] md:text-sm text-zinc-600">Selecciona dos equipos para ver tendencias</div>;
              }
              // Reusar filtros (lado izquierdo aplica a away, lado derecho a home) también en Tendencias
              const spanText = (v) => (v === 'last3' ? 'Últ. 3' : (v === 'last5' ? 'Últ. 5' : 'Todos'));
              const venueText = (v) => (v === 'home' ? 'Casa' : (v === 'away' ? 'Visita' : 'Todas'));
              const T1 = String(home || '').toUpperCase();
              const T2 = String(away || '').toUpperCase();
              const all = Array.isArray(schedAll?.games) ? schedAll.games : (Array.isArray(schedCacheRef.current) ? schedCacheRef.current : []);
              if (trendsLoading) {
                return <div className="py-2 text-center text-[12px] md:text-sm text-zinc-600">Cargando tendencias…</div>;
              }
              const toD = (g) => parseEtToLocalDate(g.kickoff || g.game_date);
              const finished = (g) => g.home_score != null && g.away_score != null;
              // Mezclar también resultados del caché de temporada actual por si aún no se incluyeron
              const merged = Array.isArray(schedCacheRef.current) ? [...all, ...schedCacheRef.current] : all;
              // De-dup final por game_id/fecha+equipos para evitar duplicar el último juego
              const base = (() => {
                const seen = new Set();
                const out = [];
                for (const g of merged) {
                  const gid = g.game_id || `${g.game_date || g.kickoff}-${g.home_team}-${g.away_team}`;
                  if (seen.has(gid)) continue;
                  seen.add(gid);
                  out.push(g);
                }
                return out;
              })();
              // Helpers para aplicar filtros por lado (solo temporada actual) y contar líneas
              const seasonStartDate = new Date(`${season}-08-01T00:00:00Z`);
              const seasonEndDate = new Date(`${season + 1}-02-15T23:59:59Z`);
              const seasonGames = base.filter((g) => {
                const d = toD(g);
                return !!d && d.getTime() >= seasonStartDate.getTime() && d.getTime() <= seasonEndDate.getTime();
              });
              const applyFilters = (team, filters) => {
                const T = String(team).toUpperCase();
                let list = seasonGames.filter((g) => g.home_team === T || g.away_team === T);
                if (filters.venue === 'home') list = list.filter((g) => g.home_team === T);
                if (filters.venue === 'away') list = list.filter((g) => g.away_team === T);
                if (filters.opponent_div && filters.opponent_div !== 'all') {
                  list = list.filter((g) => {
                    const opp = g.home_team === T ? g.away_team : g.home_team;
                    return TEAM_TO_DIV[opp] === filters.opponent_div;
                  });
                } else if (filters.opponent_conf && (filters.opponent_conf === 'AFC' || filters.opponent_conf === 'NFC')) {
                  list = list.filter((g) => {
                    const opp = g.home_team === T ? g.away_team : g.home_team;
                    return TEAM_TO_CONF[opp] === filters.opponent_conf;
                  });
                }
                list = list.filter(finished).map((g) => ({ ...g, _d: toD(g) })).sort((a, b) => (b._d?.getTime() || 0) - (a._d?.getTime() || 0));
                const want = (team === T2 ? (spanL === 'last3' ? 3 : (spanL === 'last5' ? 5 : null)) : (spanR === 'last3' ? 3 : (spanR === 'last5' ? 5 : null)));
                const used = want ? list.slice(0, want) : list;
                return used;
              };
              const leftFilters = { last_n: (spanL==='last3'?3:(spanL==='last5'?5:null)), venue: venueL, opponent_conf: oppConfL, opponent_div: oppDivL };
              const rightFilters = { last_n: (spanR==='last3'?3:(spanR==='last5'?5:null)), venue: venueR, opponent_conf: oppConfR, opponent_div: oppDivR };
              const leftList = applyFilters(T2, leftFilters);
              const rightList = applyFilters(T1, rightFilters);

              // const thresholds = [17,20,23,24,27,30]; // legado: cálculo de cliente (ya no usado)
              const h2h = base
                .filter((g) => (
                  (g.home_team === T1 && g.away_team === T2) || (g.home_team === T2 && g.away_team === T1)
                ))
                .filter(finished)
                .map((g) => ({ ...g, _d: toD(g) }))
                .sort((a, b) => (b._d?.getTime() || 0) - (a._d?.getTime() || 0))
                .slice(0, 5);
              // Render: filtros compactos (igual que en stats), luego tabla de tendencias, luego H2H (si hay)
              const Row = ({ g }) => {
                const homeAbbr = g.home_team; const awayAbbr = g.away_team;
                const hs = g.home_score; const as = g.away_score;
                const d = toD(g);
                let sNum = Number(g.season ?? g.season_year);
                if (!Number.isFinite(sNum)) {
                  if (d) {
                    const y = d.getFullYear();
                    const m = d.getMonth(); // 0-11, Aug=7
                    sNum = m >= 7 ? y : (y - 1);
                  } else {
                    sNum = null;
                  }
                }
                const sA = sNum != null ? String(sNum % 100).padStart(2, '0') : null;
                const sB = sNum != null ? String((sNum + 1) % 100).padStart(2, '0') : null;
                const seasonStr = sA && sB ? `Temporada ${sA}/${sB}` : 'Temporada';
                return (
                  <div className="rounded-xl border border-zinc-200 bg-white p-1.5 md:p-3">
                    <div className="text-[10px] md:text-xs font-semibold text-zinc-500 text-center">
                      {seasonStr}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-0.5 md:gap-2">
                      <img src={getTeamLogo('nfl', awayAbbr)} alt={awayAbbr} className="w-4 h-4 md:w-5 md:h-5" />
                      <div className="text-[12px] md:text-base font-extrabold text-zinc-900">{as ?? '—'}</div>
                      <div className="mx-0.5 text-zinc-400">—</div>
                      <div className="text-[12px] md:text-base font-extrabold text-zinc-900">{hs ?? '—'}</div>
                      <img src={getTeamLogo('nfl', homeAbbr)} alt={homeAbbr} className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                  </div>
                );
              };
              return (
                <div className="mt-1">
                  {/* Filtros (compactos) */}
                  <div className="grid grid-cols-3 items-start mb-2 gap-x-1">
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{spanL !== 'all' ? spanText(spanL) : 'Split'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute left-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        <button type="button" onClick={(e) => { setSpanL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanL==='all'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todo</button>
                        <button type="button" onClick={(e) => { setSpanL('last3'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanL==='last3'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Últimos 3</button>
                        <button type="button" onClick={(e) => { setSpanL('last5'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanL==='last5'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Últimos 5</button>
                      </div>
                    </details>
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{venueL !== 'all' ? venueText(venueL) : 'Sede'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute left-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        <button type="button" onClick={(e) => { setVenueL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueL==='all'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todas</button>
                        <button type="button" onClick={(e) => { setVenueL('home'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueL==='home'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Casa</button>
                        <button type="button" onClick={(e) => { setVenueL('away'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueL==='away'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Visita</button>
                      </div>
                    </details>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{oppConfL !== 'all' ? oppConfL : 'Conf.'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute left-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        <button type="button" onClick={(e) => { setOppConfL('all'); setOppDivL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfL==='all'&&oppDivL==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todas</button>
                        <button type="button" onClick={(e) => { setOppConfL('AFC'); setOppDivL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfL==='AFC'&&oppDivL==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Americana</button>
                        <button type="button" onClick={(e) => { setOppConfL('NFC'); setOppDivL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfL==='NFC'&&oppDivL==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Nacional</button>
                      </div>
                    </details>
                    <details className="relative flex-1">
                      <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{oppDivL !== 'all' ? divToEs(oppDivL) : 'Div.'}</span>
                        <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                      </summary>
                      <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                      <div className="absolute left-0 mt-1 w-48 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                        {[
                          {val:'AFC East',label:'Americana Este'},
                          {val:'AFC North',label:'Americana Norte'},
                          {val:'AFC South',label:'Americana Sur'},
                          {val:'AFC West',label:'Americana Oeste'},
                          {val:'NFC East',label:'Nacional Este'},
                          {val:'NFC North',label:'Nacional Norte'},
                          {val:'NFC South',label:'Nacional Sur'},
                          {val:'NFC West',label:'Nacional Oeste'}
                        ].map((dv) => (
                          <button key={dv.val} type="button" onClick={(e) => { setOppDivL(dv.val); setOppConfL('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${oppDivL===dv.val?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>{dv.label}</button>
                        ))}
                      </div>
                    </details>
                  </div>
                      {(() => {
                        const want = spanL === 'last3' ? 3 : (spanL === 'last5' ? 5 : null);
                        if (leftList.length === 0) return <div className="text-[10px] text-amber-600">Sin resultados con esta combinación de filtros</div>;
                        return (want && leftList.length < want)
                          ? <div className="text-[10px] text-amber-600">Insuficientes juegos ({leftList.length} de {want})</div>
                          : null;
                      })()}
                    </div>
                    <div />
                    <div className="flex flex-col gap-2 w-full ml-auto justify-self-end">
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <details className="relative flex-1">
                          <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                            <span className="whitespace-nowrap overflow-hidden text-ellipsis">{spanR !== 'all' ? spanText(spanR) : 'Split'}</span>
                            <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                          </summary>
                          <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                          <div className="absolute right-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                            <button type="button" onClick={(e) => { setSpanR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanR==='all'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todo</button>
                            <button type="button" onClick={(e) => { setSpanR('last3'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanR==='last3'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Últimos 3</button>
                            <button type="button" onClick={(e) => { setSpanR('last5'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${spanR==='last5'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Últimos 5</button>
                          </div>
                        </details>
                        <details className="relative flex-1">
                          <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                            <span className="whitespace-nowrap overflow-hidden text-ellipsis">{venueR !== 'all' ? venueText(venueR) : 'Sede'}</span>
                            <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                          </summary>
                          <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                          <div className="absolute right-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                            <button type="button" onClick={(e) => { setVenueR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueR==='all'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todas</button>
                            <button type="button" onClick={(e) => { setVenueR('home'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueR==='home'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Casa</button>
                            <button type="button" onClick={(e) => { setVenueR('away'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${venueR==='away'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Visita</button>
                          </div>
                        </details>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <details className="relative flex-1">
                          <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                            <span className="whitespace-nowrap overflow-hidden text-ellipsis">{oppConfR !== 'all' ? oppConfR : 'Conf.'}</span>
                            <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                          </summary>
                          <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                          <div className="absolute right-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                            <button type="button" onClick={(e) => { setOppConfR('all'); setOppDivR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfR==='all'&&oppDivR==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Todas</button>
                            <button type="button" onClick={(e) => { setOppConfR('AFC'); setOppDivR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfR==='AFC'&&oppDivR==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Americana</button>
                            <button type="button" onClick={(e) => { setOppConfR('NFC'); setOppDivR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${(oppConfR==='NFC'&&oppDivR==='all')?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>Nacional</button>
                          </div>
                        </details>
                        <details className="relative flex-1">
                          <summary className="list-none inline-flex w-full items-center justify-between gap-1 h-8 px-2 sm:px-2.5 rounded-full border bg-white text-zinc-800 border-zinc-200 text-[11px] sm:text-xs font-semibold cursor-pointer">
                            <span className="whitespace-nowrap overflow-hidden text-ellipsis">{oppDivR !== 'all' ? divToEs(oppDivR) : 'Div.'}</span>
                            <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                          </summary>
                          <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                            {[
                              {val:'AFC East',label:'Americana Este'},
                              {val:'AFC North',label:'Americana Norte'},
                              {val:'AFC South',label:'Americana Sur'},
                              {val:'AFC West',label:'Americana Oeste'},
                              {val:'NFC East',label:'Nacional Este'},
                              {val:'NFC North',label:'Nacional Norte'},
                              {val:'NFC South',label:'Nacional Sur'},
                              {val:'NFC West',label:'Nacional Oeste'}
                            ].map((dv) => (
                              <button key={dv.val} type="button" onClick={(e) => { setOppDivR(dv.val); setOppConfR('all'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }} className={`block w-full text-left text-sm px-3 py-2 rounded-md ${oppDivR===dv.val?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}>{dv.label}</button>
                            ))}
                          </div>
                        </details>
                      </div>
                      {(() => {
                        const want = spanR === 'last3' ? 3 : (spanR === 'last5' ? 5 : null);
                        if (rightList.length === 0) return <div className="text-[10px] text-amber-600 text-right">Sin resultados con esta combinación de filtros</div>;
                        return (want && rightList.length < want)
                          ? <div className="text-[10px] text-amber-600 text-right">Insuficientes juegos ({rightList.length} de {want})</div>
                          : null;
                      })()}
                    </div>
                  </div>

                  {/* Tabla de Tendencias: Juego completo / Mitades */}
                  {(() => {
                    const halfThresholds = [3,6,7,10,13,17];
                    // Build rows from backend counts
                    const countsL = teamTrendsLeft?.counts || null;
                    const countsR = teamTrendsRight?.counts || null;
                    const mkRowsFromCounts = (section) => {
                      const rows = [];
                      const L = Number(teamTrendsLeft?.games ?? 0);
                      const R = Number(teamTrendsRight?.games ?? 0);
                      if (section === 'game') {
                        rows.push({ label: 'Jugados', a: L, b: R, ar: '', br: '', aRaw: L, bRaw: R, smallerIsBetter: false });
                      }
                      if (section === 'game') {
                      for (const th of [17,20,23,24,27,30]) {
                        const aCnt = Number(countsL?.game?.[String(th)]?.over ?? 0);
                        const bCnt = Number(countsR?.game?.[String(th)]?.over ?? 0);
                        const aHL = L ? (aCnt / L) >= 0.75 : false;
                        const bHL = R ? (bCnt / R) >= 0.75 : false;
                        rows.push({ label: `TT Over ${th} pts`, a: aCnt, b: bCnt, ar: '', br: '', aRaw: aCnt, bRaw: bCnt, aHL, bHL, smallerIsBetter: false });
                      }
                      for (const th of [17,20,23,24,27,30]) {
                        const aCnt = Number(countsL?.game?.[String(th)]?.under ?? 0);
                        const bCnt = Number(countsR?.game?.[String(th)]?.under ?? 0);
                        const aHL = L ? (aCnt / L) >= 0.75 : false;
                        const bHL = R ? (bCnt / R) >= 0.75 : false;
                        rows.push({ label: `TT Under ${th} pts`, a: aCnt, b: bCnt, ar: '', br: '', aRaw: aCnt, bRaw: bCnt, aHL, bHL, smallerIsBetter: false });
                      }
                      } else if (section === 'h1' || section === 'h2') {
                        for (const th of halfThresholds) {
                          const aCnt = Number(countsL?.[section]?.[String(th)]?.over ?? 0);
                          const bCnt = Number(countsR?.[section]?.[String(th)]?.over ?? 0);
                          const aHL = L ? (aCnt / L) >= 0.75 : false;
                          const bHL = R ? (bCnt / R) >= 0.75 : false;
                          rows.push({ label: `TT Over ${th} pts`, a: aCnt, b: bCnt, ar: '', br: '', aRaw: aCnt, bRaw: bCnt, aHL, bHL, smallerIsBetter: false });
                        }
                        for (const th of halfThresholds) {
                          const aCnt = Number(countsL?.[section]?.[String(th)]?.under ?? 0);
                          const bCnt = Number(countsR?.[section]?.[String(th)]?.under ?? 0);
                          const aHL = L ? (aCnt / L) >= 0.75 : false;
                          const bHL = R ? (bCnt / R) >= 0.75 : false;
                          rows.push({ label: `TT Under ${th} pts`, a: aCnt, b: bCnt, ar: '', br: '', aRaw: aCnt, bRaw: bCnt, aHL, bHL, smallerIsBetter: false });
                        }
                      }
                      return rows;
                    };
                    const gameRows = (() => {
                      // Jugados + Ganados + Perdidos primero
                      const L = Number(teamTrendsLeft?.games ?? 0);
                      const R = Number(teamTrendsRight?.games ?? 0);
                      const gW = Number(teamTrendsLeft?.counts?.wl?.game?.w ?? 0);
                      const gL = Number(teamTrendsLeft?.counts?.wl?.game?.l ?? 0);
                      const gT = Number(teamTrendsLeft?.counts?.wl?.game?.t ?? 0);
                      const gWb = Number(teamTrendsRight?.counts?.wl?.game?.w ?? 0);
                      const gLb = Number(teamTrendsRight?.counts?.wl?.game?.l ?? 0);
                      const gTb = Number(teamTrendsRight?.counts?.wl?.game?.t ?? 0);
                      const rows = [
                        { label: 'Jugados', a: L, b: R, ar: '', br: '', aRaw: L, bRaw: R, smallerIsBetter: false },
                        { label: 'Ganados', a: gW, b: gWb, ar: '', br: '', aRaw: gW, bRaw: gWb, aHL: (L? gW/L>=0.75:false), bHL: (R? gWb/R>=0.75:false), smallerIsBetter: false },
                        { label: 'Perdidos', a: gL, b: gLb, ar: '', br: '', aRaw: gL, bRaw: gLb, aHL: (L? gL/L>=0.75:false), bHL: (R? gLb/R>=0.75:false), smallerIsBetter: true },
                        { label: 'Empatados', a: gT, b: gTb, ar: '', br: '', aRaw: gT, bRaw: gTb, aHL: (L? gT/L>=0.75:false), bHL: (R? gTb/R>=0.75:false), smallerIsBetter: false },
                      ];
                      // Líneas de puntos (Over/Under) como antes
                      for (const th of [17,20,23,24,27,30]) {
                        const aCnt = Number(countsL?.game?.[String(th)]?.over ?? 0);
                        const bCnt = Number(countsR?.game?.[String(th)]?.over ?? 0);
                        const aHL = L ? (aCnt / L) >= 0.75 : false;
                        const bHL = R ? (bCnt / R) >= 0.75 : false;
                        rows.push({ label: `TT Over ${th} pts`, a: aCnt, b: bCnt, ar: '', br: '', aRaw: aCnt, bRaw: bCnt, aHL, bHL, smallerIsBetter: false });
                      }
                      for (const th of [17,20,23,24,27,30]) {
                        const aCnt = Number(countsL?.game?.[String(th)]?.under ?? 0);
                        const bCnt = Number(countsR?.game?.[String(th)]?.under ?? 0);
                        const aHL = L ? (aCnt / L) >= 0.75 : false;
                        const bHL = R ? (bCnt / R) >= 0.75 : false;
                        rows.push({ label: `TT Under ${th} pts`, a: aCnt, b: bCnt, ar: '', br: '', aRaw: aCnt, bRaw: bCnt, aHL, bHL, smallerIsBetter: false });
                      }
                      // append FG lines for full game (TT +1.5/+2.5 and TT -1.5/-2.5 using same counts)
                      const g = { L, R };
                        const addFg = (line, overAt) => {
                        const aCnt = Number(teamTrendsLeft?.counts?.fg?.game?.[line]?.over ?? 0);
                        const bCnt = Number(teamTrendsRight?.counts?.fg?.game?.[line]?.over ?? 0);
                        const aHL = g.L ? (aCnt / g.L) >= 0.75 : false;
                        const bHL = g.R ? (bCnt / g.R) >= 0.75 : false;
                        rows.push({ label: `TT Over ${line} GC`, a: aCnt, b: bCnt, ar: '', br: '', aRaw: aCnt, bRaw: bCnt, aHL, bHL, smallerIsBetter: false });
                        const aU = Number(teamTrendsLeft?.counts?.fg?.game?.[line]?.under ?? 0);
                        const bU = Number(teamTrendsRight?.counts?.fg?.game?.[line]?.under ?? 0);
                        const aHLu = g.L ? (aU / g.L) >= 0.75 : false;
                        const bHLu = g.R ? (bU / g.R) >= 0.75 : false;
                        rows.push({ label: `TT Under ${line} GC`, a: aU, b: bU, ar: '', br: '', aRaw: aU, bRaw: bU, aHL: aHLu, bHL: bHLu, smallerIsBetter: false });
                      };
                      addFg('1.5');
                      addFg('2.5');
                      return rows;
                    })();
                    const h1Rows = mkRowsFromCounts('h1');
                    const h2Rows = mkRowsFromCounts('h2');
                    // Build margin (handicaps) rows
                    const mkMarginRows = () => {
                      const rows = [];
                      const L = Number(teamTrendsLeft?.games ?? 0);
                      const R = Number(teamTrendsRight?.games ?? 0);
                      for (const th of [3,4,6,7,10,13]) {
                        const aW = Number(countsL?.margin?.[String(th)]?.win_by ?? 0);
                        const bW = Number(countsR?.margin?.[String(th)]?.win_by ?? 0);
                        const aHL = L ? (aW / L) >= 0.75 : false;
                        const bHL = R ? (bW / R) >= 0.75 : false;
                        rows.push({ label: `Ganan por: ${th}+`, a: aW, b: bW, ar: '', br: '', aRaw: aW, bRaw: bW, aHL, bHL, smallerIsBetter: false });
                      }
                      for (const th of [3,4,6,7,10,13]) {
                        const aL = Number(countsL?.margin?.[String(th)]?.lose_by ?? 0);
                        const bL = Number(countsR?.margin?.[String(th)]?.lose_by ?? 0);
                        const aHL = L ? (aL / L) >= 0.75 : false;
                        const bHL = R ? (bL / R) >= 0.75 : false;
                        rows.push({ label: `Pierden por: ${th}+`, a: aL, b: bL, ar: '', br: '', aRaw: aL, bRaw: bL, aHL, bHL, smallerIsBetter: false });
                      }
                      return rows;
                    };
                    const marginRows = mkMarginRows();
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <details className="group" open>
                            <summary className="list-none flex items-center justify-center gap-1 text-[12px] md:text-sm font-extrabold text-zinc-900 mb-1 cursor-pointer select-none">
                              <span>Juego completo</span>
                              <img src="/icons/angle-down.svg" alt="toggle" className="w-3 h-3 transition-transform group-open:rotate-180" />
                            </summary>
                            <Section title={null} rows={gameRows} noArrows showRanks={false} centerHighlight numbersMono headerLeft="# partidos con:" headerRight="# partidos con:" />
                            {/* WL ya incluido en el bloque de juego completo arriba */}
                          </details>
                        </div>
                        <div>
                          <details className="group" open>
                            <summary className="list-none flex items-center justify-center gap-1 text-[12px] md:text-sm font-extrabold text-zinc-900 mb-1 cursor-pointer select-none">
                              <span>1ª mitad</span>
                              <img src="/icons/angle-down.svg" alt="toggle" className="w-3 h-3 transition-transform group-open:rotate-180" />
                            </summary>
                            <Section title={null} rows={(() => {
                              const rows = h1Rows.slice();
                              const L = Number(teamTrendsLeft?.games ?? 0);
                              const R = Number(teamTrendsRight?.games ?? 0);
                              const addFg = (line) => {
                                const aCnt = Number(teamTrendsLeft?.counts?.fg?.h1?.[line]?.over ?? 0);
                                const bCnt = Number(teamTrendsRight?.counts?.fg?.h1?.[line]?.over ?? 0);
                                const aHL = L ? (aCnt / L) >= 0.75 : false;
                                const bHL = R ? (bCnt / R) >= 0.75 : false;
                                rows.push({ label: `TT Over ${line} GC`, a: aCnt, b: bCnt, ar: '', br: '', aRaw: aCnt, bRaw: bCnt, aHL, bHL, smallerIsBetter: false });
                                const aU = Number(teamTrendsLeft?.counts?.fg?.h1?.[line]?.under ?? 0);
                                const bU = Number(teamTrendsRight?.counts?.fg?.h1?.[line]?.under ?? 0);
                                const aHLu = L ? (aU / L) >= 0.75 : false;
                                const bHLu = R ? (bU / R) >= 0.75 : false;
                                rows.push({ label: `TT Under ${line} GC`, a: aU, b: bU, ar: '', br: '', aRaw: aU, bRaw: bU, aHL: aHLu, bHL: bHLu, smallerIsBetter: false });
                              };
                              addFg('0.5');
                              addFg('1.5');
                              // Prepend WL for 1ª mitad
                              const w = Number(teamTrendsLeft?.counts?.wl?.h1?.w ?? 0);
                              const wB = Number(teamTrendsRight?.counts?.wl?.h1?.w ?? 0);
                              const l = Number(teamTrendsLeft?.counts?.wl?.h1?.l ?? 0);
                              const lB = Number(teamTrendsRight?.counts?.wl?.h1?.l ?? 0);
                              const t = Number(teamTrendsLeft?.counts?.wl?.h1?.t ?? 0);
                              const tB = Number(teamTrendsRight?.counts?.wl?.h1?.t ?? 0);
                              rows.unshift(
                                { label: 'Jugados', a: L, b: R, ar: '', br: '', aRaw: L, bRaw: R, smallerIsBetter: false },
                                { label: 'Ganados', a: w, b: wB, ar: '', br: '', aRaw: w, bRaw: wB, aHL: (L? w/L>=0.75:false), bHL: (R? wB/R>=0.75:false), smallerIsBetter: false },
                                { label: 'Perdidos', a: l, b: lB, ar: '', br: '', aRaw: l, bRaw: lB, aHL: (L? l/L>=0.75:false), bHL: (R? lB/R>=0.75:false), smallerIsBetter: true },
                                { label: 'Empatados', a: t, b: tB, ar: '', br: '', aRaw: t, bRaw: tB, aHL: (L? t/L>=0.75:false), bHL: (R? tB/R>=0.75:false), smallerIsBetter: false },
                              );
                              return rows;
                            })()} noArrows showRanks={false} centerHighlight numbersMono />
                          </details>
                        </div>
                        <div className="md:col-span-2">
                          <details className="group" open>
                            <summary className="list-none flex items-center justify-center gap-1 text-[12px] md:text-sm font-extrabold text-zinc-900 mb-1 cursor-pointer select-none">
                              <span>2ª mitad</span>
                              <img src="/icons/angle-down.svg" alt="toggle" className="w-3 h-3 transition-transform group-open:rotate-180" />
                            </summary>
                            <Section title={null} rows={(() => {
                              const rows = h2Rows.slice();
                              const L = Number(teamTrendsLeft?.games ?? 0);
                              const R = Number(teamTrendsRight?.games ?? 0);
                              const addFg = (line) => {
                                const aCnt = Number(teamTrendsLeft?.counts?.fg?.h2?.[line]?.over ?? 0);
                                const bCnt = Number(teamTrendsRight?.counts?.fg?.h2?.[line]?.over ?? 0);
                                const aHL = L ? (aCnt / L) >= 0.75 : false;
                                const bHL = R ? (bCnt / R) >= 0.75 : false;
                                rows.push({ label: `TT Over ${line} GC`, a: aCnt, b: bCnt, ar: '', br: '', aRaw: aCnt, bRaw: bCnt, aHL, bHL, smallerIsBetter: false });
                                const aU = Number(teamTrendsLeft?.counts?.fg?.h2?.[line]?.under ?? 0);
                                const bU = Number(teamTrendsRight?.counts?.fg?.h2?.[line]?.under ?? 0);
                                const aHLu = L ? (aU / L) >= 0.75 : false;
                                const bHLu = R ? (bU / R) >= 0.75 : false;
                                rows.push({ label: `TT Under ${line} GC`, a: aU, b: bU, ar: '', br: '', aRaw: aU, bRaw: bU, aHL: aHLu, bHL: bHLu, smallerIsBetter: false });
                              };
                              addFg('0.5');
                              addFg('1.5');
                              // Prepend WL for 2ª mitad
                              const w = Number(teamTrendsLeft?.counts?.wl?.h2?.w ?? 0);
                              const wB = Number(teamTrendsRight?.counts?.wl?.h2?.w ?? 0);
                              const l = Number(teamTrendsLeft?.counts?.wl?.h2?.l ?? 0);
                              const lB = Number(teamTrendsRight?.counts?.wl?.h2?.l ?? 0);
                              const t = Number(teamTrendsLeft?.counts?.wl?.h2?.t ?? 0);
                              const tB = Number(teamTrendsRight?.counts?.wl?.h2?.t ?? 0);
                              rows.unshift(
                                { label: 'Jugados', a: L, b: R, ar: '', br: '', aRaw: L, bRaw: R, smallerIsBetter: false },
                                { label: 'Ganados', a: w, b: wB, ar: '', br: '', aRaw: w, bRaw: wB, aHL: (L? w/L>=0.75:false), bHL: (R? wB/R>=0.75:false), smallerIsBetter: false },
                                { label: 'Perdidos', a: l, b: lB, ar: '', br: '', aRaw: l, bRaw: lB, aHL: (L? l/L>=0.75:false), bHL: (R? lB/R>=0.75:false), smallerIsBetter: true },
                                { label: 'Empatados', a: t, b: tB, ar: '', br: '', aRaw: t, bRaw: tB, aHL: (L? t/L>=0.75:false), bHL: (R? tB/R>=0.75:false), smallerIsBetter: false },
                              );
                              return rows; 
                            })()} noArrows showRanks={false} centerHighlight numbersMono />
                          </details>
                        </div>
                        <div className="md:col-span-2">
                          <details className="group" open>
                            <summary className="list-none flex items-center justify-center gap-1 text-[12px] md:text-sm font-extrabold text-zinc-900 mb-1 cursor-pointer select-none">
                              <span>Handicaps</span>
                              <img src="/icons/angle-down.svg" alt="toggle" className="w-3 h-3 transition-transform group-open:rotate-180" />
                            </summary>
                            <Section title={null} rows={marginRows} noArrows showRanks={false} centerHighlight numbersMono />
                          </details>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="my-2 h-px bg-zinc-200" />

                  {/* H2H Pirámide */}
                  <div className="mb-2 mt-3 text-center text-sm md:text-base font-extrabold text-zinc-900">Últimos 5 duelos</div>
               {(() => {
                    const top = h2h.slice(0, 3);
                    const bottom = h2h.slice(3, 5);
                    return (
                      <>
                        <div className="grid grid-cols-6 gap-1 md:gap-2 mb-2">
                          {top.map((g, idx) => (
                            <div key={g.game_id || `${g.home_team}-${g.away_team}-${g.game_date || g.kickoff}`} className={`${idx===0?'col-start-1':(idx===1?'col-start-3':'col-start-5')} col-span-2`}>
                              <Row g={g} />
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-6 gap-1 md:gap-2">
                          {bottom[0] ? (
                            <div className="col-start-2 col-span-2">
                              <Row key={bottom[0].game_id || `${bottom[0].home_team}-${bottom[0].away_team}-${bottom[0].game_date || bottom[0].kickoff}`} g={bottom[0]} />
                            </div>
                          ) : null}
                          {bottom[1] ? (
                            <div className="col-start-4 col-span-2">
                              <Row key={bottom[1].game_id || `${bottom[1].home_team}-${bottom[1].away_team}-${bottom[1].game_date || bottom[1].kickoff}`} g={bottom[1]} />
                            </div>
                          ) : null}
                        </div>
                      </>
                    );
                  })()}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}


