import { useEffect, useState } from 'react';
import { useFilters } from '../../context/FiltersContext';
import { getTeams } from '../../api/nfl';

export default function FilterBar() {
  const { filters, setFilters } = useFilters();
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    let alive = true;
    if (filters.league === 'NFL') {
      getTeams()
        .then((list) => {
          if (!alive) return;
          const normalized = Array.isArray(list) ? list.map(String) : [];
          setTeams(normalized);
          // auto-select defaults if empty
          setFilters((f) => ({
            ...f,
            teamA: f.teamA || normalized[0] || '',
            teamB: f.teamB || normalized[1] || normalized[0] || ''
          }));
        })
        .catch(() => alive && setTeams([]));
    } else {
      setTeams([]);
    }
    return () => { alive = false; };
  }, [filters.league, setFilters]);

  const onChange = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-3">
      <select className="bg-slate-800 text-slate-100 rounded-md px-3 py-2"
        value={filters.league} onChange={onChange('league')}>
        <option>NFL</option>
        <option>NBA</option>
        <option>MLB</option>
      </select>

      <input className="bg-slate-800 text-slate-100 rounded-md px-3 py-2 w-24"
        type="number" value={filters.season} onChange={onChange('season')} placeholder="Temporada" />

      <input className="bg-slate-800 text-slate-100 rounded-md px-3 py-2"
        type="date" value={filters.start} onChange={onChange('start')} />
      <input className="bg-slate-800 text-slate-100 rounded-md px-3 py-2"
        type="date" value={filters.end} onChange={onChange('end')} />

      <select className="bg-slate-800 text-slate-100 rounded-md px-3 py-2"
        value={filters.teamA} onChange={onChange('teamA')}>
        <option value="">Equipo A</option>
        {teams.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <select className="bg-slate-800 text-slate-100 rounded-md px-3 py-2"
        value={filters.teamB} onChange={onChange('teamB')}>
        <option value="">Equipo B</option>
        {teams.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <input className="bg-slate-800 text-slate-100 rounded-md px-3 py-2"
        value={filters.player} onChange={onChange('player')} placeholder="Jugador (ej. Tyreek Hill)" />
    </div>
  );
}


