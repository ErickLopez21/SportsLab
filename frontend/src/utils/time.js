// Utilities to handle time zone conversions without external deps

// Returns the time zone offset in minutes for a given IANA time zone at the provided UTC date
export function getTimeZoneOffsetMinutes(dateUtc, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = dtf.formatToParts(dateUtc);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  // Difference between the represented time in the target zone and the actual UTC instant
  return (asUTC - dateUtc.getTime()) / 60000; // minutes
}

// Parse a kickoff like "YYYY-MM-DD HH:MM ET" (or date only) as America/New_York wall time
// and return a Date in the user's local time zone (i.e., a UTC instant represented locally).
export function parseEtToLocalDate(kickoff) {
  if (!kickoff) return null;
  const s = String(kickoff).replace('ET', '').trim();
  const [datePart, timePartRaw] = s.split(/\s+/);
  if (!datePart) return null;
  const [y, m, d] = datePart.split('-').map((v) => Number(v));
  const [hh, mm] = (timePartRaw || '00:00').split(':').map((v) => Number(v));

  // Start from the same components interpreted as UTC
  const utcGuess = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  const offsetMin = getTimeZoneOffsetMinutes(new Date(utcGuess), 'America/New_York');
  // Adjust to the actual UTC instant for that ET wall time
  const correctedUtc = utcGuess - offsetMin * 60000;
  return new Date(correctedUtc);
}


