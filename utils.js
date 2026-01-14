import { CUMULATIVE_WEIGHTS, TOTAL_WEIGHT, BUFF_TTL_BUFFER_SECONDS, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, EXPONENTIAL_BACKOFF_BASE_MS, MS_PER_HOUR, MS_PER_MINUTE, RESPONSE_HEADERS, MAX_RETRIES } from './constants.js';
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
// OPTIMIZED: ADMINS is now a Set, uses .has() for O(1) lookup
function isAdmin(username) {
  return ADMINS.has(username.toLowerCase());
}

function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const clean = username.trim().toLowerCase().replace(USERNAME_SANITIZE_REGEX, '');
  if (clean.length < USERNAME_MIN_LENGTH || clean.length > USERNAME_MAX_LENGTH) return null;
  return clean;
}

// Helper: Validate and clean target username for admin commands
function validateAndCleanTarget(target) {
  if (!target) return { error: 'missing', cleanTarget: null };
  const cleanTarget = sanitizeUsername(target.replace('@', ''));
  if (!cleanTarget) return { error: 'invalid', cleanTarget: null };
  return { error: null, cleanTarget };
}

// Helper: Combined admin check with target validation (reduces boilerplate in admin commands)
function requireAdminWithTarget(username, target, usageHint = '') {
  if (!isAdmin(username)) {
    return { valid: false, response: createErrorResponse(username, 'Du hast keine Berechtigung für diesen Command!') };
  }
  const { error, cleanTarget } = validateAndCleanTarget(target);
  if (error === 'missing') {
    return { valid: false, response: createErrorResponse(username, usageHint || 'Target fehlt!') };
  }
  if (error === 'invalid') {
    return { valid: false, response: createErrorResponse(username, 'Ungültiger Username!') };
  }
  return { valid: true, cleanTarget };
}

// Helper: Safe JSON parse with fallback
function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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

// Calculate week start (Monday) in German timezone - always fresh
function calculateWeekStart() {
  // Use Intl.DateTimeFormat for reliable timezone handling
  const { year, month, day } = getGermanDateParts();
  const germanDate = new Date(`${year}-${month}-${day}T12:00:00`);
  const dayOfWeek = germanDate.getDay();
  const daysToMonday = (dayOfWeek + 6) % 7;

  // Get Monday's date
  const monday = new Date(germanDate);
  monday.setDate(germanDate.getDate() - daysToMonday);

  const mondayYear = monday.getFullYear();
  const mondayMonth = String(monday.getMonth() + 1).padStart(2, '0');
  const mondayDay = String(monday.getDate()).padStart(2, '0');
  return `${mondayYear}-${mondayMonth}-${mondayDay}`;
}

// OPTIMIZED: Cache for getWeekStart (recalculated every 60 seconds max)
let weekStartCache = { value: null, expires: 0 };

function getWeekStart() {
  const now = Date.now();
  if (weekStartCache.value && now < weekStartCache.expires) {
    return weekStartCache.value;
  }

  const result = calculateWeekStart();

  // Cache for 60 seconds
  weekStartCache = { value: result, expires: now + 60000 };
  return result;
}

// OPTIMIZED: Static Set for O(1) lookup instead of Array.includes()
const LEADERBOARD_BLOCKLIST = new Set(['dachsbank']);

function isLeaderboardBlocked(username) {
  return LEADERBOARD_BLOCKLIST.has(username.toLowerCase());
}

// OPTIMIZED: Helper function to calculate TTL for buffs (avoids repeated inline calculation)
function calculateBuffTTL(expireAt, minTTL = BUFF_TTL_BUFFER_SECONDS) {
  return Math.max(minTTL, Math.floor((expireAt - Date.now()) / 1000) + BUFF_TTL_BUFFER_SECONDS);
}

// OPTIMIZED: Helper for exponential backoff delay (avoids code duplication)
function exponentialBackoff(attempt, baseMs = EXPONENTIAL_BACKOFF_BASE_MS) {
  return new Promise(resolve => setTimeout(resolve, baseMs * Math.pow(2, attempt)));
}

/**
 * Generic atomic KV operation with retry mechanism
 * @param {Object} env - Cloudflare environment with SLOTS_KV
 * @param {string} key - KV key to operate on
 * @param {Function} operation - async (currentValue) => { newValue, result }
 *   - currentValue: current KV value (string or null)
 *   - returns: { newValue: string|null (null to delete), result: any (returned on success) }
 * @param {Function} verify - async (expectedValue) => boolean - verification function
 * @param {number} maxRetries - max retry attempts
 * @returns {Promise<{success: boolean, result: any}>}
 */
async function atomicKvUpdate(env, key, operation, verify, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const currentValue = await env.SLOTS_KV.get(key);
      const { newValue, result, options } = await operation(currentValue);

      if (newValue === null) {
        await env.SLOTS_KV.delete(key);
      } else {
        await env.SLOTS_KV.put(key, newValue, options || {});
      }

      if (await verify(newValue)) {
        return { success: true, result };
      }

      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        return { success: false, result: null, error };
      }
    }
  }
  return { success: false, result: null };
}

// Format remaining time in hours and minutes
function formatTimeRemaining(ms) {
  const hours = Math.floor(ms / MS_PER_HOUR);
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Structured error logging with context
function logError(context, error, extra = {}) {
  const logEntry = {
    context,
    message: error?.message || String(error),
    timestamp: new Date().toISOString(),
    ...extra
  };
  console.error(JSON.stringify(logEntry));
}

// Create standardized error response (uses RESPONSE_HEADERS by default)
function createErrorResponse(username, message) {
  return new Response(`@${username} ❌ ${message}`, { headers: RESPONSE_HEADERS });
}

// Create standardized success response
function createSuccessResponse(username, message) {
  return new Response(`@${username} ✅ ${message}`, { headers: RESPONSE_HEADERS });
}

// Create standardized info response
function createInfoResponse(username, message) {
  return new Response(`@${username} ℹ️ ${message}`, { headers: RESPONSE_HEADERS });
}

export {
  secureRandom,
  secureRandomInt,
  getWeightedSymbol,
  isAdmin,
  sanitizeUsername,
  validateAndCleanTarget,
  requireAdminWithTarget,
  safeJsonParse,
  validateAmount,
  getCurrentMonth,
  getCurrentDate,
  getWeekStart,
  calculateWeekStart,
  isLeaderboardBlocked,
  calculateBuffTTL,
  exponentialBackoff,
  formatTimeRemaining,
  logError,
  createErrorResponse,
  createSuccessResponse,
  createInfoResponse,
  atomicKvUpdate
};
