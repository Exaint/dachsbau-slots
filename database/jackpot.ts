/**
 * Hourly Jackpot - Lucky second-based jackpot system
 * Standalone implementation (no bank dependency)
 */

import { JACKPOT_CLAIM_TTL } from '../constants.js';
import type { Env } from '../types/index.js';

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
 *
 * Uses write-then-verify pattern to prevent duplicate claims:
 * Instead of check→claim (TOCTOU), we claim with a unique ID then verify
 * our claim won, leveraging KV's read-after-write consistency.
 */
export async function checkAndClaimHourlyJackpot(env: Env): Promise<boolean> {
  const now = new Date();
  const parts = GERMAN_TIME_FORMATTER.formatToParts(now);

  const secondPart = parts.find(p => p.type === 'second');
  const hourPart = parts.find(p => p.type === 'hour');
  const dayPart = parts.find(p => p.type === 'day');
  const monthPart = parts.find(p => p.type === 'month');

  if (!secondPart || !hourPart || !dayPart || !monthPart) return false;

  const currentSecond = parseInt(secondPart.value, 10);
  const currentHour = parseInt(hourPart.value, 10);
  const currentDay = parseInt(dayPart.value, 10);
  const currentMonth = parseInt(monthPart.value, 10);

  const seed = currentDay * 100 + currentMonth * 10 + currentHour;
  const luckySecond = seed % 60;

  if (currentSecond !== luckySecond) return false;

  // Check if already claimed this hour (fast-path rejection)
  const key = `jackpot:${currentDay}-${currentMonth}-${currentHour}`;
  const claimed = await env.SLOTS_KV.get(key);
  if (claimed) return false;

  // Race-safe claim: write unique ID then verify our claim won
  const claimId = crypto.randomUUID();
  await env.SLOTS_KV.put(key, claimId, { expirationTtl: JACKPOT_CLAIM_TTL });

  // Verify our claim is the stored value (last-writer-wins + read-after-write consistency)
  const verify = await env.SLOTS_KV.get(key);
  return verify === claimId;
}
