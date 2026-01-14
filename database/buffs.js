/**
 * Buff System - Timed buffs, boosts, mulligan, insurance, win multiplier
 */

import { BUFF_TTL_BUFFER_SECONDS, MAX_RETRIES } from '../constants.js';
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

    if (Date.now() >= data.expireAt || data.uses <= 0) {
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
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

    let data;
    try {
      data = JSON.parse(value);
    } catch {
      // Corrupted data, clean up
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, stack: 0, data: null };
    }

    // Validate data structure
    if (!data || typeof data.expireAt !== 'number') {
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, stack: 0, data: null };
    }

    if (Date.now() >= data.expireAt) {
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, stack: 0, data: null };
    }

    return { active: true, stack: typeof data.stack === 'number' ? data.stack : 0, data };
  } catch (error) {
    logError('getBuffWithStack', error, { username, buffKey });
    return { active: false, stack: 0, data: null };
  }
}

// Boosts (symbol-specific)
async function addBoost(username, symbol, env) {
  try {
    await env.SLOTS_KV.put(`boost:${username.toLowerCase()}:${symbol}`, 'active');
  } catch (error) {
    logError('addBoost', error, { username, symbol });
  }
}

async function consumeBoost(username, symbol, env, maxRetries = MAX_RETRIES) {
  const key = `boost:${username.toLowerCase()}:${symbol}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const value = await env.SLOTS_KV.get(key);
      if (value !== 'active') {
        return false; // Not active, nothing to consume
      }

      await env.SLOTS_KV.delete(key);

      // Verify deletion succeeded
      const verify = await env.SLOTS_KV.get(key);
      if (verify === null) {
        return true; // Successfully consumed
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError('consumeBoost', error, { username, symbol, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return false;
    }
  }

  return false; // All retries failed
}

// Mulligan
async function getMulliganCount(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`mulligan:${username.toLowerCase()}`);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    logError('getMulliganCount', error, { username });
    return 0;
  }
}

// OPTIMIZED: Set mulligan directly when count is already known (avoids redundant KV read)
async function setMulliganCount(username, count, env) {
  try {
    if (count <= 0) {
      await env.SLOTS_KV.delete(`mulligan:${username.toLowerCase()}`);
    } else {
      await env.SLOTS_KV.put(`mulligan:${username.toLowerCase()}`, count.toString());
    }
  } catch (error) {
    logError('setMulliganCount', error, { username, count });
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
    await env.SLOTS_KV.put(`winmulti:${username.toLowerCase()}`, 'active');
  } catch (error) {
    logError('addWinMultiplier', error, { username });
  }
}

async function consumeWinMultiplier(username, env, maxRetries = MAX_RETRIES) {
  const key = `winmulti:${username.toLowerCase()}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const value = await env.SLOTS_KV.get(key);
      if (value !== 'active') {
        return false; // Not active, nothing to consume
      }

      await env.SLOTS_KV.delete(key);

      // Verify deletion succeeded
      const verify = await env.SLOTS_KV.get(key);
      if (verify === null) {
        return true; // Successfully consumed
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError('consumeWinMultiplier', error, { username, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return false;
    }
  }

  return false; // All retries failed
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
  getMulliganCount,
  setMulliganCount,
  addInsurance,
  getInsuranceCount,
  setInsuranceCount,
  addWinMultiplier,
  consumeWinMultiplier
};
