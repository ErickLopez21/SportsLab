import { api } from './client';

export const getTeams = async () => {
  const { data } = await api.get('/api/nfl/teams');
  return Array.isArray(data) ? data : (data && Array.isArray(data.teams) ? data.teams : []);
};

export const getPlayerVsTeam = async (player, team, seasons, gameTypes) => {
  const params = {};
  if (seasons) params.seasons = seasons;
  if (gameTypes) params.game_types = gameTypes;
  const { data } = await api.get(`/api/nfl/player/${encodeURIComponent(player)}/vs/${team}`, { params });
  return data;
};

export const getSchedule = async (start, end, season, week) => {
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;
  if (season) params.season = season;
  if (week) params.week = week;
  const { data } = await api.get('/api/nfl/schedule', { params });
  return data;
};

export const searchPlayers = async (q, limit = 20) => {
  const { data } = await api.get('/api/nfl/players/search', { params: { q, limit } });
  return data;
};

export const getPlayerRanks = async (season, gameTypes) => {
  const params = {};
  if (season) params.season = season;
  if (gameTypes) params.game_types = gameTypes;
  const { data } = await api.get('/api/nfl/players/ranks', { params });
  return data;
};

export const getPlayerCareer = async (player, seasons, gameTypes) => {
  const params = {};
  if (seasons) params.seasons = seasons;
  if (gameTypes) params.game_types = gameTypes;
  const { data } = await api.get(`/api/nfl/player/${encodeURIComponent(player)}/career`, { params });
  return data;
};

export const getTeamVsTeam = async (teamA, teamB, season) => {
  const { data } = await api.get(`/api/nfl/team/${teamA}/vs/${teamB}`, { params: season ? { season } : {} });
  return data;
};

export const resolveHeadshot = async (q, season) => {
  const { data } = await api.get('/api/nfl/players/headshot', { params: season ? { q, season } : { q } });
  return data;
};

export const getStandings = async (season) => {
  const { data } = await api.get('/api/nfl/standings', { params: season ? { season } : {} });
  return data;
};

export const getTeamOffense = async (team, season, gameTypes, extraParams) => {
  const params = {};
  if (season) params.season = season;
  if (gameTypes) params.game_types = gameTypes;
  if (extraParams && typeof extraParams === 'object') Object.assign(params, extraParams);
  const { data } = await api.get(`/api/nfl/team/${encodeURIComponent(team)}/offense`, { params });
  return data;
};

export const getLeagueOffenseRanks = async (season, gameTypes, extraParams) => {
  const params = {};
  if (season) params.season = season;
  if (gameTypes) params.game_types = gameTypes;
  if (extraParams && typeof extraParams === 'object') Object.assign(params, extraParams);
  const { data } = await api.get('/api/nfl/team/offense/ranks', { params });
  return data;
};

export const getTeamDefense = async (team, season, gameTypes, extraParams) => {
  const params = {};
  if (season) params.season = season;
  if (gameTypes) params.game_types = gameTypes;
  if (extraParams && typeof extraParams === 'object') Object.assign(params, extraParams);
  const { data } = await api.get(`/api/nfl/team/${encodeURIComponent(team)}/defense`, { params });
  return data;
};

export const getLeagueDefenseRanks = async (season, gameTypes, extraParams) => {
  const params = {};
  if (season) params.season = season;
  if (gameTypes) params.game_types = gameTypes;
  if (extraParams && typeof extraParams === 'object') Object.assign(params, extraParams);
  const { data } = await api.get('/api/nfl/team/defense/ranks', { params });
  return data;
};

export const getTeamSpecialTeams = async (team, season, gameTypes, extraParams) => {
  const params = {};
  if (season) params.season = season;
  if (gameTypes) params.game_types = gameTypes;
  if (extraParams && typeof extraParams === 'object') Object.assign(params, extraParams);
  const { data } = await api.get(`/api/nfl/team/${encodeURIComponent(team)}/st`, { params });
  return data;
};

export const getLeagueSpecialTeamsRanks = async (season, gameTypes, extraParams) => {
  const params = {};
  if (season) params.season = season;
  if (gameTypes) params.game_types = gameTypes;
  if (extraParams && typeof extraParams === 'object') Object.assign(params, extraParams);
  const { data } = await api.get('/api/nfl/team/st/ranks', { params });
  return data;
};

export const getTeamTrends = async (team, season, gameTypes, extraParams) => {
  const params = {};
  if (season) params.season = season;
  if (gameTypes) params.game_types = gameTypes;
  if (extraParams && typeof extraParams === 'object') Object.assign(params, extraParams);
  const { data } = await api.get(`/api/nfl/team/${encodeURIComponent(team)}/trends`, { params });
  return data;
};


// (dedup) getTeamDefense/getLeagueDefenseRanks defined above


