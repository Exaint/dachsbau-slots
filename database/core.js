/**
 * Core Database Functions - Balance, Daily, Cooldown, Disclaimer, Selfban
 */

import { MAX_BALANCE, DAILY_TTL_SECONDS, STARTING_BALANCE } from '../constants.js';

// Balance Functions
async function getBalance(username, env) {
  try {
    const key = `user:${username.toLowerCase()}`;
    const value = await env.SLOTS_KV.get(key);
    if (value === null) {
      await setBalance(username, STARTING_BALANCE, env);
      return STARTING_BALANCE;
    }
    const balance = parseInt(value, 10);
    return isNaN(balance) ? STARTING_BALANCE : Math.min(balance, MAX_BALANCE);
  } catch (error) {
    console.error('getBalance Error:', error);
    return STARTING_BALANCE;
  }
}

async function setBalance(username, balance, env) {
  try {
    const safeBalance = Math.max(0, Math.min(balance, MAX_BALANCE));
    await env.SLOTS_KV.put(`user:${username.toLowerCase()}`, safeBalance.toString());
  } catch (error) {
    console.error('setBalance Error:', error);
  }
}

// Daily Functions
async function getLastDaily(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`daily:${username.toLowerCase()}`);
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    console.error('getLastDaily Error:', error);
    return null;
  }
}

async function setLastDaily(username, timestamp, env) {
  try {
    await env.SLOTS_KV.put(`daily:${username.toLowerCase()}`, timestamp.toString(), { expirationTtl: DAILY_TTL_SECONDS });
  } catch (error) {
    console.error('setLastDaily Error:', error);
  }
}

// Cooldown System
async function getLastSpin(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`cooldown:${username.toLowerCase()}`);
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    console.error('getLastSpin Error:', error);
    return null;
  }
}

async function setLastSpin(username, timestamp, env) {
  try {
    // Auto-expire after 60 seconds (2x cooldown time for safety)
    await env.SLOTS_KV.put(`cooldown:${username.toLowerCase()}`, timestamp.toString(), { expirationTtl: 60 });
  } catch (error) {
    console.error('setLastSpin Error:', error);
  }
}

// First-Time User System
async function hasAcceptedDisclaimer(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`disclaimer:${username.toLowerCase()}`);
    return value === 'accepted';
  } catch (error) {
    console.error('hasAcceptedDisclaimer Error:', error);
    return false;
  }
}

async function setDisclaimerAccepted(username, env) {
  try {
    await env.SLOTS_KV.put(`disclaimer:${username.toLowerCase()}`, 'accepted');
  } catch (error) {
    console.error('setDisclaimerAccepted Error:', error);
  }
}

// Selfban System
async function isSelfBanned(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`selfban:${username.toLowerCase()}`);
    if (!value) return null;
    return JSON.parse(value); // Returns { timestamp, date }
  } catch (error) {
    console.error('isSelfBanned Error:', error);
    return null;
  }
}

async function setSelfBan(username, env) {
  try {
    const now = Date.now();
    const date = new Date(now).toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const banData = {
      timestamp: now,
      date: date
    };

    await env.SLOTS_KV.put(`selfban:${username.toLowerCase()}`, JSON.stringify(banData));
  } catch (error) {
    console.error('setSelfBan Error:', error);
  }
}

async function removeSelfBan(username, env) {
  try {
    await env.SLOTS_KV.delete(`selfban:${username.toLowerCase()}`);
  } catch (error) {
    console.error('removeSelfBan Error:', error);
  }
}

// Blacklist
async function isBlacklisted(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`blacklist:${username.toLowerCase()}`);
    return value === 'true';
  } catch (error) {
    console.error('isBlacklisted Error:', error);
    return false;
  }
}

export {
  getBalance,
  setBalance,
  getLastDaily,
  setLastDaily,
  getLastSpin,
  setLastSpin,
  hasAcceptedDisclaimer,
  setDisclaimerAccepted,
  isSelfBanned,
  setSelfBan,
  removeSelfBan,
  isBlacklisted
};
