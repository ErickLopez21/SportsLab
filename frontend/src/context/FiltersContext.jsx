import React, { createContext, useContext, useMemo, useState } from 'react';

const FiltersContext = createContext(null);

export function FiltersProvider({ children }) {
  const today = new Date();
  const last7 = new Date(today);
  last7.setDate(today.getDate() - 7);

  const [filters, setFilters] = useState({
    league: 'NFL',
    season: today.getFullYear(),
    start: last7.toISOString().slice(0, 10),
    end: today.toISOString().slice(0, 10),
    teamA: '',
    teamB: '',
    player: ''
  });

  const value = useMemo(() => ({ filters, setFilters }), [filters]);
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}


