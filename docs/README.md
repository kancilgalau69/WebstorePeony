# Dokumentasi PBS Digital Store

Folder ini berisi dokumentasi teknis untuk monorepo PBS Digital Store. `README.md` di root project adalah sumber kebenaran utama untuk daftar service, port, command, dan struktur terbaru.

## Peta Dokumentasi

| Area | Dokumen Utama | Isi |
|---|---|---|
| Monorepo overview | `../README.md` | Struktur service, port, command, migration, flow pembayaran |
| Ringkasan teknis | `general/README.md` | Ringkasan monorepo yang mudah dianalisis cepat |
| Bot Telegram | `bot/QUICKSTART.md`, `bot/DEVELOPER_GUIDE.md`, `../bot-telegram/README.md` | Setup bot, command, webhook, flow pembelian Telegram |
| Admin Dashboard PBS | `dashboard/README.md`, `../dashboard/README.md` | Panel admin pusat dan integrasi service |
| User Web Store PBS | `user-store/README.md`, `../user/README.md` | Katalog, cart, checkout, QRIS, email delivery, affiliate |
| Reseller System | `reseller/README.md` | Dashboard reseller, storefront, pricing, withdrawal, API |
| Web Reseller | `../web-reseller/README.md` | Storefront reseller berbasis slug |
| Web Blog | `../web-blog/README.md` | Blog publik dan render artikel Markdown |
| Database | `database/README.md`, `../supabase/README.md` | Supabase setup, migration, function, guardrail |

## Service dan Port

| Service | Folder | Port | Command |
|---|---|---:|---|
| Telegram Bot | `bot-telegram/` | `HTTP_PORT`, default 3000 | `npm run bot` |
| Web Store PBS | `user/` | 3001 | `npm run store` |
| Reseller Dashboard | `reseller-dashboard/` | 3002 | `npm run reseller-dashboard` |
| Web Reseller | `web-reseller/` | 3003 | `npm run web-reseller` |
| Admin Dashboard PBS | `dashboard/` | 3004 | `npm run dashboard` |
| Web Blog | `web-blog/` | 3005 | `npm run web-blog` |

## Dokumentasi Detail yang Sudah Ada

### Bot Telegram (`docs/bot/`)

- `QUICKSTART.md` untuk setup cepat bot.
- `DEVELOPER_GUIDE.md` untuk panduan teknis developer.
- Dokumen katalog untuk banner, format katalog, dan update katalog.

### Dashboard (`docs/dashboard/`)

- `README.md` untuk ringkasan dashboard admin PBS.
- `QUICKSTART.md` untuk setup dashboard.
- `STORE-SETTINGS-GUIDE.md` untuk pengaturan toko.
- `LOGIN-SETUP-GUIDE.md` dan `LOGIN-TROUBLESHOOTING.md` untuk auth dashboard.
- `SUPABASE-CONFIG.md` untuk konfigurasi Supabase.
- `PRODUCTION-SETUP-RAILWAY.md` untuk deployment Railway.

### User Store (`docs/user-store/`)

- `README.md` untuk ringkasan Web Store PBS.
- `SETUP-GUIDE.md` untuk setup lengkap.
- `ORDER-FLOW.md` untuk alur pemesanan.
- `EMAIL-DELIVERY-SETUP.md` untuk pengiriman email item digital.
- `MIDTRANS-SETUP.md` untuk setup pembayaran.
- `WEBHOOK-SETUP.md` untuk webhook pembayaran.

### Reseller (`docs/reseller/`)

- `README.md` untuk gambaran umum.
- `SETUP-GUIDE.md` untuk instalasi dan konfigurasi.
- `DATABASE-SCHEMA.md` untuk skema database reseller.
- `DASHBOARD-GUIDE.md` untuk dashboard reseller.
- `STOREFRONT-GUIDE.md` untuk toko online reseller.
- `API-REFERENCE.md` untuk endpoint API.
- `ORDER-FLOW.md` untuk flow order dan pembayaran.
- `PRICING-SYSTEM.md` untuk harga dan margin.
- `WITHDRAWAL-SYSTEM.md` untuk saldo dan penarikan.

### Database (`docs/database/`)

- `README.md` untuk setup dan ringkasan migration.
- `RLS-FIX-GUIDE.md` untuk troubleshooting RLS.
- `SCRIPTS-README.md` untuk migration scripts.

## Guardrail Dokumentasi

- Jika port atau command berbeda antar dokumen, ikuti `README.md` root.
- Jika dokumentasi service belum lengkap, mulai dari README di folder service masing-masing.
- Saat mengubah flow checkout, stok, webhook, wallet, atau schema, update dokumentasi terkait di service dan database.
