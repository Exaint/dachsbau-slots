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

import { DUEL_TIMEOUT_SECONDS, DUEL_COOLDOWN_SECONDS, KV_TRUE } from '../constants.js';
import { logError, kvKey } from '../utils.js';
import { D1_ENABLED } from './d1.js';

/**
 * Create a new duel challenge
 */
async function createDuel(challenger, target, amount, env) {
  try {
    const key = kvKey('duel:', challenger);
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
    const key = kvKey('duel:', challenger);
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
    const key = kvKey('duel:', challenger);
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
    const key = kvKey('duel:', challenger);
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
    const key = kvKey('duel_optout:', username);
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
    const key = kvKey('duel_optout:', username);
    const value = await env.SLOTS_KV.get(key);
    return value === KV_TRUE;
  } catch (error) {
    logError('isDuelOptedOut', error, { username });
    return false;
  }
}

/**
 * Check if user is on duel cooldown
 * Returns remaining seconds if on cooldown, 0 if not
 */
async function getDuelCooldown(username, env) {
  try {
    const key = kvKey('duel_cooldown:', username);
    const value = await env.SLOTS_KV.get(key);
    if (!value) return 0;

    const expiresAt = parseInt(value, 10);
    const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch (error) {
    logError('getDuelCooldown', error, { username });
    return 0;
  }
}

/**
 * Set duel cooldown for user
 */
async function setDuelCooldown(username, env) {
  try {
    const key = kvKey('duel_cooldown:', username);
    const expiresAt = Date.now() + (DUEL_COOLDOWN_SECONDS * 1000);
    await env.SLOTS_KV.put(key, expiresAt.toString(), {
      expirationTtl: DUEL_COOLDOWN_SECONDS + 10
    });
    return true;
  } catch (error) {
    logError('setDuelCooldown', error, { username });
    return false;
  }
}

/**
 * Log a completed duel to D1 (fire-and-forget)
 * @param {object} data - Duel result data
 * @param {string} data.challenger - Challenger username
 * @param {string} data.target - Target username
 * @param {number} data.amount - Bet amount per player
 * @param {string[]} data.challengerGrid - Challenger's 3 symbols
 * @param {string[]} data.targetGrid - Target's 3 symbols
 * @param {number} data.challengerScore - Challenger's calculated score
 * @param {number} data.targetScore - Target's calculated score
 * @param {string|null} data.winner - Winner username or null for tie
 * @param {number} data.pot - Total pot (amount * 2)
 * @param {object} env - Environment with DB binding
 */
async function logDuel(data, env) {
  if (!D1_ENABLED || !env.DB) return;

  try {
    await env.DB.prepare(`
      INSERT INTO duel_log (challenger, target, amount, challenger_grid, target_grid, challenger_score, target_score, winner, pot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.challenger.toLowerCase(),
      data.target.toLowerCase(),
      data.amount,
      JSON.stringify(data.challengerGrid),
      JSON.stringify(data.targetGrid),
      data.challengerScore,
      data.targetScore,
      data.winner ? data.winner.toLowerCase() : null,
      data.pot
    ).run();
  } catch (error) {
    logError('logDuel', error, { challenger: data.challenger, target: data.target });
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
  isDuelOptedOut,
  getDuelCooldown,
  setDuelCooldown,
  logDuel
};
