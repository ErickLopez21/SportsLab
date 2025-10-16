import { useState } from 'react';
import { resolveHeadshot } from '../../api/nfl';

export default function HeadshotResolver() {
  const [q, setQ] = useState('Tyreek Hill');
  const [season, setSeason] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');

  const onResolve = async () => {
    setStatus('loading');
    try {
      const data = await resolveHeadshot(q, season ? Number(season) : undefined);
      setResult(data);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const headshot = result?.status === 'success' ? (result.match?.thumbnail_url || result.match?.headshot_url) : null;
  const name = result?.status === 'success' ? result.match?.name : null;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="font-semibold text-slate-100 mb-3">Headshot Resolver</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <input className="bg-slate-800 text-slate-100 rounded-md px-3 py-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del jugador" />
        <input className="bg-slate-800 text-slate-100 rounded-md px-3 py-2" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Temporada (opcional)" />
        <button onClick={onResolve} className="px-3 py-2 rounded-md bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700">Buscar</button>
      </div>
      {status === 'loading' && <div className="text-slate-400">Resolviendo…</div>}
      {status === 'error' && <div className="text-rose-400 text-sm">Error al resolver.</div>}
      {headshot && (
        <div className="flex items-center gap-3">
          <img src={headshot} alt={name || q} className="w-16 h-16 rounded-full border border-slate-700" />
          <div className="text-slate-300 text-sm">{name || q}</div>
        </div>
      )}
      {result?.status === 'not_found' && <div className="text-slate-400 text-sm">Sin coincidencias.</div>}
    </div>
  );
}


