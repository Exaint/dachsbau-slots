/**
 * Duel System - Player vs Player slot battles
 *
 * ARCHITECTURE NOTES (for future coding sessions):
 * ================================================
 * COMMANDS:
 * - !duel @target amount - Challenge a user to a duel
 * - !duelaccept - Accept a pending duel challenge
 * - !dueldecline - Decline a pending duel challenge
 * - !duelopt out - Opt out of receiving duel challenges
 * - !duelopt in - Opt back in to receiving duel challenges
 *
 * RULES:
 * - No buffs active during duels (fair fights)
 * - Minimum bet: 100 DachsTaler
 * - Both players must have enough balance
 * - Winner takes pot (both players' bets combined)
 *
 * SCORING:
 * - Dreifach > Paar > Symbolsumme
 * - Nur NEBENEINANDERLIEGENDE Symbole zählen als Paar (Pos 1+2 oder 2+3, NICHT 1+3)
 * - Bei Gleichstand: Summe der DUEL_SYMBOL_VALUES aller 3 Symbole als Tiebreaker
 *
 * FLOW:
 * 1. Challenger sends !duel @target amount
 * 2. Target has 60 seconds to !duelaccept or !dueldecline
 * 3. On accept: Both spin, winner gets pot
 * 4. On decline/timeout: Challenge expires
 */

import { DUEL_MIN_AMOUNT, DUEL_TIMEOUT_SECONDS, DUEL_SCORE_TRIPLE_OFFSET, DUEL_SCORE_PAIR_OFFSET, DUEL_SYMBOL_VALUES, DACHS_BASE_CHANCE, GRID_SIZE, ACHIEVEMENTS } from '../constants.js';
import { getBalance, deductBalance, creditBalance, checkAndUnlockAchievement, checkBalanceAchievements, updatePlayerStatBatch } from '../database.js';
import type { PlayerStats } from '../database/progression.js';
import { createDuel, findDuelForTarget, deleteDuel, acceptDuel, hasActiveDuel, setDuelOptOut, isDuelOptedOut, getDuelCooldown, setDuelCooldown, logDuel } from '../database/duels.js';
import { getWeightedSymbol, secureRandom, logError } from '../utils.js';
import type { Env } from '../types/index.js';

// ============================================
// Types
// ============================================

interface DuelScore {
  score: number;
  isTriple: boolean;
  isPair: boolean;
  symbolSum: number;
  description: string;
}

type DuelResult = 'win' | 'loss' | 'tie';

// ============================================
// Achievement Tracking
// ============================================

/**
 * Track duel achievements and stats
 */
async function trackDuelAchievements(player: string, result: DuelResult, winnings: number, env: Env): Promise<void> {
  try {
    // Unified batch: achievement-blob + stats-KV + D1 (single D1 write per stat)
    const statUpdates: [keyof PlayerStats, number][] = [['duelsPlayed', 1]];
    if (result === 'win') {
      statUpdates.push(['duelsWon', 1]);
      statUpdates.push(['totalDuelWinnings', winnings]);
    } else if (result === 'loss') {
      statUpdates.push(['duelsLost', 1]);
    }
    // Ties: only duelsPlayed is incremented (no win or loss)
    await updatePlayerStatBatch(player, statUpdates, null, env);

    // One-time achievement (reads fresh data after batch save)
    await checkAndUnlockAchievement(player, ACHIEVEMENTS.FIRST_DUEL.id, env);

    // Streak tracking (separate KV key, not a simple stat increment)
    if (result === 'win') {
      await trackDuelStreak(player, true, env);
    } else if (result === 'loss') {
      await trackDuelStreak(player, false, env);
    }
  } catch (error) {
    logError('trackDuelAchievements', error, { player, result });
  }
}

/**
 * Track duel win streak and check streak achievements
 */
async function trackDuelStreak(player: string, isWin: boolean, env: Env): Promise<void> {
  try {
    const key = `duelStreak:${player.toLowerCase()}`;
    if (isWin) {
      const current = parseInt(await env.SLOTS_KV.get(key) || '0', 10);
      const newStreak = current + 1;
      await env.SLOTS_KV.put(key, String(newStreak), { expirationTtl: 86400 * 30 });
      // Unified: achievement-blob + stats-KV + D1 (single D1 write)
      await updatePlayerStatBatch(player, [], [['maxDuelStreak', newStreak]], env);
    } else {
      await env.SLOTS_KV.put(key, '0', { expirationTtl: 86400 * 30 });
    }
  } catch (error) {
    logError('trackDuelStreak', error, { player, isWin });
  }
}

// ============================================
// Grid Generation & Scoring
// ============================================

/**
 * Generate a fair duel grid (no buffs, no peek, no special items)
 */
function generateDuelGrid(): string[] {
  const grid: string[] = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    if (secureRandom() < DACHS_BASE_CHANCE) {
      grid.push('🦡');
    } else {
      grid.push(getWeightedSymbol());
    }
  }
  return grid;
}

/**
 * Calculate duel score from grid (triple > pair > symbol sum)
 * Returns: { score, isTriple, isPair, symbolSum, description }
 */
function calculateDuelScore(grid: string[]): DuelScore {
  const symbolSum = grid.reduce((sum, s) => sum + (DUEL_SYMBOL_VALUES[s] || 0), 0);

  // Check for triple
  if (grid[0] === grid[1] && grid[1] === grid[2]) {
    return {
      score: DUEL_SCORE_TRIPLE_OFFSET + symbolSum, // Triple beats everything
      isTriple: true,
      isPair: false,
      symbolSum,
      description: `Dreifach ${grid[0]}!`
    };
  }

  // Check for adjacent pair
  if (grid[0] === grid[1] || grid[1] === grid[2]) {
    const pairSymbol = grid[0] === grid[1] ? grid[0] : grid[1];
    return {
      score: DUEL_SCORE_PAIR_OFFSET + symbolSum, // Pair beats no-match
      isTriple: false,
      isPair: true,
      symbolSum,
      description: `Doppel ${pairSymbol}!`
    };
  }

  // No match - only symbol sum counts
  return {
    score: symbolSum,
    isTriple: false,
    isPair: false,
    symbolSum,
    description: `${symbolSum} Punkte`
  };
}

// ============================================
// Command Handlers
// ============================================

/**
 * Handle !duel @target amount command
 */
async function handleDuel(username: string, args: string[], env: Env): Promise<string> {
  try {
    // Parse arguments
    if (!args || args.length < 2) {
      return `@${username} Verwendung: !duel @ziel betrag (min. ${DUEL_MIN_AMOUNT})`;
    }

    const targetArg = args[0].replace('@', '').toLowerCase();
    const amountArg = parseInt(args[1], 10);

    // Validate target
    if (!targetArg || targetArg.length === 0) {
      return `@${username} Bitte gib einen Gegner an: !duel @ziel betrag`;
    }

    const lowerUsername = username.toLowerCase();

    // Can't duel yourself
    if (targetArg === lowerUsername) {
      return `@${username} Du kannst dich nicht selbst herausfordern! 🤔`;
    }

    // Validate amount
    if (isNaN(amountArg) || amountArg < DUEL_MIN_AMOUNT) {
      return `@${username} Mindesteinsatz: ${DUEL_MIN_AMOUNT} DachsTaler`;
    }

    // Check for existing active duel
    if (await hasActiveDuel(username, env)) {
      return `@${username} Du hast bereits eine aktive Herausforderung! Warte bis sie abläuft oder abgelehnt wird.`;
    }

    // Check cooldown
    const cooldownRemaining = await getDuelCooldown(username, env);
    if (cooldownRemaining > 0) {
      return `@${username} ⏳ Du musst noch ${cooldownRemaining} Sekunden warten bevor du ein neues Duell starten kannst.`;
    }

    // Check if target has opted out
    if (await isDuelOptedOut(targetArg, env)) {
      return `@${username} @${targetArg} hat Duelle deaktiviert.`;
    }

    // Check balances
    const [challengerBalance, targetBalance] = await Promise.all([
      getBalance(username, env),
      getBalance(targetArg, env)
    ]);

    if (challengerBalance < amountArg) {
      return `@${username} Du hast nicht genug DachsTaler! (${challengerBalance}/${amountArg})`;
    }

    if (targetBalance < amountArg) {
      return `@${username} @${targetArg} hat nicht genug DachsTaler für dieses Duell.`;
    }

    // Create the duel challenge
    const success = await createDuel(username, targetArg, amountArg, env);
    if (!success) {
      return `@${username} Fehler beim Erstellen der Herausforderung. Bitte versuche es erneut.`;
    }

    // Set cooldown for challenger
    await setDuelCooldown(username, env);

    return `⚔️ @${username} fordert @${targetArg} zu einem Duell heraus! Einsatz: ${amountArg} DachsTaler | @${targetArg} schreibe !slots duelaccept oder !slots dueldecline (${DUEL_TIMEOUT_SECONDS}s)`;
  } catch (error) {
    logError('handleDuel', error, { username, args });
    return `@${username} Fehler beim Duell. Bitte versuche es erneut.`;
  }
}

/**
 * Handle !duelaccept command
 */
async function handleDuelAccept(username: string, env: Env): Promise<string> {
  try {
    // Find pending duel where this user is the target
    const duel = await findDuelForTarget(username, env);

    if (!duel) {
      return `@${username} Du hast keine offene Duell-Herausforderung.`;
    }

    // Atomically accept the duel (prevents race conditions)
    const acceptResult = await acceptDuel(duel.challenger, env);
    if (!acceptResult.success) {
      switch (acceptResult.reason) {
        case 'not_found':
          return `@${username} Duell nicht gefunden - es wurde möglicherweise zurückgezogen.`;
        case 'expired':
          return `@${username} Das Duell ist abgelaufen.`;
        case 'already_claimed':
          return `@${username} Das Duell wird gerade von einer anderen Anfrage verarbeitet.`;
        case 'race_condition':
          return `@${username} Das Duell wurde bereits verarbeitet.`;
        case 'error':
        default: {
          const debugInfo = acceptResult.debugInfo ? ` [${acceptResult.debugInfo}]` : '';
          return `@${username} Fehler beim Akzeptieren des Duells.${debugInfo}`;
        }
      }
    }

    // Re-check balances (could have changed since challenge)
    const [challengerBalance, targetBalance] = await Promise.all([
      getBalance(duel.challenger, env),
      getBalance(username, env)
    ]);

    if (challengerBalance < duel.amount) {
      return `@${username} ❌ Duell abgebrochen - @${duel.challenger} hat nicht mehr genug DachsTaler.`;
    }

    if (targetBalance < duel.amount) {
      return `@${username} ❌ Duell abgebrochen - Du hast nicht mehr genug DachsTaler.`;
    }

    // Generate grids for both players
    const challengerGrid = generateDuelGrid();
    const targetGrid = generateDuelGrid();

    // Calculate scores
    const challengerScore = calculateDuelScore(challengerGrid);
    const targetScore = calculateDuelScore(targetGrid);

    // Determine winner
    const pot = duel.amount * 2;
    let resultMessage: string;

    // Balance verified atomically by deductBalance below (no redundant pre-read needed)
    if (challengerScore.score > targetScore.score) {
      // Challenger wins - atomic D1 operations: deduct loser first, then credit winner
      const loserDeduct = await deductBalance(username, duel.amount, env);
      if (!loserDeduct.success) {
        return `@${username} ❌ Duell abgebrochen - Nicht genug DachsTaler.`;
      }
      const winnerBalanceC = await creditBalance(duel.challenger, duel.amount, env);
      resultMessage = `🏆 @${duel.challenger} GEWINNT ${pot} DachsTaler!`;
      // Achievement tracking (must await, otherwise worker terminates before completion)
      await Promise.all([
        trackDuelAchievements(duel.challenger, 'win', pot, env),
        trackDuelAchievements(username, 'loss', 0, env),
        checkBalanceAchievements(duel.challenger, winnerBalanceC, env)
      ]);
    } else if (targetScore.score > challengerScore.score) {
      // Target wins - atomic D1 operations: deduct loser first, then credit winner
      const challengerDeduct = await deductBalance(duel.challenger, duel.amount, env);
      if (!challengerDeduct.success) {
        return `@${username} ❌ Duell abgebrochen - @${duel.challenger} hat nicht genug DachsTaler.`;
      }
      const winnerBalanceT = await creditBalance(username, duel.amount, env);
      resultMessage = `🏆 @${username} GEWINNT ${pot} DachsTaler!`;
      // Achievement tracking (must await, otherwise worker terminates before completion)
      await Promise.all([
        trackDuelAchievements(username, 'win', pot, env),
        trackDuelAchievements(duel.challenger, 'loss', 0, env),
        checkBalanceAchievements(username, winnerBalanceT, env)
      ]);
    } else {
      // True tie - return bets (both participated, neither won)
      resultMessage = `🤝 UNENTSCHIEDEN! Beide behalten ihren Einsatz.`;
      // Achievement tracking (ties: only duelsPlayed, no win/loss)
      await Promise.all([
        trackDuelAchievements(duel.challenger, 'tie', 0, env),
        trackDuelAchievements(username, 'tie', 0, env)
      ]);
    }

    // Log duel to D1 (must await, otherwise worker terminates before insert completes)
    const winner = challengerScore.score > targetScore.score ? duel.challenger
      : targetScore.score > challengerScore.score ? username
      : null;
    await logDuel({
      challenger: duel.challenger,
      target: username,
      amount: duel.amount,
      challengerGrid,
      targetGrid,
      challengerScore: challengerScore.score,
      targetScore: targetScore.score,
      winner,
      pot
    }, env);

    // Build response
    const challengerGridStr = challengerGrid.join(' ');
    const targetGridStr = targetGrid.join(' ');

    return `⚔️ DUELL ⚔️ @${duel.challenger} [ ${challengerGridStr} ] ${challengerScore.description} vs @${username} [ ${targetGridStr} ] ${targetScore.description} | ${resultMessage}`;
  } catch (error) {
    logError('handleDuelAccept', error, { username });
    return `@${username} Fehler beim Akzeptieren des Duells. Bitte versuche es erneut.`;
  }
}

/**
 * Handle !dueldecline command
 */
async function handleDuelDecline(username: string, env: Env): Promise<string> {
  try {
    // Find pending duel where this user is the target
    const duel = await findDuelForTarget(username, env);

    if (!duel) {
      return `@${username} Du hast keine offene Duell-Herausforderung.`;
    }

    // Delete the duel
    await deleteDuel(duel.challenger, env);

    return `@${username} hat das Duell von @${duel.challenger} abgelehnt. ❌`;
  } catch (error) {
    logError('handleDuelDecline', error, { username });
    return `@${username} Fehler beim Ablehnen des Duells.`;
  }
}

/**
 * Handle !duelopt in/out command
 */
async function handleDuelOpt(username: string, args: string[], env: Env): Promise<string> {
  try {
    if (!args || args.length === 0) {
      const isOptedOut = await isDuelOptedOut(username, env);
      return `@${username} Duelle sind für dich ${isOptedOut ? 'deaktiviert' : 'aktiviert'}. Verwende !duelopt out oder !duelopt in`;
    }

    const option = args[0].toLowerCase();

    if (option === 'out') {
      await setDuelOptOut(username, true, env);
      return `@${username} ✅ Duelle deaktiviert. Du wirst keine Herausforderungen mehr erhalten.`;
    } else if (option === 'in') {
      await setDuelOptOut(username, false, env);
      return `@${username} ✅ Duelle aktiviert. Du kannst wieder herausgefordert werden!`;
    } else {
      return `@${username} Verwendung: !slots duelopt out (deaktivieren) oder !slots duelopt in (aktivieren)`;
    }
  } catch (error) {
    logError('handleDuelOpt', error, { username, args });
    return `@${username} Fehler bei der Opt-Out Einstellung.`;
  }
}

export {
  handleDuel,
  handleDuelAccept,
  handleDuelDecline,
  handleDuelOpt
};
