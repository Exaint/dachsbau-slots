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
 * - Tiebreaker: Sum of DUEL_SYMBOL_VALUES for all 3 symbols
 * - Winner takes pot (both players' bets combined)
 *
 * FLOW:
 * 1. Challenger sends !duel @target amount
 * 2. Target has 60 seconds to !duelaccept or !dueldecline
 * 3. On accept: Both spin, winner gets pot
 * 4. On decline/timeout: Challenge expires
 */

import { DUEL_MIN_AMOUNT, DUEL_TIMEOUT_SECONDS, DUEL_COOLDOWN_SECONDS, DUEL_SYMBOL_VALUES, DACHS_BASE_CHANCE, GRID_SIZE, ACHIEVEMENTS } from '../constants.js';
import { getBalance, setBalance, checkAndUnlockAchievement, updateAchievementStat, setMaxAchievementStat, checkBalanceAchievements, incrementStat, updateMaxStat } from '../database.js';
import { createDuel, getDuel, findDuelForTarget, deleteDuel, acceptDuel, hasActiveDuel, setDuelOptOut, isDuelOptedOut, getDuelCooldown, setDuelCooldown } from '../database/duels.js';
import { getWeightedSymbol, secureRandom, logError } from '../utils.js';

/**
 * Track duel achievements (fire-and-forget)
 * @param {string} player - Player username
 * @param {boolean} isWinner - Whether this player won
 * @param {number} winnings - Amount won (only for winner)
 * @param {object} env - Environment with KV binding
 */
async function trackDuelAchievements(player, isWinner, winnings, env) {
  try {
    const promises = [];

    // Both players get FIRST_DUEL and duelsPlayed tracked
    promises.push(checkAndUnlockAchievement(player, ACHIEVEMENTS.FIRST_DUEL.id, env));
    promises.push(incrementStat(player, 'duelsPlayed', 1, env));

    if (isWinner) {
      // Winner stats
      promises.push(updateAchievementStat(player, 'duelsWon', 1, env));
      promises.push(updateAchievementStat(player, 'totalDuelWinnings', winnings, env));
      promises.push(incrementStat(player, 'totalDuelWinnings', winnings, env));

      // Track duel win streak
      promises.push(trackDuelStreak(player, true, env));
    } else {
      // Loser stats
      promises.push(updateAchievementStat(player, 'duelsLost', 1, env));
      promises.push(incrementStat(player, 'duelsLost', 1, env));

      // Reset duel win streak on loss
      promises.push(trackDuelStreak(player, false, env));
    }

    await Promise.all(promises);
  } catch (error) {
    logError('trackDuelAchievements', error, { player, isWinner });
  }
}

/**
 * Track duel win streak and check streak achievements
 */
async function trackDuelStreak(player, isWin, env) {
  try {
    const key = `duelStreak:${player.toLowerCase()}`;
    if (isWin) {
      const current = parseInt(await env.SLOTS_KV.get(key) || '0', 10);
      const newStreak = current + 1;
      await env.SLOTS_KV.put(key, String(newStreak), { expirationTtl: 86400 * 30 });
      await setMaxAchievementStat(player, 'maxDuelStreak', newStreak, env);
      updateMaxStat(player, 'maxDuelStreak', newStreak, env).catch(() => {});
    } else {
      await env.SLOTS_KV.put(key, '0', { expirationTtl: 86400 * 30 });
    }
  } catch (error) {
    logError('trackDuelStreak', error, { player, isWin });
  }
}

/**
 * Generate a fair duel grid (no buffs, no peek, no special items)
 */
function generateDuelGrid() {
  const grid = [];
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
function calculateDuelScore(grid) {
  const symbolSum = grid.reduce((sum, s) => sum + (DUEL_SYMBOL_VALUES[s] || 0), 0);

  // Check for triple
  if (grid[0] === grid[1] && grid[1] === grid[2]) {
    return {
      score: 3000000 + symbolSum, // Triple beats everything
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
      score: 2000000 + symbolSum, // Pair beats no-match
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

/**
 * Handle !duel @target amount command
 */
async function handleDuel(username, args, env) {
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
async function handleDuelAccept(username, env) {
  try {
    // Find pending duel where this user is the target
    const duel = await findDuelForTarget(username, env);

    if (!duel) {
      return `@${username} Du hast keine offene Duell-Herausforderung.`;
    }

    // Atomically accept the duel (prevents race conditions)
    const acceptedDuel = await acceptDuel(duel.challenger, env);
    if (!acceptedDuel) {
      return `@${username} Das Duell wurde bereits akzeptiert oder ist abgelaufen.`;
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
    let resultMessage;

    if (challengerScore.score > targetScore.score) {
      // Challenger wins
      const newChallengerBalance = challengerBalance + duel.amount;
      await Promise.all([
        setBalance(duel.challenger, newChallengerBalance, env),
        setBalance(username, targetBalance - duel.amount, env)
      ]);
      resultMessage = `🏆 @${duel.challenger} GEWINNT ${pot} DachsTaler!`;
      // Fire-and-forget achievement tracking
      trackDuelAchievements(duel.challenger, true, pot, env);
      trackDuelAchievements(username, false, 0, env);
      checkBalanceAchievements(duel.challenger, newChallengerBalance, env);
    } else if (targetScore.score > challengerScore.score) {
      // Target wins
      const newTargetBalance = targetBalance + duel.amount;
      await Promise.all([
        setBalance(duel.challenger, challengerBalance - duel.amount, env),
        setBalance(username, newTargetBalance, env)
      ]);
      resultMessage = `🏆 @${username} GEWINNT ${pot} DachsTaler!`;
      // Fire-and-forget achievement tracking
      trackDuelAchievements(username, true, pot, env);
      trackDuelAchievements(duel.challenger, false, 0, env);
      checkBalanceAchievements(username, newTargetBalance, env);
    } else {
      // True tie - return bets (both participated, neither won)
      resultMessage = `🤝 UNENTSCHIEDEN! Beide behalten ihren Einsatz.`;
      // Fire-and-forget achievement tracking (both get participation, no winner)
      trackDuelAchievements(duel.challenger, false, 0, env);
      trackDuelAchievements(username, false, 0, env);
    }

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
async function handleDuelDecline(username, env) {
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
async function handleDuelOpt(username, args, env) {
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
