export function getLeagueLogo(league) {
  const key = String(league || '').toLowerCase();
  return `/logos/leagues/${key}.svg`;
}

export function getTeamLogo(league, abbr) {
  const l = String(league || '').toLowerCase();
  const a = String(abbr || '').toUpperCase();
  return `/logos/${l}/${a}.svg`;
}


