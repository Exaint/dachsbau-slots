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
import { exponentialBackoff, logError, kvKey } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE, upsertItem, deleteItem } from './d1.js';

// Buffs (timed)
async function activateBuff(username, buffKey, duration, env) {
  try {
    const expireAt = Date.now() + (duration * 1000);
    await env.SLOTS_KV.put(kvKey('buff:', username, buffKey), expireAt.toString(), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
  } catch (error) {
    logError('activateBuff', error, { username, buffKey, duration });
  }
}

async function isBuffActive(username, buffKey, env) {
  try {
    const value = await env.SLOTS_KV.get(kvKey('buff:', username, buffKey));
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
    await env.SLOTS_KV.put(kvKey('buff:', username, buffKey), JSON.stringify(data), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
  } catch (error) {
    logError('activateBuffWithUses', error, { username, buffKey, duration, uses });
  }
}

// OPTIMIZED: Return full data object to avoid redundant reads
async function getBuffWithUses(username, buffKey, env) {
  try {
    const key = kvKey('buff:', username, buffKey);
    const value = await env.SLOTS_KV.get(key);
    if (!value) return { active: false, uses: 0, data: null };

    let data;
    try {
      data = JSON.parse(value);
    } catch (parseError) {
      // Corrupted data, log and clean up
      logError('getBuffWithUses.corruptedJSON', parseError, { username, buffKey, rawValue: value?.substring(0, 100) });
      await env.SLOTS_KV.delete(key);
      return { active: false, uses: 0, data: null };
    }

    // Validate data structure
    if (!data || typeof data.expireAt !== 'number' || typeof data.uses !== 'number') {
      logError('getBuffWithUses.invalidStructure', new Error('Invalid buff data structure'), { username, buffKey, data });
      await env.SLOTS_KV.delete(key);
      return { active: false, uses: 0, data: null };
    }

    // BUG FIX: Handle delete errors gracefully - log but don't fail the read
    if (Date.now() >= data.expireAt || data.uses <= 0) {
      try {
        await env.SLOTS_KV.delete(key);
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
  const key = kvKey('buff:', username, buffKey);

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
        await env.SLOTS_KV.put(key, JSON.stringify(updatedData), { expirationTtl: ttl });
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
    await env.SLOTS_KV.put(kvKey('buff:', username, buffKey), JSON.stringify(data), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
  } catch (error) {
    logError('activateBuffWithStack', error, { username, buffKey, duration });
  }
}

// OPTIMIZED: Return full data object to avoid redundant reads
async function getBuffWithStack(username, buffKey, env) {
  try {
    const key = kvKey('buff:', username, buffKey);
    const value = await env.SLOTS_KV.get(key);
    if (!value) return { active: false, stack: 0, data: null };

    let data;
    try {
      data = JSON.parse(value);
    } catch (parseError) {
      // Corrupted data, log and clean up
      logError('getBuffWithStack.corruptedJSON', parseError, { username, buffKey, rawValue: value?.substring(0, 100) });
      await env.SLOTS_KV.delete(key);
      return { active: false, stack: 0, data: null };
    }

    // Validate data structure
    if (!data || typeof data.expireAt !== 'number') {
      logError('getBuffWithStack.invalidStructure', new Error('Invalid buff data structure'), { username, buffKey, data });
      await env.SLOTS_KV.delete(key);
      return { active: false, stack: 0, data: null };
    }

    // BUG FIX: Handle delete errors gracefully - log but don't fail the read
    if (Date.now() >= data.expireAt) {
      try {
        await env.SLOTS_KV.delete(key);
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
    await env.SLOTS_KV.put(kvKey('boost:', username, symbol), KV_ACTIVE);
  } catch (error) {
    logError('addBoost', error, { username, symbol });
  }
}

async function consumeBoost(username, symbol, env) {
  try {
    const key = kvKey('boost:', username, symbol);
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
  const key = kvKey('insurance:', username);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const current = await getInsuranceCount(username, env);
      const newCount = current + count;
      await env.SLOTS_KV.put(key, newCount.toString());

      // Verify the write succeeded
      const verifyCount = await getInsuranceCount(username, env);
      if (verifyCount === newCount) {
        if (D1_ENABLED && DUAL_WRITE && env.DB) {
          upsertItem(username, 'insurance', newCount.toString(), env).catch(err => logError('addInsurance.d1', err, { username }));
        }
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
    const value = await env.SLOTS_KV.get(kvKey('insurance:', username));
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    logError('getInsuranceCount', error, { username });
    return 0;
  }
}

// Atomic insurance decrement with retry mechanism (prevents race conditions)
async function decrementInsuranceCount(username, env, maxRetries = MAX_RETRIES) {
  const key = kvKey('insurance:', username);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const current = await getInsuranceCount(username, env);
      if (current <= 0) return; // Already at 0

      const newCount = current - 1;

      if (newCount <= 0) {
        await env.SLOTS_KV.delete(key);
        // Verify deletion
        const verify = await env.SLOTS_KV.get(key);
        if (verify === null) {
          if (D1_ENABLED && DUAL_WRITE && env.DB) {
            deleteItem(username, 'insurance', env).catch(err => logError('decrementInsurance.d1', err, { username }));
          }
          return; // Success
        }
      } else {
        await env.SLOTS_KV.put(key, newCount.toString());
        // Verify write
        const verifyCount = await getInsuranceCount(username, env);
        if (verifyCount === newCount) {
          if (D1_ENABLED && DUAL_WRITE && env.DB) {
            upsertItem(username, 'insurance', newCount.toString(), env).catch(err => logError('decrementInsurance.d1', err, { username }));
          }
          return; // Success
        }
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError('decrementInsuranceCount', error, { username, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return;
    }
  }
}

// OPTIMIZED: Set insurance directly when count is already known (avoids redundant KV read)
async function setInsuranceCount(username, count, env) {
  try {
    const key = kvKey('insurance:', username);
    if (count <= 0) {
      await env.SLOTS_KV.delete(key);
      if (D1_ENABLED && DUAL_WRITE && env.DB) {
        deleteItem(username, 'insurance', env).catch(err => logError('setInsuranceCount.d1', err, { username }));
      }
    } else {
      await env.SLOTS_KV.put(key, count.toString());
      if (D1_ENABLED && DUAL_WRITE && env.DB) {
        upsertItem(username, 'insurance', count.toString(), env).catch(err => logError('setInsuranceCount.d1', err, { username }));
      }
    }
  } catch (error) {
    logError('setInsuranceCount', error, { username, count });
  }
}

// Win Multiplier
async function addWinMultiplier(username, env) {
  try {
    await env.SLOTS_KV.put(kvKey('winmulti:', username), KV_ACTIVE);

    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertItem(username, 'winmulti', KV_ACTIVE, env).catch(err => logError('addWinMultiplier.d1', err, { username }));
    }
  } catch (error) {
    logError('addWinMultiplier', error, { username });
  }
}

async function consumeWinMultiplier(username, env) {
  try {
    const key = kvKey('winmulti:', username);
    const value = await env.SLOTS_KV.get(key);
    if (value === KV_ACTIVE) {
      await env.SLOTS_KV.delete(key);
      // Verify deletion succeeded (prevents race condition double-consume)
      const verify = await env.SLOTS_KV.get(key);
      if (verify === null) {
        if (D1_ENABLED && DUAL_WRITE && env.DB) {
          deleteItem(username, 'winmulti', env).catch(err => logError('consumeWinMultiplier.d1', err, { username }));
        }
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
  decrementInsuranceCount,
  addWinMultiplier,
  consumeWinMultiplier
};
