/**
 * Shop System - Purchase tracking and limits
 */

import { calculateWeekStart, exponentialBackoff } from '../utils.js';

// Spin Bundle Purchases
async function getSpinBundlePurchases(username, env) {
  try {
    // Always use fresh week calculation for limit checks (no cache)
    const currentWeekStart = calculateWeekStart();
    const value = await env.SLOTS_KV.get(`bundle_purchases:${username.toLowerCase()}`);
    if (!value) return { count: 0, weekStart: currentWeekStart };
    const data = JSON.parse(value);

    if (data.weekStart !== currentWeekStart) {
      return { count: 0, weekStart: currentWeekStart };
    }

    return data;
  } catch (error) {
    console.error('getSpinBundlePurchases Error:', error);
    return { count: 0, weekStart: calculateWeekStart() };
  }
}

// Atomic increment with retry mechanism
async function incrementSpinBundlePurchases(username, env, maxRetries = 3) {
  const key = `bundle_purchases:${username.toLowerCase()}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const data = await getSpinBundlePurchases(username, env);
      const expectedCount = data.count + 1;
      data.count = expectedCount;
      await env.SLOTS_KV.put(key, JSON.stringify(data));

      // Verify the write succeeded
      const verifyData = await getSpinBundlePurchases(username, env);
      if (verifyData.count === expectedCount) {
        return;
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      console.error(`incrementSpinBundlePurchases Error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) return;
    }
  }
}

// Dachs Boost Purchases
async function getDachsBoostPurchases(username, env) {
  try {
    // Always use fresh week calculation for limit checks (no cache)
    const currentWeekStart = calculateWeekStart();
    const value = await env.SLOTS_KV.get(`dachsboost_purchases:${username.toLowerCase()}`);
    if (!value) return { count: 0, weekStart: currentWeekStart };
    const data = JSON.parse(value);

    if (data.weekStart !== currentWeekStart) {
      return { count: 0, weekStart: currentWeekStart };
    }

    return data;
  } catch (error) {
    console.error('getDachsBoostPurchases Error:', error);
    return { count: 0, weekStart: calculateWeekStart() };
  }
}

// Atomic increment with retry mechanism
async function incrementDachsBoostPurchases(username, env, maxRetries = 3) {
  const key = `dachsboost_purchases:${username.toLowerCase()}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const data = await getDachsBoostPurchases(username, env);
      const expectedCount = data.count + 1;
      data.count = expectedCount;
      await env.SLOTS_KV.put(key, JSON.stringify(data));

      // Verify the write succeeded
      const verifyData = await getDachsBoostPurchases(username, env);
      if (verifyData.count === expectedCount) {
        return;
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      console.error(`incrementDachsBoostPurchases Error (attempt ${attempt + 1}):`, error);
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
