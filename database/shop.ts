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

// ============================================
// Atomic Purchase Limit Operations (D1-based)
// ============================================

export interface AtomicPurchaseResult {
  success: boolean;
  newCount?: number;
  error?: 'limit_reached' | 'd1_unavailable';
}

/**
 * Atomically check and increment Dachs Boost purchases.
 * Uses D1 atomic operation to prevent race conditions.
 *
 * SECURITY FIX: Prevents bypassing weekly limit through concurrent requests.
 * Returns { success: false, error: 'limit_reached' } if limit would be exceeded.
 */
export async function atomicIncrementDachsBoostPurchases(
  username: string,
  weeklyLimit: number,
  env: Env
): Promise<AtomicPurchaseResult> {
  return atomicIncrementPurchaseLimit(username, 'dachsboost', weeklyLimit, env);
}

/**
 * Atomically check and increment Spin Bundle purchases.
 * Uses D1 atomic operation to prevent race conditions.
 */
export async function atomicIncrementSpinBundlePurchases(
  username: string,
  weeklyLimit: number,
  env: Env
): Promise<AtomicPurchaseResult> {
  return atomicIncrementPurchaseLimit(username, 'bundle', weeklyLimit, env);
}

/**
 * Generic atomic purchase limit increment using D1.
 * INSERT OR UPDATE with WHERE count < limit ensures atomicity.
 */
async function atomicIncrementPurchaseLimit(
  username: string,
  itemType: string,
  weeklyLimit: number,
  env: Env
): Promise<AtomicPurchaseResult> {
  if (!D1_ENABLED || !env.DB) {
    return { success: false, error: 'd1_unavailable' };
  }

  try {
    const currentWeekStart = calculateWeekStart();
    const lowerUsername = username.toLowerCase();
    const now = Date.now();

    // Atomic upsert: only increment if count < limit AND same week
    // If week changed, reset count to 1
    const result = await env.DB.prepare(`
      INSERT INTO purchase_limits (username, item_type, count, week_start, updated_at)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(username, item_type) DO UPDATE SET
        count = CASE
          WHEN week_start != ? THEN 1
          WHEN count < ? THEN count + 1
          ELSE count
        END,
        week_start = ?,
        updated_at = ?
      WHERE purchase_limits.week_start != ? OR purchase_limits.count < ?
      RETURNING count
    `).bind(
      lowerUsername, itemType, currentWeekStart, now,
      currentWeekStart, weeklyLimit, currentWeekStart, now,
      currentWeekStart, weeklyLimit
    ).first<{ count: number }>();

    if (!result) {
      // WHERE clause didn't match = limit already reached
      return { success: false, error: 'limit_reached' };
    }

    // Sync to KV for reads
    const kvPrefix = itemType === 'dachsboost' ? 'dachsboost_purchases:' : 'bundle_purchases:';
    const kvData: PurchaseData = { count: result.count, weekStart: currentWeekStart };
    env.SLOTS_KV.put(kvKey(kvPrefix, username), JSON.stringify(kvData)).catch(() => {});

    return { success: true, newCount: result.count };
  } catch (error) {
    logError('atomicIncrementPurchaseLimit', error, { username, itemType });
    return { success: false, error: 'd1_unavailable' };
  }
}
