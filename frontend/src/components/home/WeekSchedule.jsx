import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { getTeamLogo } from '../../utils/logos';

export default function WeekSchedule({ start, end, season }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/api/nfl/schedule', { params: { start, end, season } });
        if (!cancelled) setData(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [start, end, season]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="m-0 text-slate-900 text-base font-semibold">Hoy</h3>
        <span className="text-slate-500 text-xs">{start} → {end}</span>
      </div>
      {loading && <p className="text-slate-500 text-sm">Cargando…</p>}
      {error && <p className="text-red-700 text-sm">Error: {error}</p>}
      {!loading && data?.games?.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.games.map((g, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
              <div className="text-slate-500 text-xs">{g.game_date}</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img alt={g.away_team} src={getTeamLogo('nfl', g.away_team)} className="w-[22px] h-[22px]" />
                  <span className="font-semibold">{g.away_team}</span>
                </div>
                <span className="text-slate-500 text-xs">vs</span>
                <div className="flex items-center gap-2">
                  <img alt={g.home_team} src={getTeamLogo('nfl', g.home_team)} className="w-[22px] h-[22px]" />
                  <span className="font-semibold">{g.home_team}</span>
                </div>
              </div>
              {g.week != null && (
                <div className="text-slate-400 text-xs">Semana {g.week}</div>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && (!data || data.games?.length === 0) && (
        <p className="text-slate-500 text-sm">No hay juegos en este rango.</p>
      )}
    </div>
  );
}


