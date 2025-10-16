import { useCallback, useEffect, useState } from 'react';
import { useFilters } from '../../context/FiltersContext';
import { getSchedule } from '../../api/nfl';

export default function ScheduleCard() {
  const { filters } = useFilters();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(() => {
    let alive = true;
    setLoading(true);
    if (filters.league !== 'NFL') { setRows([]); setLoading(false); return () => {}; }
    getSchedule(filters.start, filters.end, filters.season)
      .then((d) => {
        if (!alive) return;
        const list = d && Array.isArray(d.games) ? d.games : (Array.isArray(d) ? d : []);
        setRows(list.slice(0, 50));
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [filters.league, filters.start, filters.end, filters.season]);

  useEffect(() => {
    const cleanup = fetchSchedule();
    return cleanup;
  }, [fetchSchedule]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="font-semibold text-slate-100 mb-3">Calendario</div>
      <div className="flex items-center justify-between mb-2">
        <div />
        <button onClick={fetchSchedule} className="px-3 py-1.5 rounded-md bg-slate-800 text-slate-100 text-sm border border-slate-700 hover:bg-slate-700">
          Buscar
        </button>
      </div>
      {loading ? (
        <div className="text-slate-400">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="text-slate-400">Sin partidos en rango.</div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-auto pr-1">
          {rows.map((g, i) => (
            <div key={i} className="flex justify-between text-sm text-slate-200">
              <span>{g.week ? `W${g.week}` : ''} {g.away_team} @ {g.home_team}</span>
              <span className="text-slate-400">{g.kickoff || g.game_date || g.gametime || g.game_time_eastern}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


