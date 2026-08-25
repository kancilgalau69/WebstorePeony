// src/bot/keyboards.js
import { Markup } from 'telegraf';
import { BOT_CONFIG } from './config.js';

/**
 * Main menu keyboard
 */
export function mainMenuKeyboard() {
  return Markup.keyboard([
    ['📋 Katalog', '🔍 Cari'],
    ['📂 Kategori', '⭐ Favorit'],
    ['📜 Riwayat', '❓ Bantuan'],
  ]).resize();
}

/**
 * Catalog tabs inline keyboard
 */
export function catalogTabsKeyboard(activeTab = 'all') {
  const tabs = [
    { key: 'all', label: '📋 Semua', active: activeTab === 'all' },
    { key: 'popular', label: '🔥 Populer', active: activeTab === 'popular' },
    { key: 'new', label: '🆕 Terbaru', active: activeTab === 'new' },
  ];
  
  return Markup.inlineKeyboard([
    tabs.map(t => 
      Markup.button.callback(
        (t.active ? '▸ ' : '') + t.label, 
        `tab:${t.key}:1`
      )
    ),
  ]);
}

/**
 * Product grid keyboard (number buttons for products)
 */
export function productGridKeyboard(totalItems, currentPage, perPage = BOT_CONFIG.ITEMS_PER_PAGE) {
  const totalPages = Math.ceil(totalItems / perPage);
  const start = (currentPage - 1) * perPage;
  const end = Math.min(start + perPage, totalItems);
  
  // Create number buttons for products on current page
  const buttons = [];
  for (let i = start; i < end; i++) {
    const num = i + 1;
    buttons.push(Markup.button.callback(String(num), `view:${num}:${currentPage}`));
  }
  
  // Group buttons into rows (5 per row)
  const rows = [];
  for (let i = 0; i < buttons.length; i += BOT_CONFIG.GRID_COLS) {
    rows.push(buttons.slice(i, i + BOT_CONFIG.GRID_COLS));
  }
  
  // Add navigation row
  const navRow = [];
  if (currentPage > 1) {
    navRow.push(Markup.button.callback('◀️ Prev', `page:${currentPage - 1}`));
  }
  navRow.push(Markup.button.callback(`${currentPage}/${totalPages}`, 'page:current'));
  if (currentPage < totalPages) {
    navRow.push(Markup.button.callback('Next ▶️', `page:${currentPage + 1}`));
  }
  rows.push(navRow);
  
  // Add action row
  rows.push([
    Markup.button.callback('🔄 Refresh', 'refresh:catalog'),
    Markup.button.callback('🏠 Menu', 'menu:main'),
  ]);
  
  return Markup.inlineKeyboard(rows);
}

/**
 * Product detail keyboard
 */
export function productDetailKeyboard(productCode, quantity, isFavorite = false, originPage = 1) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('➖', `qty:dec:${productCode}:${originPage}`),
      Markup.button.callback(`${quantity}`, 'qty:current'),
      Markup.button.callback('➕', `qty:inc:${productCode}:${originPage}`),
    ],
    [
      Markup.button.callback(`🛒 Beli (${quantity})`, `buy:${productCode}:${quantity}`),
    ],
    [
      Markup.button.callback(
        isFavorite ? '⭐ Hapus Favorit' : '⭐ Tambah Favorit', 
        `fav:toggle:${productCode}:${originPage}`
      ),
    ],
    [
      Markup.button.callback('🔄 Refresh Stok', `refresh:product:${productCode}:${originPage}`),
      Markup.button.callback('⬅️ Kembali', `back:catalog:${originPage}`),
    ],
  ]);
}

/**
 * Category selection keyboard
 */
export function categoryKeyboard(categories) {
  const rows = [];
  
  // Create buttons for categories (2 per row)
  for (let i = 0; i < categories.length; i += 2) {
    const row = [];
    row.push(Markup.button.callback(categories[i], `cat:${i}`));
    if (i + 1 < categories.length) {
      row.push(Markup.button.callback(categories[i + 1], `cat:${i + 1}`));
    }
    rows.push(row);
  }
  
  // Add "All" and "Back" buttons
  rows.push([
    Markup.button.callback('📋 Semua Kategori', 'cat:all'),
    Markup.button.callback('🏠 Menu', 'menu:main'),
  ]);
  
  return Markup.inlineKeyboard(rows);
}

/**
 * Search results keyboard
 */
export function searchResultsKeyboard(totalResults) {
  const buttons = [];
  
  for (let i = 0; i < Math.min(totalResults, 15); i++) {
    buttons.push(Markup.button.callback(String(i + 1), `view:search:${i}`));
  }
  
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(buttons.slice(i, i + 5));
  }
  
  rows.push([Markup.button.callback('🏠 Menu', 'menu:main')]);
  
  return Markup.inlineKeyboard(rows);
}

/**
 * Favorites keyboard
 */
export function favoritesKeyboard(totalFavorites) {
  if (totalFavorites === 0) {
    return Markup.inlineKeyboard([
      [Markup.button.callback('📋 Lihat Katalog', 'menu:main')],
    ]);
  }
  
  const buttons = [];
  for (let i = 0; i < Math.min(totalFavorites, 20); i++) {
    buttons.push(Markup.button.callback(String(i + 1), `view:fav:${i}`));
  }
  
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(buttons.slice(i, i + 5));
  }
  
  rows.push([
    Markup.button.callback('🗑️ Hapus Semua', 'fav:clearall'),
    Markup.button.callback('🏠 Menu', 'menu:main'),
  ]);
  
  return Markup.inlineKeyboard(rows);
}

/**
 * Purchase history keyboard
 */
export function historyKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Refresh', 'refresh:history')],
    [Markup.button.callback('🏠 Menu', 'menu:main')],
  ]);
}

/**
 * Order status keyboard
 */
export function orderStatusKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Check Status', `check:${orderId}`)],
    [Markup.button.callback('❌ Cancel', `cancel:${orderId}`)],
    [Markup.button.callback('🏠 Menu', 'menu:main')],
  ]);
}

/**
 * Admin dashboard keyboard
 */
export function adminDashboardKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📊 Stats', 'admin:stats'),
      Markup.button.callback('🔥 Top Products', 'admin:topproducts'),
    ],
    [
      Markup.button.callback('👥 Users', 'admin:users'),
      Markup.button.callback('📦 Orders', 'admin:orders'),
    ],
    [
      Markup.button.callback('🔄 Refresh Data', 'admin:refresh'),
      Markup.button.callback('💾 Backup', 'admin:backup'),
    ],
    [
      Markup.button.callback('📢 Broadcast', 'admin:broadcast'),
      Markup.button.callback('🔧 Settings', 'admin:settings'),
    ],
  ]);
}

/**
 * Confirmation keyboard
 */
export function confirmKeyboard(action, data) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Ya', `confirm:${action}:${data}`),
      Markup.button.callback('❌ Tidak', `cancel:${action}`),
    ],
  ]);
}

/**
 * Payment method keyboard (for future expansion)
 */
export function paymentMethodKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📱 QRIS', 'pay:qris')],
    [Markup.button.callback('🏦 Virtual Account', 'pay:va')],
    [Markup.button.callback('💳 E-Wallet', 'pay:ewallet')],
    [Markup.button.callback('⬅️ Kembali', 'pay:back')],
  ]);
}
