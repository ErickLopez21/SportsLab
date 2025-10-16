import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFilters } from '../../context/FiltersContext';
import { getPlayerVsTeam, getTeams, searchPlayers } from '../../api/nfl';

export default function PlayerVsTeamCard() {
  const { filters } = useFilters();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle');
  const { league, season } = filters;
  const [localPlayer, setLocalPlayer] = useState('');
  const [localTeam, setLocalTeam] = useState('');
  const [teams, setTeams] = useState([]);
  const [seasonType, setSeasonType] = useState('REG');
  const [localSeasons, setLocalSeasons] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    let alive = true;
    if (league === 'NFL') {
      getTeams().then((t) => { if (alive) setTeams(Array.isArray(t) ? t : []); }).catch(() => {});
    } else {
      setTeams([]);
    }
    return () => { alive = false; };
  }, [league]);

  const isReady = useMemo(() => Boolean(localPlayer && localTeam), [localPlayer, localTeam]);

  const fetchPvt = useCallback(() => {
    if (league !== 'NFL' || !isReady) { setData(null); setStatus('idle'); return () => {}; }
    let alive = true;
    setStatus('loading');
    const seasonsParam = (localSeasons && localSeasons.trim()) || undefined;
    getPlayerVsTeam(localPlayer, localTeam, seasonsParam, seasonType)
      .then((d) => { if (alive) { setData(d); setStatus('done'); } })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [league, isReady, localPlayer, localTeam, localSeasons, seasonType]);

  useEffect(() => {
    const cleanup = fetchPvt();
    return cleanup;
  }, [fetchPvt]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="font-semibold text-slate-100 mb-3">Jugador vs Equipo</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Jugador</label>
          <input
            className="bg-slate-800 text-slate-100 rounded-md px-3 py-2"
            placeholder="Ej. Tyreek Hill"
            value={localPlayer}
            onChange={(e) => setLocalPlayer(e.target.value)}
          />
          <button
            onClick={async () => {
              if (!localPlayer || league !== 'NFL') { setSuggestions([]); return; }
              try {
                const resp = await searchPlayers(localPlayer, localSeasons?.trim() || String(season), seasonType);
                setSuggestions(Array.isArray(resp?.players) ? resp.players : []);
              } catch {
                setSuggestions([]);
              }
            }}
            className="mt-2 w-max px-2.5 py-1.5 rounded-md bg-slate-800 text-slate-100 text-xs border border-slate-700 hover:bg-slate-700"
          >
            Sugerencias
          </button>
          {suggestions.length > 0 && (
            <div className="mt-2 max-h-40 overflow-auto border border-slate-700 rounded-md divide-y divide-slate-800">
              {suggestions.map((s) => (
                <button key={s.name} onClick={() => { setLocalPlayer(s.name); setSuggestions([]); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800">
                  {s.name} <span className="text-slate-500">({s.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Equipo</label>
          <input
            list="pvt-teams"
            className="bg-slate-800 text-slate-100 rounded-md px-3 py-2"
            placeholder="Ej. KC"
            value={localTeam}
            onChange={(e) => setLocalTeam(e.target.value.toUpperCase())}
          />
          <datalist id="pvt-teams">
            {teams.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Temporadas (ej. 2022-2024 o 2019,2020)</label>
          <input
            className="bg-slate-800 text-slate-100 rounded-md px-3 py-2"
            value={localSeasons}
            onChange={(e) => setLocalSeasons(e.target.value)}
            placeholder={String(season)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Tipo de temporada</label>
          <select className="bg-slate-800 text-slate-100 rounded-md px-3 py-2" value={seasonType} onChange={(e) => setSeasonType(e.target.value)}>
            <option value="REG">Regular (REG)</option>
            <option value="POST">Playoffs (POST)</option>
            <option value="PRE">Pretemporada (PRE)</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-slate-400 text-sm">
          {status === 'idle' && !isReady ? 'Ingresa jugador y equipo.' : ''}
        </div>
        <button disabled={!isReady} onClick={fetchPvt} className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-100 text-sm border border-slate-700 hover:bg-slate-700 disabled:opacity-50">
          Buscar
        </button>
      </div>
      {status === 'idle' && <></>}
      {status === 'loading' && <div className="text-slate-400">Cargando…</div>}
      {status === 'error' && <div className="text-rose-400 text-sm">Error al cargar.</div>}
      {status === 'done' && (
        <pre className="text-slate-300 text-xs max-h-72 overflow-auto">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}


