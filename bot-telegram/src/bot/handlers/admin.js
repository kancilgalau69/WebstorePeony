// src/bot/handlers/admin.js
import { BOT_CONFIG } from '../config.js';
import { getAnalyticsSummary, USER_SESSIONS, ACTIVE_ORDERS } from '../state.js';
import { formatAdminDashboard, formatAdminHelp, formatCurrency } from '../formatters.js';
import { adminDashboardKeyboard } from '../keyboards.js';
import { loadProducts } from '../../data/products.js';

/**
 * Check if user is admin
 */
function isAdmin(userId) {
  return BOT_CONFIG.TELEGRAM_ADMIN_IDS.includes(userId);
}

/**
 * Admin command handler
 */
export async function handleAdminCommand(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    return ctx.reply('❌ Anda tidak memiliki akses admin');
  }
  
  // Support both text messages and photo captions
  const rawText = ctx.message?.text || ctx.message?.caption || '';
  const args = rawText.split(/\s+/).slice(1);
  const command = args[0]?.toLowerCase();
  
  if (!command || command === 'dashboard') {
    const stats = getAnalyticsSummary();
    const text = formatAdminDashboard(stats);
    await ctx.replyWithMarkdown(text, adminDashboardKeyboard());
    return;
  }
  
  switch (command) {
    case 'help':
      await ctx.replyWithMarkdown(formatAdminHelp());
      break;
      
    case 'refresh':
      await handleAdminRefresh(ctx);
      break;
      
    case 'stats':
      await handleAdminStats(ctx, args.slice(1));
      break;
      
    case 'topproducts':
      await handleAdminTopProducts(ctx);
      break;
      
    case 'users':
      await handleAdminUsers(ctx);
      break;
      
    case 'orders':
      await handleAdminOrders(ctx);
      break;
      
    case 'health':
      await handleAdminHealth(ctx);
      break;
      
    case 'broadcast':
      await handleAdminBroadcast(ctx, args.slice(1));
      break;
      
    case 'send':
      await handleAdminSend(ctx, args.slice(1));
      break;
      
    case 'settings':
      await handleAdminSettings(ctx, args.slice(1));
      break;
      
    case 'backup':
      await handleAdminBackup(ctx, args.slice(1));
      break;
      
    case 'restore':
      await handleAdminRestore(ctx, args.slice(1));
      break;
      
    default:
      await ctx.reply(`❌ Command tidak dikenal: ${command}\n\nGunakan /admin help untuk bantuan`);
  }
}

/**
 * Admin refresh products
 */
async function handleAdminRefresh(ctx) {
  try {
    await ctx.reply('⏳ Memuat ulang data produk...');
    await loadProducts(true, { resetStability: true });
    
    const { getAll } = await import('../../data/products.js');
    const products = getAll();
    
    await ctx.reply(`✅ Data produk berhasil dimuat ulang!\n\nTotal: ${products.length} produk`);
  } catch (error) {
    console.error('[ADMIN REFRESH ERROR]', error);
    await ctx.reply('❌ Gagal memuat ulang data produk');
  }
}

/**
 * Admin statistics
 */
async function handleAdminStats(ctx, args) {
  try {
    const stats = getAnalyticsSummary();
    const period = args[0] || 'all';
    
    // Get total users from Supabase
    const { supabase } = await import('../../database/supabase.js');
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const totalUsers = error ? USER_SESSIONS.size : (count || 0);
    
    const text = [
      '📊 *STATISTIK LENGKAP*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '💰 *Revenue*',
      `• Total Orders: ${stats.totalOrders}`,
      `• Total Revenue: ${formatCurrency(stats.totalRevenue)}`,
      `• Avg Order Value: ${formatCurrency(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)}`,
      '',
      '👥 *Users*',
      `• Active Sessions: ${stats.activeUsers}`,
      `• Total Users: ${totalUsers}`,
      '',
      '📦 *Products*',
      `• Total Views: ${Array.from(stats.topProducts).reduce((sum, [, views]) => sum + views, 0)}`,
      `• Unique Products Viewed: ${stats.topProducts.length}`,
      '',
      '🔍 *Searches*',
      `• Total Searches: ${Array.from(stats.topSearches).reduce((sum, [, count]) => sum + count, 0)}`,
      `• Unique Queries: ${stats.topSearches.length}`,
    ].join('\n');
    
    await ctx.replyWithMarkdown(text);
  } catch (error) {
    console.error('[ADMIN STATS ERROR]', error);
    // Fallback to in-memory stats
    const stats = getAnalyticsSummary();
    const text = [
      '📊 *STATISTIK LENGKAP*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '💰 *Revenue*',
      `• Total Orders: ${stats.totalOrders}`,
      `• Total Revenue: ${formatCurrency(stats.totalRevenue)}`,
      '',
      '👥 *Users*',
      `• Active Sessions: ${stats.activeUsers}`,
      '',
      '⚠️ _Using in-memory data (DB error)_',
    ].join('\n');
    await ctx.replyWithMarkdown(text);
  }
}

/**
 * Admin top products
 */
async function handleAdminTopProducts(ctx) {
  const stats = getAnalyticsSummary();
  const { getAll } = await import('../../data/products.js');
  const allProducts = getAll();
  
  const text = [
    '🔥 *TOP PRODUCTS*',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    ...stats.topProducts.slice(0, 15).map(([code, views], i) => {
      const product = allProducts.find(p => p.kode === code);
      const name = product?.nama || code;
      const botPrice = Number(product?.harga_bot ?? product?.harga_web ?? 0) || 0;
      return `${i + 1}. *${name}*\n   ${views} views • ${formatCurrency(botPrice)}`;
    }),
  ].join('\n');
  
  await ctx.replyWithMarkdown(text);
}

/**
 * Admin users info
 */
async function handleAdminUsers(ctx) {
  try {
    // Get users from Supabase instead of in-memory sessions
    const { supabase } = await import('../../database/supabase.js');
    
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // Query users from database
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('user_id, last_activity');
    
    if (error) throw error;
    
    const totalUsers = allUsers?.length || 0;
    let active5min = 0;
    let active1hour = 0;
    let active1day = 0;
    
    if (allUsers) {
      for (const user of allUsers) {
        if (!user.last_activity) continue;
        const lastActivity = new Date(user.last_activity).getTime();
        
        if (lastActivity > fiveMinAgo) active5min++;
        if (lastActivity > oneHourAgo) active1hour++;
        if (lastActivity > oneDayAgo) active1day++;
      }
    }
    
    const text = [
      '👥 *USER ACTIVITY*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `• Active now: ${active5min}`,
      `• Last 5 minutes: ${active5min}`,
      `• Last hour: ${active1hour}`,
      `• Last 24 hours: ${active1day}`,
      `• Total users: ${totalUsers}`,
      '',
      '💡 _Data dari Supabase database_',
    ].join('\n');
    
    await ctx.replyWithMarkdown(text);
  } catch (error) {
    console.error('[ADMIN USERS ERROR]', error);
    
    // Fallback to in-memory sessions
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    let active5min = 0;
    let active1hour = 0;
    let active1day = 0;
    
    for (const [userId, session] of USER_SESSIONS.entries()) {
      if (session.lastActivity > fiveMinAgo) active5min++;
      if (session.lastActivity > oneHourAgo) active1hour++;
      if (session.lastActivity > oneDayAgo) active1day++;
    }
    
    const text = [
      '👥 *USER ACTIVITY*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      `• Active now: ${active5min}`,
      `• Last 5 minutes: ${active5min}`,
      `• Last hour: ${active1hour}`,
      `• Last 24 hours: ${active1day}`,
      `• Total users: ${USER_SESSIONS.size}`,
      '',
      '⚠️ _Fallback: in-memory sessions_',
      '_(Database query failed)_',
    ].join('\n');
    
    await ctx.replyWithMarkdown(text);
  }
}

/**
 * Admin orders info
 */
async function handleAdminOrders(ctx) {
  const pendingOrders = Array.from(ACTIVE_ORDERS.values()).filter(o => o.status === 'pending');
  const completedOrders = Array.from(ACTIVE_ORDERS.values()).filter(o => o.status === 'completed');
  
  const text = [
    '📦 *ACTIVE ORDERS*',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `• Pending: ${pendingOrders.length}`,
    `• Completed: ${completedOrders.length}`,
    `• Total: ${ACTIVE_ORDERS.size}`,
    '',
  ];
  
  if (pendingOrders.length > 0) {
    text.push('*Pending Orders:*');
    pendingOrders.slice(0, 10).forEach(order => {
      const timeLeft = Math.max(0, order.expiresAt - Date.now());
      const minutesLeft = Math.floor(timeLeft / 60000);
      text.push(`• ${order.orderId}: ${order.productName} x${order.quantity} (${minutesLeft}m left)`);
    });
  }
  
  await ctx.replyWithMarkdown(text.join('\n'));
}

/**
 * Admin health check
 */
async function handleAdminHealth(ctx) {
  try {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotal = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    const { getAll } = await import('../../data/products.js');
    const products = getAll();
    
    // Get total users from Supabase
    const { supabase } = await import('../../database/supabase.js');
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const totalUsers = error ? '?' : (count || 0);
    
    const text = [
      '🔧 *SYSTEM HEALTH*',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '📊 *Status:* 🟢 Online',
      `⏱️ *Uptime:* ${hours}h ${minutes}m`,
      `💾 *Memory:* ${memMB}/${memTotal} MB`,
      '',
      '📦 *Data:*',
      `• Products: ${products.length}`,
      `• Active Orders: ${ACTIVE_ORDERS.size}`,
      `• Active Sessions: ${USER_SESSIONS.size}`,
      `• Total Users: ${totalUsers}`,
      '',
      '🔧 *Environment:*',
      `• Node: ${process.version}`,
      `• Platform: ${process.platform}`,
      `• Arch: ${process.arch}`,
    ].join('\n');
    
    await ctx.replyWithMarkdown(text);
  } catch (error) {
    console.error('[ADMIN HEALTH ERROR]', error);
    await ctx.reply('❌ Failed to get system health');
  }
}

/**
 * Admin broadcast message
 * Supports:
 *   - Text with Telegram native formatting (bold, italic, etc via toolbar)
 *   - Photo sent directly with caption starting with /admin broadcast
 *   - Reply to a photo + /admin broadcast <caption>
 *   - HTML tags in message
 */
async function handleAdminBroadcast(ctx, args) {
  const msg = ctx.message;

  // Detect photo sent directly (photo message with caption "/admin broadcast ...")
  const directPhoto = msg?.photo;
  const replyPhoto = msg?.reply_to_message?.photo;
  const photoArray = directPhoto || replyPhoto;
  const photoFileId = photoArray ? photoArray[photoArray.length - 1]?.file_id : null;

  // Get the text content: from caption (if photo) or from text
  let rawText = '';
  let entities = [];

  if (directPhoto && msg.caption) {
    rawText = msg.caption;
    entities = msg.caption_entities || [];
  } else {
    rawText = msg?.text || '';
    entities = msg?.entities || [];
  }

  // Strip the "/admin broadcast" prefix from the text
  const prefixMatch = rawText.match(/^\/admin\s+broadcast\s*/i);
  const prefixLen = prefixMatch ? prefixMatch[0].length : 0;
  const messageText = rawText.slice(prefixLen);
  const messageEntities = entities
    .filter(e => e.offset >= prefixLen)
    .map(e => ({ ...e, offset: e.offset - prefixLen }));

  // Handle special subcommands: cancel
  const subcommand = messageText.trim().toLowerCase();
  if (subcommand === 'cancel') {
    // Cancel the most recent draft broadcast from this admin
    const { supabase } = await import('../../database/supabase.js');
    const { data: latestDraft } = await supabase
      .from('broadcasts')
      .select('id, title')
      .eq('status', 'draft')
      .eq('created_by', `admin:${ctx.from.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestDraft) {
      await supabase.from('broadcasts').update({ status: 'cancelled' }).eq('id', latestDraft.id);
      return ctx.reply(`✅ Broadcast "${latestDraft.title}" dibatalkan.`);
    } else {
      return ctx.reply('❌ Tidak ada broadcast draft yang bisa dibatalkan.');
    }
  }

  if (!messageText.trim() && !photoFileId) {
    return ctx.reply(
      '📢 <b>BROADCAST</b>\n\n' +
      '<b>Cara pakai:</b>\n' +
      '1️⃣ Ketik pesan dengan format (bold/italic/link via toolbar Telegram)\n' +
      '   lalu awali dengan <code>/admin broadcast</code>\n\n' +
      '2️⃣ Kirim foto langsung dengan caption:\n' +
      '   <code>/admin broadcast teks caption</code>\n\n' +
      '3️⃣ Reply ke foto + ketik:\n' +
      '   <code>/admin broadcast teks caption</code>\n\n' +
      '💡 Format Telegram native (bold, italic, link, dll) otomatis dipertahankan.\n' +
      '💡 Bisa juga pakai HTML: &lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;a href="..."&gt;',
      { parse_mode: 'HTML' }
    );
  }

  // Convert Telegram entities to HTML for storage
  const htmlMessage = entitiesToHtml(messageText, messageEntities);

  const { supabase } = await import('../../database/supabase.js');

  // Store Telegram file_id directly; it is stable and can be reused by sendPhoto.
  const imageUrl = photoFileId || null;

  // Create broadcast record in DB (status: draft)
  const { data: broadcast, error: insertErr } = await supabase
    .from('broadcasts')
    .insert({
      title: `Bot: ${(messageText.trim() || 'Photo broadcast').substring(0, 80)}`,
      message: htmlMessage,
      parse_mode: 'HTML',
      image_url: imageUrl,
      status: 'draft',
      created_by: `admin:${ctx.from.id}`,
    })
    .select()
    .single();

  if (insertErr) {
    console.error('[BROADCAST] Failed to create broadcast record:', insertErr);
    return ctx.reply('❌ Gagal membuat broadcast. Coba lagi.');
  }

  // Show preview (send back with same format to verify)
  try {
    if (imageUrl) {
      const previewCaption = `📢 PREVIEW:\n\n${htmlMessage}`;
      if (previewCaption.length > 1024) {
        await ctx.replyWithPhoto(imageUrl);
        await ctx.reply(previewCaption, { parse_mode: 'HTML' });
      } else {
        await ctx.replyWithPhoto(imageUrl, {
          caption: previewCaption,
          parse_mode: 'HTML',
        });
      }
    } else {
      await ctx.reply(`📢 <b>PREVIEW:</b>\n━━━━━━━━━━━━━━━━━━━━\n\n${htmlMessage}\n\n━━━━━━━━━━━━━━━━━━━━`, { parse_mode: 'HTML' });
    }
  } catch (parseErr) {
    await ctx.reply(
      `⚠️ Format tidak valid: ${parseErr?.message || 'Parse error'}\n\n` +
      `Broadcast disimpan sebagai draft. Kelola via Dashboard Admin.`
    );
    return;
  }

  await ctx.reply(
    `✅ Broadcast siap dikirim (ID: <code>${broadcast.id.substring(0, 8)}</code>)\n\n` +
    `Ketik: <code>/admin send ${broadcast.id.substring(0, 8)}</code> untuk kirim sekarang.\n` +
    `Atau kelola via Dashboard Admin → Broadcast.`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Convert Telegram message entities to HTML string.
 * Handles nested/overlapping entities correctly.
 */
function entitiesToHtml(text, entities) {
  if (!entities || entities.length === 0) {
    // Escape HTML special chars in plain text
    return escapeHtml(text);
  }

  // Sort entities by offset (stable sort for nested)
  const sorted = [...entities].sort((a, b) => a.offset - b.offset || b.length - a.length);

  let result = '';
  let lastIndex = 0;

  for (const entity of sorted) {
    const start = entity.offset;
    const end = entity.offset + entity.length;

    // Add text before this entity (escaped)
    if (start > lastIndex) {
      result += escapeHtml(text.slice(lastIndex, start));
    }

    const content = text.slice(start, end);
    const escapedContent = escapeHtml(content);

    switch (entity.type) {
      case 'bold':
        result += `<b>${escapedContent}</b>`;
        break;
      case 'italic':
        result += `<i>${escapedContent}</i>`;
        break;
      case 'underline':
        result += `<u>${escapedContent}</u>`;
        break;
      case 'strikethrough':
        result += `<s>${escapedContent}</s>`;
        break;
      case 'spoiler':
        result += `<tg-spoiler>${escapedContent}</tg-spoiler>`;
        break;
      case 'code':
        result += `<code>${escapedContent}</code>`;
        break;
      case 'pre':
        result += `<pre>${escapedContent}</pre>`;
        break;
      case 'text_link':
        result += `<a href="${escapeHtml(entity.url || '')}">${escapedContent}</a>`;
        break;
      case 'text_mention':
        result += `<a href="tg://user?id=${entity.user?.id || ''}">${escapedContent}</a>`;
        break;
      case 'blockquote':
        result += `<blockquote>${escapedContent}</blockquote>`;
        break;
      default:
        // Unknown entity type, just output escaped text
        result += escapedContent;
        break;
    }

    lastIndex = end;
  }

  // Add remaining text after last entity
  if (lastIndex < text.length) {
    result += escapeHtml(text.slice(lastIndex));
  }

  return result;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Admin send broadcast (confirm and execute)
 * Usage: /admin send <broadcast_id_prefix>
 */
async function handleAdminSend(ctx, args) {
  try {
    const idPrefix = args[0];
    if (!idPrefix) {
      return ctx.reply('❌ Format: /admin send <broadcast_id>');
    }

    const { supabase } = await import('../../database/supabase.js');
    const { executeBroadcast } = await import('../../services/broadcast.js');

    // Find broadcast by ID prefix
    const { data: broadcasts, error: fetchErr } = await supabase
      .from('broadcasts')
      .select('id, title, status, message, image_url')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(10);

    if (fetchErr) throw fetchErr;

    const broadcast = (broadcasts || []).find(b => b.id.startsWith(idPrefix));

    if (!broadcast) {
      return ctx.reply('❌ Broadcast tidak ditemukan atau sudah terkirim.');
    }

    await ctx.reply(`⏳ Mengirim broadcast "${broadcast.title.substring(0, 50)}"...`);

    const result = await executeBroadcast(ctx.telegram, broadcast.id);

    await ctx.reply(
      `✅ <b>Broadcast Selesai</b>\n\n` +
      `📊 Terkirim: <b>${result.sent}</b>\n` +
      `❌ Gagal: <b>${result.failed}</b>\n` +
      `👥 Total: <b>${result.total}</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('[ADMIN SEND BROADCAST ERROR]', error);
    try {
      await ctx.reply(`❌ Gagal mengirim broadcast: ${error?.message || 'unknown error'}`);
    } catch {}
  }
}

/**
 * Admin settings management
 */
async function handleAdminSettings(ctx, args) {
  const { settings } = await import('../../services/settings.js');
  const subcommand = args[0]?.toLowerCase();
  
  if (!subcommand || subcommand === 'show') {
    const text = settings.getFormattedSettings();
    await ctx.reply(text, { parse_mode: 'HTML' });
    return;
  }
  
  switch (subcommand) {
    case 'set': {
      const path = args[1];
      const value = args.slice(2).join(' ');
      
      if (!path || value === undefined) {
        await ctx.reply(
          '⚙️ *SET SETTING*\n\n' +
          'Format: /admin settings set <path> <value>\n\n' +
          'Contoh:\n' +
          '/admin settings set store.name My Store\n' +
          '/admin settings set payment.autoConfirm true\n' +
          '/admin settings set notifications.lowStockThreshold 10',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Parse value
      let parsedValue = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(value)) parsedValue = Number(value);
      
      const success = settings.set(path, parsedValue);
      
      if (success) {
        await ctx.reply(`✅ Setting updated: ${path} = ${parsedValue}`);
      } else {
        await ctx.reply('❌ Failed to update setting');
      }
      break;
    }
    
    case 'get': {
      const path = args[1];
      
      if (!path) {
        await ctx.reply('❌ Missing path. Usage: /admin settings get <path>');
        return;
      }
      
      const value = settings.get(path);
      await ctx.reply(`⚙️ ${path} = ${JSON.stringify(value)}`);
      break;
    }
    
    case 'reset': {
      settings.reset();
      await ctx.reply('✅ Settings reset to defaults');
      break;
    }
    
    case 'export': {
      const data = settings.export();
      const jsonStr = JSON.stringify(data, null, 2);
      
      await ctx.replyWithDocument({
        source: Buffer.from(jsonStr),
        filename: `settings-${new Date().toISOString().split('T')[0]}.json`
      }, {
        caption: '⚙️ Settings exported'
      });
      break;
    }
    
    default:
      await ctx.reply('❌ Unknown subcommand. Use: show, set, get, reset, export');
  }
}

/**
 * Admin backup
 */
async function handleAdminBackup(ctx, args) {
  const { backup } = await import('../../services/backup.js');
  const subcommand = args[0]?.toLowerCase();
  
  if (!subcommand || subcommand === 'create') {
    await ctx.reply('⏳ Creating backup...');
    
    const result = await backup.createBackup({
      includeProducts: true,
      includePayments: true,
      includeSettings: true,
      includeState: true,
      compress: true
    });
    
    if (result.success) {
      await ctx.replyWithDocument({
        source: result.path,
        filename: result.filename
      }, {
        caption: `✅ Backup created\n\nSize: ${(result.size / 1024).toFixed(2)} KB`
      });
    } else {
      await ctx.reply(`❌ Backup failed: ${result.error}`);
    }
    return;
  }
  
  switch (subcommand) {
    case 'list': {
      const text = backup.formatBackupList();
      await ctx.replyWithMarkdown(text);
      break;
    }
    
    case 'delete': {
      const filename = args[1];
      
      if (!filename) {
        await ctx.reply('❌ Missing filename. Usage: /admin backup delete <filename>');
        return;
      }
      
      const result = backup.deleteBackup(filename);
      
      if (result.success) {
        await ctx.reply(`✅ Backup deleted: ${filename}`);
      } else {
        await ctx.reply(`❌ Failed to delete: ${result.error}`);
      }
      break;
    }
    
    case 'cleanup': {
      const result = backup.cleanupOldBackups(10);
      await ctx.reply(`✅ Cleanup completed. Deleted ${result.deleted} old backups.`);
      break;
    }
    
    default:
      await ctx.reply(
        '📦 *BACKUP COMMANDS*\n\n' +
        '• /admin backup create - Create new backup\n' +
        '• /admin backup list - List all backups\n' +
        '• /admin backup delete <filename> - Delete backup\n' +
        '• /admin backup cleanup - Delete old backups',
        { parse_mode: 'Markdown' }
      );
  }
}

/**
 * Admin restore
 */
async function handleAdminRestore(ctx, args) {
  const { backup } = await import('../../services/backup.js');
  const filename = args[0];
  
  if (!filename) {
    const text = backup.formatBackupList();
    await ctx.replyWithMarkdown(
      text + '\n\n⚠️ *Restore*\n\nFormat: /admin restore <filename>'
    );
    return;
  }
  
  await ctx.reply('⏳ Restoring backup...');
  
  const result = await backup.restoreBackup(filename, {
    restoreProducts: true,
    restorePayments: true,
    restoreSettings: true,
    restoreState: true
  });
  
  if (result.success) {
    await ctx.reply(
      `✅ Restore completed!\n\n` +
      `Restored: ${result.restored.join(', ')}\n` +
      `Backup date: ${new Date(result.backupDate).toLocaleString('id-ID')}\n\n` +
      `⚠️ Please restart bot to apply all changes.`
    );
  } else {
    await ctx.reply(`❌ Restore failed: ${result.error}`);
  }
}

/**
 * Handle admin callback actions
 */
export default async function handleAdminAction(ctx, params) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    return ctx.answerCbQuery('❌ Akses ditolak');
  }
  
  const [action] = params;
  
  switch (action) {
    case 'stats':
      await handleAdminStats(ctx, []);
      await ctx.answerCbQuery();
      break;
      
    case 'topproducts':
      await handleAdminTopProducts(ctx);
      await ctx.answerCbQuery();
      break;
      
    case 'users':
      await handleAdminUsers(ctx);
      await ctx.answerCbQuery();
      break;
      
    case 'orders':
      await handleAdminOrders(ctx);
      await ctx.answerCbQuery();
      break;
      
    case 'refresh':
      await ctx.answerCbQuery('⏳ Memuat ulang...');
      await handleAdminRefresh(ctx);
      break;
      
    case 'backup':
      await ctx.answerCbQuery('⏳ Creating backup...');
      await handleAdminBackup(ctx, ['create']);
      break;
      
    case 'broadcast':
      await ctx.answerCbQuery();
      await ctx.reply(
        '📢 *BROADCAST MESSAGE*\n\n' +
        'Gunakan command: /admin broadcast <pesan>',
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'settings':
      await ctx.answerCbQuery();
      await handleAdminSettings(ctx, ['show']);
      break;
      
    default:
      await ctx.answerCbQuery('Action tidak dikenal');
  }
}
