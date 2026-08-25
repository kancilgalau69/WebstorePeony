# Panduan Instalasi & Konfigurasi PBS Reseller System

Dokumen ini menjelaskan langkah-langkah lengkap untuk menginstal dan mengkonfigurasi PBS Reseller System dari awal.

---

## Daftar Isi

- [Prasyarat](#prasyarat)
- [Langkah 1: Migrasi Database](#langkah-1-migrasi-database)
- [Langkah 2: Instalasi Dependensi](#langkah-2-instalasi-dependensi)
- [Langkah 3: Konfigurasi Environment](#langkah-3-konfigurasi-environment)
- [Langkah 4: Membuat Akun Reseller Pertama](#langkah-4-membuat-akun-reseller-pertama)
- [Langkah 5: Menjalankan Service](#langkah-5-menjalankan-service)
- [Tabel Port Assignment](#tabel-port-assignment)
- [Konfigurasi Webhook Midtrans](#konfigurasi-webhook-midtrans)
- [Troubleshooting](#troubleshooting)

---

## Prasyarat

Sebelum memulai, pastikan Anda sudah memiliki:

| Prasyarat | Versi Minimum | Keterangan |
|-----------|---------------|------------|
| **Node.js** | >= 18.0.0 | Runtime JavaScript. Cek: `node --version` |
| **npm** | >= 9.0.0 | Package manager (bawaan Node.js). Cek: `npm --version` |
| **Akun Supabase** | - | Sudah ada project Supabase yang aktif dengan tabel `products` dan `items` |
| **Akun Midtrans** | - | Sudah ada akun Midtrans (Sandbox atau Production) |
| **Bot Telegram** | - | Sudah ada bot Telegram yang aktif (opsional, untuk notifikasi) |

**Penting:** PBS Reseller System adalah **ekstensi** dari PBS Digital Store yang sudah ada. Pastikan sistem utama (bot Telegram, dashboard admin) sudah berjalan dengan benar sebelum menambahkan fitur reseller.

---

## Langkah 1: Migrasi Database

### 1.1 Buka Supabase SQL Editor

1. Login ke [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project PBS Anda
3. Klik **SQL Editor** di sidebar kiri
4. Klik **New Query**

### 1.2 Jalankan Migration File

Buka file migrasi:
```
supabase/migrations/014_reseller_system.sql
```

Salin seluruh isi file dan paste ke SQL Editor, lalu klik **Run**.

### 1.3 Apa yang Dibuat oleh Migrasi Ini?

Migrasi `014_reseller_system.sql` membuat komponen-komponen berikut:

#### 6 Tabel Baru

| No | Tabel | Deskripsi |
|----|-------|-----------|
| 1 | `resellers` | Data reseller (profil, kredensial, saldo) |
| 2 | `reseller_products` | Visibilitas produk per reseller (show/hide) |
| 3 | `reseller_prices` | Harga jual custom per produk per reseller |
| 4 | `reseller_orders` | Pesanan yang masuk melalui toko reseller |
| 5 | `reseller_order_items` | Detail item per pesanan reseller |
| 6 | `reseller_withdrawals` | Riwayat penarikan saldo reseller |

#### 1 Database Function

| Fungsi | Deskripsi |
|--------|-----------|
| `calculate_reseller_price(base_price, margin_type, margin_value)` | Menghitung harga jual berdasarkan margin |

#### 2 Database Triggers

| Trigger | Tabel | Event | Deskripsi |
|---------|-------|-------|-----------|
| `trigger_update_reseller_saldo` | `reseller_orders` | AFTER INSERT OR UPDATE | Menambah saldo, total_penjualan, dan total_komisi saat order selesai |
| `trigger_process_withdrawal` | `reseller_withdrawals` | AFTER UPDATE | Mengurangi saldo saat penarikan selesai |

#### Row Level Security (RLS)

Semua 6 tabel memiliki **RLS enabled** dengan policy `service_role` yang memberikan akses penuh ke service role Supabase.

#### Indexes

Index dibuat pada kolom-kolom yang sering di-query untuk optimasi performa (lihat [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) untuk detail lengkap).

### 1.4 Verifikasi Migrasi

Setelah menjalankan migrasi, verifikasi dengan query berikut:

```sql
-- Cek tabel yang dibuat
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'reseller%'
ORDER BY table_name;

-- Harus menampilkan 6 tabel:
-- reseller_order_items
-- reseller_orders
-- reseller_prices
-- reseller_products
-- reseller_withdrawals
-- resellers
```

```sql
-- Cek function
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'calculate_reseller_price';
```

```sql
-- Cek triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name LIKE '%reseller%';
```

---

## Langkah 2: Instalasi Dependensi

### 2.1 Install Dependensi Reseller Dashboard

```bash
cd reseller-dashboard
npm install
```

### 2.2 Install Dependensi Web Reseller

```bash
cd web-reseller
npm install
```

### 2.3 Verifikasi Instalasi

Pastikan tidak ada error saat instalasi. Jika ada masalah dengan dependensi, coba:

```bash
# Hapus node_modules dan install ulang
rm -rf node_modules package-lock.json
npm install
```

---

## Langkah 3: Konfigurasi Environment

### 3.1 Reseller Dashboard (`reseller-dashboard/.env.local`)

Buat file `.env.local` di direktori `reseller-dashboard/`:

```env
# ============================================
# SUPABASE CONFIGURATION
# ============================================

# URL project Supabase Anda
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Anon key Supabase (public, aman di-expose ke client)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service role key Supabase (RAHASIA, hanya untuk server-side)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Cara mendapatkan:**
1. Buka Supabase Dashboard → Project Settings → API
2. **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

### 3.2 Web Reseller (`web-reseller/.env.local`)

Buat file `.env.local` di direktori `web-reseller/`:

```env
# ============================================
# SUPABASE CONFIGURATION
# ============================================

# URL project Supabase Anda
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Anon key Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service role key Supabase (RAHASIA)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============================================
# MIDTRANS CONFIGURATION
# ============================================

# Server key Midtrans (RAHASIA, untuk backend)
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxx

# Client key Midtrans (public, untuk frontend)
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx

# Client key untuk Next.js public access
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx

# Mode production (true = production, false = sandbox)
MIDTRANS_IS_PRODUCTION=false

# ============================================
# TELEGRAM BOT CONFIGURATION
# ============================================

# Token bot Telegram (untuk notifikasi ke admin)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# ID admin Telegram yang menerima notifikasi (pisahkan dengan koma untuk multiple)
TELEGRAM_ADMIN_IDS=123456789,987654321

# ============================================
# HCAPTCHA CONFIGURATION (Opsional)
# ============================================

# Secret key hCaptcha (untuk verifikasi server-side)
HCAPTCHA_SECRET_KEY=0x0000000000000000000000000000000000000000

# Site key hCaptcha (untuk widget client-side)
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=10000000-ffff-ffff-ffff-000000000000
```

**Cara mendapatkan Midtrans keys:**
1. Login ke [Midtrans Dashboard](https://dashboard.midtrans.com)
2. Settings → Access Keys
3. Untuk sandbox, gunakan prefix `SB-`
4. Untuk production, gunakan key tanpa prefix `SB-`

**Cara mendapatkan Telegram Bot Token:**
1. Chat dengan [@BotFather](https://t.me/BotFather) di Telegram
2. Gunakan token yang sama dengan bot PBS utama

**Cara mendapatkan Telegram Admin IDs:**
1. Chat dengan [@userinfobot](https://t.me/userinfobot) di Telegram
2. Bot akan menampilkan ID Anda

---

## Langkah 4: Membuat Akun Reseller Pertama

Karena belum ada fitur registrasi publik, akun reseller pertama harus dibuat secara manual melalui SQL.

### 4.1 Generate Password Hash dengan bcrypt

Jalankan script Node.js berikut untuk menghasilkan hash password:

```javascript
// generate-hash.js
const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'password_reseller_anda'; // Ganti dengan password yang diinginkan
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  console.log('Password:', password);
  console.log('Hash:', hash);
}

generateHash();
```

Jalankan:

```bash
node generate-hash.js
```

Output contoh:

```
Password: password_reseller_anda
Hash: $2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4.2 Insert Reseller ke Database

Buka Supabase SQL Editor dan jalankan query berikut:

```sql
INSERT INTO resellers (
  nama_toko,
  slug,
  email,
  password_hash,
  deskripsi,
  warna_tema,
  is_active,
  saldo,
  total_penjualan,
  total_komisi
) VALUES (
  'Toko Digital ABC',                          -- Nama toko
  'toko-abc',                                  -- Slug (URL-friendly, huruf kecil, tanpa spasi)
  'reseller@pbs.com',                      -- Email login
  '$2b$10$Oj3djWXNjzqOOmbPvrqAluP.mBvHOQA6ZBgg2gtQE9CE/Jl6l8zxa',    -- Hash dari langkah 4.1
  'Toko digital terpercaya',                   -- Deskripsi toko
  '#3B82F6',                                   -- Warna tema (hex color)
  true,                                        -- Status aktif
  0,                                           -- Saldo awal
  0,                                           -- Total penjualan awal
  0                                            -- Total komisi awal
);
```

### 4.3 Verifikasi Akun

```sql
SELECT id, nama_toko, slug, email, is_active, created_at 
FROM resellers 
WHERE email = 'reseller@example.com';
```

### 4.4 Test Login

1. Buka browser dan akses `http://localhost:3002`
2. Masukkan email dan password yang sudah dibuat
3. Jika berhasil, Anda akan diarahkan ke dashboard reseller

---

## Langkah 5: Menjalankan Service

### Opsi A: Jalankan Semua Service Sekaligus

Dari root direktori project:

```bash
npm start
```

Atau gunakan script khusus:

```bash
node start-all.js
```

Script `start-all.js` akan menjalankan semua 5 service secara bersamaan.

### Opsi B: Jalankan Service Reseller Saja

Jika hanya ingin menjalankan service reseller:

**Reseller Dashboard:**
```bash
cd reseller-dashboard
npm run dev    # Development mode (hot reload)
npm run build  # Build untuk production
npm start      # Production mode
```

Atau dari root:
```bash
npm run reseller-dashboard
```

**Web Reseller:**
```bash
cd web-reseller
npm run dev    # Development mode (hot reload)
npm run build  # Build untuk production
npm start      # Production mode
```

Atau dari root:
```bash
npm run web-reseller
```

### Opsi C: Jalankan dengan PM2 (Production)

```bash
# Install PM2 secara global
npm install -g pm2

# Jalankan reseller dashboard
pm2 start npm --name "reseller-dashboard" -- start --prefix reseller-dashboard

# Jalankan web reseller
pm2 start npm --name "web-reseller" -- start --prefix web-reseller

# Lihat status
pm2 status

# Lihat log
pm2 logs reseller-dashboard
pm2 logs web-reseller
```

---

## Tabel Port Assignment

| Service | Port | URL | Keterangan |
|---------|------|-----|------------|
| Bot Telegram | N/A | - | Berjalan sebagai long-polling, tidak memerlukan port |
| Admin Dashboard | 3000 | `http://localhost:3000` | Panel admin pusat |
| User Panel | 3001 | `http://localhost:3001` | Panel pelanggan |
| **Reseller Dashboard** | **3002** | `http://localhost:3002` | **Dashboard reseller** |
| **Web Reseller** | **3003** | `http://localhost:3003` | **Toko online reseller** |

**Catatan:** Pastikan port-port di atas tidak digunakan oleh service lain. Jika perlu mengubah port, edit file `next.config.js` atau `package.json` pada masing-masing service.

---

## Konfigurasi Webhook Midtrans

Webhook Midtrans diperlukan agar sistem dapat menerima notifikasi pembayaran secara real-time.

### 1. Buka Midtrans Dashboard

1. Login ke [Midtrans Dashboard](https://dashboard.midtrans.com)
2. Pilih environment (Sandbox atau Production)
3. Navigasi ke **Settings → Configuration**

### 2. Set Payment Notification URL

Masukkan URL webhook yang mengarah ke endpoint `/api/webhook` pada service **web-reseller**:

```
# Format:
https://your-domain.com:3003/api/webhook

# Contoh (production):
https://store.example.com/api/webhook

# Contoh (development dengan ngrok):
https://abc123.ngrok.io/api/webhook
```

### 3. Konfigurasi Tambahan di Midtrans

| Setting | Nilai |
|---------|-------|
| Payment Notification URL | `https://your-domain.com/api/webhook` |
| Finish Redirect URL | (kosongkan, ditangani oleh frontend) |
| Unfinish Redirect URL | (kosongkan) |
| Error Redirect URL | (kosongkan) |

### 4. Testing Webhook (Sandbox)

Untuk menguji webhook di environment sandbox:

1. Pastikan web-reseller sudah berjalan
2. Jika development lokal, gunakan [ngrok](https://ngrok.com) untuk membuat tunnel:
   ```bash
   ngrok http 3003
   ```
3. Salin URL ngrok (contoh: `https://abc123.ngrok.io`) dan set sebagai webhook URL di Midtrans
4. Lakukan transaksi test dan periksa log untuk memastikan webhook diterima

### 5. Penting: Shared Webhook

Jika sistem PBS utama juga menggunakan webhook Midtrans, Anda memiliki dua opsi:

**Opsi A: Webhook terpisah per service**
- Setiap service memiliki URL webhook sendiri
- Konfigurasi di Midtrans hanya mendukung 1 URL → gunakan reverse proxy (Nginx) untuk routing

**Opsi B: Webhook tunggal dengan routing**
- Semua webhook masuk ke satu endpoint
- Endpoint memeriksa prefix order ID (`RS-` untuk reseller) dan merouting ke handler yang sesuai

---

## Troubleshooting

### Masalah Umum

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| Login gagal | Password hash salah | Generate ulang hash dan update di database |
| Halaman blank setelah login | Cookie tidak di-set | Pastikan domain sama (localhost) |
| Produk tidak muncul | Tabel `products` kosong | Tambahkan produk melalui admin dashboard |
| Payment error | Midtrans key salah | Periksa `.env.local` pada web-reseller |
| Webhook tidak diterima | URL webhook salah | Periksa konfigurasi di Midtrans dashboard |
| Port sudah digunakan | Konflik port | Ubah port di `package.json` atau matikan service lain |
| Build error | Node.js versi lama | Update Node.js ke versi >= 18 |

### Memeriksa Log

```bash
# Development mode (log langsung di terminal)
npm run dev

# Production mode dengan PM2
pm2 logs reseller-dashboard --lines 50
pm2 logs web-reseller --lines 50
```

### Reset Password Reseller

Jika reseller lupa password, admin dapat mereset melalui SQL:

```javascript
// Generate hash baru
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('password_baru', 10);
console.log(hash);
```

```sql
UPDATE resellers 
SET password_hash = '$2b$10$new_hash_here' 
WHERE email = 'reseller@example.com';
```

---

*Lanjut ke: [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) — Referensi lengkap skema database*
