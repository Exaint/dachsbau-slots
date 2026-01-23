/**
 * Shop System - Purchase tracking and limits
 */

import { MAX_RETRIES } from '../constants.js';
import { calculateWeekStart, exponentialBackoff, logError, kvKey } from '../utils.js';
import { D1_ENABLED, DUAL_WRITE, upsertPurchaseLimit } from './d1.js';

// Spin Bundle Purchases
async function getSpinBundlePurchases(username, env) {
  try {
    // Always use fresh week calculation for limit checks (no cache)
    const currentWeekStart = calculateWeekStart();
    const value = await env.SLOTS_KV.get(kvKey('bundle_purchases:', username));
    if (!value) return { count: 0, weekStart: currentWeekStart };
    const data = JSON.parse(value);

    if (data.weekStart !== currentWeekStart) {
      return { count: 0, weekStart: currentWeekStart };
    }

    return data;
  } catch (error) {
    logError('getSpinBundlePurchases', error, { username });
    return { count: 0, weekStart: calculateWeekStart() };
  }
}

// Atomic increment with retry mechanism
async function incrementSpinBundlePurchases(username, env, maxRetries = MAX_RETRIES) {
  const key = kvKey('bundle_purchases:', username);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const data = await getSpinBundlePurchases(username, env);
      const expectedCount = data.count + 1;
      data.count = expectedCount;
      await env.SLOTS_KV.put(key, JSON.stringify(data));

      // Verify the write succeeded
      const verifyData = await getSpinBundlePurchases(username, env);
      if (verifyData.count === expectedCount) {
        if (D1_ENABLED && DUAL_WRITE && env.DB) {
          upsertPurchaseLimit(username, 'bundle', expectedCount, data.weekStart, env).catch(err => logError('incrementSpinBundle.d1', err, { username }));
        }
        return;
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError('incrementSpinBundlePurchases', error, { username, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return;
    }
  }
}

// Dachs Boost Purchases
async function getDachsBoostPurchases(username, env) {
  try {
    // Always use fresh week calculation for limit checks (no cache)
    const currentWeekStart = calculateWeekStart();
    const value = await env.SLOTS_KV.get(kvKey('dachsboost_purchases:', username));
    if (!value) return { count: 0, weekStart: currentWeekStart };
    const data = JSON.parse(value);

    if (data.weekStart !== currentWeekStart) {
      return { count: 0, weekStart: currentWeekStart };
    }

    return data;
  } catch (error) {
    logError('getDachsBoostPurchases', error, { username });
    return { count: 0, weekStart: calculateWeekStart() };
  }
}

// Atomic increment with retry mechanism
async function incrementDachsBoostPurchases(username, env, maxRetries = MAX_RETRIES) {
  const key = kvKey('dachsboost_purchases:', username);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const data = await getDachsBoostPurchases(username, env);
      const expectedCount = data.count + 1;
      data.count = expectedCount;
      await env.SLOTS_KV.put(key, JSON.stringify(data));

      // Verify the write succeeded
      const verifyData = await getDachsBoostPurchases(username, env);
      if (verifyData.count === expectedCount) {
        if (D1_ENABLED && DUAL_WRITE && env.DB) {
          upsertPurchaseLimit(username, 'dachsboost', expectedCount, data.weekStart, env).catch(err => logError('incrementDachsBoost.d1', err, { username }));
        }
        return;
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      logError('incrementDachsBoostPurchases', error, { username, attempt: attempt + 1 });
      if (attempt === maxRetries - 1) return;
    }
  }
}

export {
  getSpinBundlePurchases,
  incrementSpinBundlePurchases,
  getDachsBoostPurchases,
  incrementDachsBoostPurchases
};
