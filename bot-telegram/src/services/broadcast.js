// src/services/broadcast.js
// Broadcast service: send messages to all Telegram users
// Supports: text, photo+caption, HTML/MarkdownV2, scheduling, delivery tracking

import { supabase } from '../database/supabase.js';
import { logger } from '../utils/logger.js';

// Telegram rate limits: max ~30 messages/sec to different users
// We use 35ms delay (≈28/sec) with batch pauses every 25 messages
const DELAY_PER_MESSAGE_MS = 35;
const BATCH_SIZE = 25;
const BATCH_PAUSE_MS = 1000; // 1 second pause every 25 messages
const PHOTO_CAPTION_LIMIT = 1024;

async function sendBroadcastToUser(telegram, userId, broadcast) {
  const message = String(broadcast.message || '');
  const parseMode = broadcast.parse_mode || 'HTML';

  if (broadcast.image_url) {
    if (message.length > PHOTO_CAPTION_LIMIT) {
      await telegram.sendPhoto(userId, broadcast.image_url);
      await telegram.sendMessage(userId, message, {
        parse_mode: parseMode,
        disable_web_page_preview: true,
      });
      return;
    }

    await telegram.sendPhoto(userId, broadcast.image_url, {
      ...(message ? { caption: message, parse_mode: parseMode } : {}),
    });
    return;
  }

  await telegram.sendMessage(userId, message, {
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

/**
 * Execute a broadcast: send message to all users in the `users` table.
 * Updates the `broadcasts` row with progress and results.
 *
 * @param {object} telegram - Telegraf telegram instance (bot.telegram)
 * @param {string} broadcastId - UUID of the broadcast row
 * @returns {Promise<{sent: number, failed: number, total: number}>}
 */
export async function executeBroadcast(telegram, broadcastId) {
  // 1. Load broadcast record
  const { data: broadcast, error: fetchErr } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('id', broadcastId)
    .single();

  if (fetchErr || !broadcast) {
    logger.error('[BROADCAST] Broadcast not found', { broadcastId, error: fetchErr?.message });
    return { sent: 0, failed: 0, total: 0 };
  }

  if (broadcast.status === 'completed' || broadcast.status === 'cancelled') {
    logger.warn('[BROADCAST] Broadcast already finished, skipping', { broadcastId, status: broadcast.status });
    return { sent: broadcast.sent_count, failed: broadcast.failed_count, total: broadcast.total_recipients };
  }

  // 2. Get all user IDs from Supabase
  const { data: allUsers, error: usersErr } = await supabase
    .from('users')
    .select('user_id');

  if (usersErr) {
    logger.error('[BROADCAST] Failed to fetch users', { error: usersErr.message });
    await supabase.from('broadcasts').update({ status: 'draft' }).eq('id', broadcastId);
    return { sent: 0, failed: 0, total: 0 };
  }

  const userIds = (allUsers || []).map(u => String(u.user_id)).filter(Boolean);
  const total = userIds.length;

  if (total === 0) {
    logger.warn('[BROADCAST] No users to broadcast to');
    await supabase.from('broadcasts').update({
      status: 'completed',
      total_recipients: 0,
      sent_count: 0,
      failed_count: 0,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq('id', broadcastId);
    return { sent: 0, failed: 0, total: 0 };
  }

  // 3. Mark as sending
  await supabase.from('broadcasts').update({
    status: 'sending',
    total_recipients: total,
    started_at: new Date().toISOString(),
  }).eq('id', broadcastId);

  logger.info(`[BROADCAST] Starting broadcast ${broadcastId}: ${total} recipients`, {
    message: broadcast.message?.slice(0, 30),
    hasImage: !!broadcast.image_url,
    parseMode: broadcast.parse_mode,
  });

  // 4. Send messages
  let sent = 0;
  let failed = 0;
  const failedIds = [];

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];

    try {
      await sendBroadcastToUser(telegram, userId, broadcast);
      sent++;
    } catch (err) {
      failed++;
      failedIds.push(userId);

      // Log specific error types
      const errDesc = err?.response?.description || err?.message || 'unknown';
      const errCode = err?.response?.error_code || 0;

      if (errCode === 403) {
        // User blocked the bot — expected, don't spam logs
        logger.debug(`[BROADCAST] User ${userId} blocked bot`);
      } else if (errCode === 429) {
        // Rate limited — wait and retry
        const retryAfter = err?.response?.parameters?.retry_after || 5;
        logger.warn(`[BROADCAST] Rate limited, waiting ${retryAfter}s`, { userId });
        await sleep(retryAfter * 1000);
        // Retry once
        try {
          await sendBroadcastToUser(telegram, userId, broadcast);
          sent++;
          failed--;
          failedIds.pop();
        } catch {
          // Still failed after retry
          logger.warn(`[BROADCAST] Retry failed for ${userId}`);
        }
      } else {
        logger.warn(`[BROADCAST] Failed to send to ${userId}: [${errCode}] ${errDesc}`);
      }
    }

    // Rate limiting: delay between messages
    await sleep(DELAY_PER_MESSAGE_MS);

    // Batch pause every BATCH_SIZE messages
    if ((i + 1) % BATCH_SIZE === 0 && i + 1 < userIds.length) {
      await sleep(BATCH_PAUSE_MS);

      // Update progress in DB every batch
      await supabase.from('broadcasts').update({
        sent_count: sent,
        failed_count: failed,
      }).eq('id', broadcastId);
    }
  }

  // 5. Mark as completed
  await supabase.from('broadcasts').update({
    status: 'completed',
    sent_count: sent,
    failed_count: failed,
    total_recipients: total,
    failed_user_ids: failedIds.length > 0 ? failedIds.slice(0, 500) : null, // cap at 500 for storage
    completed_at: new Date().toISOString(),
  }).eq('id', broadcastId);

  logger.info(`[BROADCAST] Completed ${broadcastId}: sent=${sent}, failed=${failed}, total=${total}`);

  return { sent, failed, total };
}

/**
 * Check for scheduled broadcasts that are due and execute them.
 * Called periodically by the scheduler.
 */
export async function processScheduledBroadcasts(telegram) {
  try {
    const now = new Date().toISOString();

    const { data: dueBroadcasts, error } = await supabase
      .from('broadcasts')
      .select('id, message')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(5);

    if (error) {
      logger.error('[BROADCAST SCHEDULER] Failed to check scheduled broadcasts', { error: error.message });
      return;
    }

    if (!dueBroadcasts || dueBroadcasts.length === 0) return;

    for (const bc of dueBroadcasts) {
      logger.info(`[BROADCAST SCHEDULER] Executing scheduled broadcast: ${bc.message?.slice(0, 30)} (${bc.id})`);
      await executeBroadcast(telegram, bc.id);
    }
  } catch (err) {
    logger.error('[BROADCAST SCHEDULER] Error', { error: err?.message });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default { executeBroadcast, processScheduledBroadcasts };
