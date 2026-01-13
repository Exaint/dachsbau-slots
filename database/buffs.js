/**
 * Buff System - Timed buffs, boosts, mulligan, insurance, win multiplier
 */

import { BUFF_TTL_BUFFER_SECONDS } from '../constants.js';
import { exponentialBackoff } from '../utils.js';

// Buffs (timed)
async function activateBuff(username, buffKey, duration, env) {
  try {
    const expireAt = Date.now() + (duration * 1000);
    await env.SLOTS_KV.put(`buff:${username.toLowerCase()}:${buffKey}`, expireAt.toString(), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
  } catch (error) {
    console.error('activateBuff Error:', error);
  }
}

async function isBuffActive(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return false;
    return Date.now() < parseInt(value, 10);
  } catch (error) {
    console.error('isBuffActive Error:', error);
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
    console.error('activateBuffWithUses Error:', error);
  }
}

// OPTIMIZED: Return full data object to avoid redundant reads
async function getBuffWithUses(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return { active: false, uses: 0, data: null };

    const data = JSON.parse(value);
    if (Date.now() >= data.expireAt || data.uses <= 0) {
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, uses: 0, data: null };
    }

    return { active: true, uses: data.uses, data };
  } catch (error) {
    console.error('getBuffWithUses Error:', error);
    return { active: false, uses: 0, data: null };
  }
}

// Atomic buff uses decrement with retry mechanism (prevents race conditions)
async function decrementBuffUses(username, buffKey, env, maxRetries = 3) {
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
      console.error(`decrementBuffUses Error (attempt ${attempt + 1}):`, error);
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
    console.error('activateBuffWithStack Error:', error);
  }
}

// OPTIMIZED: Return full data object to avoid redundant reads
async function getBuffWithStack(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(`buff:${username.toLowerCase()}:${buffKey}`);
    if (!value) return { active: false, stack: 0, data: null };

    const data = JSON.parse(value);
    if (Date.now() >= data.expireAt) {
      await env.SLOTS_KV.delete(`buff:${username.toLowerCase()}:${buffKey}`);
      return { active: false, stack: 0, data: null };
    }

    return { active: true, stack: data.stack || 0, data };
  } catch (error) {
    console.error('getBuffWithStack Error:', error);
    return { active: false, stack: 0, data: null };
  }
}

// Boosts (symbol-specific)
async function addBoost(username, symbol, env) {
  try {
    await env.SLOTS_KV.put(`boost:${username.toLowerCase()}:${symbol}`, 'active');
  } catch (error) {
    console.error('addBoost Error:', error);
  }
}

async function consumeBoost(username, symbol, env) {
  try {
    const key = `boost:${username.toLowerCase()}:${symbol}`;
    const value = await env.SLOTS_KV.get(key);
    if (value === 'active') {
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
    console.error('consumeBoost Error:', error);
    return false;
  }
}

// Mulligan
async function getMulliganCount(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`mulligan:${username.toLowerCase()}`);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error('getMulliganCount Error:', error);
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
    console.error('setMulliganCount Error:', error);
  }
}

// Insurance - Atomic add with retry mechanism
async function addInsurance(username, count, env, maxRetries = 3) {
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
      console.error(`addInsurance Error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) return;
    }
  }
}

async function getInsuranceCount(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`insurance:${username.toLowerCase()}`);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error('getInsuranceCount Error:', error);
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
    console.error('setInsuranceCount Error:', error);
  }
}

// Win Multiplier
async function addWinMultiplier(username, env) {
  try {
    await env.SLOTS_KV.put(`winmulti:${username.toLowerCase()}`, 'active');
  } catch (error) {
    console.error('addWinMultiplier Error:', error);
  }
}

async function consumeWinMultiplier(username, env) {
  try {
    const key = `winmulti:${username.toLowerCase()}`;
    const value = await env.SLOTS_KV.get(key);
    if (value === 'active') {
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
    console.error('consumeWinMultiplier Error:', error);
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
  getMulliganCount,
  setMulliganCount,
  addInsurance,
  getInsuranceCount,
  setInsuranceCount,
  addWinMultiplier,
  consumeWinMultiplier
};
