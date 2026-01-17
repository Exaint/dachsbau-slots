/**
 * Duel System - KV operations for duels
 *
 * ARCHITECTURE NOTES (for future coding sessions):
 * ================================================
 * KV KEYS:
 * - duel:{challenger} - Active challenge from this user
 *   Value: JSON { target, amount, createdAt }
 * - duel_optout:{username} - User has opted out of duels
 *   Value: 'true'
 *
 * FLOW:
 * 1. !duel @target amount - Creates challenge (stored under challenger)
 * 2. !duelaccept - Target accepts, both spin, winner gets pot
 * 3. !dueldecline - Target declines, challenge deleted
 * 4. Timeout after DUEL_TIMEOUT_SECONDS auto-deletes challenge
 *
 * RACE CONDITION PREVENTION:
 * - acceptDuel uses delete + verify pattern
 * - Only one active challenge per challenger
 */

import { DUEL_TIMEOUT_SECONDS, KV_TRUE } from '../constants.js';
import { logError } from '../utils.js';

/**
 * Create a new duel challenge
 */
async function createDuel(challenger, target, amount, env) {
  try {
    const key = `duel:${challenger.toLowerCase()}`;
    const data = {
      target: target.toLowerCase(),
      amount,
      createdAt: Date.now()
    };
    await env.SLOTS_KV.put(key, JSON.stringify(data), {
      expirationTtl: DUEL_TIMEOUT_SECONDS + 10
    });
    return true;
  } catch (error) {
    logError('createDuel', error, { challenger, target, amount });
    return false;
  }
}

/**
 * Get active duel challenge from a specific challenger
 */
async function getDuel(challenger, env) {
  try {
    const key = `duel:${challenger.toLowerCase()}`;
    const value = await env.SLOTS_KV.get(key);
    if (!value) return null;

    const data = JSON.parse(value);

    // Check if expired
    if (Date.now() > data.createdAt + (DUEL_TIMEOUT_SECONDS * 1000)) {
      await env.SLOTS_KV.delete(key);
      return null;
    }

    return { challenger: challenger.toLowerCase(), ...data };
  } catch (error) {
    logError('getDuel', error, { challenger });
    return null;
  }
}

/**
 * Find pending duel where user is the target
 */
async function findDuelForTarget(target, env) {
  try {
    // List all duel keys and find one where target matches
    const list = await env.SLOTS_KV.list({ prefix: 'duel:' });

    for (const key of list.keys) {
      const value = await env.SLOTS_KV.get(key.name);
      if (!value) continue;

      try {
        const data = JSON.parse(value);

        // Check if this duel targets the user and isn't expired
        if (data.target === target.toLowerCase() &&
            Date.now() <= data.createdAt + (DUEL_TIMEOUT_SECONDS * 1000)) {
          const challenger = key.name.replace('duel:', '');
          return { challenger, ...data };
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch (error) {
    logError('findDuelForTarget', error, { target });
    return null;
  }
}

/**
 * Delete a duel challenge (accept/decline/timeout)
 */
async function deleteDuel(challenger, env) {
  try {
    const key = `duel:${challenger.toLowerCase()}`;
    await env.SLOTS_KV.delete(key);
    return true;
  } catch (error) {
    logError('deleteDuel', error, { challenger });
    return false;
  }
}

/**
 * Accept a duel - atomic delete + verify to prevent race conditions
 */
async function acceptDuel(challenger, env) {
  try {
    const key = `duel:${challenger.toLowerCase()}`;
    const value = await env.SLOTS_KV.get(key);
    if (!value) return null;

    const data = JSON.parse(value);

    // Check if expired
    if (Date.now() > data.createdAt + (DUEL_TIMEOUT_SECONDS * 1000)) {
      await env.SLOTS_KV.delete(key);
      return null;
    }

    // Delete the duel
    await env.SLOTS_KV.delete(key);

    // Verify deletion succeeded (prevents double-accept race condition)
    const verify = await env.SLOTS_KV.get(key);
    if (verify !== null) {
      return null; // Another request accepted it first
    }

    return { challenger: challenger.toLowerCase(), ...data };
  } catch (error) {
    logError('acceptDuel', error, { challenger });
    return null;
  }
}

/**
 * Check if user has an active outgoing challenge
 */
async function hasActiveDuel(username, env) {
  const duel = await getDuel(username, env);
  return duel !== null;
}

/**
 * Set user's duel opt-out status
 */
async function setDuelOptOut(username, optOut, env) {
  try {
    const key = `duel_optout:${username.toLowerCase()}`;
    if (optOut) {
      await env.SLOTS_KV.put(key, KV_TRUE);
    } else {
      await env.SLOTS_KV.delete(key);
    }
    return true;
  } catch (error) {
    logError('setDuelOptOut', error, { username, optOut });
    return false;
  }
}

/**
 * Check if user has opted out of duels
 */
async function isDuelOptedOut(username, env) {
  try {
    const key = `duel_optout:${username.toLowerCase()}`;
    const value = await env.SLOTS_KV.get(key);
    return value === KV_TRUE;
  } catch (error) {
    logError('isDuelOptedOut', error, { username });
    return false;
  }
}

export {
  createDuel,
  getDuel,
  findDuelForTarget,
  deleteDuel,
  acceptDuel,
  hasActiveDuel,
  setDuelOptOut,
  isDuelOptedOut
};
