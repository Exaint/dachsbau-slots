/**
 * Configuration Constants - Core settings and limits
 * @version 1.3
 *
 * Sections:
 * 1. KV Storage Constants
 * 2. Time Constants
 * 3. Balance & Transfer Limits
 * 4. Core Game Settings
 * 5. Bank Settings
 * 6. TTL Constants
 * 7. Leaderboard Settings
 * 8. Duel Settings
 * 9. Validation Settings
 * 10. Retry Settings
 * 11. Feature Flags
 * 12. URLs
 */

// ===========================================
// 1. KV Storage Constants
// ===========================================

// KV String Booleans (KV stores strings, not booleans)
export const KV_TRUE = 'true';
export const KV_ACTIVE = 'active';
export const KV_ACCEPTED = 'accepted';

// KV Key Prefixes (centralized for easy refactoring)
export const KV_PREFIX = {
  USER: 'user:',
  BUFF: 'buff:',
  BOOST: 'boost:',
  DAILY: 'daily:',
  COOLDOWN: 'cooldown:',
  DISCLAIMER: 'disclaimer:',
  SELFBAN: 'selfban:',
  BLACKLIST: 'blacklist:',
  FROZEN: 'frozen:',
  STATS: 'stats:',
  STREAK: 'streak:',
  RANK: 'rank:',
  UNLOCK: 'unlock:',
  MONTHLY_LOGIN: 'monthly_login:',
  FREE_SPINS: 'freespins:',
  GUARANTEED_PAIR: 'guaranteedpair:',
  WILD_CARD: 'wildcard:',
  INSURANCE: 'insurance:',
  WIN_MULTI: 'winmulti:',
  BUNDLE_PURCHASES: 'bundle_purchases:',
  DACHS_BOOST_PURCHASES: 'dachsboost_purchases:',
  PEEK: 'peek:',
  JACKPOT: 'jackpot:',
  LEADERBOARD_BLOCKED: 'lb_blocked:',
  DUEL: 'duel:',
  DUEL_OPTOUT: 'duel_optout:'
};

// ===========================================
// 2. Time Constants
// ===========================================

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86400;
export const MS_PER_MINUTE = 60000;
export const MS_PER_HOUR = 3600000;

// ===========================================
// 3. Balance & Transfer Limits
// ===========================================

export const STARTING_BALANCE = 100;
export const MAX_BALANCE = 999999999;
export const MIN_TRANSFER = 1;
export const MAX_TRANSFER = 100000;

// ===========================================
// 4. Core Game Settings
// ===========================================

export const GRID_SIZE = 3;
export const BASE_SPIN_COST = 10;
export const COOLDOWN_SECONDS = 30;
export const FREE_SPIN_COST_THRESHOLD = 1000;
export const JACKPOT_LUCKY_SECOND_DIVISOR = 60;

// ===========================================
// 5. Bank Settings
// ===========================================

export const BANK_USERNAME = 'dachsbank';
export const BANK_START_BALANCE = 444444;
export const BANK_KEY = `user:${BANK_USERNAME}`;

// ===========================================
// 5b. Twitch Channel Settings
// ===========================================

export const BROADCASTER_LOGIN = 'frechhdachs';

// ===========================================
// 6. TTL Constants (in seconds)
// ===========================================

export const BUFF_TTL_BUFFER_SECONDS = 60;
export const COOLDOWN_TTL_SECONDS = 60;
export const PEEK_TTL_SECONDS = SECONDS_PER_HOUR;
export const JACKPOT_CLAIM_TTL = SECONDS_PER_HOUR;
export const DAILY_TTL_SECONDS = SECONDS_PER_DAY + SECONDS_PER_HOUR;
export const STREAK_TTL_SECONDS = SECONDS_PER_DAY * 7;
export const LEADERBOARD_CACHE_TTL = 300;

// ===========================================
// 7. Leaderboard Settings
// ===========================================

export const LEADERBOARD_LIMIT = 1000;
export const LEADERBOARD_BATCH_SIZE = 50;
export const LEADERBOARD_MIN_USERS = 100;

// ===========================================
// 8. Duel Settings
// ===========================================

export const DUEL_MIN_AMOUNT = 100;
export const DUEL_TIMEOUT_SECONDS = 60;
export const DUEL_COOLDOWN_SECONDS = 30;

// ===========================================
// 9. Validation Settings
// ===========================================

export const USERNAME_MIN_LENGTH = 1;
export const USERNAME_MAX_LENGTH = 25;

// ===========================================
// 10. Retry Settings
// ===========================================

export const MAX_RETRIES = 3;
export const EXPONENTIAL_BACKOFF_BASE_MS = 10;

// ===========================================
// 11. Feature Flags & Debug
// ===========================================

export const DEBUG_MODE = false;
export const DEBUG_DACHS_PAIR_CHANCE = 0.75;

// ===========================================
// 12. HTTP & URLs
// ===========================================

export const RESPONSE_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8' };

export const URLS = {
  INFO: 'https://git.new/DachsbauSlotInfos',
  SHOP: 'https://git.new/DachsbauSlotsShop',
  UNLOCK: 'https://dub.sh/SlotUnlock',
  WEBSITE: 'https://dachsbau-slots.exaint.workers.dev'
};
