/**
 * Format an NFL season year to display format (e.g., 2024 -> "2024/25")
 * NFL seasons span two calendar years: 2024 season runs from Sept 2024 to Feb 2025
 * 
 * @param {number} year - The season year (e.g., 2024)
 * @returns {string} - Formatted season (e.g., "2024/25")
 */
export const formatNFLSeason = (year) => {
  const y = parseInt(year);
  if (isNaN(y)) return String(year);
  
  const nextYear = y + 1;
  
  return `${y}/${String(nextYear).slice(-2)}`;
};

/**
 * Parse a season display string back to year (e.g., "2024/25" -> 2024)
 * 
 * @param {string} seasonDisplay - Formatted season (e.g., "2024/25")
 * @returns {number|null} - Season year or null if invalid
 */
export const parseNFLSeason = (seasonDisplay) => {
  const match = String(seasonDisplay).match(/(\d{4})\/(\d{2})/);
  if (!match) return null;
  
  const [, startYear] = match;
  return parseInt(startYear);
};

/**
 * Format a date for NFL context (e.g., game dates, etc.)
 * 
 * @param {Date|string} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date
 */
export const formatNFLDate = (date, options = {}) => {
  const d = date instanceof Date ? date : new Date(date);
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  return d.toLocaleDateString('es-MX', defaultOptions);
};

