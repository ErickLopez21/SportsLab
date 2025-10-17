export function getLeagueLogo(league) {
  const key = String(league || '').toLowerCase();
  return `/logos/leagues/${key}.svg`;
}

export function getTeamLogo(league, abbr) {
  const l = String(league || '').toLowerCase();
  let a = String(abbr || '').toUpperCase();
  
  // Handle team abbreviation aliases
  if (a === 'LAR') a = 'LA'; // Los Angeles Rams logo is saved as LA.svg
  
  return `/logos/${l}/${a}.svg`;
}


