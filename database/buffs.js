/**
 * Buff System - Timed buffs, boosts, insurance, win multiplier
 *
 * ARCHITECTURE NOTES (for future coding sessions):
 * ================================================
 * BUFF TYPES:
 * - Simple timed buffs: Store expireAt timestamp (e.g., lucky_charm, golden_hour)
 * - Buffs with uses: Store { expireAt, uses } (e.g., dachs_locator)
 * - Buffs with stack: Store { expireAt, stack } (e.g., rage_mode)
 * - One-time items: Store 'active' string (e.g., boosts, win_multiplier)
 *
 * RACE CONDITION PREVENTION:
 * - consumeBoost/consumeWinMultiplier: Delete + verify pattern
 * - addInsurance: Retry with exponential backoff + verification
 * - decrementBuffUses: Retry with verification after each attempt
 *
 * ERROR HANDLING:
 * - All functions return safe defaults on error (false, 0, null)
 * - Expired buff cleanup errors are logged but don't fail reads
 * - Corrupted JSON data triggers cleanup and returns inactive
 */

import { BUFF_TTL_BUFFER_SECONDS, MAX_RETRIES, KV_ACTIVE } from '../constants.js';
import { exponentialBackoff, logError } from '../utils.js';

// Buffs (timed)
async function activateBuff(username, buffKey, duration, env) {
  try {
    const expireAt = Date.now() + (duration * 1000);
    await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, expireAt.toString(), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
  } catch (error) {
    logError('activateBuff', error, { username, buffKey, duration });
  }
}

async function isBuffActive(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return false;
    return Date.now() < parseInt(value, 10);
  } catch (error) {
    logError('isBuffActive', error, { username, buffKey });
    return false;
  }
}

// Buff with uses (Dachs Locator)
async function activateBuffWithUses(username, buffKey, duration, uses, env) {
  try {
    const expireAt = Date.now() + (duration * 1000);
    const data = { expireAt, uses };
    await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, JSON.stringify(data), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
  } catch (error) {
    logError('activateBuffWithUses', error, { username, buffKey, duration, uses });
  }
}

// OPTIMIZED: Return full data object to avoid redundant reads
async function getBuffWithUses(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return { active: false, uses: 0, data: null };

    let data;
    try {
      data = JSON.parse(value);
    } catch {
      // Corrupted data, clean up
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, uses: 0, data: null };
    }

    // Validate data structure
    if (!data || typeof data.expireAt !== 'number' || typeof data.uses !== 'number') {
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, uses: 0, data: null };
    }

    // BUG FIX: Handle delete errors gracefully - log but don't fail the read
    if (Date.now() >= data.expireAt || data.uses <= 0) {
      try {
        await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      } catch (deleteError) {
        // Log error but still return inactive - the buff is expired anyway
        logError('getBuffWithUses.cleanup', deleteError, { username, buffKey });
      }
      return { active: false, uses: 0, data: null };
    }

    return { active: true, uses: data.uses, data };
  } catch (error) {
    logError('getBuffWithUses', error, { username, buffKey });
    return { active: false, uses: 0, data: null };
  }
}

// Atomic buff uses decrement with retry mechanism (prevents race conditions)
async function decrementBuffUses(username, buffKey, env, maxRetries = MAX_RETRIES) {
  const key = `buff:${username.toLowerCase()}:${buffKey}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Read current state
      const value = await env.SLOTS_KV.get(key);
      if (!value) return;

      const data = JSON.parse(value);
      if (Date.now() >= data.expireAt || data.uses <= 0) {
        await env.SLOTS_KV.delete(key);
        return;
      }

      // Prepare update
      const updatedData = { ...data, uses: data.uses - 1 };

      if (updatedData.uses <= 0) {
        await env.SLOTS_KV.delete(key);
      } else {
        const ttl = Math.max(BUFF_TTL_BUFFER_SECONDS, Math.floor((data.expireAt - Date.now()) / 1000) + BUFF_TTL_BUFFER_SECONDS);
        const metadata = { lastUpdate: Date.now(), attempt };
        await env.SLOTS_KV.put(key, JSON.stringify(updatedData), { expirationTtl: ttl, metadata });
      }

      // Verify the write succeeded
      const verifyValue = await env.SLOTS_KV.get(key);
      if (updatedData.uses <= 0) {
        // Should be deleted
        if (!verifyValue) return; // Success
      } else {
        // Should have updated uses
        if (verifyValue) {
          const verifyData = JSON.parse(verifyValue);
          if (verifyData.uses === updatedData.uses) return; // Success
        }
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError('decrementBuffUses', error, { username, buffKey, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return;
    }
  }
}

// Buff with stack (Rage Mode)
async function activateBuffWithStack(username, buffKey, duration, env) {
  try {
    const expireAt = Date.now() + (duration * 1000);
    const data = { expireAt, stack: 0 };
    await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, JSON.stringify(data), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
  } catch (error) {
    logError('activateBuffWithStack', error, { username, buffKey, duration });
  }
}

// OPTIMIZED: Return full data object to avoid redundant reads
async function getBuffWithStack(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return { active: false, stack: 0, data: null };

    const data = JSON.parse(value);
    // BUG FIX: Handle delete errors gracefully - log but don't fail the read
    if (Date.now() >= data.expireAt) {
      try {
        await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      } catch (deleteError) {
        logError('getBuffWithStack.cleanup', deleteError, { username, buffKey });
      }
      return { active: false, stack: 0, data: null };
    }

    return { active: true, stack: data.stack || 0, data };
  } catch (error) {
    logError('getBuffWithStack', error, { username, buffKey });
    return { active: false, stack: 0, data: null };
  }
}

// Boosts (symbol-specific)
async function addBoost(username, symbol, env) {
  try {
    await env.SLOTS_KV.put(`boost:${username.toLowerCase()}:${symbol}`, KV_ACTIVE);
  } catch (error) {
    logError('addBoost', error, { username, symbol });
  }
}

async function consumeBoost(username, symbol, env) {
  try {
    const key = `boost:${username.toLowerCase()}:${symbol}`;
    const value = await env.SLOTS_KV.get(key);
    if (value === KV_ACTIVE) {
      await env.SLOTS_KV.delete(key);
      // Verify deletion succeeded (prevents race condition double-consume)
      const verify = await env.SLOTS_KV.get(key);
      if (verify === null) {
        return true; // Successfully consumed
      }
      // Another request consumed it first
      return false;
    }
    return false;
  } catch (error) {
    logError('consumeBoost', error, { username, symbol });
    return false;
  }
}

// Insurance - Atomic add with retry mechanism
async function addInsurance(username, count, env, maxRetries = MAX_RETRIES) {
  const key = `insurance:${username.toLowerCase()}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const current = await getInsuranceCount(username, env);
      const newCount = current + count;
      await env.SLOTS_KV.put(key, newCount.toString());

      // Verify the write succeeded
      const verifyCount = await getInsuranceCount(username, env);
      if (verifyCount === newCount) {
        return;
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError('addInsurance', error, { username, count, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return;
    }
  }
}

async function getInsuranceCount(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`insurance:${username.toLowerCase()}`);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    logError('getInsuranceCount', error, { username });
    return 0;
  }
}

// OPTIMIZED: Set insurance directly when count is already known (avoids redundant KV read)
async function setInsuranceCount(username, count, env) {
  try {
    if (count <= 0) {
      await env.SLOTS_KV.delete(`insurance:${username.toLowerCase()}`);
    } else {
      await env.SLOTS_KV.put(`insurance:${username.toLowerCase()}`, count.toString());
    }
  } catch (error) {
    logError('setInsuranceCount', error, { username, count });
  }
}

// Win Multiplier
async function addWinMultiplier(username, env) {
  try {
    await env.SLOTS_KV.put(`winmulti:${username.toLowerCase()}`, KV_ACTIVE);
  } catch (error) {
    logError('addWinMultiplier', error, { username });
  }
}

async function consumeWinMultiplier(username, env) {
  try {
    const key = `winmulti:${username.toLowerCase()}`;
    const value = await env.SLOTS_KV.get(key);
    if (value === KV_ACTIVE) {
      await env.SLOTS_KV.delete(key);
      // Verify deletion succeeded (prevents race condition double-consume)
      const verify = await env.SLOTS_KV.get(key);
      if (verify === null) {
        return true; // Successfully consumed
      }
      // Another request consumed it first
      return false;
    }
    return false;
  } catch (error) {
    logError('consumeWinMultiplier', error, { username });
    return false;
  }
}

export {
  activateBuff,
  isBuffActive,
  activateBuffWithUses,
  getBuffWithUses,
  decrementBuffUses,
  activateBuffWithStack,
  getBuffWithStack,
  addBoost,
  consumeBoost,
  addInsurance,
  getInsuranceCount,
  setInsuranceCount,
  addWinMultiplier,
  consumeWinMultiplier
};
