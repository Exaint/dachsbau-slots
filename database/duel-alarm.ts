/**
 * Durable Object: DuelTimeoutAlarm
 *
 * Schedules a precise alarm for duel timeout notifications.
 * When a duel is created, the Worker creates a DO instance and schedules
 * an alarm for DUEL_TIMEOUT_SECONDS + 2 seconds. When the alarm fires,
 * it sends a chat message via Twitch Helix API.
 *
 * If the duel is accepted/declined before the alarm fires, the alarm
 * is cancelled via cancelTimeout().
 */

import { DurableObject } from 'cloudflare:workers';
import { DUEL_TIMEOUT_SECONDS } from '../constants.js';
import { sendChatMessage } from '../web/twitch.js';
import { logError } from '../utils.js';
import type { Env } from '../types/index.js';

interface DuelAlarmData {
  challenger: string;
  target: string;
  amount: number;
}

export class DuelTimeoutAlarm extends DurableObject<Env> {
  /**
   * Schedule a timeout notification for a duel.
   * Called when a new duel is created.
   */
  async scheduleTimeout(challenger: string, target: string, amount: number, delayMs: number): Promise<void> {
    await this.ctx.storage.put('duelData', { challenger, target, amount } satisfies DuelAlarmData);
    await this.ctx.storage.setAlarm(Date.now() + delayMs);
  }

  /**
   * Cancel a pending timeout notification.
   * Called when a duel is accepted, declined, or manually deleted.
   */
  async cancelTimeout(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  /**
   * Alarm handler - fires when the duel timeout expires.
   * Sends a chat message and cleans up storage.
   */
  async alarm(): Promise<void> {
    try {
      const data = await this.ctx.storage.get<DuelAlarmData>('duelData');
      if (!data) return; // Already cancelled or processed

      // Delete cron fallback key BEFORE sending to prevent duplicate from cron
      await this.env.SLOTS_KV.delete(`duel_notify:${data.challenger.toLowerCase()}`);

      await sendChatMessage(
        `⏰ @${data.challenger} Dein Duell gegen @${data.target} (${data.amount} DachsTaler) ist abgelaufen — @${data.target} hat sich wie ein feiger Dachs im Dachsbau versteckt :c`,
        this.env
      );
    } catch (error) {
      logError('DuelTimeoutAlarm.alarm', error);
    } finally {
      // Always clean up DO storage
      await this.ctx.storage.deleteAll();
    }
  }
}

// ============================================
// Helper Functions (called from duels.ts)
// ============================================

/**
 * Schedule a duel timeout alarm via Durable Object.
 * Fires DUEL_TIMEOUT_SECONDS + 2 seconds after creation.
 */
export async function scheduleDuelAlarm(challenger: string, target: string, amount: number, env: Env): Promise<void> {
  try {
    const id = env.DUEL_ALARM.idFromName(challenger.toLowerCase());
    const stub = env.DUEL_ALARM.get(id) as unknown as DuelTimeoutAlarm;
    await stub.scheduleTimeout(challenger, target, amount, (DUEL_TIMEOUT_SECONDS + 2) * 1000);
  } catch (error) {
    logError('scheduleDuelAlarm', error, { challenger, target, amount });
  }
}

/**
 * Cancel a pending duel timeout alarm via Durable Object.
 * Called when duel is accepted, declined, or deleted.
 */
export async function cancelDuelAlarm(challenger: string, env: Env): Promise<void> {
  try {
    const id = env.DUEL_ALARM.idFromName(challenger.toLowerCase());
    const stub = env.DUEL_ALARM.get(id) as unknown as DuelTimeoutAlarm;
    await stub.cancelTimeout();
  } catch (error) {
    logError('cancelDuelAlarm', error, { challenger });
  }
}
