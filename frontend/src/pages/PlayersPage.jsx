import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { searchPlayers, getPlayerCareer, getPlayerVsTeam, getPlayerRanks } from '../api/nfl';
import { getTeamLogo } from '../utils/logos';
import { getTeamFullName, getTeamNickname } from '../utils/nflMeta';
import { formatNFLSeason } from '../utils/seasons';

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

export default function PlayersPage() {
  const [tab, setTab] = useState('career'); // 'career' | 'vs-team'
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState(null); // Store player info (position, team, headshot)
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Rankings for 2025 season
  const [ranksData, setRanksData] = useState(null);
  
  // Filters
  const [selectedSeasons, setSelectedSeasons] = useState([]); // Array of selected season years
  const [seasonType, setSeasonType] = useState('both'); // 'regular' | 'postseason' | 'both'
  
  // Player search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  // Headshot from player info or playerData
  const headshotUrl = selectedPlayerInfo?.headshot_url || playerData?.headshot_url || null;

  // Load rankings dynamically based on selected season
  // Only show rankings if exactly ONE season is selected
  useEffect(() => {
    let isMounted = true; // Prevent state updates if component unmounts
    
    const loadRanks = async () => {
      // Reset rankings if multiple seasons or no season selected
      if (selectedSeasons.length !== 1) {
        if (isMounted) setRanksData(null);
        return;
      }

      const season = selectedSeasons[0];
      // Map seasonType to game_types format
      const gameTypes = seasonType === 'regular' ? 'REG' : seasonType === 'postseason' ? 'POST' : 'REG,POST';
      
      try {
        const ranks = await getPlayerRanks(season, gameTypes);
        // Only update if still mounted and still the same season
        if (isMounted && selectedSeasons.length === 1 && selectedSeasons[0] === season) {
          // Check if ranks has data, otherwise set to null
          const hasData = ranks && (
            (Array.isArray(ranks.qb) && ranks.qb.length > 0) ||
            (Array.isArray(ranks.rb) && ranks.rb.length > 0) ||
            (Array.isArray(ranks.wr_te) && ranks.wr_te.length > 0)
          );
          setRanksData(hasData ? ranks : null);
        }
      } catch (err) {
        console.error('Failed to load rankings:', err);
        if (isMounted) setRanksData(null);
      }
    };
    
    loadRanks();
    
    return () => {
      isMounted = false; // Cleanup on unmount or season/type change
    };
  }, [selectedSeasons, seasonType]);

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    // Don't search if a player is already selected and query matches their name
    if (selectedPlayer && searchQuery.trim().toLowerCase() === selectedPlayer.toLowerCase()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchPlayers(searchQuery, 10);
        setSearchResults(results?.results || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedPlayer]);

  // Load player data when player, tab, or filters change
  useEffect(() => {
    if (!selectedPlayer) return;
    
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Build filter params
        const currentYear = new Date().getFullYear();
        let seasons = null;
        
        // Apply selected seasons filter
        if (selectedSeasons.length > 0) {
          // Sort seasons and create range string
          const sorted = [...selectedSeasons].sort((a, b) => a - b);
          const min = sorted[0];
          const max = sorted[sorted.length - 1];
          seasons = `${min}-${max}`;
        }
        // If no seasons selected, backend uses default (last 10 years)
        
        // Map seasonType to game_types parameter
        let gameTypes = 'REG,POST'; // default: both
        if (seasonType === 'regular') {
          gameTypes = 'REG';
        } else if (seasonType === 'postseason') {
          gameTypes = 'POST';
        }
        
        if (tab === 'career') {
          // Load career stats
          const data = await getPlayerCareer(selectedPlayer, seasons, gameTypes);
          setPlayerData(data);
        } else if (tab === 'vs-team' && selectedTeam) {
          // Load vs team stats
          if (!seasons) {
            seasons = `${currentYear - 4}-${currentYear}`; // Default to last 5 for vs-team
          }
          const data = await getPlayerVsTeam(selectedPlayer, selectedTeam, seasons, gameTypes);
          setPlayerData(data);
        } else {
          setPlayerData(null);
        }
      } catch (err) {
        setError(err?.message || 'Error al cargar estadísticas');
        setPlayerData(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedPlayer, selectedTeam, tab, selectedSeasons, seasonType]);

  const handlePlayerSelect = (player) => {
    setSelectedPlayer(player.name);
    setSelectedPlayerInfo({
      player_id: player.player_id,
      position: player.position,
      team: player.team,
      headshot_url: player.headshot_url,
    });
    setSearchQuery(player.name);
    setShowDropdown(false); // Close dropdown
    setSearchResults([]); // Clear search results
    setPlayerData(null); // Reset data
    
    // Set default filters
    setTab('career'); // Default to career tab
    const currentYear = new Date().getFullYear();
    setSelectedSeasons([currentYear]); // Default to current season (2025/26)
  };

  return (
    <div className="" style={{ backgroundColor: '#FAFAFA', minHeight: 'var(--minvh)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <div className="max-w-screen-xl mx-auto px-2 md:px-4 lg:px-6 py-4">
        {/* Header with back link and title */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-zinc-200 mb-2">
          <div className="grid grid-cols-3 items-center h-10">
            <div className="justify-self-start">
              <Link to="/app" className="text-sm text-zinc-600 hover:underline">← Volver</Link>
            </div>
            <div className="justify-self-center text-sm md:text-base font-extrabold text-zinc-800">SportsLab</div>
            <div className="justify-self-end" />
          </div>
        </div>

        {/* Player selector card */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4 mb-3">
          {/* Tabs: Carrera / Vs Equipo */}
          <div className="mb-4 flex items-center justify-center">
            <div className="inline-flex rounded-full bg-zinc-100 border border-zinc-200 p-0.5">
              <button
                type="button"
                onClick={() => setTab('career')}
                className={`px-4 h-8 rounded-full text-xs md:text-sm font-semibold ${
                  tab === 'career'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Carrera
              </button>
              <button
                type="button"
                onClick={() => setTab('vs-team')}
                className={`px-4 h-8 rounded-full text-xs md:text-sm font-semibold ${
                  tab === 'vs-team'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Vs Equipo
              </button>
            </div>
          </div>

          {/* Player selector section */}
          <div className="flex flex-col items-center justify-center">
            {/* Headshot */}
            <div className="relative mb-3">
              {headshotUrl ? (
                <img
                  src={headshotUrl}
                  alt={selectedPlayer || 'Jugador'}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-zinc-200 shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-zinc-100 border-2 border-zinc-200 shadow-sm flex items-center justify-center">
                  <svg className="w-10 h-10 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Player name or prompt */}
            {selectedPlayer ? (
              <div className="text-center mb-2">
                <h2 className="text-lg md:text-xl font-black text-zinc-900">
                  {selectedPlayer}
                </h2>
                {selectedPlayerInfo && (
                  <div className="mt-1 text-xs md:text-sm text-zinc-500 font-medium">
                    {selectedPlayerInfo.position && `${selectedPlayerInfo.position}`}
                    {selectedPlayerInfo.team && ` · ${selectedPlayerInfo.team}`}
                  </div>
                )}
              </div>
            ) : (
              <h2 className="text-base md:text-lg font-bold text-zinc-500 mb-2">
                Selecciona un jugador
              </h2>
            )}

            {/* Search input with autocomplete */}
            <div className="w-full max-w-md relative" ref={dropdownRef}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="Buscar jugador..."
                className="w-full px-4 py-2.5 rounded-xl border-2 border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-sky-600 text-sm md:text-base"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
                </div>
              )}
              
              {/* Autocomplete dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-zinc-200 rounded-xl shadow-lg max-h-80 overflow-auto z-50">
                  {searchResults.map((player, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePlayerSelect(player)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 text-left border-b border-zinc-100 last:border-b-0"
                    >
                      {player.headshot_url ? (
                        <img
                          src={player.headshot_url}
                          alt={player.name}
                          className="w-10 h-10 rounded-full object-cover border border-zinc-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                          <svg className="w-6 h-6 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm md:text-base font-semibold text-zinc-900 truncate">
                          {player.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {player.position ? `${player.position} · ` : ''}{player.team || 'FA'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team selector (only in vs-team tab) */}
            {tab === 'vs-team' && (
              <div className="mt-3 w-full max-w-md">
                <details className="relative">
                  <summary className="list-none w-full px-4 py-2.5 rounded-xl border-2 border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:border-sky-600 text-sm md:text-base cursor-pointer flex items-center justify-between">
                    {selectedTeam ? (
                      <div className="flex items-center gap-2">
                        <img src={getTeamLogo('nfl', selectedTeam)} alt={selectedTeam} className="w-5 h-5" />
                        <span>{getTeamNickname(selectedTeam) || getTeamFullName(selectedTeam) || selectedTeam}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-400">Selecciona rival...</span>
                    )}
                    <img src="/icons/angle-down.svg" alt="abrir" className="w-3 h-3 shrink-0" />
                  </summary>
                  <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                  <div className="absolute left-0 right-0 mt-1 max-h-80 overflow-auto bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                    {TEAMS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={(e) => {
                          setSelectedTeam(t);
                          const d = e.currentTarget.closest('details');
                          if (d) d.open = false;
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left ${
                          selectedTeam === t ? 'bg-zinc-100 font-semibold text-zinc-900' : 'hover:bg-zinc-50 text-zinc-800'
                        }`}
                      >
                        <img src={getTeamLogo('nfl', t)} alt={t} className="w-5 h-5" />
                        <span className="text-sm">{getTeamNickname(t) || getTeamFullName(t) || t}</span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>

        {/* Filters section */}
        {selectedPlayer && (
          <div className="flex flex-wrap justify-center items-center gap-2 mb-3">
            {/* Info tooltip for rankings */}
            {selectedSeasons.length === 1 && (
              <div className="relative group">
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors"
                  title="Información sobre rankings"
                >
                  <svg className="w-2.5 h-2.5 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-60 bg-white border border-sky-600 text-zinc-900 rounded-md px-2.5 py-2 shadow-lg z-50">
                  <div className="text-[10px] leading-snug mb-1">
                    Rankings solo cuando se selecciona 1 temporada y se cumplen los mínimos requeridos:
                  </div>
                  <div className="text-[9px] leading-snug mb-1 text-zinc-600">
                    Mínimo requerido:
                  </div>
                  <div className="space-y-0.5 text-[9px] leading-snug">
                    <div>QB: 75 pases · RB: 35 acarreos</div>
                    <div>WR/TE: 20 targets · DEF: 3 tacleadas</div>
                    <div>K: 10 intentos de gol de campo</div>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-sky-600"></div>
                </div>
              </div>
            )}
            
            {/* Seasons filter with checkboxes */}
            <details className="relative">
              <summary className="list-none inline-flex items-center justify-between gap-1 h-8 px-3 rounded-full border bg-white text-zinc-800 border-zinc-200 text-xs font-semibold cursor-pointer">
                <span className="whitespace-nowrap">
                  {selectedSeasons.length > 0 
                    ? selectedSeasons.length === 1 
                      ? formatNFLSeason(selectedSeasons[0])
                      : `${selectedSeasons.length} temp.`
                    : 'Temporadas'}
                </span>
                <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
              </summary>
              <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
              <div className="absolute left-0 mt-1 w-48 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50 max-h-80 overflow-auto">
                {/* Quick actions */}
                <div className="mb-2 pb-2 border-b border-zinc-200">
                    <button
                      type="button"
                      onClick={() => {
                        const currentYear = new Date().getFullYear();
                        const last5 = Array.from({ length: 5 }, (_, i) => currentYear - i);
                        setSelectedSeasons(last5);
                      }}
                      className="block w-full text-left text-xs px-3 py-1.5 rounded-md text-sky-600 hover:bg-sky-50 font-semibold"
                    >
                      Últimas 5
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const currentYear = new Date().getFullYear();
                        const last10 = Array.from({ length: 10 }, (_, i) => currentYear - i);
                        setSelectedSeasons(last10);
                      }}
                      className="block w-full text-left text-xs px-3 py-1.5 rounded-md text-sky-600 hover:bg-sky-50 font-semibold"
                    >
                      Últimas 10
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSeasons([])}
                      className="block w-full text-left text-xs px-3 py-1.5 rounded-md text-zinc-500 hover:bg-zinc-50"
                    >
                      Limpiar
                    </button>
                  </div>
                  {/* Individual seasons */}
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <label
                      key={year}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 rounded-md cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSeasons.includes(year)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSeasons([...selectedSeasons, year]);
                          } else {
                            setSelectedSeasons(selectedSeasons.filter(s => s !== year));
                          }
                        }}
                        className="w-4 h-4 rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-sm text-zinc-900">{formatNFLSeason(year)}</span>
                    </label>
                  ))}
                </div>
              </details>

              {/* Season Type filter (Regular/Playoffs/Tipo) */}
              <details className="relative">
                <summary className="list-none inline-flex items-center justify-between gap-1 h-8 px-3 rounded-full border bg-white text-zinc-800 border-zinc-200 text-xs font-semibold cursor-pointer">
                  <span className="whitespace-nowrap">
                    {seasonType === 'regular' ? 'Regular' : seasonType === 'postseason' ? 'Playoffs' : 'Tipo'}
                  </span>
                  <img src="/icons/angle-down.svg" alt="abrir" className="w-2.5 h-2.5 flex-shrink-0" />
                </summary>
                <div className="fixed inset-0 z-40" onClick={(e) => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }} />
                <div className="absolute left-0 mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-md p-2 z-50">
                  <button
                    type="button"
                    onClick={(e) => { setSeasonType('both'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }}
                    className={`block w-full text-left text-sm px-3 py-2 rounded-md ${seasonType==='both'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { setSeasonType('regular'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }}
                    className={`block w-full text-left text-sm px-3 py-2 rounded-md ${seasonType==='regular'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}
                  >
                    Regular
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { setSeasonType('postseason'); const d=e.currentTarget.closest('details'); if (d) d.open=false; }}
                    className={`block w-full text-left text-sm px-3 py-2 rounded-md ${seasonType==='postseason'?'bg-zinc-100 text-zinc-900 font-semibold':'text-zinc-900 hover:bg-zinc-50'}`}
                  >
                    Playoffs
                  </button>
                </div>
              </details>
            </div>
          )}

          {/* Loading/Error states */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mb-3" />
              <p className="text-sky-700 font-semibold">Cargando estadísticas...</p>
            </div>
          )}

          {error && (
            <div className="max-w-2xl mx-auto p-4 rounded-xl bg-red-50 border border-red-200 text-center">
              <p className="text-red-700 font-semibold">{error}</p>
            </div>
          )}

          {/* Stats display */}
          {!loading && !error && selectedPlayer && playerData && (() => {
            const roleGuess = playerData.aggregate?.role_guess;
            const isQB = roleGuess === 'QB';

            // Helper to format numbers with commas
            const formatNumber = (num) => {
              if (num == null || num === '—') return '—';
              const n = typeof num === 'number' ? num : parseFloat(num);
              if (isNaN(n)) return num;
              // Only add commas if >= 1000
              if (Math.abs(n) >= 1000) {
                return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
              }
              return String(num);
            };

            // Helper to get ranking for a stat
            // Only show rankings in "career" tab (not in "vs-team" since those are team-specific stats)
            const getRank = (role, metricKey, value) => {
              // Hide rankings if we're in vs-team tab
              if (tab !== 'career') return null;
              
              const playerId = selectedPlayerInfo?.player_id;
              if (!ranksData || !playerId || value == null || value === '—') return null;
              
              // Map role to ranks data
              let ranksList = null;
              if (role === 'qb') ranksList = ranksData.qb;
              else if (role === 'rb') ranksList = ranksData.rb;
              else if (role === 'wr_te') ranksList = ranksData.wr_te;
              else if (role === 'def') ranksList = ranksData.def;
              else if (role === 'kick') ranksList = ranksData.kick;
              
              if (!ranksList || !Array.isArray(ranksList) || ranksList.length === 0) return null;
              
              // Sort by metric descending (higher is better)
              const sorted = [...ranksList].sort((a, b) => {
                const aVal = a[metricKey] ?? -Infinity;
                const bVal = b[metricKey] ?? -Infinity;
                return bVal - aVal;
              });
              
              // Find rank (1-based) - normalize player_id comparison
              const normalizedPlayerId = String(playerId);
              const rank = sorted.findIndex(p => String(p.player_id) === normalizedPlayerId);
              return rank >= 0 ? `${rank + 1}.º` : null;
            };

            // Check if there's any data at all
            const hasAnyData = playerData.aggregate?.qb || playerData.aggregate?.rb || playerData.aggregate?.wr_te || playerData.aggregate?.def || playerData.aggregate?.kick;
            
            if (!hasAnyData) {
              return (
                <div className="mt-6 text-center py-12">
                  <p className="text-base text-zinc-600">
                    Tu búsqueda no trajo resultados, selecciona otro jugador o cambia el/los filtro/s.
                  </p>
                </div>
              );
            }

            // Determine primary position to order cards
            const primaryPosition = selectedPlayerInfo?.position || '';
            const isQBPrimary = primaryPosition === 'QB';
            const isRBPrimary = primaryPosition === 'RB' || primaryPosition === 'FB';
            const isWRTEPrimary = primaryPosition === 'WR' || primaryPosition === 'TE';

            // Define card components
            const PassingCard = playerData.aggregate?.qb ? (
              <div key="passing" className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4 mb-3">
                <div className="text-center text-sm md:text-base font-extrabold text-zinc-900 mb-2">Pase</div>
                <div>
                  <div className="grid grid-cols-4 gap-2 md:gap-3">
                    {[
                      { k: 'YDS PASE/P', v: playerData.aggregate.qb.yards_per_game?.toFixed(1) ?? '—', metric: 'yards_per_game' },
                      { k: 'YDS TOT', v: formatNumber(playerData.aggregate.qb.yards_total), metric: 'yards_total' },
                      { k: 'PASES/P', v: playerData.aggregate.qb.attempts_per_game?.toFixed(1) ?? '—', metric: 'attempts_per_game' },
                      { k: 'COMP/P', v: playerData.aggregate.qb.completions_per_game?.toFixed(1) ?? '—', metric: 'completions_per_game' },
                      { k: 'YDS/INT', v: playerData.aggregate.qb.yards_per_attempt?.toFixed(1) ?? '—', metric: 'yards_per_attempt' },
                      { k: 'TD', v: formatNumber(playerData.aggregate.qb.td_total), metric: 'td_total' },
                      { k: 'TD/P', v: playerData.aggregate.qb.td_per_game?.toFixed(2) ?? '—', metric: 'td_per_game' },
                      { k: 'INT', v: formatNumber(playerData.aggregate.qb.interceptions), metric: 'interceptions' },
                      { k: 'CAPT/P', v: playerData.aggregate.qb.sacks_per_game?.toFixed(2) ?? '—', metric: 'sacks_per_game' },
                      { k: 'YDS/CAPT', v: playerData.aggregate.qb.yards_per_sack?.toFixed(1) ?? '—', metric: 'yards_per_sack' },
                    ].map((it) => {
                      const rank = it.metric ? getRank('qb', it.metric, it.v) : null;
                      return (
                        <div key={it.k} className="text-center px-2 py-2">
                          <div className="text-[10px] md:text-xs text-zinc-500 mb-1 uppercase tracking-wide font-semibold">{it.k}</div>
                          <div className="text-lg md:text-2xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                          {rank && <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{rank}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null;

            const RushingCard = playerData.aggregate?.rb ? (
              <div key="rushing" className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4 mb-3">
                <div className="text-center text-sm md:text-base font-extrabold text-zinc-900 mb-2">Carrera</div>
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  {[
                    { k: 'YDS CARR/P', v: playerData.aggregate.rb.yards_per_game?.toFixed(1) ?? '—', metric: 'yards_per_game' },
                    { k: 'YDS TOT', v: formatNumber(playerData.aggregate.rb.yards_total), metric: 'yards_total' },
                    { k: 'TD', v: formatNumber(playerData.aggregate.rb.td_total), metric: 'td_total' },
                    { k: 'ACAR/P', v: playerData.aggregate.rb.attempts_per_game?.toFixed(1) ?? '—', metric: 'attempts_per_game' },
                    { k: 'YDS/ACAR', v: playerData.aggregate.rb.yards_per_carry?.toFixed(2) ?? '—', metric: 'yards_per_carry' },
                  ].map((it) => {
                    const rank = it.metric ? getRank('rb', it.metric, it.v) : null;
                    return (
                      <div key={it.k} className="text-center px-2 py-2">
                        <div className="text-[10px] md:text-xs text-zinc-500 mb-1 uppercase tracking-wide font-semibold">{it.k}</div>
                        <div className="text-lg md:text-2xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                        {rank && <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{rank}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null;

            const ReceivingCard = (playerData.aggregate?.wr_te && !isQB) ? (
              <div key="receiving" className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4 mb-3">
                <div className="text-center text-sm md:text-base font-extrabold text-zinc-900 mb-2">Recepción</div>
                <div>
                  <div className="grid grid-cols-4 gap-2 md:gap-3">
                    {[
                      { k: 'YDS RECEP/P', v: playerData.aggregate.wr_te.yards_per_game?.toFixed(1) ?? '—', metric: 'yards_per_game' },
                      { k: 'YDS TOT', v: formatNumber(playerData.aggregate.wr_te.yards_total), metric: 'yards_total' },
                      { k: 'TD', v: formatNumber(playerData.aggregate.wr_te.td_total), metric: 'td_total' },
                      { k: 'TGTS/P', v: playerData.aggregate.wr_te.targets_per_game?.toFixed(1) ?? '—', metric: 'targets_per_game' },
                      { k: 'RECEPs/P', v: playerData.aggregate.wr_te.receptions_per_game?.toFixed(1) ?? '—', metric: 'receptions_per_game' },
                      { k: 'YDS/RECEP', v: playerData.aggregate.wr_te.yards_per_reception?.toFixed(1) ?? '—', metric: 'yards_per_reception' },
                      { k: 'YDS/TGT', v: playerData.aggregate.wr_te.yards_per_target?.toFixed(1) ?? '—', metric: 'yards_per_target' },
                    ].map((it) => {
                      const rank = it.metric ? getRank('wr_te', it.metric, it.v) : null;
                      return (
                        <div key={it.k} className="text-center px-2 py-2">
                          <div className="text-[10px] md:text-xs text-zinc-500 mb-1 uppercase tracking-wide font-semibold">{it.k}</div>
                          <div className="text-lg md:text-2xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                          {rank && <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{rank}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null;

            const DefenseCard = playerData.aggregate?.def ? (
              <div key="defense" className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4 mb-3">
                <div className="text-center text-sm md:text-base font-extrabold text-zinc-900 mb-2">Defensa</div>
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  {[
                    { k: 'TACLEADAS TOT', v: formatNumber(playerData.aggregate.def.tackles_total), metric: 'tackles_total' },
                    { k: 'TACL SOLO/P', v: playerData.aggregate.def.tackles_solo_per_game?.toFixed(1) ?? '—', metric: 'tackles_solo_per_game' },
                    { k: 'DERRIBOS/P', v: playerData.aggregate.def.tfl_per_game?.toFixed(1) ?? '—', metric: 'tfl_per_game' },
                    { k: 'GOLPES QB/P', v: playerData.aggregate.def.qb_hits_per_game?.toFixed(1) ?? '—', metric: 'qb_hits_per_game' },
                    { k: 'CAPTURAS TOT', v: formatNumber(playerData.aggregate.def.sacks_total), metric: 'sacks_total' },
                    { k: 'CAPTURAS/P', v: playerData.aggregate.def.sacks_per_game?.toFixed(1) ?? '—', metric: 'sacks_per_game' },
                    { k: 'YDS/CAPT', v: playerData.aggregate.def.yards_per_sack?.toFixed(1) ?? '—', metric: 'yards_per_sack' },
                    { k: 'INTS TOT', v: formatNumber(playerData.aggregate.def.interceptions_total), metric: 'interceptions_total' },
                    { k: 'INTS/P', v: playerData.aggregate.def.interceptions_per_game?.toFixed(1) ?? '—', metric: 'interceptions_per_game' },
                    { k: 'TD DEF', v: formatNumber(playerData.aggregate.def.def_td), metric: 'def_td' },
                    { k: 'FUMB REC', v: formatNumber(playerData.aggregate.def.fumbles_recovered), metric: 'fumbles_recovered' },
                    { k: 'PASES DEF', v: formatNumber(playerData.aggregate.def.pass_defended), metric: 'pass_defended' },
                  ].map((it) => {
                    const rank = it.metric ? getRank('def', it.metric, it.v) : null;
                    return (
                      <div key={it.k} className="text-center px-2 py-2">
                        <div className="text-[10px] md:text-xs text-zinc-500 mb-1 uppercase tracking-wide font-semibold">{it.k}</div>
                        <div className="text-lg md:text-2xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                        {rank && <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{rank}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null;

            const KickingCard = playerData.aggregate?.kick ? (
              <div key="kicking" className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-3 md:p-4 mb-3">
                <div className="text-center text-sm md:text-base font-extrabold text-zinc-900 mb-2">Patadas</div>
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  {[
                    { k: '% GC', v: playerData.aggregate.kick.fg_pct ? `${playerData.aggregate.kick.fg_pct}%` : '—', metric: 'fg_pct' },
                    { k: '% PTO. EX.', v: playerData.aggregate.kick.pat_pct ? `${playerData.aggregate.kick.pat_pct}%` : '—', metric: 'pat_pct' },
                    { k: 'GC +LARGO', v: formatNumber(playerData.aggregate.kick.fg_long), metric: null },
                    { k: '30-39 YDS', v: formatNumber(playerData.aggregate.kick.fg_made_30_39), metric: 'fg_30_39' },
                    { k: '40-49 YDS', v: formatNumber(playerData.aggregate.kick.fg_made_40_49), metric: 'fg_40_49' },
                    { k: '50+ YDS', v: formatNumber(playerData.aggregate.kick.fg_made_50_plus), metric: 'fg_50_plus' },
                  ].map((it) => {
                    const rank = it.metric ? getRank('kick', it.metric, it.v) : null;
                    return (
                      <div key={it.k} className="text-center px-2 py-2">
                        <div className="text-[10px] md:text-xs text-zinc-500 mb-1 uppercase tracking-wide font-semibold">{it.k}</div>
                        <div className="text-lg md:text-2xl font-extrabold text-zinc-900 leading-none">{it.v}</div>
                        {rank && <div className="text-[10px] md:text-xs font-semibold text-sky-600 mt-0.5">{rank}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null;

            // Order cards based on primary position
            const isDefPrimary = ['LB', 'OLB', 'ILB', 'MLB', 'CB', 'S', 'SS', 'FS', 'DB', 'DE', 'DT', 'NT', 'DL'].includes(primaryPosition);
            const isKickerPrimary = ['K', 'PK'].includes(primaryPosition);
            
            const orderedCards = [];
            if (isKickerPrimary) {
              // K: Patadas primero
              if (KickingCard) orderedCards.push(KickingCard);
            } else if (isDefPrimary) {
              // DEF: Defensa primero
              if (DefenseCard) orderedCards.push(DefenseCard);
              if (RushingCard) orderedCards.push(RushingCard);
              if (ReceivingCard) orderedCards.push(ReceivingCard);
              if (PassingCard) orderedCards.push(PassingCard);
            } else if (isQBPrimary) {
              // QB: Pase primero
              if (PassingCard) orderedCards.push(PassingCard);
              if (RushingCard) orderedCards.push(RushingCard);
              if (ReceivingCard) orderedCards.push(ReceivingCard);
              if (DefenseCard) orderedCards.push(DefenseCard);
            } else if (isRBPrimary) {
              // RB: Carrera primero
              if (RushingCard) orderedCards.push(RushingCard);
              if (ReceivingCard) orderedCards.push(ReceivingCard);
              if (PassingCard) orderedCards.push(PassingCard);
              if (DefenseCard) orderedCards.push(DefenseCard);
            } else if (isWRTEPrimary) {
              // WR/TE: Recepción primero
              if (ReceivingCard) orderedCards.push(ReceivingCard);
              if (RushingCard) orderedCards.push(RushingCard);
              if (PassingCard) orderedCards.push(PassingCard);
              if (DefenseCard) orderedCards.push(DefenseCard);
            } else {
              // Default order (if position is unknown)
              if (PassingCard) orderedCards.push(PassingCard);
              if (RushingCard) orderedCards.push(RushingCard);
              if (ReceivingCard) orderedCards.push(ReceivingCard);
              if (DefenseCard) orderedCards.push(DefenseCard);
              if (KickingCard) orderedCards.push(KickingCard);
            }

            return <>{orderedCards}</>;
          })()}

        {/* Empty state */}
        {!loading && !error && !selectedPlayer && (
          <div className="text-center py-12 text-zinc-500">
            <svg className="w-16 h-16 mx-auto mb-3 text-zinc-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <p className="text-sm md:text-base font-semibold">
              Busca un jugador para ver sus estadísticas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

