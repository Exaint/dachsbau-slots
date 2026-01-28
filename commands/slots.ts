/**
 * Slot Machine - Main game logic
 * Engine functions (grid, win calculation) are in ./slots/engine.js
 * Helper functions (parsing, buffs, streaks, achievements) are in ./slots/helpers.js
 *
 * ARCHITECTURE NOTES (for future coding sessions):
 * ================================================
 * - handleSlot() uses TWO-STAGE BUFF LOADING for performance optimization
 *   Stage 1: D1 cooldown claim + essential KV reads (all parallel)
 *   Stage 2: Non-essential buffs loaded in parallel with grid generation
 *
 * - Pre-loaded values are passed to helper functions to avoid redundant KV reads
 * - All balance operations use atomic Promise.all() with verification
 * - Race conditions are prevented via retry mechanisms in database/buffs.js
 *
 * KEY PERFORMANCE PATTERNS:
 * - Promise.all() for parallel reads (D1 claim + 13 KV Stage 1 + 10 Stage 2)
 * - Pre-computed values cached at module level (regex patterns)
 * - Only check symbol boosts for symbols that appear in the grid (1-3 vs 7)
 */

import {
  RESPONSE_HEADERS,
  COOLDOWN_SECONDS,
  BASE_SPIN_COST,
  DACHS_BASE_CHANCE,
  DAILY_BOOST_AMOUNT,
  DAILY_AMOUNT,
  LOW_BALANCE_WARNING,
  STREAK_THRESHOLD,
  INSURANCE_REFUND_RATE,
  URLS,
  RAGE_MODE_LOSS_STACK,
  RAGE_MODE_MAX_STACK,
  FREE_SPIN_COST_THRESHOLD,
  HOURLY_JACKPOT_AMOUNT
} from '../constants.js';
import { logError, getCurrentDate, getGermanDateFromTimestamp, kvKey, calculateBuffTTL, secureRandomInt, stripInvisibleChars } from '../utils.js';
import {
  getBalance,
  setBalance,
  deductBalance,
  creditBalance,
  getLastSpin,
  setLastSpin,
  hasAcceptedDisclaimer,
  isSelfBanned,
  setLastActive,
  hasGuaranteedPair,
  hasWildCard,
  getFreeSpins,
  consumeFreeSpinWithMultiplier,
  isBuffActive,
  getBuffWithUses,
  getBuffWithStack,
  decrementBuffUses,
  getInsuranceCount,
  decrementInsuranceCount,
  getStreakMultiplier,
  incrementStreakMultiplier,
  resetStreakMultiplier,
  getStreak,
  updateStats,
  getPrestigeRank,
  getLastDaily,
  hasUnlock,
  getCustomMessages,
  checkAndClaimHourlyJackpot
} from '../database.js';
import type { Env, WinResult, StreakData, FreeSpinEntry, BuffWithUsesResult, BuffWithStackResult, CustomMessages } from '../types/index.js';

// Engine functions
import { generateGrid, applySpecialItems, calculateWin, buildResponseMessage } from './slots/engine.js';

// Helper functions
import {
  trackSlotAchievements,
  parseSpinAmount,
  applyMultipliersAndBuffs,
  calculateStreakBonuses
} from './slots/helpers.js';

import { D1_ENABLED, DUAL_WRITE, upsertItem, claimSpinSlot, type SpinClaimResult } from '../database/d1.js';

// ============================================
// Main Slot Handler
// ============================================

async function handleSlot(username: string, amountParam: string | undefined, _url: URL, env: Env, ctx?: ExecutionContext): Promise<Response> {
  try {
    const lowerUsername = username.toLowerCase();

    // Defense-in-depth: strip invisible chars (primary sanitization is in handleSlotAction)
    if (amountParam) {
      amountParam = stripInvisibleChars(amountParam) || undefined;
    }

    const now = Date.now();
    const cooldownMs = COOLDOWN_SECONDS * 1000;

    // =========================================================================
    // TWO-STAGE BUFF LOADING - Performance Optimization
    // Stage 1: D1 cooldown claim + essential KV reads (all parallel)
    // Stage 2: Non-essential buffs loaded after grid (parallel with grid gen)
    // D1 claim runs parallel with KV reads → zero-latency race condition detection
    // =========================================================================

    // STAGE 1: D1 atomic claim + essential reads (all parallel for fastest rejection)
    // NOTE: Free spins are only READ here (not consumed) to avoid losing them on security check failures
    // OPTIMIZED: Peek grid pre-loaded here to avoid sequential KV read in generateGrid()
    const [
      spinClaim,
      selfBanData,
      hasAccepted,
      lastSpin,
      currentBalance,
      hasGuaranteedPairToken,
      hasWildCardToken,
      availableFreeSpins,
      // Grid generation buffs (affect symbol probabilities)
      hasStarMagnet,
      hasDiamondRush,
      hasLuckyCharm,
      hasDachsLocator,
      hasRageMode,
      hasHappyHour,
      // Pre-loaded peek grid (avoids sequential KV read in generateGrid)
      preloadedPeek
    ] = await Promise.all([
      claimSpinSlot(lowerUsername, now, cooldownMs, env),
      isSelfBanned(username, env),
      hasAcceptedDisclaimer(username, env),
      getLastSpin(username, env),
      getBalance(username, env),
      hasGuaranteedPair(username, env),
      hasWildCard(username, env),
      getFreeSpins(username, env).catch(err => { logError('handleSlot.getFreeSpins', err, { username }); return [] as FreeSpinEntry[]; }),
      isBuffActive(username, 'star_magnet', env),
      isBuffActive(username, 'diamond_rush', env),
      isBuffActive(username, 'lucky_charm', env),
      getBuffWithUses(username, 'dachs_locator', env),
      getBuffWithStack(username, 'rage_mode', env),
      isBuffActive(username, 'happy_hour', env),
      env.SLOTS_KV.get(`peek:${lowerUsername}`)
    ]) as [
      SpinClaimResult,
      { timestamp: number; date: string } | null,
      boolean,
      number | null,
      number,
      boolean,
      boolean,
      FreeSpinEntry[],
      boolean,
      boolean,
      boolean,
      BuffWithUsesResult,
      BuffWithStackResult,
      boolean,
      string | null
    ];

    // STAGE 2: Non-essential buffs (loaded in parallel with remaining logic)
    // These only affect post-grid calculations, not grid generation
    const stage2Promise = Promise.all([
      getInsuranceCount(username, env),
      getStreak(username, env),
      isBuffActive(username, 'golden_hour', env),
      isBuffActive(username, 'profit_doubler', env),
      isBuffActive(username, 'jackpot_booster', env),
      getStreakMultiplier(username, env),
      getPrestigeRank(username, env),
      getLastDaily(username, env),
      hasUnlock(username, 'daily_boost', env),
      getCustomMessages(username, env)
    ]);

    // D1 cooldown claim (checked FIRST for fastest race condition rejection)
    // Ran in parallel with KV reads above — no additional latency
    if (!spinClaim.claimed) {
      const RACE_CONDITION_WINDOW = 3000; // 3 seconds
      if (spinClaim.remainingMs && spinClaim.remainingMs > cooldownMs - RACE_CONDITION_WINDOW) {
        // Race condition: another request just claimed → return empty (Fossabot ignores empty responses)
        return new Response('', { headers: RESPONSE_HEADERS });
      }
      const remainingSec = spinClaim.remainingMs ? Math.ceil(spinClaim.remainingMs / 1000) : COOLDOWN_SECONDS;
      return new Response(`@${username} ⏱️ Cooldown: Noch ${remainingSec} Sekunden!     `, { headers: RESPONSE_HEADERS });
    }

    // Selfban Check
    if (selfBanData) {
      return new Response(`@${username} 🚫 Du hast dich selbst vom Spielen ausgeschlossen (seit ${selfBanData.date}). Kontaktiere einen Admin für eine Freischaltung. Hilfe: ${URLS.INFO}`, { headers: RESPONSE_HEADERS });
    }

    // First-Time Disclaimer
    if (!hasAccepted) {
      return new Response(`@${username} 🦡 Willkommen! Dachsbau Slots ist nur zur Unterhaltung - Hier geht es NICHT um Echtgeld! Verstanden? Schreib "!slots accept" zum Spielen! Weitere Infos: ${URLS.INFO} | Shop: ${URLS.SHOP} 🎰`, { headers: RESPONSE_HEADERS });
    }

    // KV cooldown fallback (only when D1 is disabled)
    if ((!D1_ENABLED || !env.DB) && lastSpin && (now - lastSpin) < cooldownMs) {
      const remainingSec = Math.ceil((cooldownMs - (now - lastSpin)) / 1000);
      return new Response(`@${username} ⏱️ Cooldown: Noch ${remainingSec} Sekunden!     `, { headers: RESPONSE_HEADERS });
    }

    // Free Spins - consume AFTER security checks pass (avoids losing spins on rejected requests)
    let isFreeSpinUsed = false;
    let freeSpinMultiplier = 1;
    const hasAvailableFreeSpins = Array.isArray(availableFreeSpins) && availableFreeSpins.some(fs => fs.count > 0);
    if (hasAvailableFreeSpins) {
      const freeSpinResult = await consumeFreeSpinWithMultiplier(username, env)
        .catch(err => { logError('handleSlot.consumeFreeSpin', err, { username }); return null; });
      if (freeSpinResult && typeof freeSpinResult === 'object') {
        isFreeSpinUsed = freeSpinResult.used === true;
        freeSpinMultiplier = (typeof freeSpinResult.multiplier === 'number' && freeSpinResult.multiplier > 0) ? freeSpinResult.multiplier : 1;
      }
    }

    // Parse spin amount
    const spinAmountResult = await parseSpinAmount(username, amountParam || null, currentBalance, isFreeSpinUsed, env);
    if (spinAmountResult.error) {
      return new Response(spinAmountResult.error, { headers: RESPONSE_HEADERS });
    }

    let spinCost = isFreeSpinUsed ? 0 : (spinAmountResult.spinCost || BASE_SPIN_COST);
    const multiplier = isFreeSpinUsed ? freeSpinMultiplier : (spinAmountResult.multiplier || 1);

    // Happy Hour check (already loaded)
    if (!isFreeSpinUsed && spinCost < FREE_SPIN_COST_THRESHOLD && hasHappyHour) {
      spinCost = Math.floor(spinCost / 2);
    }

    // Balance check
    if (!isFreeSpinUsed && currentBalance < spinCost) {
      return new Response(`@${username} ❌ Nicht genug DachsTaler! Du brauchst ${spinCost} (Aktuell: ${currentBalance}) 🦡`, { headers: RESPONSE_HEADERS });
    }

    // Calculate Dachs chance
    let dachsChance = DACHS_BASE_CHANCE;
    if (hasLuckyCharm) dachsChance *= 2;
    if (hasDachsLocator.active) dachsChance *= 3;
    if (hasRageMode.active && hasRageMode.stack > 0) {
      dachsChance *= (1 + hasRageMode.stack / 100);
    }

    // Generate grid (with pre-loaded peek for optimization)
    const grid = await generateGrid(lowerUsername, dachsChance, hasStarMagnet, hasDiamondRush, env, preloadedPeek);

    // Save original grid for achievement tracking (before special items modify it)
    const originalGrid = [...grid];

    // STAGE 2 AWAIT: Now that grid is generated, await non-essential buffs
    const [
      insuranceCount,
      previousStreak,
      hasGoldenHour,
      hasProfitDoubler,
      hasJackpotBooster,
      currentStreakMulti,
      prestigeRank,
      lastDaily,
      hasDailyBoost,
      kvMessages
    ] = await stage2Promise as [
      number,
      StreakData,
      boolean,
      boolean,
      boolean,
      number,
      string | null,
      number | null,
      boolean,
      CustomMessages | null
    ];

    // Decrement Dachs Locator uses (using atomic function with retry mechanism)
    if (hasDachsLocator.active) {
      await decrementBuffUses(username, 'dachs_locator', env);
    }

    // Apply special items
    await applySpecialItems(username, grid, hasGuaranteedPairToken, hasWildCardToken, env);

    // Calculate win
    const result: WinResult = calculateWin(grid);

    // Hourly Jackpot
    let hourlyJackpotWon = false;
    if (await checkAndClaimHourlyJackpot(env)) {
      result.points += HOURLY_JACKPOT_AMOUNT;
      hourlyJackpotWon = true;
    }

    // OPTIMIZED: Apply buffs with pre-loaded values
    const preloadedBuffs = { hasGoldenHour, hasProfitDoubler, hasJackpotBooster, currentStreakMulti };
    const { shopBuffs, streakMulti } = await applyMultipliersAndBuffs(username, result, multiplier, grid, env, preloadedBuffs);

    // OPTIMIZED: Calculate streak bonuses with pre-loaded streak
    const isWin = result.points > 0 || !!(result.freeSpins && result.freeSpins > 0);
    const streakBonusResult = await calculateStreakBonuses(lowerUsername, username, isWin, previousStreak, env);
    const { streakBonus, comboBonus, naturalBonuses } = streakBonusResult;
    let lossWarningMessage = streakBonusResult.lossWarningMessage;

    // Track streak triggers for achievements
    const hotStreakTriggered = isWin && previousStreak.wins + 1 === STREAK_THRESHOLD;
    const comebackTriggered = isWin && previousStreak.losses >= STREAK_THRESHOLD;
    const isAllIn = amountParam && amountParam.toLowerCase() === 'all';

    // Rage Mode updates
    const rageModeKey = kvKey('buff:', lowerUsername, 'rage_mode');
    if (!isWin && hasRageMode.active && hasRageMode.data) {
      const data = hasRageMode.data;
      data.stack = Math.min((data.stack || 0) + RAGE_MODE_LOSS_STACK, RAGE_MODE_MAX_STACK);
      const serialized = JSON.stringify(data);
      await Promise.all([
        env.SLOTS_KV.put(rageModeKey, serialized, { expirationTtl: calculateBuffTTL(data.expireAt) }),
        resetStreakMultiplier(username, env)
      ]);
      if (D1_ENABLED && DUAL_WRITE && env.DB) {
        upsertItem(username, 'buff:rage_mode', serialized, env).catch(err => logError('rageMode.d1', err, { username }));
      }
    } else if (isWin && hasRageMode.active && hasRageMode.data) {
      const data = hasRageMode.data;
      data.stack = 0;
      const serialized = JSON.stringify(data);
      await Promise.all([
        env.SLOTS_KV.put(rageModeKey, serialized, { expirationTtl: calculateBuffTTL(data.expireAt) }),
        incrementStreakMultiplier(username, env)
      ]);
      if (D1_ENABLED && DUAL_WRITE && env.DB) {
        upsertItem(username, 'buff:rage_mode', serialized, env).catch(err => logError('rageMode.d1', err, { username }));
      }
    } else if (isWin) {
      await incrementStreakMultiplier(username, env);
    } else {
      await resetStreakMultiplier(username, env);
    }

    // OPTIMIZED: Insurance check (pre-loaded insuranceCount and prestigeRank)
    if (!isFreeSpinUsed && result.points === 0 && !result.freeSpins && insuranceCount > 0) {
      const refund = Math.floor(spinCost * INSURANCE_REFUND_RATE);
      // Atomic D1 balance operation: deduct net loss (spinCost - refund) atomically
      const netInsuranceLoss = spinCost - refund;
      const deductResult = await deductBalance(username, netInsuranceLoss, env);
      let newBalanceWithRefund: number;
      if (deductResult.success) {
        newBalanceWithRefund = deductResult.newBalance;
      } else {
        // Insufficient balance edge case — spin already consumed, set to 0
        await setBalance(username, 0, env);
        newBalanceWithRefund = 0;
      }

      await Promise.all([
        updateStats(username, false, result.points, spinCost, env),
        decrementInsuranceCount(username, env)
      ]);
      const rankSymbol = prestigeRank ? `${prestigeRank} ` : '';

      // Achievement tracking (insurance used) - use waitUntil to prevent Worker termination
      const insuranceAchievementPromise = trackSlotAchievements(username, originalGrid, grid, result, newBalanceWithRefund, isFreeSpinUsed, isAllIn || false, hasWildCardToken, true, hourlyJackpotWon, hotStreakTriggered, comebackTriggered, env, { spinCost })
        .catch(err => logError('trackSlotAchievements.insurance', err, { username }));
      if (ctx) ctx.waitUntil(insuranceAchievementPromise);

      return new Response(`@${username} ${rankSymbol}[ ${grid.join(' ')} ] ${result.message} 🛡️ ║ Insurance +${refund} (${insuranceCount - 1} übrig) ║ Kontostand: ${newBalanceWithRefund} DachsTaler`, { headers: RESPONSE_HEADERS });
    }

    // Atomic D1 balance operation: apply net delta (winnings + bonuses - cost) atomically
    const totalBonuses = streakBonus + comboBonus;
    const effectiveSpinCost = isFreeSpinUsed ? 0 : spinCost;
    const netDelta = result.points + totalBonuses - effectiveSpinCost;
    let newBalance: number;
    if (netDelta > 0) {
      newBalance = await creditBalance(username, netDelta, env);
    } else if (netDelta < 0) {
      const deductResult = await deductBalance(username, Math.abs(netDelta), env);
      if (deductResult.success) {
        newBalance = deductResult.newBalance;
      } else {
        // Insufficient balance edge case — spin already consumed, set to 0
        await setBalance(username, 0, env);
        newBalance = 0;
      }
    } else {
      // Break even — no balance change needed, read current
      newBalance = await getBalance(username, env);
    }

    // OPTIMIZED: Final updates (prestigeRank already pre-loaded)
    await Promise.all([
      updateStats(username, result.points > 0, Math.max(0, result.points - spinCost), spinCost, env),
      setLastSpin(username, now, env),
      setLastActive(username, env)
    ]);

    const rank = prestigeRank; // Pre-loaded

    // OPTIMIZED: Compute remaining free spins from initial read instead of re-reading KV
    let remainingCount = 0;
    if (Array.isArray(availableFreeSpins)) {
      remainingCount = availableFreeSpins.reduce((sum, fs) => sum + (fs.count || 0), 0);
      if (isFreeSpinUsed) remainingCount = Math.max(0, remainingCount - 1);
    }

    // OPTIMIZED: Low Balance Warning (lastDaily and hasDailyBoost pre-loaded)
    // Fixed: Use German timezone consistently (same as handleDaily)
    if (newBalance < LOW_BALANCE_WARNING) {
      const todayGerman = getCurrentDate();

      let dailyAvailable = !lastDaily;
      if (lastDaily) {
        const lastDailyGerman = getGermanDateFromTimestamp(lastDaily);
        dailyAvailable = todayGerman !== lastDailyGerman;
      }

      if (dailyAvailable) {
        const dailyAmountValue = hasDailyBoost ? DAILY_BOOST_AMOUNT : DAILY_AMOUNT;
        lossWarningMessage = lossWarningMessage
          ? `${lossWarningMessage} ⚠️ Niedriger Kontostand! Nutze !slots daily für +${dailyAmountValue} DachsTaler`
          : `⚠️ Niedriger Kontostand! Nutze !slots daily für +${dailyAmountValue} DachsTaler`;
      }
    }

    // Custom Message (KV-based)
    let customMsgAppend: string | null = null;
    if (kvMessages) {
      const msgArray = isWin ? kvMessages.win : kvMessages.loss;
      if (msgArray && msgArray.length > 0) {
        customMsgAppend = msgArray[secureRandomInt(0, msgArray.length - 1)];
      }
    }

    // Achievement tracking - use waitUntil to prevent Worker termination before completion
    // Pass extended data for tracking loss streaks and spin costs
    const extendedData = {
      spinCost,
      currentLossStreak: !isWin ? streakBonusResult.newStreak?.losses || 0 : 0
    };
    const achievementPromise = trackSlotAchievements(username, originalGrid, grid, result, newBalance, isFreeSpinUsed, isAllIn || false, hasWildCardToken, false, hourlyJackpotWon, hotStreakTriggered, comebackTriggered, env, extendedData)
      .catch(err => logError('trackSlotAchievements', err, { username }));
    if (ctx) ctx.waitUntil(achievementPromise);

    // Build response
    const totalWin = result.points + totalBonuses;
    let message = buildResponseMessage(username, grid, result, totalWin, newBalance, rank, isFreeSpinUsed, multiplier, remainingCount, hourlyJackpotWon, naturalBonuses, shopBuffs, streakMulti, lossWarningMessage, spinCost, hasWildCardToken);

    // Append custom message if available
    if (customMsgAppend) {
      message += ` | 💬 "${customMsgAppend}"`;
    }

    return new Response(message, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logError('handleSlot', error, { username, amountParam });
    return new Response(`@${username} ❌ Fehler beim Spin.`, { headers: RESPONSE_HEADERS });
  }
}

export { handleSlot, calculateWin };
