import { useState } from 'react';
import { getPlayerVsTeam, getTeamVsTeam } from '../../api/nfl';

const PLAYER_EXAMPLES = [
  { player: 'Tyreek Hill', team: 'CIN' },
  { player: 'Patrick Mahomes', team: 'BUF' },
  { player: 'Saquon Barkley', team: 'LAR' },
];

const TEAM_EXAMPLES = [
  { teamA: 'KC', teamB: 'BUF' },
  { teamA: 'SF', teamB: 'DET' },
  { teamA: 'BAL', teamB: 'PIT' },
];

export default function LiveDemo() {
  const [demoType, setDemoType] = useState('player'); // 'player' or 'team'
  
  // Player vs Team state
  const [player, setPlayer] = useState('');
  const [team, setTeam] = useState('');
  
  // Team vs Team state
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Allowed combinations (restrict demo to curated pairs)
  const normalizeTeam = (t) => String(t || '').trim().toUpperCase();
  const normalizePlayer = (p) => String(p || '').trim().toLowerCase();
  // Historic aliases (solo para la demo)
  const TEAM_ALIASES = { LAR: 'LA', STL: 'LA', OAK: 'LV', SD: 'LAC' };
  const mapTeamAlias = (t) => TEAM_ALIASES[normalizeTeam(t)] || normalizeTeam(t);

  const ALLOWED_TEAM_COMBOS = new Set(
    TEAM_EXAMPLES.map(({ teamA, teamB }) => {
      const a = normalizeTeam(teamA);
      const b = normalizeTeam(teamB);
      return [a, b].sort().join('|');
    })
  );

  const ALLOWED_PLAYER_COMBOS = new Set(
    PLAYER_EXAMPLES.map(({ player, team }) => `${normalizePlayer(player)}|${normalizeTeam(team)}`)
  );

  const isAllowedTeamCombo = (a, b) => {
    const A = normalizeTeam(a);
    const B = normalizeTeam(b);
    if (!A || !B) return false;
    const key = [A, B].sort().join('|');
    return ALLOWED_TEAM_COMBOS.has(key);
  };

  const isAllowedPlayerCombo = (p, t) => {
    const key = `${normalizePlayer(p)}|${normalizeTeam(t)}`;
    const aliasKey = `${normalizePlayer(p)}|${mapTeamAlias(t)}`;
    return ALLOWED_PLAYER_COMBOS.has(key) || ALLOWED_PLAYER_COMBOS.has(aliasKey);
  };

  const runPlayerVsTeam = async () => {
    setError(null); setData(null);
    if (!player || !team) { setError('Ingresa un jugador y equipo'); return; }
    if (!isAllowedPlayerCombo(player, team)) {
      setError('Esta demo permite solo ejemplos predefinidos. Usa los botones de "Prueba rápida".');
      return;
    }
    try {
      setLoading(true);
      const seasons = new Date().getFullYear() - 4 + '-' + new Date().getFullYear();
      // Mostrar REG + POST para la demo y normalizar alias de equipo
      const res = await getPlayerVsTeam(player, mapTeamAlias(team), seasons, 'REG,POST');
      setData({ type: 'player', ...res });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const runTeamVsTeam = async () => {
    setError(null); setData(null);
    if (!teamA || !teamB) { setError('Ingresa ambos equipos'); return; }
    if (!isAllowedTeamCombo(teamA, teamB)) {
      setError('Demo limitada a combinaciones predefinidas. Usa los botones de "Prueba rápida".');
      return;
    }
    try {
      setLoading(true);
      // No pasar season para obtener datos históricos completos
      const res = await getTeamVsTeam(teamA, teamB);
      // Mapear respuesta real a los campos esperados por la UI
      const gamesArr = Array.isArray(res?.head_to_head?.games) ? res.head_to_head.games : [];
      const toNum = (v) => (v == null ? 0 : Number(v));
      const tA = normalizeTeam(teamA);
      const tB = normalizeTeam(teamB);
      let aWins = 0, bWins = 0;
      let sumDiff = 0, sumAScore = 0, sumBScore = 0;
      for (const g of gamesArr) {
        const home = normalizeTeam(g?.home_team);
        const away = normalizeTeam(g?.away_team);
        const hs = toNum(g?.home_score);
        const as = toNum(g?.away_score);
        const aScore = home === tA ? hs : (away === tA ? as : 0);
        const bScore = home === tB ? hs : (away === tB ? as : 0);
        sumAScore += aScore;
        sumBScore += bScore;
        sumDiff += (aScore - bScore);
        const winner = normalizeTeam(g?.winner);
        if (winner && winner !== 'TIE') {
          if (winner === tA) aWins += 1; else if (winner === tB) bWins += 1;
        }
      }
      const count = gamesArr.length;
      const mapped = {
        games: count,
        team_a_wins: aWins,
        team_b_wins: bWins,
        avg_point_diff: count ? (sumDiff / count) : 0,
        team_a_avg_score: count ? (sumAScore / count) : 0,
        team_b_avg_score: count ? (sumBScore / count) : 0,
      };
      setData({ type: 'team', ...res, ...mapped });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoTypeChange = (type) => {
    setDemoType(type);
    setError(null);
    setData(null);
  };

  return (
    <section id="live-demo" className="bg-gradient-to-br from-white to-zinc-50">
      <div className="px-4 md:px-6 py-10 md:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 border border-zinc-200 mb-4">
            <span className="text-sm font-semibold text-zinc-700">Demo Gratuita</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 mb-3">
            Pruébalo tú mismo
          </h2>
          <p className="text-zinc-600 text-base sm:text-lg">
            Analiza jugadores o equipos — sin registro
          </p>
        </div>

        {/* Demo Type Tabs */}
        <div className="max-w-md mx-auto mb-8">
          <div className="bg-zinc-100 rounded-xl p-1 grid grid-cols-2 gap-1">
            <button
              onClick={() => handleDemoTypeChange('player')}
              className={`px-4 py-3 rounded-lg font-bold text-sm transition-all duration-200 ${
                demoType === 'player'
                  ? 'bg-white text-sky-600 shadow-md'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Jugador vs Equipo
            </button>
            <button
              onClick={() => handleDemoTypeChange('team')}
              className={`px-4 py-3 rounded-lg font-bold text-sm transition-all duration-200 ${
                demoType === 'team'
                  ? 'bg-white text-sky-600 shadow-md'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
               Equipo vs Equipo
            </button>
          </div>
        </div>

        {/* Player vs Team Demo */}
        {demoType === 'player' && (
          <>
            {/* Quick Examples */}
            <div className="mb-6">
              <div className="text-center mb-3">
                <p className="text-sm font-bold text-zinc-700 mb-1"> Instrucciones</p>
                <p className="text-xs text-zinc-500">Selecciona una de estas opciones para ver el análisis:</p>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-2">
                {PLAYER_EXAMPLES.map((ex, i) => (
                  <button 
                    key={i} 
                    onClick={() => { setPlayer(ex.player); setTeam(ex.team); }} 
                    className="px-4 py-2 rounded-lg border-2 border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-xs sm:text-sm transition-all duration-200 hover:scale-105"
                  >
                    {ex.player} vs {ex.team}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Inputs - Read Only */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  value={player} 
                  readOnly
                  placeholder="Selecciona un ejemplo arriba" 
                  className="flex-1 bg-zinc-50 border-2 border-zinc-300 rounded-xl px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 cursor-not-allowed"
                />
                <input 
                  value={team} 
                  readOnly
                  placeholder="Equipo" 
                  className="w-full sm:w-32 bg-zinc-50 border-2 border-zinc-300 rounded-xl px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 cursor-not-allowed"
                />
                <button 
                  onClick={runPlayerVsTeam} 
                  disabled={loading || !isAllowedPlayerCombo(player, team)}
                  className="px-6 py-3 rounded-xl bg-sky-600 text-white font-bold text-base shadow-md hover:bg-sky-700 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Buscando...' : 'Analizar →'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Team vs Team Demo */}
        {demoType === 'team' && (
          <>
            {/* Quick Examples */}
            <div className="mb-6">
              <div className="text-center mb-3">
                <p className="text-sm font-bold text-zinc-700 mb-1">Instrucciones</p>
                <p className="text-xs text-zinc-500">Selecciona una de estas opciones para ver la comparación:</p>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-2">
                {TEAM_EXAMPLES.map((ex, i) => (
                  <button 
                    key={i} 
                    onClick={() => { setTeamA(ex.teamA); setTeamB(ex.teamB); }} 
                    className="px-4 py-2 rounded-lg border-2 border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-xs sm:text-sm transition-all duration-200 hover:scale-105"
                  >
                    {ex.teamA} vs {ex.teamB}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Inputs - Read Only */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  value={teamA} 
                  readOnly
                  placeholder="Selecciona un ejemplo arriba" 
                  className="flex-1 bg-zinc-50 border-2 border-zinc-300 rounded-xl px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 cursor-not-allowed"
                />
                <span className="hidden sm:flex items-center justify-center text-2xl text-zinc-400 font-bold">VS</span>
                <input 
                  value={teamB} 
                  readOnly
                  placeholder="Equipo 2" 
                  className="flex-1 bg-zinc-50 border-2 border-zinc-300 rounded-xl px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 cursor-not-allowed"
                />
                <button 
                  onClick={runTeamVsTeam} 
                  disabled={loading || !isAllowedTeamCombo(teamA, teamB)}
                  className="px-6 py-3 rounded-xl bg-sky-600 text-white font-bold text-base shadow-md hover:bg-sky-700 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Comparar →' : 'Comparar →'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mb-3" />
            <p className="text-sky-700 font-semibold">Analizando datos...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="max-w-2xl mx-auto p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-red-700 text-center font-semibold">{error}</p>
          </div>
        )}

        {/* Results - Mobile Optimized */}
        {data && data.type === 'player' && (
          <div className="max-w-3xl mx-auto">
            {/* Info Message - Compacto */}
            <div className="mb-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
              <p className="text-center text-zinc-600 text-xs sm:text-sm">
                <span className="font-bold text-zinc-900">Vista previa</span> — Con Premium: <span className="font-semibold">métricas avanzadas, filtros por temporada, sede, rivales de conferencia y más</span>
              </p>
            </div>

            {/* Detectar rol y mostrar métricas adecuadas */}
            {(() => {
              const agg = data.aggregate || {};
              const role = (agg.role_guess || '').toLowerCase();
              const hasPassing = !!(agg.qb && ((agg.qb.yards_total || 0) > 0));
              const hasRushing = !!(agg.rb && ((agg.rb.yards_total || 0) > 0));
              const hasReceiving = !!(agg.wr_te && ((agg.wr_te.yards_total || 0) > 0));
              const forceRB = ((data.player || '').toLowerCase() === 'saquon barkley');

              // Caso especial demo: Saquon Barkley siempre como RB
              if (forceRB && agg.rb) {
                const r = agg.rb;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <StatCompact label="Juegos" value={data.games} />
                    <StatCompact label="Acarreos/Juego" value={r.attempts_per_game ?? '-'} />
                    <StatCompact label="Yds/Juego" value={r.yards_per_game ?? '-'} />
                    <StatCompact label="TDs" value={r.td_total} />
                    <StatCompact label="Y/Ac" value={r.yards_per_carry ?? '-'} />
                  </div>
                );
              }

              // Priorizar WR/TE si hay receiving (si no es QB, aunque tenga algo de pase/carrera)
              if ((/wr|te/.test(role) && hasReceiving) || (hasReceiving && !/qb/.test(role))) {
                const rec = agg.wr_te;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <StatCompact label="Juegos" value={data.games} />
                    <StatCompact label="Rec/Juego" value={rec.receptions_per_game ?? '-'} />
                    <StatCompact label="Yds/Juego" value={rec.yards_per_game ?? '-'} />
                    <StatCompact label="TDs" value={rec.td_total} />
                    <StatCompact label="Targets/Juego" value={rec.targets_per_game ?? '-'} />
                    <StatCompact label="Y/Rec" value={rec.yards_per_reception ?? '-'} />
                  </div>
                );
              }

              if ((role.includes('qb') && agg.qb) || hasPassing) {
                const p = agg.qb;
                const cmpPct = p.completions_per_game && p.attempts_per_game 
                  ? ((p.completions_per_game / p.attempts_per_game) * 100).toFixed(1)
                  : '-';
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <StatCompact label="Juegos" value={data.games} />
                    <StatCompact label="Yds/Juego" value={p.yards_per_game ?? '-'} />
                    <StatCompact label="TDs" value={p.td_total} />
                    <StatCompact label="INT" value={p.interceptions} />
                    <StatCompact label="Cmp%" value={cmpPct !== '-' ? `${cmpPct}%` : '-'} />
                    <StatCompact label="Y/Intento" value={p.yards_per_attempt ?? '-'} />
                  </div>
                );
              }

              if ((role.includes('rb') && agg.rb) || hasRushing) {
                const r = agg.rb;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <StatCompact label="Juegos" value={data.games} />
                    <StatCompact label="Acarreos/Juego" value={r.attempts_per_game ?? '-'} />
                    <StatCompact label="Yds/Juego" value={r.yards_per_game ?? '-'} />
                    <StatCompact label="TDs" value={r.td_total} />
                    <StatCompact label="Y/C" value={r.yards_per_carry ?? '-'} />
                  </div>
                );
              }

              // Fallback: mostrar mensaje si no hay datos
              return (
                <div className="text-center py-8 text-zinc-500">
                  <p className="text-sm">No hay datos disponibles para mostrar.</p>
                </div>
              );
            })()}

            {/* Data context info */}
            {(() => {
              const currentYear = new Date().getFullYear();
              const startYear = currentYear - 4;
              const seasonRange = `${startYear}-${currentYear}`;
              return (
                <div className="mt-3 text-center text-zinc-400 text-[10px] sm:text-xs">
                  <p>Temporadas {seasonRange} · Regular + Playoffs</p>
                </div>
              );
            })()}

            <PremiumUpsell />
          </div>
        )}

        {data && data.type === 'team' && (
          <div className="max-w-3xl mx-auto">
            {/* Info Message - Compacto */}
            <div className="mb-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
              <p className="text-center text-zinc-600 text-xs sm:text-sm">
                <span className="font-bold text-zinc-900">Vista previa</span> — Con Premium: <span className="font-semibold">ofensiva, defensiva, equipos especiales, tendencias y filtros avanzados</span>
              </p>
            </div>

            {(() => {
              const gcA = Number(data?.team_a_stats?.fg_per_game ?? 0);
              const gcB = Number(data?.team_b_stats?.fg_per_game ?? 0);
              const gcAvg = ((gcA + gcB) / 2).toFixed(2);
              const passYdsA = data?.team_a_stats?.pass_yards_per_game ? Number(data.team_a_stats.pass_yards_per_game).toFixed(1) : '-';
              const passYdsB = data?.team_b_stats?.pass_yards_per_game ? Number(data.team_b_stats.pass_yards_per_game).toFixed(1) : '-';
              return (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {data.games !== undefined && <StatCompact label="Juegos" value={data.games} />}
                  {data.team_a_wins !== undefined && <StatCompact label={`Vict. ${teamA}`} value={data.team_a_wins} />}
                  {data.team_b_wins !== undefined && <StatCompact label={`Vict. ${teamB}`} value={data.team_b_wins} />}
                  {data.team_a_avg_score !== undefined && <StatCompact label={`${teamA} ptos PROM`} value={data.team_a_avg_score?.toFixed(1)} />}
                  {data.team_b_avg_score !== undefined && <StatCompact label={`${teamB} ptos PROM`} value={data.team_b_avg_score?.toFixed(1)} />}
                  <StatCompact label="GC prom/P" value={gcAvg} />
                  {passYdsA !== '-' && <StatCompact label={`${teamA} yds pase`} value={passYdsA} />}
                  {passYdsB !== '-' && <StatCompact label={`${teamB} yds pase`} value={passYdsB} />}
                </div>
              );
            })()}

            {/* Data context info */}
            <div className="mt-3 text-center text-zinc-400 text-[10px] sm:text-xs">
              <p>Datos históricos H2H · Ultimos 5 duelos · Regular + Playoffs</p>
            </div>

            <PremiumUpsell />
        </div>
        )}

        {/* Bottom Info */}
        {!data && !loading && (
          <div className="mt-6 text-center text-sm text-zinc-500">
            <p>Esta demo usa datos reales de la NFL. Funciona 100% gratis sin registro.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function StatCompact({ label, value }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3 shadow-sm">
      <div className="text-zinc-500 text-[10px] sm:text-xs font-bold uppercase tracking-wide mb-1 text-center">{label}</div>
      <div className="text-zinc-900 text-xl sm:text-2xl font-extrabold text-center leading-none">{value ?? '-'}</div>
    </div>
  );
}

function PremiumUpsell() {
  return (
    <div className="mt-4 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h3 className="text-base font-bold text-zinc-900 mb-1">
            Desbloquea todo con Premium
          </h3>
          <p className="text-zinc-600 text-xs sm:text-sm mb-2">
            Tendencias detalladas, splits completos, rankings y mucho más
          </p>
        </div>
        <button
          onClick={() => {
            const el = document.getElementById('pricing');
            if (el) {
              const headerOffset = 80;
              const elementPosition = el.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
              window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
          }}
          className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-sky-600 text-white font-bold text-xs sm:text-sm shadow-md hover:bg-sky-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
        >
          Ver plan
          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}


