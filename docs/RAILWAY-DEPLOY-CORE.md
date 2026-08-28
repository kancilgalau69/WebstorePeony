# Panduan Deploy Railway — Dashboard, Bot Telegram & Web User

Panduan ini fokus pada 3 service inti: **Admin Dashboard**, **Bot Telegram**, dan **Web User (toko pelanggan)**. Setiap service di-deploy sebagai **service Railway terpisah** dari repo yang sama (monorepo), dengan Root Directory berbeda.

> Untuk reseller store / reseller dashboard / blog, polanya sama — cukup ganti Root Directory dan env-nya.

---

## Konsep penting sebelum mulai

1. **Satu repo, banyak service.** Buat 1 project Railway, lalu tambahkan 1 service per folder (`dashboard`, `bot-telegram`, `user`). Masing-masing set **Root Directory** ke folder tersebut.

2. **`NEXT_PUBLIC_*` di-inline saat BUILD, bukan runtime.** Ini penyebab paling umum build gagal. Untuk Next.js (dashboard & user), variabel berawalan `NEXT_PUBLIC_` **harus sudah ada saat `npm run build` berjalan**. Di Railway, service variables tersedia baik saat build maupun runtime, jadi cukup pastikan variabel di-set **sebelum** deploy pertama. Jika kosong saat build, nilainya ikut kosong di bundle browser selamanya (sampai rebuild).

3. **Gunakan `$PORT` dari Railway.** Railway memberi port lewat env `PORT`. Next.js dan bot harus bind ke port itu (lihat Start Command tiap service).

4. **Supabase adalah database bersama.** Semua service menunjuk ke project Supabase yang sama. Jalankan migrasi (`supabase/migrations/`) sekali di Supabase sebelum deploy.

---

## Persiapan awal (sekali saja)

1. Push repo ke GitHub.
2. Pastikan migrasi database sudah dijalankan di Supabase (lihat `supabase/README.md`).
3. Siapkan kredensial: Supabase (URL, anon key, service_role key), Midtrans, dan (opsional) Tokopay/Qiospay, Resend/SMTP, hCaptcha, Telegram bot token.
4. Di Railway: **New Project → Deploy from GitHub repo** → pilih repo ini.

---

## Service 1 — Admin Dashboard (Next.js)

**Settings**
- Root Directory: `dashboard`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start -- -p $PORT`
  - (script `start` default memakai `-p 3004`; override dengan `$PORT` agar cocok dengan Railway)
- Generate Domain (Networking → Public Networking) untuk dapat URL publik.

**Environment Variables (minimal)**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon...
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...
NEXT_PUBLIC_BOT_URL=https://<domain-bot-railway>
WEBHOOK_SECRET=<string-acak-kuat-sama-dgn-bot>
```

Opsional:
```
NEXT_PUBLIC_BLOG_URL=https://<domain-blog>
NEXT_PUBLIC_APP_URL=https://<domain-dashboard>
```

**Catatan penting**
- `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` **wajib ada saat build**. Kalau kosong, halaman dashboard tidak bisa login/ambil data di browser.
- `NEXT_PUBLIC_BOT_URL` + `WEBHOOK_SECRET` dipakai tombol refresh katalog bot (`/api/bot/refresh` → `${BOT_URL}/webhook/refresh` dengan header `x-refresh-key`). `WEBHOOK_SECRET` harus **sama persis** dengan yang di service bot.
- Login dashboard memakai Supabase Auth — pastikan user admin sudah dibuat di Supabase Auth.

---

## Service 2 — Bot Telegram (Node.js + Express)

Bot ini butuh bind ke `$PORT` (untuk endpoint webhook/health) dan berjalan mode **webhook** di produksi.

**Settings**
- Root Directory: `bot-telegram`
- Build Command: `npm install`
- Start Command: `npm start` (menjalankan `node index.js`)
- Generate Domain untuk dapat URL publik (dipakai `PUBLIC_BASE_URL` + webhook Telegram/Midtrans).

**Environment Variables (minimal)**
```
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_ADMIN_IDS=123456789
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...anon...
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...
MIDTRANS_SERVER_KEY=Mid-server-xxx
MIDTRANS_IS_PRODUCTION=true
HTTP_PORT=$PORT
PUBLIC_BASE_URL=https://<domain-bot-railway>
WEBHOOK_SECRET=<string-acak-kuat-sama-dgn-dashboard>
WEBHOOK_WEB_URL=https://<domain-user-railway>/api/webhook
```

Opsional (gateway tambahan & tuning):
```
TOKOPAY_MERCHANT_ID=Mxxx
TOKOPAY_SECRET_KEY=xxx
QIOSPAY_MERCHANT_CODE=QPxxx
QIOSPAY_API_KEY=xxx
QIOSPAY_SECRET_KEY=<buat-sendiri>
WEBHOOK_WEB_RESELLER_URL=https://<domain-web-reseller>/api/webhook
PAYMENT_TTL_MS=900000
PRODUCT_TTL_MS=300000
```

**Catatan penting**
- `HTTP_PORT=$PORT` — bot membaca `HTTP_PORT`; arahkan ke `$PORT` Railway. (Bot default 3000 kalau tidak di-set, tapi Railway butuh port dinamisnya.)
- `PUBLIC_BASE_URL` di-set → bot otomatis jalan **mode webhook** dan mendaftarkan webhook Telegram ke `PUBLIC_BASE_URL/webhook/telegram`. Kalau tidak di-set, bot fallback ke polling.
- `WEBHOOK_WEB_URL` = endpoint webhook web user. Bot meneruskan notifikasi pembayaran order `PBS-*` ke sini. Wajib benar agar item digital web user terkirim.
- Set **Notification URL Midtrans** (dashboard Midtrans) ke `https://<domain-bot>/webhook/midtrans`.
- `MIDTRANS_IS_PRODUCTION=true` untuk akun produksi; `false` untuk sandbox.

---

## Service 3 — Web User / Toko Pelanggan (Next.js)

**Settings**
- Root Directory: `user`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start -- -p $PORT`
  - (script `start` default `-p 3001`; override dengan `$PORT`)
- Generate Domain untuk URL publik.

**Environment Variables (minimal)**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon...
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...

MIDTRANS_SERVER_KEY=Mid-server-xxx
MIDTRANS_CLIENT_KEY=Mid-client-xxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=Mid-client-xxx
MIDTRANS_IS_PRODUCTION=true

EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxx
RESEND_FROM_NAME=Nama Toko
RESEND_FROM_EMAIL=order@domain-terverifikasi.com

HCAPTCHA_SECRET_KEY=xxx
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=xxx

WEBHOOK_SECRET=<string-acak-kuat>
SESSION_SECRET=<string-acak-kuat>
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_ADMIN_IDS=123456789
NEXT_PUBLIC_BOT_URL=https://<domain-bot-railway>
```

Opsional (gateway tambahan):
```
TOKOPAY_MERCHANT_ID=Mxxx
TOKOPAY_SECRET_KEY=xxx
QIOSPAY_MERCHANT_CODE=QPxxx
QIOSPAY_API_KEY=xxx
QIOSPAY_SECRET_KEY=<buat-sendiri>
QIOSPAY_QRIS_STRING=00020101...   # raw QRIS dari dashboard Qiospay (utuh!)
QIOSPAY_MAX_ADMIN_FEE=300
```

**Catatan penting**
- `NEXT_PUBLIC_*` (Supabase URL, anon key, Midtrans client key, hCaptcha site key) **wajib ada saat build**.
- `RESEND_FROM_EMAIL` harus domain yang **sudah diverifikasi** di Resend, kalau tidak email item digital gagal terkirim.
- `WEBHOOK_SECRET` dipakai untuk autentikasi event internal Qiospay → `/api/webhook`. Wajib di-set kalau pakai Qiospay.
- **Gateway pembayaran** dipilih lewat tabel `settings` key `active_payment_gateway` (`midtrans` / `tokopay` / `qiospay`) — diatur dari Admin Dashboard, bukan env.
- Callback pembayaran (produksi):
  - Midtrans: Notification URL diarahkan ke bot (`/webhook/midtrans`), lalu bot forward ke `WEBHOOK_WEB_URL`. Untuk order web murni, web user juga punya auto-trigger via polling.
  - Tokopay: set Callback URL di dashboard Tokopay ke `https://<domain-user>/api/webhook`.
  - Qiospay: set Callback URL di dashboard Qiospay ke `https://<domain-user>/api/callback/accept/<QIOSPAY_SECRET_KEY>`.

---

## Troubleshooting

### Build gagal: `@supabase/ssr: Your project's URL and API key are required`
Penyebab: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` kosong saat build (prerender halaman client memanggil Supabase).
Solusi:
1. Pastikan kedua variabel `NEXT_PUBLIC_*` sudah di-set di service Railway **sebelum** build.
2. Trigger ulang deploy (Deployments → Redeploy) setelah menambahkan env.
3. Kode sudah dibuat tahan-crash (fallback placeholder saat prerender), tapi nilai asli tetap wajib agar app berfungsi di browser.

### App jalan tapi login/data gagal di browser
`NEXT_PUBLIC_*` kosong saat build sebelumnya. Set env-nya lalu **Redeploy** (bukan sekadar restart) supaya nilai ter-inline ulang ke bundle.

### Bot tidak menerima update / webhook
- Pastikan `PUBLIC_BASE_URL` = domain publik Railway bot (https).
- Cek `HTTP_PORT=$PORT`. Kalau bot tidak bind `$PORT`, Railway menandai deploy unhealthy.
- Cek `https://<domain-bot>/health` mengembalikan OK.

### Pembayaran sukses tapi item tidak terkirim
- Cek `WEBHOOK_WEB_URL` (di bot) menunjuk ke `https://<domain-user>/api/webhook` yang benar.
- Cek Notification/Callback URL di dashboard gateway sudah ke domain produksi.
- Cek `WEBHOOK_SECRET` konsisten di service yang saling memanggil.

### Warning `Unsupported metadata themeColor` / `middleware deprecated`
Ini **peringatan**, bukan error — build tetap sukses. Bisa diabaikan.

### Port salah / "Application failed to respond"
Start Command harus pakai `$PORT`:
- Next.js: `npm run start -- -p $PORT`
- Bot: set `HTTP_PORT=$PORT`

---

## Checklist urutan deploy

1. Jalankan migrasi Supabase.
2. Deploy **bot-telegram** dulu → catat domain publiknya.
3. Deploy **web user** → isi `WEBHOOK_WEB_URL` di bot dengan `https://<domain-user>/api/webhook`.
4. Deploy **dashboard** → isi `NEXT_PUBLIC_BOT_URL` = domain bot.
5. Set Notification/Callback URL di dashboard gateway (Midtrans/Tokopay/Qiospay).
6. Set `active_payment_gateway` di dashboard admin.
7. Tes 1 order kecil end-to-end.
