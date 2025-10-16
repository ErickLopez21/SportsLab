// Minimal NFL team city mapping for display purposes

const TEAM_CITY = {
  // AFC East
  BUF: 'Buffalo, NY', MIA: 'Miami, FL', NE: 'Foxborough, MA', NYJ: 'East Rutherford, NJ',
  // AFC North
  BAL: 'Baltimore, MD', CIN: 'Cincinnati, OH', CLE: 'Cleveland, OH', PIT: 'Pittsburgh, PA',
  // AFC South
  HOU: 'Houston, TX', IND: 'Indianapolis, IN', JAX: 'Jacksonville, FL', TEN: 'Nashville, TN',
  // AFC West
  DEN: 'Denver, CO', KC: 'Kansas City, MO', LV: 'Las Vegas, NV', LAC: 'Inglewood, CA',
  // NFC East
  DAL: 'Arlington, TX', NYG: 'East Rutherford, NJ', PHI: 'Philadelphia, PA', WAS: 'Landover, MD',
  // NFC North
  CHI: 'Chicago, IL', DET: 'Detroit, MI', GB: 'Green Bay, WI', MIN: 'Minneapolis, MN',
  // NFC South
  ATL: 'Atlanta, GA', CAR: 'Charlotte, NC', NO: 'New Orleans, LA', TB: 'Tampa, FL',
  // NFC West
  ARI: 'Glendale, AZ', LAR: 'Inglewood, CA', SF: 'Santa Clara, CA', SEA: 'Seattle, WA',
};

export function getTeamCity(teamAbbr) {
  if (!teamAbbr) return '';
  return TEAM_CITY[String(teamAbbr).toUpperCase()] || '';
}

const TEAM_NAME = {
  BUF: 'Bills', MIA: 'Dolphins', NE: 'Patriots', NYJ: 'Jets',
  BAL: 'Ravens', CIN: 'Bengals', CLE: 'Browns', PIT: 'Steelers',
  HOU: 'Texans', IND: 'Colts', JAX: 'Jaguars', TEN: 'Titans',
  DEN: 'Broncos', KC: 'Chiefs', LV: 'Raiders', LAC: 'Chargers',
  DAL: 'Cowboys', NYG: 'Giants', PHI: 'Eagles', WAS: 'Commanders',
  CHI: 'Bears', DET: 'Lions', GB: 'Packers', MIN: 'Vikings',
  ATL: 'Falcons', CAR: 'Panthers', NO: 'Saints', TB: 'Buccaneers',
  ARI: 'Cardinals', LAR: 'Rams', SF: '49ers', SEA: 'Seahawks',
};

export function getTeamNickname(abbr) {
  if (!abbr) return '';
  return TEAM_NAME[String(abbr).toUpperCase()] || abbr;
}

// Primary brand colors per NFL team (approximate)
const TEAM_PRIMARY_COLOR = {
  ARI: '#97233F', ATL: '#A71930', BAL: '#241773', BUF: '#00338D',
  CAR: '#000000', CHI: '#C83803', CIN: '#FB4F14', CLE: '#FF3C00',
  DAL: '#002244', DEN: '#FB4F14', DET: '#0076B6', GB: '#FFB612',
  HOU: '#03202F', IND: '#002C5F', JAX: '#9F792C', KC: '#FFFFFE',
  LAC: '#FFC20E', LAR: '#FFD100', LV: '#0A0A09', MIA: '#008E97',
  MIN: '#FFC62F', NE: '#002244', NO: '#D3BC8D', NYG: '#A71930',
  NYJ: '#115740', PHI: '#A5ACAF', PIT: '#FFFFFE', SEA: '#A5ACAF',
  SF: '#AA0000', TB: '#A71930', TEN: '#4B92DB', WAS: '#5A1414',
};

export function getTeamPrimaryColor(abbr) {
  if (!abbr) return '#0ea5e9';
  return TEAM_PRIMARY_COLOR[String(abbr).toUpperCase()] || '#0ea5e9';
}

export function getTeamFullName(abbr) {
  const cityFull = getTeamCity(abbr);
  const city = cityFull ? cityFull.split(',')[0] : '';
  const nick = getTeamNickname(abbr);
  return [city, nick].filter(Boolean).join(' ');
}


