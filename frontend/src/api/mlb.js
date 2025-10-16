import { api } from './client';

export const getMlbTeams = async () => {
  const { data } = await api.get('/api/mlb/teams');
  return data;
};


