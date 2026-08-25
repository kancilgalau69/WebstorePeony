# PBS Reseller System - Dokumentasi Lengkap

## Pengantar

Sistem reseller PBS Digital Store memungkinkan pihak ketiga (reseller) menjual produk digital dari katalog pusat melalui toko online sendiri, dengan dashboard pengelolaan, pengaturan harga custom, dan sistem komisi otomatis.

Setiap reseller mendapatkan:
- **Toko online sendiri** dengan URL unik (`/{slug}`)
- **Dashboard manajemen** untuk mengelola produk, harga, dan pesanan
- **Sistem harga fleksibel** dengan margin fixed atau persentase per produk
- **Komisi otomatis** yang dihitung dari selisih harga jual dan harga pusat
- **Sistem penarikan saldo** ke berbagai bank dan e-wallet
- **Branding custom** termasuk logo, warna tema, dan informasi toko

---

## Daftar Isi

| No | Dokumen | Deskripsi |
|----|---------|-----------|
| 1 | [README.md](./README.md) | Gambaran umum sistem (dokumen ini) |
| 2 | [SETUP-GUIDE.md](./SETUP-GUIDE.md) | Panduan instalasi & konfigurasi |
| 3 | [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) | Referensi lengkap skema database |
| 4 | [DASHBOARD-GUIDE.md](./DASHBOARD-GUIDE.md) | Panduan dashboard reseller |
| 5 | [STOREFRONT-GUIDE.md](./STOREFRONT-GUIDE.md) | Panduan toko online (web reseller) |
| 6 | [API-REFERENCE.md](./API-REFERENCE.md) | Referensi lengkap API endpoint |
| 7 | [ORDER-FLOW.md](./ORDER-FLOW.md) | Alur order & pembayaran |
| 8 | [PRICING-SYSTEM.md](./PRICING-SYSTEM.md) | Sistem harga & margin |
| 9 | [WITHDRAWAL-SYSTEM.md](./WITHDRAWAL-SYSTEM.md) | Sistem saldo & penarikan |

---

## Gambaran Umum

### Apa itu PBS Reseller System?

PBS Reseller System adalah platform white-label yang memungkinkan siapa saja menjadi reseller produk digital PBS. Reseller tidak perlu menyediakan stok produk sendiri — semua produk dikelola oleh admin pusat. Reseller hanya perlu:

1. **Mendaftar** dan mendapatkan akun reseller
2. **Mengatur toko** — nama, logo, warna tema, deskripsi
3. **Memilih produk** yang ingin dijual (show/hide dari katalog pusat)
4. **Mengatur margin harga** — tambahkan keuntungan di atas harga pusat
5. **Membagikan link toko** ke pelanggan
6. **Menerima komisi** otomatis setiap ada transaksi berhasil

### Apa yang Didapat Setiap Reseller?

| Fitur | Deskripsi |
|-------|-----------|
| Toko Online | URL unik `/{slug}` dengan branding custom |
| Dashboard | Panel manajemen di port 3002 |
| Katalog Produk | Akses ke seluruh katalog produk digital PBS |
| Harga Custom | Atur margin per produk (fixed/persen) |
| Pembayaran QRIS | Otomatis via Midtrans (GoPay QRIS) |
| Komisi Otomatis | Dihitung dan ditambahkan ke saldo saat order selesai |
| Penarikan Saldo | Ke bank atau e-wallet dengan minimum Rp 50.000 |
| Notifikasi | Admin mendapat notifikasi Telegram setiap transaksi |

### Fitur Keamanan & UI Modern

| Fitur | Deskripsi |
|-------|-----------|
| **hCaptcha** | Verifikasi CAPTCHA di halaman checkout untuk mencegah bot dan spam |
| **Rate Limiting** | Pembatasan request checkout (max 5 per 15 menit per IP) |
| **Redesign UI** | Tampilan modern dengan gradient, smooth animation, dan better UX |
| **Responsive Design** | Optimal di semua ukuran layar (desktop, tablet, mobile) |
| **Loading States** | Skeleton loading dan spinner untuk feedback yang lebih baik |

---

## Alur Sistem (Flow Diagram)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PBS RESELLER SYSTEM FLOW                        │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────────────┐     ┌──────────────────────────┐
  │  ADMIN   │────>│  Menambah Produk │────>│  Katalog Produk (DB)     │
  │  PUSAT   │     │  ke Database     │     │  products table          │
  └──────────┘     └──────────────────┘     └────────────┬─────────────┘
                                                         │
                                                         ▼
  ┌──────────┐     ┌──────────────────┐     ┌──────────────────────────┐
  │ RESELLER │────>│  Konfigurasi     │────>│  - Pilih produk (show)   │
  │          │     │  Toko & Harga    │     │  - Atur margin harga     │
  └──────────┘     └──────────────────┘     │  - Custom branding       │
                                            └────────────┬─────────────┘
                                                         │
                                                         ▼
  ┌──────────┐     ┌──────────────────┐     ┌──────────────────────────┐
  │ CUSTOMER │────>│  Kunjungi Toko   │────>│  /{slug}                 │
  │          │     │  Reseller        │     │  Browse & pilih produk   │
  └──────────┘     └──────────────────┘     └────────────┬─────────────┘
                                                         │
                                                         ▼
                   ┌──────────────────┐     ┌──────────────────────────┐
                   │  Checkout &      │────>│  QRIS Payment via        │
                   │  Pembayaran      │     │  Midtrans Core API       │
                   └──────────────────┘     └────────────┬─────────────┘
                                                         │
                                                         ▼
                   ┌──────────────────┐     ┌──────────────────────────┐
                   │  Webhook         │────>│  - Update status order   │
                   │  Midtrans        │     │  - Finalize items        │
                   └──────────────────┘     │  - Hitung komisi         │
                                            └────────────┬─────────────┘
                                                         │
                                                         ▼
  ┌──────────┐     ┌──────────────────┐     ┌──────────────────────────┐
  │ RESELLER │<────│  Komisi Otomatis │<────│  Trigger DB menambah     │
  │          │     │  Masuk ke Saldo  │     │  komisi ke saldo         │
  └──────────┘     └──────────────────┘     └──────────────────────────┘
       │
       ▼
  ┌──────────────────┐     ┌──────────────────────────┐
  │  Penarikan Saldo │────>│  Transfer ke Bank/E-Wallet│
  │  (min Rp 50.000) │     │  Diproses oleh Admin      │
  └──────────────────┘     └──────────────────────────┘
```

---

## Arsitektur Sistem

PBS Reseller System merupakan bagian dari monorepo `bot-telegram-pbs` yang terdiri dari 5 service:

```
bot-telegram-pbs/
├── bot-telegram/          # Bot Telegram PBS (Service 1)
├── dashboard/             # Admin Dashboard (Service 2)
├── user/                  # User Panel (Service 3)
├── reseller-dashboard/    # Dashboard Reseller (Service 4)  ← RESELLER
├── web-reseller/          # Toko Online Reseller (Service 5) ← RESELLER
├── supabase/migrations/   # Database migrations
├── start-all.js           # Script untuk menjalankan semua service
└── docs/reseller/         # Dokumentasi (folder ini)
```

### Tabel Service & Port

| No | Service | Direktori | Port | Deskripsi |
|----|---------|-----------|------|-----------|
| 1 | Bot Telegram | `bot-telegram/` | N/A | Bot Telegram untuk pembelian via chat |
| 2 | Admin Dashboard | `dashboard/` | 3000 | Panel admin untuk mengelola produk & pesanan |
| 3 | User Panel | `user/` | 3001 | Panel pelanggan untuk riwayat pembelian |
| 4 | Reseller Dashboard | `reseller-dashboard/` | 3002 | Dashboard reseller untuk mengelola toko |
| 5 | Web Reseller | `web-reseller/` | 3003 | Toko online reseller (storefront) |

---

## Tech Stack

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| **Next.js** | 14 | Framework React full-stack (App Router) |
| **TypeScript** | Latest | Type safety untuk seluruh codebase |
| **Tailwind CSS** | v3 | Utility-first CSS framework |
| **Supabase** | Latest | Backend-as-a-Service (PostgreSQL, Auth, Storage) |
| **Midtrans** | Core API | Payment gateway (QRIS via GoPay) |
| **bcrypt** | Latest | Hashing password reseller |
| **Recharts** | Latest | Library chart untuk dashboard (Area Chart) |
| **Font Awesome** | 6 | Icon library |
| **Custom HMAC-SHA256** | - | Session authentication untuk reseller dashboard |

---

## Shared Resources (Sumber Daya Bersama)

Semua 5 service dalam monorepo ini **berbagi sumber daya yang sama**:

### 1. Database Supabase (Shared)

Semua service terhubung ke **satu database Supabase yang sama**. Tabel-tabel reseller (`resellers`, `reseller_products`, `reseller_prices`, `reseller_orders`, `reseller_order_items`, `reseller_withdrawals`) berada di database yang sama dengan tabel produk utama (`products`, `items`, dll).

**Keuntungan:**
- Reseller langsung mengakses katalog produk terbaru dari admin
- Stok item terintegrasi — reservasi dan finalisasi menggunakan fungsi yang sama
- Tidak perlu sinkronisasi data antar database

### 2. Midtrans Payment Gateway (Shared)

Semua pembayaran (baik dari bot Telegram, user panel, maupun toko reseller) menggunakan **satu akun Midtrans yang sama**. Order dari reseller dibedakan dengan prefix `RS-` pada order ID.

**Catatan:**
- Webhook URL harus dikonfigurasi untuk menerima callback dari semua service
- Order reseller diidentifikasi dari prefix `RS-` pada `order_id`

### 3. Telegram Bot (Shared)

Bot Telegram yang sama digunakan untuk:
- Menerima pesanan langsung dari pelanggan (fitur utama)
- Mengirim **notifikasi ke admin** saat ada order reseller masuk
- Mengirim **notifikasi ke admin** saat order reseller berhasil/gagal

**Konfigurasi:**
- `TELEGRAM_BOT_TOKEN` — Token bot yang sama
- `TELEGRAM_ADMIN_IDS` — ID admin yang menerima notifikasi

---

## Quick Start

Untuk memulai, ikuti langkah-langkah berikut:

1. **Baca [SETUP-GUIDE.md](./SETUP-GUIDE.md)** — Instalasi dan konfigurasi awal
2. **Baca [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md)** — Pahami struktur database
3. **Baca [DASHBOARD-GUIDE.md](./DASHBOARD-GUIDE.md)** — Pelajari cara menggunakan dashboard
4. **Baca [STOREFRONT-GUIDE.md](./STOREFRONT-GUIDE.md)** — Pahami cara kerja toko online
5. **Baca [ORDER-FLOW.md](./ORDER-FLOW.md)** — Pahami alur transaksi end-to-end
6. **Baca [PRICING-SYSTEM.md](./PRICING-SYSTEM.md)** — Pahami sistem harga dan margin
7. **Baca [WITHDRAWAL-SYSTEM.md](./WITHDRAWAL-SYSTEM.md)** — Pahami sistem penarikan saldo
8. **Baca [API-REFERENCE.md](./API-REFERENCE.md)** — Referensi API untuk developer

---

## Kontak & Support

Untuk pertanyaan atau bantuan terkait PBS Reseller System, hubungi admin PBS Digital Store melalui bot Telegram atau dashboard admin.

---

*Dokumentasi ini dibuat untuk PBS Digital Store Reseller System. Terakhir diperbarui: 2025.*
