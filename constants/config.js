/**
 * Configuration Constants - Core settings and limits
 */

export const RESPONSE_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8' };

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
export const STREAK_TTL_SECONDS = 604800; // 7 days

// Debug Mode
export const DEBUG_MODE = false;
export const DEBUG_DACHS_PAIR_CHANCE = 0.75;

// URLs
export const URLS = {
  INFO: 'https://git.new/DachsbauSlotInfos',
  SHOP: 'https://git.new/DachsbauSlotsShop',
  UNLOCK: 'https://dub.sh/SlotUnlock'
};
