# Telegram Bot PBS

Service Telegram Bot untuk penjualan produk digital PBS melalui chat Telegram sekaligus HTTP server untuk webhook.

## Ringkasan

| Item | Nilai |
|---|---|
| Runtime | Node.js, Telegraf, Express |
| Entry point | `index.js` |
| Port | `HTTP_PORT`, default 3000 |
| Command root | `npm run bot` |
| Command lokal | `npm start` |
| Env file | `.env` |

## Fungsi Utama

- Katalog produk via Telegram.
- Quick buy dengan format kode produk dan jumlah.
- Pencarian produk, favorit, riwayat pembelian, dan cek status order.
- Pembayaran Midtrans QRIS.
- Auto delivery item digital setelah pembayaran sukses.
- Webhook Midtrans dan forwarding event ke web apps bila dikonfigurasi.
- Scheduler, backup, low stock alert, metrics, dan rate limiting.

## Struktur Penting

```text
bot-telegram/
├── index.js                       # Bot + HTTP webhook receiver
├── src/bot/handlers/webhook.js    # Midtrans webhook + forwarding
├── src/bot/handlers/purchase.js   # Flow pembelian Telegram
├── src/database/                  # Supabase CRUD dan stok
├── src/payments/                  # Integrasi Midtrans
├── src/services/                  # Scheduler, backup, settings
├── src/utils/                     # Logger, metrics, rate limiter
└── package.json
```

## Command

Dari root repo:

```bash
npm run bot
npm run build:bot
```

Dari folder ini:

```bash
npm start
npm run dev
npm test
npm run migrate
```

## Environment

Variabel umum di `.env`:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_IDS=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MIDTRANS_SERVER_KEY=
MIDTRANS_IS_PRODUCTION=false
HTTP_PORT=3000
PUBLIC_BASE_URL=
WEBHOOK_SECRET=
SUPPORT_CONTACT=
WEBHOOK_WEB_URL=
```

## Endpoint Penting

- `POST /webhook/telegram` untuk webhook Telegram.
- `POST /webhook/midtrans` untuk callback pembayaran Midtrans.
- `POST /webhook/refresh` untuk trigger refresh data.
- `GET /health` untuk health check.
- `GET /status` untuk status bot.
- `GET /metrics` untuk metrics.

## Catatan Kritis

- Gunakan Node.js 20+ untuk service ini.
- Jaga flow stok `reserve -> finalize -> release`.
- Webhook Midtrans harus idempotent.
- Jika `WEBHOOK_WEB_URL` salah atau transient error, event forwarding ke web apps bisa gagal.

Lihat overview monorepo di `../README.md`.
