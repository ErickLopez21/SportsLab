import { useCallback, useEffect, useState } from 'react';
import { useFilters } from '../../context/FiltersContext';
import { getTeams, getTeamVsTeam } from '../../api/nfl';

export default function TeamVsTeamCard() {
  const { filters } = useFilters();
  const { league, season } = filters;
  const [localTeamA, setLocalTeamA] = useState('');
  const [localTeamB, setLocalTeamB] = useState('');
  const [teams, setTeams] = useState([]);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    let alive = true;
    if (league === 'NFL') {
      getTeams().then((t) => { if (alive) setTeams(Array.isArray(t) ? t : []); }).catch(() => {});
    } else {
      setTeams([]);
    }
    return () => { alive = false; };
  }, [league]);

  const isReady = localTeamA && localTeamB && localTeamA !== localTeamB;

  const fetchComparison = useCallback(() => {
    if (league !== 'NFL' || !isReady) { setData(null); setStatus('idle'); return () => {}; }
    let alive = true;
    setStatus('loading');
    getTeamVsTeam(localTeamA, localTeamB, season)
      .then((d) => { if (alive) { setData(d); setStatus('done'); } })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [league, isReady, localTeamA, localTeamB, season]);

  useEffect(() => {
    const cleanup = fetchComparison();
    return cleanup;
  }, [fetchComparison]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="font-semibold text-slate-100 mb-3">Equipo vs Equipo</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Equipo A</label>
          <select className="bg-slate-800 text-slate-100 rounded-md px-3 py-2" value={localTeamA} onChange={(e) => setLocalTeamA(e.target.value)}>
            <option value="">Seleccionar</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Equipo B</label>
          <select className="bg-slate-800 text-slate-100 rounded-md px-3 py-2" value={localTeamB} onChange={(e) => setLocalTeamB(e.target.value)}>
            <option value="">Seleccionar</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-slate-400 text-sm">
          {status === 'idle' && !isReady ? 'Selecciona dos equipos diferentes.' : ''}
        </div>
        <button disabled={!isReady} onClick={fetchComparison} className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-100 text-sm border border-slate-700 hover:bg-slate-700 disabled:opacity-50">
          Comparar
        </button>
      </div>
      {status === 'idle' && <></>}
      {status === 'loading' && <div className="text-slate-400">Cargando…</div>}
      {status === 'error' && <div className="text-rose-400 text-sm">Error al cargar.</div>}
      {status === 'done' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/60 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-2">{data.team_a}</div>
              <div className="space-y-1 text-sm">
                <div><span className="text-slate-400">Yardas:</span> <span className="text-slate-100">{data.team_a_stats.total_yards}</span></div>
                <div><span className="text-slate-400">Pase:</span> <span className="text-slate-100">{data.team_a_stats.pass_yards}</span></div>
                <div><span className="text-slate-400">Carrera:</span> <span className="text-slate-100">{data.team_a_stats.rush_yards}</span></div>
                <div><span className="text-slate-400">Puntos:</span> <span className="text-slate-100">{data.team_a_stats.points}</span></div>
                <div><span className="text-slate-400">FG por juego:</span> <span className="text-slate-100">{data.team_a_stats.fg_per_game}</span></div>
              </div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-2">{data.team_b}</div>
              <div className="space-y-1 text-sm">
                <div><span className="text-slate-400">Yardas:</span> <span className="text-slate-100">{data.team_b_stats.total_yards}</span></div>
                <div><span className="text-slate-400">Pase:</span> <span className="text-slate-100">{data.team_b_stats.pass_yards}</span></div>
                <div><span className="text-slate-400">Carrera:</span> <span className="text-slate-100">{data.team_b_stats.rush_yards}</span></div>
                <div><span className="text-slate-400">Puntos:</span> <span className="text-slate-100">{data.team_b_stats.points}</span></div>
                <div><span className="text-slate-400">FG por juego:</span> <span className="text-slate-100">{data.team_b_stats.fg_per_game}</span></div>
              </div>
            </div>
          </div>
          {data.head_to_head.count > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-200 mb-2">Últimos {data.head_to_head.count} enfrentamientos</div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {data.head_to_head.games.map((g, i) => (
                  <div key={i} className="bg-slate-800/40 rounded-md p-2 text-xs">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-slate-300">{g.season} S{g.week}</span> 
                        <span className="ml-2 text-slate-400">{g.date}</span>
                      </div>
                      <div className={`font-semibold ${g.winner === 'TIE' ? 'text-slate-400' : 'text-lime-400'}`}>
                        {g.winner === 'TIE' ? 'EMPATE' : `Ganó ${g.winner}`}
                      </div>
                    </div>
                    <div className="mt-1 text-slate-300">
                      {g.home_team} {g.home_score} - {g.away_score} {g.away_team}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.head_to_head.count === 0 && (
            <div className="text-slate-400 text-sm">Sin enfrentamientos previos recientes.</div>
          )}
        </div>
      )}
    </div>
  );
}

