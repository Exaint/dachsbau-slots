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

// Helper function to get admin list as array (for display purposes)
function getAdminList() {
  return Array.from(ADMINS);
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

// Helper: Check admin permission (returns Response if not admin, null if admin)
function requireAdmin(username) {
  if (!isAdmin(username)) {
    return createErrorResponse(username, 'Du hast keine Berechtigung für diesen Command!');
  }
  return null;
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

// Helper to build KV keys with consistent lowercase username
function kvKey(prefix, username, ...parts) {
  const base = `${prefix}${username.toLowerCase()}`;
  return parts.length ? `${base}:${parts.join(':')}` : base;
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

// Get German date string from a timestamp (for comparing daily claims)
function getGermanDateFromTimestamp(timestamp) {
  const date = new Date(timestamp);
  const parts = GERMAN_DATE_FORMATTER.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

// Get milliseconds until next German midnight
function getMsUntilGermanMidnight() {
  const now = new Date();
  // Get current German time components
  const germanTimeFormatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const timeParts = germanTimeFormatter.formatToParts(now);
  const hours = parseInt(timeParts.find(p => p.type === 'hour').value, 10);
  const minutes = parseInt(timeParts.find(p => p.type === 'minute').value, 10);
  const seconds = parseInt(timeParts.find(p => p.type === 'second').value, 10);

  // Calculate remaining time until midnight (in ms)
  return ((23 - hours) * 3600 + (59 - minutes) * 60 + (60 - seconds)) * 1000;
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
const LEADERBOARD_BLOCKLIST = new Set([]);

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
    level: 'error',
    context,
    message: error?.message || String(error),
    timestamp: new Date().toISOString(),
    ...extra
  };
  console.error(JSON.stringify(logEntry));
}

function logWarn(context, message, extra = {}) {
  const logEntry = {
    level: 'warn',
    context,
    message,
    timestamp: new Date().toISOString(),
    ...extra
  };
  console.warn(JSON.stringify(logEntry));
}

function logInfo(context, message, extra = {}) {
  const logEntry = {
    level: 'info',
    context,
    message,
    timestamp: new Date().toISOString(),
    ...extra
  };
  console.log(JSON.stringify(logEntry));
}

// Audit log for admin actions
function logAudit(action, admin, target, extra = {}) {
  const logEntry = {
    level: 'audit',
    action,
    admin,
    target,
    timestamp: new Date().toISOString(),
    ...extra
  };
  console.log(JSON.stringify(logEntry));
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

// Profanity filter for custom messages
const PROFANITY_PATTERNS = [
  // Deutsche Schimpfwörter
  /h[u0ü]r[e3]ns[o0]hn/i,
  /w[i1]chs[e3]r/i,
  /f[o0]tz[e3]/i,
  /schl[a4]mp[e3]/i,
  /[a4]rschl[o0]ch/i,
  /m[i1]sstück/i,
  /m[i1]stst[uü]ck/i,
  /d[r]?ecks[a4]u/i,
  /dr[e3]cks?k[e3]rl/i,
  /sp[a4]st/i,
  /b[e3]h[i1]nd[e3]rt/i,
  /m[o0]ng[o0]/i,
  /v[o0]ll[i1]d[i1][o0]t/i,
  /schwuchtel/i,
  /n[u0]tt[e3]/i,
  /w[i1]x+[e3]r/i,
  /[a4]rsch/i,
  /depp/i,
  /trottel/i,
  /id[i1][o0]t/i,
  /d[u0]mm[e3]?r?/i,
  /bl[öo0]d/i,
  /kackn[o0]{2,}/i,
  /kackbr[a4]tze/i,
  /pisser/i,
  /wanker/i,
  /penner/i,
  /opfer/i,
  /missgeburt/i,
  /bastard/i,
  /dreckskerl/i,
  /h[u0]nds[o0]hn/i,
  /spacko/i,
  /assi/i,
  /abschaum/i,
  /krepier/i,
  /verrecke?/i,
  /fresse/i,
  /maul\s*halte?n/i,
  /halt.*maul/i,
  /halt.*fresse/i,
  /leck\s*m[i1]ch/i,
  /verpiss/i,
  /schei[sß]+/i,
  /kack[e3]/i,
  /wichse/i,
  /tussi/i,
  /flittchen/i,
  /luder/i,
  /miststück/i,
  /dumpfbacke/i,
  /volltrottel/i,
  /hohlbirne/i,
  /schwanzlutscher/i,
  /arschgeige/i,
  /arschkriecher/i,
  /hackfresse/i,
  /pissnelke/i,
  /rotzl[öo]ffel/i,
  /saftsack/i,
  /sackgesicht/i,
  /dreckschwein/i,
  /sau[bk]?e?r?l?/i,
  /schwein/i,
  /hurenbock/i,
  // Rassismus / Diskriminierung
  /n[i1]gg[e3a4]r?/i,
  /n[e3]g[e3]r/i,
  /k[a4]n[a4]k/i,
  /h[e3][i1]l\s*h[i1]tl[e3]r/i,
  /s[i1][e3]g\s*h[e3][i1]l/i,
  /n[a4]z[i1]/i,
  /zigeuner/i,
  /judens[a4]u/i,
  /judenschwein/i,
  /schlitzauge/i,
  /kameeltreiber/i,
  /kümmel/i,
  /kümmeltürke/i,
  /untermensch/i,
  /kameltreiber/i,
  /ausländer\s*raus/i,
  /88(?:\s|$)/,
  // Englische Schimpfwörter
  /f+[u0ü]+c+k+/i,
  /sh[i1]+t+/i,
  /b[i1]tch/i,
  /c[u0]nt/i,
  /d[i1]ck(?:head)?/i,
  /[a4]ssh[o0]l[e3]/i,
  /wh[o0]r[e3]/i,
  /r[e3]t[a4]rd/i,
  /f[a4]gg?[o0]t/i,
  /bastard/i,
  /moron/i,
  /idiot/i,
  /dumb[a4]ss/i,
  /motherf/i,
  /cock(?:suck)?/i,
  /puss[iy]/i,
  /slut/i,
  /twat/i,
  /wank[e3]r/i,
  /bollocks/i,
  /prick/i,
  /tosser/i,
  /bloody\s*hell/i,
  /stfu/i,
  /gtfo/i,
  /kys/i,
  // Sexuell explizit
  /p[o0]rn[o0]?/i,
  /t[i1]tt[e3]n/i,
  /schw[a4]nz/i,
  /fick/i,
  /v[ö0]g[e3]l[n]?/i,
  /blas[e3]n/i,
  /anal/i,
  /nutte/i,
  /hure/i,
  // Gewalt
  /umbringe?n/i,
  /vergew[a4]lt/i,
  /ermorden/i,
  /abstechen/i,
  /aufschlitz/i,
  /abknall/i,
  /totschlag/i,
  // Twitch / Internet-spezifisch
  /kys/i,
  /k[i1]ll\s*y[o0]urself/i,
  /neck\s*y[o0]urself/i,
  /unalive/i,
  /tr[a4]sh(?:kid)?/i,
  /cancer/i,
  /krebs/i,
  /aids/i,
  /incel/i,
  /simp/i,
  /virgin/i,
  /cuck/i,
  /get\s*r[a4]ped/i,
  /r[a4]pe/i,
  /pedo/i,
  /p[ä]do/i,
  /n[o0]life/i,
  /loser/i,
  /subhuman/i,
  /untermensch/i,
  /autist/i,
  /sperg/i,
  /downie/i,
  /tr[a4]nny/i,
  /shemale/i,
  // Türkisch
  /(?:^|[\s.,!?])pi[cç](?:lik)?(?:$|[\s.,!?])/i,
  /amina\s*koyim/i,
  /orospu/i,
  /siktir/i,
  /anan[iı]/i,
  /göt/i,
];

function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't');
  return PROFANITY_PATTERNS.some(pattern => pattern.test(normalized) || pattern.test(text));
}

// Rate-Limit Check via KV Counter mit TTL
async function checkRateLimit(identifier, limit, windowSeconds, env) {
  const key = `rl:${identifier}`;
  const count = parseInt(await env.SLOTS_KV.get(key) || '0', 10);
  if (count >= limit) return false;
  await env.SLOTS_KV.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return true;
}

export {
  secureRandom,
  secureRandomInt,
  getWeightedSymbol,
  isAdmin,
  getAdminList,
  sanitizeUsername,
  validateAndCleanTarget,
  requireAdmin,
  requireAdminWithTarget,
  safeJsonParse,
  validateAmount,
  kvKey,
  getCurrentMonth,
  getCurrentDate,
  getGermanDateFromTimestamp,
  getMsUntilGermanMidnight,
  getWeekStart,
  calculateWeekStart,
  isLeaderboardBlocked,
  calculateBuffTTL,
  exponentialBackoff,
  formatTimeRemaining,
  logError,
  logWarn,
  logInfo,
  logAudit,
  createErrorResponse,
  createSuccessResponse,
  createInfoResponse,
  atomicKvUpdate,
  checkRateLimit,
  containsProfanity
};
