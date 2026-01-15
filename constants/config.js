/**
 * Configuration Constants - Core settings and limits
 * @version 1.1
 */

export const RESPONSE_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8' };

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
  LEADERBOARD_BLOCKED: 'lb_blocked:'
};

// Time Constants
export const MS_PER_HOUR = 3600000;
export const MS_PER_MINUTE = 60000;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86400;

// Balance Limits
export const MAX_BALANCE = 999999999;
export const MIN_TRANSFER = 1;
export const MAX_TRANSFER = 100000;
export const STARTING_BALANCE = 100;

// Core Game Settings
export const COOLDOWN_SECONDS = 30;
export const BASE_SPIN_COST = 10;
export const GRID_SIZE = 3;

// Bank Settings
export const BANK_USERNAME = 'dachsbank';
export const BANK_START_BALANCE = 444444;
export const BANK_KEY = `user:${BANK_USERNAME}`;

// TTL Constants (in seconds)
export const LEADERBOARD_CACHE_TTL = 300; // 5 minutes
export const DAILY_TTL_SECONDS = SECONDS_PER_DAY + SECONDS_PER_HOUR; // 25 hours
export const PEEK_TTL_SECONDS = SECONDS_PER_HOUR; // 1 hour
export const JACKPOT_CLAIM_TTL = SECONDS_PER_HOUR; // 1 hour
export const BUFF_TTL_BUFFER_SECONDS = 60;
export const STREAK_TTL_SECONDS = SECONDS_PER_DAY * 7; // 7 days
export const COOLDOWN_TTL_SECONDS = 60; // 2x cooldown time for safety margin

// Debug Mode
export const DEBUG_MODE = false;
export const DEBUG_DACHS_PAIR_CHANCE = 0.75;

// Leaderboard Settings
export const LEADERBOARD_LIMIT = 500; // Max users to fetch
export const LEADERBOARD_BATCH_SIZE = 50; // KV reads per batch
export const LEADERBOARD_MIN_USERS = 100; // Early exit threshold

// Jackpot Settings
export const JACKPOT_LUCKY_SECOND_DIVISOR = 60; // Seconds in minute for lucky second calc

// Free Spin Settings
export const FREE_SPIN_COST_THRESHOLD = 1000; // Min cost for free spin bonus message

// Username Validation
export const USERNAME_MIN_LENGTH = 1;
export const USERNAME_MAX_LENGTH = 25;

// Retry Settings
export const MAX_RETRIES = 3;
export const EXPONENTIAL_BACKOFF_BASE_MS = 10;

// Time Helper
export const SECONDS_PER_MINUTE = 60;

// URLs
export const URLS = {
  INFO: 'https://git.new/DachsbauSlotInfos',
  SHOP: 'https://git.new/DachsbauSlotsShop',
  UNLOCK: 'https://dub.sh/SlotUnlock'
};
