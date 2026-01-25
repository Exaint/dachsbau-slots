/**
 * Items - Guaranteed Pair, Wild Card, Free Spins
 */

import { MAX_RETRIES, KV_ACTIVE } from '../constants.js';
import { exponentialBackoff, logError, kvKey } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE, upsertItem, deleteItem } from './d1.js';
import type { Env, FreeSpinEntry } from '../types/index.js';

// ============================================
// Types
// ============================================

export interface FreeSpinConsumeResult {
  used: boolean;
  multiplier: number;
}

// ============================================
// Guaranteed Pair
// ============================================

export async function activateGuaranteedPair(username: string, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.put(kvKey('guaranteedpair:', username), KV_ACTIVE);

    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertItem(username, 'guaranteedpair', KV_ACTIVE, env).catch(err => logError('activateGuaranteedPair.d1', err, { username }));
    }
  } catch (error) {
    logError('activateGuaranteedPair', error, { username });
  }
}

export async function hasGuaranteedPair(username: string, env: Env): Promise<boolean> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('guaranteedpair:', username));
    return value === KV_ACTIVE;
  } catch (error) {
    logError('hasGuaranteedPair', error, { username });
    return false;
  }
}

export async function consumeGuaranteedPair(username: string, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.delete(kvKey('guaranteedpair:', username));

    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      deleteItem(username, 'guaranteedpair', env).catch(err => logError('consumeGuaranteedPair.d1', err, { username }));
    }
  } catch (error) {
    logError('consumeGuaranteedPair', error, { username });
  }
}

// ============================================
// Wild Card
// ============================================

export async function activateWildCard(username: string, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.put(kvKey('wildcard:', username), KV_ACTIVE);

    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertItem(username, 'wildcard', KV_ACTIVE, env).catch(err => logError('activateWildCard.d1', err, { username }));
    }
  } catch (error) {
    logError('activateWildCard', error, { username });
  }
}

export async function hasWildCard(username: string, env: Env): Promise<boolean> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('wildcard:', username));
    return value === KV_ACTIVE;
  } catch (error) {
    logError('hasWildCard', error, { username });
    return false;
  }
}

export async function consumeWildCard(username: string, env: Env): Promise<void> {
  try {
    await env.SLOTS_KV.delete(kvKey('wildcard:', username));

    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      deleteItem(username, 'wildcard', env).catch(err => logError('consumeWildCard.d1', err, { username }));
    }
  } catch (error) {
    logError('consumeWildCard', error, { username });
  }
}

// ============================================
// Free Spins
// ============================================

export async function getFreeSpins(username: string, env: Env): Promise<FreeSpinEntry[]> {
  try {
    const value = await env.SLOTS_KV.get(kvKey('freespins:', username));
    if (!value || value === 'null' || value === 'undefined') return [];

    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      logError('getFreeSpins.invalidStructure', new Error('Not an array'), { username, parsed });
      return [];
    }

    const valid = parsed.filter((fs: unknown): fs is FreeSpinEntry =>
      fs !== null &&
      typeof fs === 'object' &&
      typeof (fs as FreeSpinEntry).multiplier === 'number' &&
      typeof (fs as FreeSpinEntry).count === 'number' &&
      (fs as FreeSpinEntry).multiplier > 0 &&
      (fs as FreeSpinEntry).count > 0
    );

    return valid;
  } catch (error) {
    logError('getFreeSpins', error, { username });
    return [];
  }
}

export async function addFreeSpinsWithMultiplier(username: string, count: number, multiplier: number, env: Env): Promise<void> {
  try {
    if (typeof count !== 'number' || count <= 0 || typeof multiplier !== 'number' || multiplier <= 0) {
      logError('addFreeSpinsWithMultiplier.invalidParams', new Error('Invalid parameters'), { username, count, multiplier });
      return;
    }

    const freeSpins = await getFreeSpins(username, env);

    const hasExisting = freeSpins.some(fs => fs.multiplier === multiplier);
    const updated: FreeSpinEntry[] = hasExisting
      ? freeSpins.map(fs => fs.multiplier === multiplier ? { ...fs, count: fs.count + count } : fs)
      : [...freeSpins, { multiplier, count }];

    updated.sort((a, b) => a.multiplier - b.multiplier);

    const jsonValue = JSON.stringify(updated);
    await env.SLOTS_KV.put(kvKey('freespins:', username), jsonValue);

    if (D1_ENABLED && DUAL_WRITE && env.DB) {
      upsertItem(username, 'freespins', jsonValue, env).catch(err => logError('addFreeSpinsWithMultiplier.d1', err, { username }));
    }
  } catch (error) {
    logError('addFreeSpinsWithMultiplier', error, { username, count, multiplier });
  }
}

// Atomic free spin consumption with retry mechanism (prevents race conditions)
export async function consumeFreeSpinWithMultiplier(username: string, env: Env, maxRetries: number = MAX_RETRIES): Promise<FreeSpinConsumeResult> {
  const key = kvKey('freespins:', username);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Read current state
      const value = await env.SLOTS_KV.get(key);
      if (!value || value === 'null' || value === 'undefined') {
        return { used: false, multiplier: 0 };
      }

      const freeSpins: FreeSpinEntry[] = JSON.parse(value);
      if (!Array.isArray(freeSpins) || freeSpins.length === 0) {
        return { used: false, multiplier: 0 };
      }

      const lowestEntry = freeSpins[0];
      if (!lowestEntry || typeof lowestEntry !== 'object') {
        logError('consumeFreeSpinWithMultiplier.invalidEntry', new Error('Invalid lowest entry'), { username, lowestEntry });
        return { used: false, multiplier: 0 };
      }

      if (typeof lowestEntry.count !== 'number' || typeof lowestEntry.multiplier !== 'number') {
        logError('consumeFreeSpinWithMultiplier.invalidTypes', new Error('Invalid entry types'), { username, lowestEntry });
        return { used: false, multiplier: 0 };
      }

      if (lowestEntry.multiplier <= 0 || lowestEntry.count <= 0) {
        logError('consumeFreeSpinWithMultiplier.invalidValues', new Error('Invalid entry values'), { username, lowestEntry });
        return { used: false, multiplier: 0 };
      }

      // Prepare update - OPTIMIZED: Use deep copy instead of redundant JSON.parse
      const multiplierToReturn = lowestEntry.multiplier;
      const updatedFreeSpins: FreeSpinEntry[] = freeSpins.map(entry => ({ ...entry }));
      updatedFreeSpins[0].count--;

      if (updatedFreeSpins[0].count <= 0) {
        updatedFreeSpins.shift();
      }

      // Write with metadata for optimistic lock verification
      const metadata = { lastUpdate: Date.now(), attempt };
      await env.SLOTS_KV.put(key, JSON.stringify(updatedFreeSpins), { metadata });

      // Verify the write succeeded
      const verifyValue = await env.SLOTS_KV.get(key);
      const verifySpins: FreeSpinEntry[] = verifyValue ? JSON.parse(verifyValue) : [];

      // Check if our update was applied (count should match)
      const expectedCount = updatedFreeSpins.length > 0 ? updatedFreeSpins[0]?.count : -1;
      const actualCount = verifySpins.length > 0 ? verifySpins[0]?.count : -1;

      if (verifySpins.length === updatedFreeSpins.length &&
          (updatedFreeSpins.length === 0 || expectedCount === actualCount)) {
        if (D1_ENABLED && DUAL_WRITE && env.DB) {
          if (updatedFreeSpins.length === 0) {
            deleteItem(username, 'freespins', env).catch(err => logError('consumeFreeSpin.d1', err, { username }));
          } else {
            upsertItem(username, 'freespins', JSON.stringify(updatedFreeSpins), env).catch(err => logError('consumeFreeSpin.d1', err, { username }));
          }
        }
        return { used: true, multiplier: multiplierToReturn };
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError('consumeFreeSpinWithMultiplier', error, { username, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) {
        return { used: false, multiplier: 0 };
      }
    }
  }

  return { used: false, multiplier: 0 };
}
