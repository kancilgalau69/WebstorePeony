# PBS Digital Store

Monorepo untuk **PBS Digital Store** — ekosistem platform penjualan produk digital dengan Telegram Bot, Admin Dashboard PBS, Web Store PBS (user), Sistem Reseller, dan Web Blog publik.

---

## Struktur Proyek

```
bot-telegram-pbs/
├── bot-telegram/              # Telegram Bot (Node.js + Telegraf + Express)
│   ├── index.js               # Entry point: bot + HTTP server webhook receiver
│   ├── src/
│   │   ├── bot/handlers/
│   │   │   ├── webhook.js     # Midtrans webhook + forward ke web apps
│   │   │   └── purchase.js    # Alur pembelian via Telegram
│   │   ├── database/          # Supabase CRUD
│   │   ├── payments/          # Midtrans integration
│   │   ├── services/          # Scheduler, backup, settings
│   │   └── utils/             # Logger, metrics, rate limiter
│   └── package.json
│
├── dashboard/                 # Admin Dashboard PBS (Next.js 16 + React 19) — Port 3004
│   ├── app/dashboard/         # products, items, orders, resellers, affiliates,
│   │                          # promos, announcement, blog, backup, users,
│   │                          # analytics, settings, klikpayment
│   └── package.json
│
├── user/                      # Web Store PBS (Next.js 14) — Port 3001
│   ├── app/
│   │   ├── api/               # checkout, webhook, orders, payment-status,
│   │   │                      # catalog-products, affiliate, promo
│   │   ├── product/[id]/      # Detail produk + share + affiliate link
│   │   ├── cart/, checkout/, orders/, profile/, login/, register/
│   │   ├── order-pending/, order-success/, order-failed/
│   │   └── affiliate/         # Dashboard affiliate user
│   ├── components/            # CartProvider, AuthProvider, Header, BottomNav, ProductCard
│   ├── lib/email/             # SMTP/Resend email delivery
│   └── package.json
│
├── reseller-dashboard/        # Dashboard Reseller (Next.js 14) — Port 3002
│   ├── app/dashboard/         # ringkasan, orders, products, pricing, balance, store-settings
│   ├── lib/auth.ts            # Custom session (HMAC-SHA256 cookie)
│   └── package.json
│
├── web-reseller/              # Storefront Reseller (Next.js 14) — Port 3003
│   ├── app/[slug]/            # Halaman toko dinamis per reseller
│   │   └── product/[id]/, cart/, checkout/, order-*/
│   └── package.json
│
├── web-blog/                  # Blog Publik (Next.js 14) — Port 3005
│   ├── app/
│   │   ├── page.tsx           # Beranda blog (featured + grid + filter kategori)
│   │   └── [slug]/page.tsx    # Detail artikel (Markdown + share + related)
│   └── package.json
│
├── supabase/
│   └── migrations/            # SQL migrations
│
├── docs/                      # Dokumentasi teknis detail per layanan
├── start-all.js               # Multi-service launcher
└── package.json               # Root workspace scripts
```

---

## Port & URL

| Service | Port | Dev Command |
|---------|------|-------------|
| Telegram Bot | `HTTP_PORT` env (default 3000) | `npm run bot` |
| Web Store PBS | 3001 | `npm run store` |
| Reseller Dashboard | 3002 | `npm run reseller-dashboard` |
| Web Reseller | 3003 | `npm run web-reseller` |
| Admin Dashboard PBS | 3004 | `npm run dashboard` |
| Web Blog | 3005 | `npm run web-blog` |

---

## Commands

```bash
# Install semua dependensi
npm run install:all

# Jalankan semua service sekaligus
npm start

# Jalankan service spesifik
npm run bot
npm run dashboard
npm run store
npm run reseller-dashboard
npm run web-reseller
npm run web-blog

# Build production
npm run build:dashboard
npm run build:store
npm run build:reseller-dashboard
npm run build:web-reseller
npm run build:web-blog
```

---

## Database (Supabase) — Migrations

| File | Isi |
|------|-----|
| `001_core_schema.sql` | Schema awal: products, product_items, users, user_web, orders, settings, security logs |
| `002_reseller_system.sql` | Sistem reseller lengkap: toko, produk, harga markup, orders, withdraw, security |
| `003_affiliate_system.sql` | Program affiliate: komisi referral, pencairan, DB triggers |
| `004_wallet_system.sql` | Dompet digital: user_wallets, wallet_transactions, saldo_topup_orders |
| `005_marketing_and_content.sql` | Konten & Promosi: Blog, promos/kupon, announcements, broadcast Telegram |
| `006_rls_and_permissions.sql` | Kebijakan terpusat Row Level Security (RLS) & service role permissions |

---

## Arsitektur Alur Pembayaran

### PBS Web Store (user) & Telegram Bot

```
User → Cart / Chat → Checkout (QRIS Midtrans atau Saldo Wallet)
         ↓
  Midtrans Notification → bot-telegram (webhook.js) atau Wallet Debit
         ↓
  bot-telegram forward ke user web store /api/webhook
         ↓
  Finalize order + alokasi product items
  Kirim email + update stok
```

---

## Fitur Setiap Service

### 🤖 1. bot-telegram (Telegram Bot PBS)
- **Pembelian Produk**: Alur pembelian produk digital (pulsa, game, dll.) langsung melalui chat bot Telegram dengan interaksi tombol inline.
- **Webhook Receiver**: Menerima callback notifikasi pembayaran dari Midtrans.
- **Event Forwarder**: Meneruskan event transaksi ke user web store (`user`) secara aman untuk finalisasi.
- **Broadcast System**: Menerima perintah pengiriman pesan massal terjadwal ke user bot.

### 📊 2. dashboard (Admin Dashboard PBS)
- **Pusat Manajemen**: CRUD produk PBS, stok item digital, dan riwayat pesanan.
- **Manajemen Reseller & Affiliate**: Pendaftaran reseller, kustomisasi harga, approval pencairan komisi affiliate, dan saldo komisi.
- **Broadcast & Promosi**: Manajemen promo (kupon diskon) dan penjadwalan broadcast massal Telegram.
- **Digiflazz PPOB**: Pengelolaan margin PPOB Digiflazz dan pemantauan transaksi Digiflazz via KlikPayment.

### 🛒 3. user (Web Store PBS - Customer)
- **Katalog & Keranjang Belanja**: Antarmuka modern untuk mencari produk, detail produk, dan mengelola keranjang.
- **Checkout Multi-payment**: Integrasi QRIS Midtrans dan pembayaran instan menggunakan Saldo Wallet.
- **Sistem Wallet & Topup**: Dompet digital terintegrasi (user_wallets) dengan fitur Top-up otomatis via Midtrans, debit transaksi, dan refund otomatis jika terjadi kegagalan.
- **Digiflazz PPOB Store**: Pembelian Pulsa, Data, PLN, Game, dll. secara langsung dengan status transaksi real-time.
- **Affiliate Program**: Pendaftaran mandiri affiliate, link referral unik (`?ref=KODE`), pelacakan statistik, komisi otomatis via trigger DB, dan penarikan saldo komisi.
- **Announcement Popup**: Pengumuman global dinamis dari admin pusat.

### 🔑 4. reseller-dashboard & web-reseller (Reseller System)
- **Toko Kustom**: Reseller dapat memiliki subdomain/toko sendiri (`/[slug]`) dengan nama dan logo kustom.
- **Markup Harga**: Menentukan margin harga jual sendiri per produk di atas HPP dari PBS.
- **Laporan Keuangan**: Ringkasan saldo komisi, riwayat pesanan pelanggan reseller, dan pencairan komisi (withdraw) berjenjang.

### 📝 5. web-blog (Public Blog)
- **Blog SEO-Friendly**: Desain beranda modern dengan filter kategori dan artikel unggulan.
- **Markdown Rendering**: Artikel dimuat cepat dari basis data dengan format Markdown.
- **Social Sharing**: Tombol bagikan artikel terintegrasi ke WhatsApp, Telegram, X (Twitter), Facebook, LinkedIn, dan Email.

---

## Guardrails & Pitfalls

> **PENTING untuk developer yang mengedit checkout/stok:**

- ✅ Harga checkout **selalu** dihitung server-side dari tabel `products`. Jangan percaya harga dari client.
- ✅ Stok baca dari view `product_inventory_summary`, bukan raw `product_items` (ada batas row PostgREST).
- ✅ Kontrak stok: **reserve → finalize → release** harus utuh. Jangan modifikasi sebagian.
- ✅ Email harus `await`-ed — SMTP bisa timeout; ada support `SMTP_FORCE_IPV4`.
- ✅ Webhook Midtrans ada guard duplicate untuk mencegah finalisasi ganda.

---

## Dokumentasi Lanjutan

| Topik | File |
|-------|------|
| Overview | `docs/README.md` |
| Setup bot | `docs/bot/QUICKSTART.md` |
| Developer bot | `docs/bot/DEVELOPER_GUIDE.md` |
| Setup web store PBS | `docs/user-store/SETUP-GUIDE.md` |
| Sistem reseller | `docs/reseller/README.md` |
| Database | `docs/database/README.md` |
| RLS troubleshooting | `docs/database/RLS-FIX-GUIDE.md` |
| Migration scripts | `bot-telegram/scripts/README.md` |
#   W e b s t o r e P e o n y  
 