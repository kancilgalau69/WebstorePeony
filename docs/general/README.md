# PBS Digital Store - Monorepo Overview

Dokumen ini merangkum kondisi monorepo berdasarkan `README.md` di root project. Jika ada perbedaan informasi antar dokumen, gunakan `README.md` root sebagai sumber kebenaran utama.

## Ringkasan

`bot-telegram-pbs` adalah monorepo untuk ekosistem penjualan produk digital yang terdiri dari:

- Telegram Bot PBS untuk pembelian via chat.
- Admin Dashboard PBS untuk mengelola produk, stok, order, reseller, affiliate, promo, broadcast, blog, backup, analytics, dan settings.
- Web Store PBS untuk pelanggan akhir.
- Sistem reseller dengan dashboard dan storefront white-label.
- Web Blog publik.

## Service Aktif

| Service | Folder | Port | Command |
|---|---|---:|---|
| Telegram Bot | `bot-telegram/` | `HTTP_PORT`, default 3000 | `npm run bot` |
| Web Store PBS | `user/` | 3001 | `npm run store` |
| Reseller Dashboard | `reseller-dashboard/` | 3002 | `npm run reseller-dashboard` |
| Web Reseller | `web-reseller/` | 3003 | `npm run web-reseller` |
| Admin Dashboard PBS | `dashboard/` | 3004 | `npm run dashboard` |
| Web Blog | `web-blog/` | 3005 | `npm run web-blog` |

## Struktur Utama

```text
bot-telegram-pbs/
├── bot-telegram/          # Telegram Bot + webhook receiver
├── dashboard/             # Admin Dashboard PBS
├── user/                  # Web Store PBS
├── reseller-dashboard/    # Dashboard Reseller
├── web-reseller/          # Storefront Reseller
├── web-blog/              # Blog publik
├── supabase/migrations/   # SQL migrations
├── docs/                  # Dokumentasi teknis
├── start-all.js           # Multi-service launcher
└── package.json           # Root scripts
```

## Core Flow Pembayaran

### PBS Web Store, Telegram Bot, dan Reseller

```text
User -> Pilih produk -> Checkout -> Reserve stock -> Midtrans QRIS -> Webhook sukses -> Finalize stock -> Kirim item digital
```

## Database Bersama

Semua service berbagi satu Supabase PostgreSQL. Migration berada di `supabase/migrations/`.

Area schema utama:

- Produk dan item digital: `products`, `product_items`, `product_inventory_summary`.
- Order PBS: `orders`, `order_items`.
- User web PBS: `user_web`.
- Reseller: `resellers`, `reseller_products`, `reseller_prices`, `reseller_orders`, `reseller_order_items`, `reseller_withdrawals`.
- Affiliate: tabel komisi, saldo, dan withdrawal affiliate.
- Blog: post, kategori, dan metadata SEO.
- Promo: kupon, tipe promo, dan pembatasan produk.
- Wallet: `user_wallets`, `wallet_transactions`, `saldo_topup_orders`.

## Aturan Kritis Development

- Total checkout harus dihitung server-side dari database, bukan dari harga yang dikirim client.
- Stock flow harus menjaga kontrak `reserve -> finalize -> release`.
- Untuk membaca stok, prioritaskan view `product_inventory_summary`, bukan agregasi raw `product_items` yang rawan limit PostgREST.
- Webhook Midtrans harus idempotent karena callback bisa retry atau datang lebih dari sekali.
- Email delivery item digital harus ditunggu dan retry-aware.
- Perubahan schema Supabase bisa berdampak ke banyak service sekaligus.

## Command Root

```bash
npm run install:all
npm start
npm run bot
npm run dashboard
npm run store
npm run reseller-dashboard
npm run web-reseller
npm run web-blog
```

## Dokumentasi Lanjutan

- Root overview: `README.md`
- Dokumentasi index: `docs/README.md`
- Database: `docs/database/README.md` dan `supabase/README.md`
- User Store: `user/README.md` dan `docs/user-store/README.md`
- Dashboard: `dashboard/README.md` dan `docs/dashboard/README.md`
- Reseller: `docs/reseller/README.md`
