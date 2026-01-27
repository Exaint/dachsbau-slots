/**
 * EventSub Routes - Twitch EventSub webhook handler + setup endpoint
 * Required for bot badge: Twitch needs an active channel.chat.message subscription
 */

import { logError } from '../utils.js';
import { createEventSubSubscription, listEventSubSubscriptions } from '../web/twitch.js';
import type { Env } from '../types/index.js';

const EVENTSUB_MESSAGE_TYPE_HEADER = 'twitch-eventsub-message-type';
const EVENTSUB_MESSAGE_ID_HEADER = 'twitch-eventsub-message-id';
const EVENTSUB_MESSAGE_TIMESTAMP_HEADER = 'twitch-eventsub-message-timestamp';
const EVENTSUB_MESSAGE_SIGNATURE_HEADER = 'twitch-eventsub-message-signature';

const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000; // 10 minutes replay protection

/**
 * Verify Twitch EventSub webhook signature (HMAC-SHA256)
 */
async function verifySignature(secret: string, messageId: string, timestamp: string, body: string, expectedSignature: string): Promise<boolean> {
  const message = messageId + timestamp + body;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const hex = Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');

  return expectedSignature === `sha256=${hex}`;
}

/**
 * Handle Twitch EventSub webhook POST requests
 * Verifies signature, handles verification challenges, notifications, and revocations
 */
export async function handleEventSubWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.EVENTSUB_SECRET) {
    return new Response('EventSub not configured', { status: 500 });
  }

  const messageType = request.headers.get(EVENTSUB_MESSAGE_TYPE_HEADER);
  const messageId = request.headers.get(EVENTSUB_MESSAGE_ID_HEADER);
  const timestamp = request.headers.get(EVENTSUB_MESSAGE_TIMESTAMP_HEADER);
  const signature = request.headers.get(EVENTSUB_MESSAGE_SIGNATURE_HEADER);

  if (!messageType || !messageId || !timestamp || !signature) {
    return new Response('Missing required headers', { status: 400 });
  }

  // Replay protection: reject messages older than 10 minutes
  const messageAge = Date.now() - new Date(timestamp).getTime();
  if (messageAge > MAX_MESSAGE_AGE_MS) {
    return new Response('Message too old', { status: 403 });
  }

  const body = await request.text();

  // Verify HMAC signature
  const valid = await verifySignature(env.EVENTSUB_SECRET, messageId, timestamp, body, signature);
  if (!valid) {
    return new Response('Invalid signature', { status: 403 });
  }

  // Handle message types
  if (messageType === 'webhook_callback_verification') {
    const data = JSON.parse(body) as { challenge: string };
    return new Response(data.challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  if (messageType === 'notification') {
    // We don't need to process chat messages — the subscription just needs to exist
    return new Response(null, { status: 204 });
  }

  if (messageType === 'revocation') {
    const data = JSON.parse(body) as { subscription?: { type?: string; status?: string } };
    logError('EventSub revocation', new Error(`Subscription revoked: ${data.subscription?.type} - ${data.subscription?.status}`));
    return new Response(null, { status: 204 });
  }

  return new Response('Unknown message type', { status: 400 });
}

/**
 * Admin endpoint: Setup bot badge by creating EventSub subscription
 * GET /api/setup-bot-badge?secret=<BOT_SECRET>
 */
export async function handleSetupBotBadge(url: URL, env: Env): Promise<Response> {
  // Verify admin access via BOT_SECRET
  const secret = url.searchParams.get('secret');
  if (!env.BOT_SECRET || secret !== env.BOT_SECRET) {
    return new Response('Unauthorized', { status: 403 });
  }

  try {
    // List existing subscriptions
    const existing = await listEventSubSubscriptions(env);

    // Check if channel.chat.message subscription already exists and is enabled
    const hasActiveSubscription = existing.some(
      (sub: { type: string; status: string }) => sub.type === 'channel.chat.message' && sub.status === 'enabled'
    );

    let created = null;
    if (!hasActiveSubscription) {
      created = await createEventSubSubscription(env, url.origin);
    }

    return new Response(JSON.stringify({
      success: true,
      existing: existing.length,
      subscriptions: existing.map((sub: { type: string; status: string; id: string }) => ({
        id: sub.id,
        type: sub.type,
        status: sub.status
      })),
      created: created ? true : false,
      message: hasActiveSubscription
        ? 'channel.chat.message Subscription ist bereits aktiv'
        : (created ? 'Neue Subscription erstellt — Twitch verifiziert den Webhook' : 'Subscription-Erstellung fehlgeschlagen')
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('handleSetupBotBadge', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
