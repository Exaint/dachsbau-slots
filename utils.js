import { CUMULATIVE_WEIGHTS, TOTAL_WEIGHT, RESPONSE_HEADERS, BUFF_TTL_BUFFER_SECONDS } from './constants.js';
import { ADMINS } from './config.js';

// OPTIMIZED: Cached DateTimeFormat instances (avoid recreation per request)
const GERMAN_DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// OPTIMIZED: Pre-compiled regex patterns (avoid recompilation per request)
const USERNAME_SANITIZE_REGEX = /[^a-z0-9_]/gi;

// OPTIMIZED: Response helper to reduce code duplication (~80+ usages)
function respond(message) {
  return new Response(message, { headers: RESPONSE_HEADERS });
}

// Cryptographically secure random number generator (0 to 1, like Math.random but secure)
function secureRandom() {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / (0xFFFFFFFF + 1);
}

// Secure random integer in range [min, max] (inclusive)
function secureRandomInt(min, max) {
  const range = max - min + 1;
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] % range) + min;
}

// OPTIMIZED: Function to get weighted random symbol using pre-computed cumulative weights
function getWeightedSymbol() {
  const rand = secureRandom() * TOTAL_WEIGHT;
  // Use pre-computed cumulative weights for faster lookup
  for (const { symbol, cumulative } of CUMULATIVE_WEIGHTS) {
    if (rand < cumulative) return symbol;
  }
  return '⭐'; // Fallback
}

// Helper function to check if user is admin (uses config.js)
function isAdmin(username) {
  const lowerUsername = username.toLowerCase();
  return ADMINS.includes(lowerUsername);
}

function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const clean = username.trim().toLowerCase().replace(USERNAME_SANITIZE_REGEX, '');
  if (clean.length < 1 || clean.length > 25) return null;
  return clean;
}

function validateAmount(amount, min = 1, max = 100000) {
  const parsed = parseInt(amount, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

// Helper to get date parts in German timezone (Europe/Berlin)
function getGermanDateParts() {
  const now = new Date();
  const parts = GERMAN_DATE_FORMATTER.formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return { year, month, day };
}

function getCurrentMonth() {
  const { year, month } = getGermanDateParts();
  return `${year}-${month}`;
}

function getCurrentDate() {
  const { year, month, day } = getGermanDateParts();
  return `${year}-${month}-${day}`;
}

function getWeekStart() {
  // Calculate days since Monday in German timezone
  const now = new Date();
  const germanDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const dayOfWeek = germanDate.getDay();
  const daysToMonday = (dayOfWeek + 6) % 7;

  // Get Monday's date
  const monday = new Date(germanDate);
  monday.setDate(germanDate.getDate() - daysToMonday);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isLeaderboardBlocked(username) {
  const leaderboardBlocklist = ['dachsbank'];
  return leaderboardBlocklist.includes(username.toLowerCase());
}

// OPTIMIZED: Helper function to calculate TTL for buffs (avoids repeated inline calculation)
function calculateBuffTTL(expireAt, minTTL = BUFF_TTL_BUFFER_SECONDS) {
  return Math.max(minTTL, Math.floor((expireAt - Date.now()) / 1000) + BUFF_TTL_BUFFER_SECONDS);
}

// OPTIMIZED: Helper for exponential backoff delay (avoids code duplication)
function exponentialBackoff(attempt, baseMs = 10) {
  return new Promise(resolve => setTimeout(resolve, baseMs * Math.pow(2, attempt)));
}

export {
  respond,
  secureRandom,
  secureRandomInt,
  getWeightedSymbol,
  isAdmin,
  sanitizeUsername,
  validateAmount,
  getCurrentMonth,
  getCurrentDate,
  getWeekStart,
  isLeaderboardBlocked,
  calculateBuffTTL,
  exponentialBackoff
};
