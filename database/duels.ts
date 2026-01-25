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
import type { Env, DuelChallenge } from '../types/index.js';

// ============================================
// Types
// ============================================

export interface DuelData {
  target: string;
  amount: number;
  createdAt: number;
}

export interface DuelLogData {
  challenger: string;
  target: string;
  amount: number;
  challengerGrid: string[];
  targetGrid: string[];
  challengerScore: number;
  targetScore: number;
  winner: string | null;
  pot: number;
}

export interface DuelHistoryEntry {
  id: number;
  challenger: string;
  target: string;
  amount: number;
  challengerGrid: string[];
  targetGrid: string[];
  challengerScore: number;
  targetScore: number;
  winner: string | null;
  pot: number;
  createdAt: number;
}

export type AcceptDuelResult =
  | { success: true; duel: DuelChallenge }
  | { success: false; reason: 'not_found' | 'expired' | 'already_claimed' | 'race_condition' | 'error' };

// ============================================
// Duel Challenge Operations
// ============================================

/**
 * Create a new duel challenge
 */
export async function createDuel(challenger: string, target: string, amount: number, env: Env): Promise<boolean> {
  try {
    const key = kvKey('duel:', challenger);
    const data: DuelData = {
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
export async function getDuel(challenger: string, env: Env): Promise<DuelChallenge | null> {
  try {
    const key = kvKey('duel:', challenger);
    const value = await env.SLOTS_KV.get(key);
    if (!value) return null;

    const data: DuelData = JSON.parse(value);

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
export async function findDuelForTarget(target: string, env: Env): Promise<DuelChallenge | null> {
  try {
    // List all duel keys and find one where target matches
    const list = await env.SLOTS_KV.list({ prefix: 'duel:' });

    for (const key of list.keys) {
      const value = await env.SLOTS_KV.get(key.name);
      if (!value) continue;

      try {
        const data: DuelData = JSON.parse(value);

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
export async function deleteDuel(challenger: string, env: Env): Promise<boolean> {
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
 * Accept a duel - claim-lock + delete + verify to prevent race conditions
 * Returns detailed result with failure reason
 */
export async function acceptDuel(challenger: string, env: Env): Promise<AcceptDuelResult> {
  try {
    const key = kvKey('duel:', challenger);

    // First read the duel to get createdAt for unique claim key
    const value = await env.SLOTS_KV.get(key);
    if (!value) return { success: false, reason: 'not_found' };

    const data: DuelData = JSON.parse(value);

    // Check if expired
    if (Date.now() > data.createdAt + (DUEL_TIMEOUT_SECONDS * 1000)) {
      await env.SLOTS_KV.delete(key);
      return { success: false, reason: 'expired' };
    }

    // Unique claim key per duel (prevents stale claim locks from previous duels)
    const claimKey = `${key}:claim:${data.createdAt}`;

    // Check if another request is already claiming this specific duel
    const alreadyClaimed = await env.SLOTS_KV.get(claimKey);
    if (alreadyClaimed) return { success: false, reason: 'already_claimed' };

    // Set claim-lock with short TTL (prevents parallel double-accept)
    await env.SLOTS_KV.put(claimKey, '1', { expirationTtl: 10 });

    // Delete the duel
    await env.SLOTS_KV.delete(key);

    // Verify deletion succeeded
    const verify = await env.SLOTS_KV.get(key);
    if (verify !== null) {
      await env.SLOTS_KV.delete(claimKey);
      return { success: false, reason: 'race_condition' }; // Another request accepted it first
    }

    // Cleanup claim lock (fire-and-forget, TTL handles cleanup anyway)
    env.SLOTS_KV.delete(claimKey).catch(() => {});

    return { success: true, duel: { challenger: challenger.toLowerCase(), ...data } };
  } catch (error) {
    logError('acceptDuel', error, { challenger });
    return { success: false, reason: 'error' };
  }
}

/**
 * Check if user has an active outgoing challenge
 */
export async function hasActiveDuel(username: string, env: Env): Promise<boolean> {
  const duel = await getDuel(username, env);
  return duel !== null;
}

// ============================================
// Duel Opt-Out
// ============================================

/**
 * Set user's duel opt-out status
 */
export async function setDuelOptOut(username: string, optOut: boolean, env: Env): Promise<boolean> {
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
export async function isDuelOptedOut(username: string, env: Env): Promise<boolean> {
  try {
    const key = kvKey('duel_optout:', username);
    const value = await env.SLOTS_KV.get(key);
    return value === KV_TRUE;
  } catch (error) {
    logError('isDuelOptedOut', error, { username });
    return false;
  }
}

// ============================================
// Duel Cooldown
// ============================================

/**
 * Check if user is on duel cooldown
 * Returns remaining seconds if on cooldown, 0 if not
 */
export async function getDuelCooldown(username: string, env: Env): Promise<number> {
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
export async function setDuelCooldown(username: string, env: Env): Promise<boolean> {
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

// ============================================
// Duel Logging (D1)
// ============================================

/**
 * Log a completed duel to D1 (fire-and-forget)
 */
export async function logDuel(data: DuelLogData, env: Env): Promise<void> {
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

/**
 * Get duel history for a player from D1
 */
export async function getDuelHistory(username: string, limit: number, env: Env): Promise<DuelHistoryEntry[]> {
  if (!D1_ENABLED || !env.DB) return [];

  try {
    const lowerUsername = username.toLowerCase();
    const result = await env.DB.prepare(`
      SELECT id, challenger, target, amount, challenger_grid, target_grid,
             challenger_score, target_score, winner, pot, created_at
      FROM duel_log
      WHERE challenger = ? OR target = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(lowerUsername, lowerUsername, limit).all<{
      id: number;
      challenger: string;
      target: string;
      amount: number;
      challenger_grid: string;
      target_grid: string;
      challenger_score: number;
      target_score: number;
      winner: string | null;
      pot: number;
      created_at: number;
    }>();

    return (result.results || []).map(row => ({
      id: row.id,
      challenger: row.challenger,
      target: row.target,
      amount: row.amount,
      challengerGrid: JSON.parse(row.challenger_grid) as string[],
      targetGrid: JSON.parse(row.target_grid) as string[],
      challengerScore: row.challenger_score,
      targetScore: row.target_score,
      winner: row.winner,
      pot: row.pot,
      createdAt: row.created_at
    }));
  } catch (error) {
    logError('getDuelHistory', error, { username });
    return [];
  }
}
