import { useEffect, useState } from 'react';
import { getStandings } from '../../api/nfl';
import { Link } from 'react-router-dom';
import { getTeamLogo } from '../../utils/logos';
import { getTeamNickname } from '../../utils/nflMeta';

export default function StandingsCard({ season, league = 'NFL' }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    getStandings(season)
      .then((d) => { if (alive) { setData(d); setStatus('done'); } })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [season]);

  const renderTable = (title, rows) => (
    <div className="py-2">
      <div className="text-sm font-semibold text-zinc-800 mb-2">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] md:text-sm">
          <thead>
            <tr className="text-zinc-600">
              <th className="text-left font-semibold py-2">Equipo</th>
              <th className="text-right font-semibold">G</th>
              <th className="text-right font-semibold">P</th>
              <th className="text-right font-semibold">E</th>
              <th className="text-right font-semibold">%.</th>
              <th className="text-right font-semibold" title="Puntos anotados por partido">PAP</th>
              <th className="text-right font-semibold" title="Puntos permitidos por partido">PPP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-zinc-200">
                <td className="py-1.5 text-zinc-900">
                  <div className="flex items-center gap-2">
                    <Link to={`/teams/${encodeURIComponent(r.team)}`} className="shrink-0">
                      <img src={getTeamLogo('nfl', r.team)} alt={r.team} className="w-5 h-5" />
                    </Link>
                    <span>{getTeamNickname(r.team)}</span>
                  </div>
                </td>
                <td className="text-right text-zinc-900">{r.w}</td>
                <td className="text-right text-zinc-900">{r.l}</td>
                <td className="text-right text-zinc-900">{r.t}</td>
                <td className="text-right text-zinc-900">{r.pct.toFixed(3)}</td>
                <td className="text-right text-zinc-900" title="Puntos anotados por juego">{(r.pf_pg ?? r.pf)?.toFixed ? (r.pf_pg ?? r.pf).toFixed(1) : r.pf_pg ?? r.pf}</td>
                <td className="text-right text-zinc-900" title="Puntos permitidos por juego">{(r.pa_pg ?? r.pa)?.toFixed ? (r.pa_pg ?? r.pa).toFixed(1) : r.pa_pg ?? r.pa}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (status === 'loading') return <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 text-sm text-zinc-500">Cargando…</div>;
  if (status === 'error') return <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 text-sm text-rose-500">Error al cargar standings.</div>;
  if (!data || !data.conferences) return null;

  const { AFC = [], NFC = [] } = data.conferences || {};

  const spanishDivision = (key) => {
    if (!key) return 'Otros';
    if (key.endsWith('East')) return 'Este';
    if (key.endsWith('North')) return 'Norte';
    if (key.endsWith('South')) return 'Sur';
    if (key.endsWith('West')) return 'Oeste';
    return key;
  };

  const groupByDivision = (rows) => {
    const order = [
      'AFC East','AFC North','AFC South','AFC West',
      'NFC East','NFC North','NFC South','NFC West'
    ];
    const map = {};
    for (const r of rows) {
      const k = r.division || 'Otros';
      if (!map[k]) map[k] = [];
      map[k].push(r);
    }
    return order
      .filter((k) => map[k] && map[k].length)
      .map((k) => ({ key: k, title: spanishDivision(k), rows: map[k] }));
  };

  const renderConference = (confTitle, rows) => (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4">
      <div className="text-sm font-semibold text-zinc-800 mb-2">{confTitle}</div>
      {groupByDivision(rows).map(({ key, title, rows }, idx) => (
        <div key={key} className={idx > 0 ? 'pt-3 mt-3 border-t border-zinc-200' : ''}>
          {renderTable(`División ${title}`, rows)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {renderConference('Conferencia Americana', AFC)}
      <div className="h-px bg-zinc-200 opacity-70 mx-2" />
      {renderConference('Conferencia Nacional', NFC)}
    </div>
  );
}


