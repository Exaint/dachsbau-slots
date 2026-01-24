/**
 * Hourly Jackpot - Lucky second-based jackpot system
 * Standalone implementation (no bank dependency)
 */

import { JACKPOT_CLAIM_TTL } from '../constants.js';

// German timezone formatter for hourly jackpot
const GERMAN_TIME_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  day: '2-digit',
  month: '2-digit',
  hour12: false
});

/**
 * Check if a player hits the hourly jackpot (lucky second mechanism)
 * Each hour has one "lucky second" derived from the current date/hour.
 * The first player to spin during that second wins the jackpot.
 * @param {object} env - Cloudflare environment bindings
 * @returns {Promise<boolean>} Whether the jackpot was won
 */
async function checkAndClaimHourlyJackpot(env) {
  const now = new Date();
  const parts = GERMAN_TIME_FORMATTER.formatToParts(now);

  const currentSecond = parseInt(parts.find(p => p.type === 'second').value, 10);
  const currentHour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const currentDay = parseInt(parts.find(p => p.type === 'day').value, 10);
  const currentMonth = parseInt(parts.find(p => p.type === 'month').value, 10);

  const seed = currentDay * 100 + currentMonth * 10 + currentHour;
  const luckySecond = seed % 60;

  if (currentSecond !== luckySecond) return false;

  // Check if already claimed this hour (German time)
  const key = `jackpot:${currentDay}-${currentMonth}-${currentHour}`;
  const claimed = await env.SLOTS_KV.get(key);
  if (claimed) return false;

  // Claim jackpot (expires after 1 hour)
  await env.SLOTS_KV.put(key, 'claimed', { expirationTtl: JACKPOT_CLAIM_TTL });
  return true;
}

export { checkAndClaimHourlyJackpot };
