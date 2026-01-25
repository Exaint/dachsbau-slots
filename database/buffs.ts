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
import type { Env } from '../types/index.js';

// ============================================
// Types
// ============================================

export interface BuffUsesData {
  expireAt: number;
  uses: number;
}

export interface BuffStackData {
  expireAt: number;
  stack: number;
}

export interface BuffWithUsesResult {
  active: boolean;
  uses: number;
  data: BuffUsesData | null;
}

export interface BuffWithStackResult {
  active: boolean;
  stack: number;
  data: BuffStackData | null;
}

// ============================================
// Buffs (timed)
// ============================================

export async function activateBuff(username: string, buffKey: string, duration: number, env: Env): Promise<void> {
  try {
    const expireAt = Date.now() + (duration * 1000);
    await env.SLOTS_KV.put(kvKey('buff:', username, buffKey), expireAt.toString(), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
  } catch (error) {
    logError('activateBuff', error, { username, buffKey, duration });
  }
}

export async function isBuffActive(username: string, buffKey: string, env: Env): Promise<boolean> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('buff:', username, buffKey));
    if (!value) return false;
    return Date.now() < parseInt(value, 10);
  } catch (error) {
    logError('isBuffActive', error, { username, buffKey });
    return false;
  }
}

// ============================================
// Buff with uses (Dachs Locator)
// ============================================

export async function activateBuffWithUses(username: string, buffKey: string, duration: number, uses: number, env: Env): Promise<void> {
  try {
    const expireAt = Date.now() + (duration * 1000);
    const data: BuffUsesData = { expireAt, uses };
    await env.SLOTS_KV.put(kvKey('buff:', username, buffKey), JSON.stringify(data), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
  } catch (error) {
    logError('activateBuffWithUses', error, { username, buffKey, duration, uses });
  }
}

// OPTIMIZED: Return full data object to avoid redundant reads
export async function getBuffWithUses(username: string, buffKey: string, env: Env): Promise<BuffWithUsesResult> {
  try {
    const key = kvKey('buff:', username, buffKey);
    const value = await env.SLOTS_KV.get(key);
    if (!value) return { active: false, uses: 0, data: null };

    let data: BuffUsesData;
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
export async function decrementBuffUses(username: string, buffKey: string, env: Env, maxRetries: number = MAX_RETRIES): Promise<void> {
  const key = kvKey('buff:', username, buffKey);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Read current state
      const value = await env.SLOTS_KV.get(key);
      if (!value) return;

      const data: BuffUsesData = JSON.parse(value);
      if (Date.now() >= data.expireAt || data.uses <= 0) {
        await env.SLOTS_KV.delete(key);
        return;
      }

      // Prepare update
      const updatedData: BuffUsesData = { ...data, uses: data.uses - 1 };

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
          const verifyData: BuffUsesData = JSON.parse(verifyValue);
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

// ============================================
// Buff with stack (Rage Mode)
// ============================================

export async function activateBuffWithStack(username: string, buffKey: string, duration: number, env: Env): Promise<void> {
  try {
    const expireAt = Date.now() + (duration * 1000);
    const data: BuffStackData = { expireAt, stack: 0 };
    await env.SLOTS_KV.put(kvKey('buff:', username, buffKey), JSON.stringify(data), { expirationTtl: duration + BUFF_TTL_BUFFER_SECONDS });
  } catch (error) {
    logError('activateBuffWithStack', error, { username, buffKey, duration });
  }
}

// OPTIMIZED: Return full data object to avoid redundant reads
export async function getBuffWithStack(username: string, buffKey: string, env: Env): Promise<BuffWithStackResult> {
  try {
    const key = kvKey('buff:', username, buffKey);
    const value = await env.SLOTS_KV.get(key);
    if (!value) return { active: false, stack: 0, data: null };

    let data: BuffStackData;
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

// ============================================
// Boosts (symbol-specific)
// ============================================

export async function addBoost(username: string, symbol: string, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.put(kvKey('boost:', username, symbol), KV_ACTIVE);
  } catch (error) {
    logError('addBoost', error, { username, symbol });
  }
}

export async function consumeBoost(username: string, symbol: string, env: Env): Promise<boolean> {
  try {
    const key = kvKey('boost:', username, symbol);
    const claimKey = `${key}:claim`;

    // Check if another request is already claiming this boost
    const alreadyClaimed = await env.SLOTS_KV.get(claimKey);
    if (alreadyClaimed) return false;

    const value = await env.SLOTS_KV.get(key);
    if (value !== KV_ACTIVE) return false;

    // Set claim-lock with short TTL (prevents parallel double-consume)
    await env.SLOTS_KV.put(claimKey, '1', { expirationTtl: 10 });
    await env.SLOTS_KV.delete(key);
    await env.SLOTS_KV.delete(claimKey);
    return true;
  } catch (error) {
    logError('consumeBoost', error, { username, symbol });
    return false;
  }
}

// ============================================
// Insurance - Atomic add with retry mechanism
// ============================================

export async function addInsurance(username: string, count: number, env: Env, maxRetries: number = MAX_RETRIES): Promise<void> {
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

export async function getInsuranceCount(username: string, env: Env): Promise<number> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('insurance:', username));
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    logError('getInsuranceCount', error, { username });
    return 0;
  }
}

// Atomic insurance decrement with retry mechanism (prevents race conditions)
export async function decrementInsuranceCount(username: string, env: Env, maxRetries: number = MAX_RETRIES): Promise<void> {
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
export async function setInsuranceCount(username: string, count: number, env: Env): Promise<void> {
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

// ============================================
// Win Multiplier
// ============================================

export async function addWinMultiplier(username: string, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.put(kvKey('winmulti:', username), KV_ACTIVE);

    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertItem(username, 'winmulti', KV_ACTIVE, env).catch(err => logError('addWinMultiplier.d1', err, { username }));
    }
  } catch (error) {
    logError('addWinMultiplier', error, { username });
  }
}

export async function consumeWinMultiplier(username: string, env: Env): Promise<boolean> {
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
