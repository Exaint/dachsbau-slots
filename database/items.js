/**
 * Items - Guaranteed Pair, Wild Card, Free Spins
 */

import { exponentialBackoff } from '../utils.js';

// Guaranteed Pair
async function activateGuaranteedPair(username, env) {
  try {
    await env.SLOTS_KV.put(`guaranteedpair:${username.toLowerCase()}`, 'active');
  } catch (error) {
    console.error('activateGuaranteedPair Error:', error);
  }
}

async function hasGuaranteedPair(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`guaranteedpair:${username.toLowerCase()}`);
    return value === 'active';
  } catch (error) {
    console.error('hasGuaranteedPair Error:', error);
    return false;
  }
}

async function consumeGuaranteedPair(username, env) {
  try {
    await env.SLOTS_KV.delete(`guaranteedpair:${username.toLowerCase()}`);
  } catch (error) {
    console.error('consumeGuaranteedPair Error:', error);
  }
}

// Wild Card
async function activateWildCard(username, env) {
  try {
    await env.SLOTS_KV.put(`wildcard:${username.toLowerCase()}`, 'active');
  } catch (error) {
    console.error('activateWildCard Error:', error);
  }
}

async function hasWildCard(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`wildcard:${username.toLowerCase()}`);
    return value === 'active';
  } catch (error) {
    console.error('hasWildCard Error:', error);
    return false;
  }
}

async function consumeWildCard(username, env) {
  try {
    await env.SLOTS_KV.delete(`wildcard:${username.toLowerCase()}`);
  } catch (error) {
    console.error('consumeWildCard Error:', error);
  }
}

// Free Spins
async function getFreeSpins(username, env) {
  try {
    const value = await env.SLOTS_KV.get(`freespins:${username.toLowerCase()}`);
    if (!value || value === 'null' || value === 'undefined') return [];

    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      console.error('Invalid free spins structure (not array):', parsed);
      return [];
    }

    const valid = parsed.filter(fs =>
      fs &&
      typeof fs === 'object' &&
      typeof fs.multiplier === 'number' &&
      typeof fs.count === 'number' &&
      fs.multiplier > 0 &&
      fs.count > 0
    );

    return valid;
  } catch (error) {
    console.error('getFreeSpins Error:', error);
    return [];
  }
}

async function addFreeSpinsWithMultiplier(username, count, multiplier, env) {
  try {
    if (typeof count !== 'number' || count <= 0 || typeof multiplier !== 'number' || multiplier <= 0) {
      console.error('Invalid free spin parameters:', { count, multiplier });
      return;
    }

    const freeSpins = await getFreeSpins(username, env);

    const existing = freeSpins.find(fs => fs.multiplier === multiplier);
    if (existing) {
      existing.count += count;
    } else {
      freeSpins.push({ multiplier, count });
    }

    freeSpins.sort((a, b) => a.multiplier - b.multiplier);

    await env.SLOTS_KV.put(`freespins:${username.toLowerCase()}`, JSON.stringify(freeSpins));
  } catch (error) {
    console.error('addFreeSpinsWithMultiplier Error:', error);
  }
}

// Atomic free spin consumption with retry mechanism (prevents race conditions)
async function consumeFreeSpinWithMultiplier(username, env, maxRetries = 3) {
  const key = `freespins:${username.toLowerCase()}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Read current state
      const value = await env.SLOTS_KV.get(key);
      if (!value || value === 'null' || value === 'undefined') {
        return { used: false, multiplier: 0 };
      }

      const freeSpins = JSON.parse(value);
      if (!Array.isArray(freeSpins) || freeSpins.length === 0) {
        return { used: false, multiplier: 0 };
      }

      const lowestEntry = freeSpins[0];
      if (!lowestEntry || typeof lowestEntry !== 'object') {
        console.error('Invalid lowest entry:', lowestEntry);
        return { used: false, multiplier: 0 };
      }

      if (typeof lowestEntry.count !== 'number' || typeof lowestEntry.multiplier !== 'number') {
        console.error('Invalid entry types:', lowestEntry);
        return { used: false, multiplier: 0 };
      }

      if (lowestEntry.multiplier <= 0 || lowestEntry.count <= 0) {
        console.error('Invalid entry values:', lowestEntry);
        return { used: false, multiplier: 0 };
      }

      // Prepare update - OPTIMIZED: Use deep copy instead of redundant JSON.parse
      const multiplierToReturn = lowestEntry.multiplier;
      const updatedFreeSpins = freeSpins.map(entry => ({ ...entry }));
      updatedFreeSpins[0].count--;

      if (updatedFreeSpins[0].count <= 0) {
        updatedFreeSpins.shift();
      }

      // Write with metadata for optimistic lock verification
      const metadata = { lastUpdate: Date.now(), attempt };
      await env.SLOTS_KV.put(key, JSON.stringify(updatedFreeSpins), { metadata });

      // Verify the write succeeded
      const verifyValue = await env.SLOTS_KV.get(key);
      const verifySpins = verifyValue ? JSON.parse(verifyValue) : [];

      // Check if our update was applied (count should match)
      const expectedCount = updatedFreeSpins.length > 0 ? updatedFreeSpins[0]?.count : -1;
      const actualCount = verifySpins.length > 0 ? verifySpins[0]?.count : -1;

      if (verifySpins.length === updatedFreeSpins.length &&
          (updatedFreeSpins.length === 0 || expectedCount === actualCount)) {
        return { used: true, multiplier: multiplierToReturn };
      }

      // Verification failed, retry with backoff
      if (attempt < maxRetries - 1) {
        await exponentialBackoff(attempt);
      }
    } catch (error) {
      console.error(`consumeFreeSpinWithMultiplier Error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) {
        return { used: false, multiplier: 0 };
      }
    }
  }

  return { used: false, multiplier: 0 };
}

export {
  activateGuaranteedPair,
  hasGuaranteedPair,
  consumeGuaranteedPair,
  activateWildCard,
  hasWildCard,
  consumeWildCard,
  getFreeSpins,
  addFreeSpinsWithMultiplier,
  consumeFreeSpinWithMultiplier
};
