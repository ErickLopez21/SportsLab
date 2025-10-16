import { useMemo } from 'react';

// Simple demo with 5 predefined ESPN IDs; replace later with backend lookup
const DEMO_PLAYERS = [
  { name: 'Patrick Mahomes', espnId: '3139477', team: 'KC' },
  { name: 'Josh Allen', espnId: '3918298', team: 'BUF' },
  { name: 'Tyreek Hill', espnId: '3116406', team: 'MIA' },
  { name: 'JaMarr Chase', espnId: '4361429', team: 'CIN' },
  { name: 'Christian McCaffrey', espnId: '3117251', team: 'SF' },
];

export default function HeadshotsDemo() {
  const players = useMemo(() => DEMO_PLAYERS, []);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="font-semibold text-slate-100 mb-3">Headshots (demo)</div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {players.map((p) => {
          const url = `https://a.espncdn.com/i/headshots/nfl/players/full/${p.espnId}.png`;
          return (
            <div key={p.espnId} className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
                <img
                  src={url}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.src = '/logos/nfl/silhouette.png'; }}
                />
              </div>
              <div className="text-xs text-slate-300 text-center">
                {p.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


