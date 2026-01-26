/**
 * Shop System - Purchase tracking and limits
 */

import { MAX_RETRIES } from '../constants.js';
import { calculateWeekStart, exponentialBackoff, logError, kvKey } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE, upsertPurchaseLimit } from './d1.js';
import type { Env } from '../types/index.js';

// ============================================
// Types
// ============================================

export interface PurchaseData {
  count: number;
  weekStart: string;
}

// ============================================
// Generic Purchase Tracking (shared logic)
// ============================================

async function getPurchases(kvPrefix: string, username: string, env: Env): Promise<PurchaseData> {
  try {
    const currentWeekStart = calculateWeekStart();
    const value = await env.SLOTS_KV.get(kvKey(kvPrefix, username));
    if (!value) return { count: 0, weekStart: currentWeekStart };
    const data: PurchaseData = JSON.parse(value);

    if (data.weekStart !== currentWeekStart) {
      return { count: 0, weekStart: currentWeekStart };
    }

    return data;
  } catch (error) {
    logError(`getPurchases[${kvPrefix}]`, error, { username });
    return { count: 0, weekStart: calculateWeekStart() };
  }
}

async function incrementPurchases(
  kvPrefix: string,
  d1ItemType: string,
  username: string,
  env: Env,
  maxRetries: number = MAX_RETRIES
): Promise<void> {
  const key = kvKey(kvPrefix, username);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const data = await getPurchases(kvPrefix, username, env);
      const expectedCount = data.count + 1;
      data.count = expectedCount;
      await env.SLOTS_KV.put(key, JSON.stringify(data));

      // Verify the write succeeded
      const verifyData = await getPurchases(kvPrefix, username, env);
      if (verifyData.count === expectedCount) {
        if (D1_ENABLED && DUAL_WRITE && env.DB) {
          upsertPurchaseLimit(username, d1ItemType, expectedCount, data.weekStart, env)
            .catch(err => logError(`incrementPurchases[${d1ItemType}].d1`, err, { username }));
        }
        return;
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError(`incrementPurchases[${d1ItemType}]`, error, { username, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return;
    }
  }
}

// ============================================
// Public API (stable exports)
// ============================================

export function getSpinBundlePurchases(username: string, env: Env): Promise<PurchaseData> {
  return getPurchases('bundle_purchases:', username, env);
}

export function incrementSpinBundlePurchases(username: string, env: Env, maxRetries?: number): Promise<void> {
  return incrementPurchases('bundle_purchases:', 'bundle', username, env, maxRetries);
}

export function getDachsBoostPurchases(username: string, env: Env): Promise<PurchaseData> {
  return getPurchases('dachsboost_purchases:', username, env);
}

export function incrementDachsBoostPurchases(username: string, env: Env, maxRetries?: number): Promise<void> {
  return incrementPurchases('dachsboost_purchases:', 'dachsboost', username, env, maxRetries);
}
