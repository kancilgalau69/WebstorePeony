// bot-telegram/index.js
import { Telegraf } from 'telegraf';
import express from 'express';
import { BOT_CONFIG, validateConfig } from './src/bot/config.js';
import { loadProducts } from './src/data/products.js';
import { logger } from './src/utils/logger.js';
import Logger from './src/utils/logger.js';
import { 
  metrics, 
  MetricNames,
  createCommandMetricsMiddleware,
  createCallbackMetricsMiddleware,
  createHttpMetricsMiddleware
} from './src/utils/metrics.js';
import {
  messageLimiter,
  commandLimiter,
  callbackLimiter,
  createRateLimitMiddleware
} from './src/utils/rateLimiter.js';
import {
  scheduler,
  setupProductRefreshJob,
  setupLowStockAlertJob,
  setupCleanupJob,
  setupReservationCleanupJob,
  setupMetricsUpdateJob
} from './src/services/scheduler.js';
import { loadState, saveState, startAutoSave } from './src/bot/persistence.js';
import {
  handleStart,
  handleHelp,
  handleMenu,
  handleSearch,
  handleCategories,
  handleFavorites,
  handleHistory,
  handleBuyCommand,
  handleStatus,
  handleTextMessage,
} from './src/bot/handlers/commands.js';
import { handleCallbackQuery } from './src/bot/handlers/callbacks.js';
import { handleAdminCommand } from './src/bot/handlers/admin.js';
import {
  handleMidtransWebhook,
  handleRefreshWebhook,
  handleLowStockWebhook,
  handleStatusEndpoint,
} from './src/bot/handlers/webhook.js';
import { upsertUser } from './src/database/users.js';

console.log('\n' + '═'.repeat(50));
console.log('  🤖  Rain Store Telegram Bot v2.0');
console.log('═'.repeat(50) + '\n');

// Validate configuration
try {
  validateConfig();
  logger.info('✅ Configuration validated');
} catch (error) {
  logger.error('❌ Configuration error:', { error: error.message });
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf(BOT_CONFIG.TELEGRAM_BOT_TOKEN, {
  handlerTimeout: 30_000,
});

// Bot info
(async () => {
  try {
    const me = await bot.telegram.getMe();
    console.log(`\n🤖 Bot: @${me.username}`);
    console.log(`📦 Store: ${BOT_CONFIG.STORE_NAME}`);
    console.log(`👥 Admins: ${BOT_CONFIG.TELEGRAM_ADMIN_IDS.length}`);
  } catch (error) {
    logger.error('❌ Failed to get bot info:', { error: error.message });
    process.exit(1);
  }
})();

// ==================== Middleware ====================

// Correlation ID for tracking
bot.use(Logger.createTelegrafMiddleware());

// Auto-track all users (save/update user on every interaction)
bot.use(async (ctx, next) => {
  if (ctx.from && ctx.from.id) {
    try {
      await upsertUser({
        user_id: String(ctx.from.id),
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        language: ctx.from.language_code || 'id',
      });
    } catch (error) {
      // Don't block request if user save fails
      console.error('[USER TRACK] Failed to track user:', error?.message);
    }
  }
  return next();
});

// Rate limiting (skip for admins)
bot.use(createRateLimitMiddleware(messageLimiter, {
  skipCondition: (ctx) => BOT_CONFIG.TELEGRAM_ADMIN_IDS.includes(ctx.from?.id)
}));

// Metrics tracking
bot.use((ctx, next) => {
  metrics.incCounter(MetricNames.MESSAGE_RECEIVED, { 
    type: ctx.updateType || 'unknown' 
  });
  return next();
});

// Command metrics
bot.use(createCommandMetricsMiddleware());

// ==================== Commands ====================

bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command(['menu', 'catalog'], handleMenu);
bot.command('search', handleSearch);
bot.command('categories', handleCategories);
bot.command('favorites', handleFavorites);
bot.command('history', handleHistory);
bot.command('buy', handleBuyCommand);
bot.command('status', handleStatus);

// Admin commands
bot.command('admin', handleAdminCommand);

// Handle photo messages with caption "/admin broadcast ..." (direct photo broadcast)
bot.on('photo', async (ctx, next) => {
  const caption = ctx.message?.caption || '';
  if (caption.match(/^\/admin\s+broadcast/i)) {
    const userId = ctx.from?.id;
    if (!BOT_CONFIG.TELEGRAM_ADMIN_IDS.includes(userId)) {
      return next();
    }
    // Route to admin broadcast handler
    return handleAdminCommand(ctx);
  }
  return next();
});
bot.command('adminhelp', async (ctx) => {
  const { formatAdminHelp } = await import('./src/bot/formatters.js');
  await ctx.replyWithMarkdown(formatAdminHelp());
});

// Keyboard button handlers
bot.hears(/^📋\s*Katalog$/i, handleMenu);
bot.hears(/^📂\s*Kategori$/i, handleCategories);
bot.hears(/^⭐\s*Favorit$/i, handleFavorites);
bot.hears(/^📜\s*Riwayat$/i, handleHistory);
bot.hears(/^❓\s*Bantuan$/i, handleHelp);
bot.hears(/^🔍\s*Cari$/i, async (ctx) => {
  await ctx.reply(
    '🔍 *Pencarian Produk*\n\n' +
    'Kirim pesan dengan format:\n' +
    '/search <kata kunci>\n\n' +
    'Atau langsung ketik nama produk untuk mencari.',
    { parse_mode: 'Markdown' }
  );
});

// Callback query handler (with rate limiting and metrics)
bot.on('callback_query', 
  createRateLimitMiddleware(callbackLimiter, {
    skipCondition: (ctx) => BOT_CONFIG.TELEGRAM_ADMIN_IDS.includes(ctx.from?.id)
  }),
  createCallbackMetricsMiddleware(),
  handleCallbackQuery
);

// Text message handler (for quick buy and search)
bot.on('text', handleTextMessage);

// Error handler
bot.catch((err, ctx) => {
  logger.error('[BOT ERROR]', { 
    error: err.message, 
    stack: err.stack,
    userId: ctx.from?.id,
    correlationId: ctx.correlationId
  });
  metrics.incCounter(MetricNames.COMMAND_ERRORS, { error: err.name });
  try {
    ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi atau hubungi admin.');
  } catch {}
});

// ==================== Express Server ====================

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(Logger.createExpressMiddleware());
app.use(createHttpMetricsMiddleware());

// Disable caching
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Status endpoint (enhanced)
app.get('/status', handleStatusEndpoint);

// Metrics endpoint (Prometheus format)
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics.toPrometheusFormat());
});

// Metrics JSON endpoint
app.get('/metrics/json', (req, res) => {
  res.json(metrics.toJSON());
});

// Midtrans webhook
app.post('/webhook/midtrans', (req, res) => {
  handleMidtransWebhook(req, res, bot.telegram);
});

// Product refresh webhook
app.get('/webhook/refresh', (req, res) => {
  handleRefreshWebhook(req, res);
});

app.post('/webhook/refresh', (req, res) => {
  handleRefreshWebhook(req, res);
});

// Low stock alert webhook
app.post('/webhook/lowstock', (req, res) => {
  handleLowStockWebhook(req, res, bot.telegram);
});

// Broadcast trigger webhook (from dashboard admin)
app.post('/webhook/broadcast', async (req, res) => {
  try {
    const secret = req.get('x-refresh-key') || req.body?.secret;
    if (secret !== BOT_CONFIG.WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const broadcastId = req.body?.broadcast_id;
    if (!broadcastId) {
      return res.status(400).json({ error: 'Missing broadcast_id' });
    }

    const { executeBroadcast } = await import('./src/services/broadcast.js');

    // Execute async (don't block the response)
    res.json({ success: true, message: 'Broadcast triggered' });

    // Execute in background
    executeBroadcast(bot.telegram, broadcastId).catch(err => {
      logger.error('[WEBHOOK BROADCAST] Execution error:', { error: err?.message, broadcastId });
    });
  } catch (error) {
    logger.error('[WEBHOOK BROADCAST] Error:', { error: error?.message });
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Telegram webhook endpoint
const webhookPath = '/webhook/telegram';
const webhookUrl = `${BOT_CONFIG.PUBLIC_BASE_URL}${webhookPath}`;

// ==================== Launch ====================

async function launch() {
  try {
    console.log('\n⚡ Starting bot...\n');
    
    // Load saved state (users, favorites, etc)
    await loadState();
    
    // Load products
    await loadProducts(true);
    const { getAll } = await import('./src/data/products.js');
    const products = getAll();
    console.log(`✅ Products loaded: ${products.length}`);
    
    // Start scheduler
    scheduler.start();
    
    // Setup scheduled jobs
    await setupProductRefreshJob(5); // Refresh products every 5 minutes
    await setupLowStockAlertJob(bot, {
      intervalMinutes: 60,
      threshold: 5,
      adminIds: BOT_CONFIG.TELEGRAM_ADMIN_IDS
    });
    await setupReservationCleanupJob(5); // Every 5 minutes
    await setupCleanupJob(24);
    setupMetricsUpdateJob(60);
    
    // Setup broadcast scheduler (check every 60 seconds for due scheduled broadcasts)
    const { processScheduledBroadcasts } = await import('./src/services/broadcast.js');
    scheduler.addJob(
      'broadcast-scheduler',
      () => processScheduledBroadcasts(bot.telegram),
      60 * 1000, // every 60 seconds
      { runImmediately: true }
    );
    console.log('✅ Broadcast scheduler active');
    
    // Start auto-save (every 5 minutes)
    startAutoSave(5);
    
    // Setup Supabase Realtime subscription for instant cache invalidation
    try {
      const { setupRealtimeSubscription } = await import('./src/database/supabase.js');
      setupRealtimeSubscription();
      console.log('✅ Realtime subscription active');
    } catch (rtErr) {
      console.warn('⚠️ Realtime subscription failed (non-critical):', rtErr.message);
    }
    
    console.log('✅ Scheduler configured (5 jobs)');
    
    // Start Express HTTP server
    const server = app.listen(BOT_CONFIG.HTTP_PORT, () => {
      console.log(`✅ Express server listening: ${BOT_CONFIG.HTTP_PORT}`);
    });

    // Determine launch mode
    const isWebhookMode = BOT_CONFIG.PUBLIC_BASE_URL && 
                          BOT_CONFIG.PUBLIC_BASE_URL.startsWith('http') && 
                          !BOT_CONFIG.USE_POLLING;

    if (isWebhookMode) {
      console.log(`✅ Webhook mode enabled (${webhookUrl})`);
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
      app.use(bot.webhookCallback(webhookPath));
    } else {
      console.log('✅ Polling mode enabled');
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.launch();
    }

    console.log('\n' + '═'.repeat(50));
    console.log('  ✨  Bot is ready!');
    console.log('═'.repeat(50) + '\n');

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n🛑 Shutting down gracefully...`);
      console.log('💾 Saving state...');
      await saveState();
      scheduler.stop();

      server.close(() => {
        console.log('✅ Server closed');
      });

      try {
        bot.stop(signal);
      } catch {}

      setTimeout(() => {
        console.log('👋 Goodbye!\n');
        process.exit(0);
      }, 1000);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    
  } catch (error) {
    logger.error('❌ Failed to launch bot:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start the bot
launch();
