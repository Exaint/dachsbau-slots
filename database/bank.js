/**
 * Bank System - DachsBank balance and Hourly Jackpot
 */

import { BANK_USERNAME, BANK_START_BALANCE, JACKPOT_CLAIM_TTL } from '../constants.js';

// DachsBank Helper Functions
async function updateBankBalance(amount, env) {
  try {
    let bankBalance = await env.SLOTS_KV.get(`user:${BANK_USERNAME}`);

    // Initialize bank if doesn't exist
    if (bankBalance === null) {
      bankBalance = BANK_START_BALANCE;
    } else {
      bankBalance = parseInt(bankBalance, 10);
    }

    // Update balance (can go negative)
    const newBalance = bankBalance + amount;
    await env.SLOTS_KV.put(`user:${BANK_USERNAME}`, newBalance.toString());

    return newBalance;
  } catch (error) {
    console.error('updateBankBalance Error:', error);
    // Return current balance estimate on error (prevents crash when caller uses return value)
    return BANK_START_BALANCE;
  }
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
    console.error('getBankBalance Error:', error);
    return BANK_START_BALANCE;
  }
}

// Hourly Jackpot
async function checkAndClaimHourlyJackpot(env) {
  const now = new Date();
  const currentSecond = now.getUTCSeconds();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDate();
  const currentMonth = now.getUTCMonth();
  const seed = currentDay * 100 + currentMonth * 10 + currentHour;
  const luckySecond = seed % 60;

  if (currentSecond !== luckySecond) return false;

  // Check if already claimed this hour
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
