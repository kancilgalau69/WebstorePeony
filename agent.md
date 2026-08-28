# PBS Digital Store - Penjelasan Projek

Dokumen ini menjelaskan arsitektur, komponen, dan alur kerja keseluruhan projek **PBS Digital Store** (WebstorePeony). Untuk panduan operasional singkat (perintah, guardrail, entry point), lihat `AGENTS.md`. Untuk detail per-topik, lihat `docs/`.

## Ringkasan

PBS Digital Store adalah **monorepo** untuk platform penjualan produk digital (akun, voucher, kredensial, dsb). Platform menjual lewat banyak kanal sekaligus dan semuanya berbagi **satu database Supabase (PostgreSQL)** yang sama.

Ada 6 service aplikasi + 1 folder database:

| Service | Peran | Stack | Port |
|---|---|---|---|
| `bot-telegram` | Toko utama via bot Telegram | Node.js + Telegraf + Express | HTTP_PORT (default 3000) |
| `user` | Toko web pelanggan | Next.js 14 / React 18 | 3001 |
| `reseller-dashboard` | Panel kelola toko reseller | Next.js 14 / React 18 | 3002 |
| `web-reseller` | Etalase toko reseller (multi-tenant) | Next.js 14 / React 18 | 3003 |
| `dashboard` | Panel admin platform | Next.js 16 / React 19 | 3004 |
| `web-blog` | Blog publik (SEO/marketing) | Next.js 14 / React 18 | 3005 |
| `supabase` | Migrasi SQL + dokumentasi DB | PostgreSQL | - |

Catatan port: `start-all.js` menampilkan dashboard sebagai `3000`, tetapi skrip dev dashboard sebenarnya memakai `3004`. Gunakan skrip `package.json` masing-masing service sebagai sumber kebenaran.

## Arsitektur Tingkat Tinggi

```
                    ┌───────────────────────────────┐
                    │     Supabase (PostgreSQL)      │
                    │  products, product_items,      │
                    │  orders, users, resellers,     │
                    │  wallet, affiliate, blog, ...  │
                    │  + RPC reserve/finalize/release│
                    └───────────────────────────────┘
                          ▲    ▲    ▲    ▲    ▲    ▲
        ┌─────────────────┘    │    │    │    │    └─────────────────┐
        │            ┌─────────┘    │    └────────┐          ┌───────┘
┌───────────────┐ ┌──────────┐ ┌───────────────┐ ┌──────────────┐ ┌──────────┐
│ bot-telegram  │ │   user   │ │reseller-dash..│ │ web-reseller │ │dashboard │
│  (Telegraf)   │ │ (web toko)│ │ (kelola toko) │ │ (etalase RS) │ │  (admin) │
└───────────────┘ └──────────┘ └───────────────┘ └──────────────┘ └──────────┘
        │              │                                  │              │
        │              │                                  │       ┌──────────┐
        └──────────────┴─── Midtrans / Tokopay (QRIS) ────┘       │ web-blog │
                       └──── Resend / SMTP (email) ───────┘       └──────────┘
                       └──── hCaptcha (anti-bot) ──────────┘
```

Prinsip kunci: bot, user store, dan web-reseller semuanya membaca katalog dan stok yang sama, memakai kontrak stok yang sama (reserve -> finalize -> release), dan memakai gateway pembayaran QRIS yang sama. Admin dashboard mengelola seluruh data; web-blog hanya membaca konten.

## Service

### bot-telegram (Toko utama Telegram)
Bot Telegraf + server Express untuk webhook & monitoring. Arsitektur hybrid: data persisten di Supabase, tetapi ada state in-memory (`ACTIVE_ORDERS`, `USER_SESSIONS`) dan file JSON (`data/bot-state.json`, `data/settings.json`).

- Entry point: `bot-telegram/index.js` (validasi config -> middleware -> handlers -> Express -> launch).
- Handlers: `src/bot/handlers/` (commands, callbacks, purchase, webhook, admin).
- Pembayaran: `src/payments/midtrans.js` dan `src/payments/tokopay.js`.
- Fitur user: katalog berpaginasi + banner, pencarian fuzzy (nama/kode/alias/kategori), quick-buy via kode, kategori, favorit, riwayat, pembelian QRIS, pengiriman produk digital otomatis (teks atau file `.txt` bila banyak item).
- Fitur admin: statistik, broadcast (text/foto, terjadwal, rate-limited ~28 pesan/detik), settings, backup/restore, notifikasi order & low-stock.
- Mode jalan: **webhook** (jika `PUBLIC_BASE_URL` di-set) atau **polling**.
- Webhook forwarding: bot meneruskan notifikasi Midtrans ke web store (`WEBHOOK_WEB_URL`, order `PBS-xxx`) atau reseller store (`WEBHOOK_WEB_RESELLER_URL`, order `RS-xxx`) dengan retry + idempotency.
- Reliability: Supabase Realtime untuk invalidasi cache produk, stock stabilization (anti-flicker stok ke 0), idempotency ganda pada pembayaran, graceful shutdown.
- Endpoint Express: `/health`, `/status`, `/metrics` (Prometheus), `/webhook/midtrans`, `/webhook/refresh`, `/webhook/lowstock`, `/webhook/broadcast`, `/webhook/telegram`.

### user (Toko web pelanggan)
Toko web Next.js 14 (App Router). Alur inti ada di dua API route:

- `app/api/checkout/route.ts` (POST): validasi anti-bot + hCaptcha + rate limit, **hitung harga server-side dari tabel `products` by ID** (tidak percaya harga client), validasi stok via view `product_inventory_summary`, terapkan promo, buat order `RAIN-<timestamp>`, pilih gateway (`settings.active_payment_gateway`), reserve stok via RPC, insert order, notif admin, kembalikan QR.
- `app/api/webhook/route.ts` (POST): verifikasi signature (Midtrans SHA512 / Tokopay MD5), finalize/release stok, kirim email delivery (di-`await`), trigger refresh katalog bot. Idempotensi dijaga via `.neq('status','completed')` + lock email delivery.
- Email delivery: `lib/email/` (Resend atau SMTP nodemailer dengan opsi `SMTP_FORCE_IPV4`), retry exponential backoff, klasifikasi error kaya, template item digital dengan escaping HTML.
- Auth user web: `lib/auth.ts` (bcrypt + session cookie HMAC).
- Fitur tambahan: program afiliasi, promo/kupon, halaman lacak order, wallet/saldo (di database).
- Testing: `npm run test-flow` (checkout + polling + verifikasi item), `npm run simulate-order` (simulasi webhook settlement).

### dashboard (Admin platform)
Panel admin Next.js 16 / React 19. Autentikasi via **Supabase Auth** (email/password) dengan proteksi rute di `middleware.ts` (`@supabase/ssr`). Mengelola: produk, product items/stok, order, promo, announcement, reseller, affiliate, broadcast Telegram, blog, users, analytics (Recharts), settings, dan backup database (export SQL/TXT via introspeksi PostgREST OpenAPI). Integrasi: memicu refresh cache produk bot via `api/bot/refresh` (`${BOT_URL}/webhook/refresh` dengan header `x-refresh-key`).

### reseller-dashboard (Kelola toko reseller)
Panel Next.js 14 dengan **sistem auth kustom** (bukan Supabase Auth): password bcrypt (12 rounds) + session token HMAC-SHA256 di cookie httpOnly `pbs_reseller_session`. Ada registrasi publik (hCaptcha + rate limit + abuse log); reseller baru dibuat `is_active: false` menunggu aktivasi admin. Fitur reseller: ringkasan toko, riwayat order, katalog produk, atur harga jual sendiri (margin fixed/percent per-produk atau bulk, tersimpan di `reseller_prices`), pengaturan toko, saldo & komisi + penarikan (min Rp 50.000). Notifikasi ke admin via Telegram.

### web-reseller (Etalase reseller multi-tenant)
Storefront Next.js 14 berbasis slug: tiap reseller punya toko sendiri di `/{slug}` dengan branding (logo, warna tema, kontak). Root `/` adalah landing page rekrutmen reseller. Alur e-commerce penuh (cart per-slug di localStorage, checkout, QRIS Midtrans, pengiriman item digital, pelacakan order). Order memakai prefix `RS-`. Berbagi katalog/stok/inventory yang sama dan menjaga kontrak reserve -> finalize -> release. Pasangan storefront dari `reseller-dashboard`.

### web-blog (Blog publik)
Blog Next.js 14 murni SSR (tanpa API route) yang membaca `blog_posts` & `blog_categories` dari Supabase. Fitur: beranda (featured + grid + filter kategori), detail artikel (Markdown tersanitasi via `react-markdown` + `rehype-sanitize`), SEO lengkap (OpenGraph/Twitter/canonical), view counter, tombol share, hanya menampilkan post `published`. Konten dikelola dari Admin Dashboard. Berperan sebagai kanal akuisisi/SEO yang mengarahkan traffic ke toko utama.

## Database (Supabase)

Satu database PostgreSQL berbagi antar semua service. Migrasi ada di `supabase/migrations/` sebagai 8 file konsolidasi (jalankan berurutan):

1. `001_core_schema.sql` - settings, products, product_items, users, user_web, orders, order_items, stock_reservations, favorites, analytics, view inventory.
2. `002_reseller_system.sql` - resellers, reseller_products, reseller_prices, reseller_orders/items, reseller_withdrawals, tabel keamanan web reseller.
3. `003_affiliate_system.sql` - profil affiliate, clicks, earnings, withdrawals + trigger komisi.
4. `004_wallet_system.sql` - user_wallets, wallet_transactions, saldo_topup_orders.
5. `005_marketing_and_content.sql` - blog, promo/kupon, announcements/popups, broadcast Telegram.
6. `006_rls_and_permissions.sql` - enable RLS + policy service-role untuk seluruh tabel.
7. `007_rebrand_rain_store_patch.sql` - patch rebranding.
8. `008_payment_gateway_settings.sql` - setting gateway + kolom `payment_provider` di orders.

Tabel inti:
- `products` - katalog (`kode` unik, `harga`, `harga_bot`, `harga_web`, `stok`, `aktif`, `alias[]`, full-text search).
- `product_items` - item digital individual per produk. Status: `available` / `reserved` / `sold` / `invalid`.
- `orders` + `order_items` - order dari Telegram & web (status pending/paid/completed/expired/cancelled, data Midtrans, tracking email delivery).
- `stock_reservations` - reservasi level-produk (expiry default 15 menit).
- `users` (Telegram) & `user_web` (akun toko web).

View penting: **`product_inventory_summary`** - agregasi stok per produk (available/reserved/sold/invalid). Selalu baca stok dari view ini, bukan agregasi mentah `product_items`, untuk menghindari batas baris PostgREST.

RLS: aktif di semua tabel, tetapi policy bersifat permisif penuh (`USING (true)`). Proteksi data mengandalkan pemisahan **anon key vs service-role key** di layer aplikasi, bukan policy per-baris.

## Kontrak Stok: reserve -> finalize -> release

Kontrak paling kritis di seluruh platform, diimplementasikan sebagai RPC PostgreSQL dan dipanggil oleh bot, user store, dan web-reseller:

- **reserve** (`reserve_items_for_order`) - saat order dibuat, tandai item `available` -> `reserved` dengan expiry.
- **finalize** (`finalize_items_for_order`) - saat pembayaran sukses, tandai `reserved` -> `sold` dan kembalikan `item_data` untuk dikirim ke pembeli.
- **release** (`release_reserved_items`) - saat pembayaran gagal/expire/cancel atau rollback, kembalikan `reserved` -> `available`.

Trigger `sync_product_stock` menjaga kolom `products.stok` selalu sama dengan jumlah item `available`. Reservasi kedaluwarsa dibersihkan lewat job terjadwal.

## Alur Pembayaran (umum)

1. Pelanggan checkout (bot / user store / web-reseller).
2. Sistem menghitung total **server-side**, memvalidasi stok, dan me-**reserve** item.
3. Sistem membuat charge QRIS ke gateway aktif (**Midtrans** Core API atau **Tokopay**), lalu menampilkan QR.
4. Client polling status; gateway juga mengirim webhook notifikasi.
5. Saat `settlement`/`capture`: verifikasi signature -> **finalize** stok -> kirim item digital (email untuk web, pesan untuk bot) -> update order `completed`.
6. Saat gagal/expire: **release** stok.

Prefix order menentukan routing webhook: `RAIN-`/tanpa prefix (user store), `PBS-` (diteruskan bot ke web store), `RS-` (reseller store).

## Perintah

Root (`package.json`):
- Install semua: `npm run install:all`
- Jalankan semua: `npm start` (via `start-all.js`)
- Jalankan satu: `npm run bot | dashboard | store | reseller-dashboard | web-reseller | web-blog`
- Build: `npm run build:dashboard | build:store | build:reseller-dashboard | build:web-reseller | build:web-blog`

Per-service:
- `bot-telegram`: `npm start | npm run dev | npm test | npm run migrate`
- `user`: `npm run dev | npm run build | npm start | npm run test-flow | npm run simulate-order`
- `dashboard` / `reseller-dashboard` / `web-reseller` / `web-blog`: `npm run dev | npm run build | npm start | npm run lint`

## Environment

Setiap service punya file env sendiri: `bot-telegram/.env`, dan `.env.local` di masing-masing app Next.js. Kredensial yang umum lintas service: kunci Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), Midtrans/Tokopay, hCaptcha, dan token Telegram. User store & web-reseller juga butuh konfigurasi email (Resend/SMTP).

Peringatan keamanan: file `.env.local`/`.env` di beberapa service berisi kredensial live termasuk **service-role key** (yang mem-bypass RLS dan memberi akses tulis penuh). Pastikan tidak ter-commit ke git. Untuk web-blog yang hanya membaca, pertimbangkan memakai anon key saja.

## Guardrail Penting (wajib dijaga)

- Total checkout **selalu** dihitung server-side dari tabel `products` by ID. Jangan pernah percaya harga dari client.
- Baca stok lewat view `product_inventory_summary`, bukan agregasi mentah `product_items` (menghindari batas baris PostgREST).
- Jaga kontrak reserve -> finalize -> release tetap utuh saat mengubah alur stok/checkout.
- Email delivery harus di-`await`; pernah ada masalah SMTP timeout & IPv6 (dukung `SMTP_FORCE_IPV4`).
- Webhook forwarding bot bisa drop event bila `WEBHOOK_WEB_URL` salah konfigurasi; guard duplikat sudah ada, jangan dilanggar.

## Temuan / Catatan

Beberapa ketidaksesuaian yang perlu diketahui saat menelusuri kode:
- `docs/database/README.md` masih menyebut penomoran migrasi lama (001-028) dan nama fungsi stok lama (`reserve_stock`, dll). File aktual sudah dikonsolidasi jadi 8 file dan memakai nama `*_items_*` (`reserve_items_for_order`, dll).
- Menu `KlikPayment` di nav admin dashboard menunjuk ke `/dashboard/klikpayment` yang halamannya belum ada.
- Ada logika promo yang berpotensi tumpang tindih di `user/app/api/checkout/route.ts` (diskon pre-charge vs blok promo saat insert order).
- Endpoint `/status` bot mengekspos detail sistem tanpa autentikasi; perhatikan bila `PUBLIC_BASE_URL` publik.

## Peta Dokumentasi

- Overview: `docs/README.md`, `docs/general/README.md`
- Bot: `docs/bot/QUICKSTART.md`, `docs/bot/DEVELOPER_GUIDE.md`
- User store: `docs/user-store/SETUP-GUIDE.md`
- Reseller: `docs/reseller/README.md`
- Database: `docs/database/README.md`, `supabase/README.md`
- RLS troubleshooting: `docs/database/RLS-FIX-GUIDE.md`
- Migrasi: `bot-telegram/scripts/README.md`
