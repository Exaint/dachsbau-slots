/**
 * Bank System - DachsBank balance and Hourly Jackpot
 */

import { BANK_USERNAME, BANK_START_BALANCE, JACKPOT_CLAIM_TTL, MAX_RETRIES } from '../constants.js';
import { logError, exponentialBackoff } from '../utils.js';

// DachsBank Helper Functions
async function updateBankBalance(amount, env, maxRetries = MAX_RETRIES) {
  const key = `user:${BANK_USERNAME}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let bankBalance = await env.SLOTS_KV.get(key);

      // Initialize bank if doesn't exist
      if (bankBalance === null) {
        bankBalance = BANK_START_BALANCE;
      } else {
        bankBalance = parseInt(bankBalance, 10);
      }

      // Update balance (can go negative)
      const newBalance = bankBalance + amount;
      await env.SLOTS_KV.put(key, newBalance.toString());

      // Verify the write (bank is high-traffic, verify atomicity)
      const verifyValue = await env.SLOTS_KV.get(key);
      const verifyBalance = parseInt(verifyValue, 10);

      // Allow some tolerance for concurrent updates (just verify it changed in the right direction)
      if ((amount >= 0 && verifyBalance >= bankBalance) || (amount < 0 && verifyBalance <= bankBalance)) {
        return verifyBalance;
      }

      // Verification suspicious, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError('updateBankBalance', error, { amount, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return BANK_START_BALANCE;
    }
  }
  return BANK_START_BALANCE;
}

async function getBankBalance(env) {
  try {
    let bankBalance = await env.SLOTS_KV.get(`user:${BANK_USERNAME}`);

    if (bankBalance === null) {
      // Initialize bank
      await env.SLOTS_KV.put(`user:${BANK_USERNAME}`, BANK_START_BALANCE.toString());
      return BANK_START_BALANCE;
    }

    return parseInt(bankBalance, 10);
  } catch (error) {
    logError('getBankBalance', error);
    return BANK_START_BALANCE;
  }
}

// German timezone formatter for hourly jackpot (consistent with rest of codebase)
const GERMAN_TIME_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  day: '2-digit',
  month: '2-digit',
  hour12: false
});

// Hourly Jackpot - Uses German timezone for consistency
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

export {
  updateBankBalance,
  getBankBalance,
  checkAndClaimHourlyJackpot
};
