import { api } from './client';

export const getNbaTeams = async () => {
  const { data } = await api.get('/api/nba/teams');
  return data;
};


