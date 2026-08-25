# Dashboard Reseller - Panduan Lengkap

Dokumen ini menjelaskan secara detail setiap halaman dan fitur yang tersedia di Dashboard Reseller PBS.

---

## Daftar Isi

- [Autentikasi & Login](#autentikasi--login)
- [Layout Dashboard](#layout-dashboard)
- [Halaman 1: Ringkasan](#halaman-1-ringkasan)
- [Halaman 2: Riwayat Order](#halaman-2-riwayat-order)
- [Halaman 3: Produk](#halaman-3-produk)
- [Halaman 4: Harga Jual](#halaman-4-harga-jual)
- [Halaman 5: Pengaturan Toko](#halaman-5-pengaturan-toko)
- [Halaman 6: Saldo & Komisi](#halaman-6-saldo--komisi)

---

## Autentikasi & Login

### Halaman Login

URL: `http://localhost:3002` atau `http://localhost:3002/login`

| Field | Deskripsi |
|-------|-----------|
| Email | Email yang terdaftar di tabel `resellers` |
| Password | Password yang di-hash dengan bcrypt |

### Mekanisme Session

| Aspek | Detail |
|-------|--------|
| **Tipe Session** | Cookie-based dengan HMAC-SHA256 |
| **Nama Cookie** | `pbs_reseller_session` |
| **Masa Berlaku** | 30 hari sejak login |
| **Penyimpanan** | Token disimpan di kolom `session_token` tabel `resellers` |
| **Validasi** | Setiap request ke `/dashboard/*` divalidasi oleh middleware |

### Alur Login

```
1. User memasukkan email + password
2. POST /api/auth/login
3. Server mencari reseller berdasarkan email
4. Server membandingkan password dengan bcrypt.compare()
5. Jika cocok:
   a. Generate session token (HMAC-SHA256)
   b. Simpan token + expiry di tabel resellers
   c. Set cookie pbs_reseller_session (httpOnly, 30 hari)
   d. Return data reseller
6. Redirect ke /dashboard
```

### Middleware Proteksi

Semua route `/dashboard/*` dilindungi oleh middleware yang:
1. Membaca cookie `pbs_reseller_session`
2. Mencari reseller dengan `session_token` yang cocok
3. Memeriksa `session_expires_at` belum expired
4. Memeriksa `is_active = true`
5. Jika salah satu gagal → redirect ke `/login`

---

## Layout Dashboard

### Struktur Layout

```
┌─────────────────────────────────────────────────────────────┐
│                        HEADER                                │
│  [≡ Toggle]  Judul Halaman                    [Saldo: Rp X] │
├──────────────┬──────────────────────────────────────────────┤
│   SIDEBAR    │                                              │
│              │                                              │
│  ┌────────┐  │              KONTEN HALAMAN                  │
│  │  Logo  │  │                                              │
│  └────────┘  │                                              │
│              │                                              │
│  📊 Ringkasan│                                              │
│  📋 Riwayat  │                                              │
│  📦 Produk   │                                              │
│  💰 Harga    │                                              │
│  ⚙️ Toko     │                                              │
│  💵 Saldo    │                                              │
│              │                                              │
│              │                                              │
│  ┌────────┐  │                                              │
│  │ Saldo  │  │                                              │
│  │Rp XXX  │  │                                              │
│  └────────┘  │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### Sidebar

| Aspek | Detail |
|-------|--------|
| **Warna Background** | Dark navy `#0f1229` |
| **Lebar** | 256px (expanded), 0px (collapsed) |
| **Collapsible** | Ya, toggle via tombol hamburger di header |
| **Responsive** | Auto-collapse di layar mobile (< 768px) |

### Item Navigasi Sidebar

| No | Label | Icon | Route | Deskripsi |
|----|-------|------|-------|-----------|
| 1 | Ringkasan | `fa-chart-line` | `/dashboard` | Halaman utama dengan statistik |
| 2 | Riwayat Order | `fa-receipt` | `/dashboard/orders` | Daftar semua pesanan |
| 3 | Produk | `fa-box` | `/dashboard/products` | Kelola visibilitas produk |
| 4 | Harga Jual | `fa-tags` | `/dashboard/pricing` | Atur margin dan harga jual |
| 5 | Pengaturan Toko | `fa-store` | `/dashboard/store-settings` | Edit profil dan branding toko |
| 6 | Saldo & Komisi | `fa-wallet` | `/dashboard/balance` | Lihat saldo dan tarik dana |

### Footer Sidebar

Di bagian bawah sidebar terdapat **tampilan saldo** yang selalu terlihat:
- Label: "Saldo Tersedia"
- Nilai: Format Rupiah (contoh: Rp 1.250.000)
- Warna: Hijau untuk saldo positif

### Header

| Elemen | Posisi | Deskripsi |
|--------|--------|-----------|
| Toggle Sidebar | Kiri | Tombol hamburger untuk collapse/expand sidebar |
| Judul Halaman | Tengah-Kiri | Nama halaman yang sedang aktif |
| Info Saldo | Kanan | Saldo terkini dalam format Rupiah |

---

## Halaman 1: Ringkasan

**Route:** `/dashboard`
**API:** `GET /api/dashboard/summary`

### Welcome Banner

Di bagian atas halaman terdapat banner selamat datang:
```
Selamat datang, [Nama Toko]! 👋
Berikut ringkasan toko Anda hari ini.
```

### 4 Kartu Statistik

| No | Kartu | Icon | Warna | Data | Deskripsi |
|----|-------|------|-------|------|-----------|
| 1 | Total Order | `fa-shopping-cart` | Biru | `totalOrders` | Jumlah seluruh order (semua status) |
| 2 | Order Hari Ini | `fa-calendar-day` | Hijau | `todayOrders` | Jumlah order yang masuk hari ini |
| 3 | Pendapatan Bulan Ini | `fa-money-bill-wave` | Ungu | `monthRevenue` | Total pendapatan (harga jual) bulan berjalan |
| 4 | Total Komisi | `fa-coins` | Kuning | `totalKomisi` | Akumulasi komisi dari semua order selesai |

### Grafik Area (7 Hari Terakhir)

| Aspek | Detail |
|-------|--------|
| **Library** | Recharts (AreaChart) |
| **Data** | 7 data point (7 hari terakhir) |
| **Sumbu X** | Tanggal (format: DD/MM) |
| **Sumbu Y** | Jumlah order atau pendapatan |
| **Warna Area** | Gradient biru |
| **Tooltip** | Menampilkan tanggal dan nilai saat hover |

### Tabel Order Terbaru

Menampilkan **5 order terakhir** dengan kolom:

| Kolom | Deskripsi |
|-------|-----------|
| Order ID | ID order (format: RS-xxxxx) |
| Pelanggan | Nama pelanggan |
| Total | Harga jual total (format Rupiah) |
| Status | Badge warna: Pending (kuning), Completed (hijau), Cancelled (merah) |
| Tanggal | Waktu order (format: DD/MM/YYYY HH:mm) |

---

## Halaman 2: Riwayat Order

**Route:** `/dashboard/orders`
**API:** `GET /api/dashboard/orders?page=1&limit=20&status=all&search=`

### Filter & Pencarian

| Elemen | Tipe | Deskripsi |
|--------|------|-----------|
| Search Box | Text input | Cari berdasarkan Order ID, nama pelanggan, atau email |
| Status Filter | Dropdown/Tabs | Filter: All, Pending, Completed, Cancelled |

### Tabel Order

| Kolom | Deskripsi |
|-------|-----------|
| Order ID | ID order (klik untuk detail) |
| Pelanggan | Nama pelanggan |
| Email | Email pelanggan |
| Total | Harga jual total |
| Modal | Harga pusat total |
| Komisi | Selisih (total - modal) |
| Status | Badge berwarna |
| Tanggal | Waktu pembuatan order |

### Paginasi

| Aspek | Detail |
|-------|--------|
| **Items per halaman** | 20 |
| **Navigasi** | Tombol Previous/Next + nomor halaman |
| **Info** | "Menampilkan X-Y dari Z order" |

### Modal Detail Order

Klik pada baris order untuk membuka modal detail yang menampilkan:

| Section | Konten |
|---------|--------|
| **Header** | Order ID, status badge, tanggal |
| **Info Pelanggan** | Nama, email, telepon |
| **Ringkasan Harga** | Total amount, total modal, komisi |
| **Daftar Item** | Tabel item: nama produk, kode, harga pusat, harga jual, quantity |
| **Info Pembayaran** | Tipe pembayaran, status Midtrans |

---

## Halaman 3: Produk

**Route:** `/dashboard/products`
**API:** `GET /api/dashboard/products` (read), `PUT /api/dashboard/products` (update)

### Banner Informasi

```
ℹ️ Data produk dikelola oleh admin pusat. Anda hanya dapat mengatur
visibilitas produk (tampilkan/sembunyikan) di toko Anda.
```

**Penting:** Reseller **TIDAK BISA** mengedit nama produk, deskripsi, harga pusat, gambar, atau atribut produk lainnya. Semua data produk dikelola oleh admin pusat melalui Admin Dashboard.

### Kartu Statistik

| No | Kartu | Deskripsi |
|----|-------|-----------|
| 1 | Total Produk | Jumlah seluruh produk aktif di katalog pusat |
| 2 | Ditampilkan | Jumlah produk yang visible di toko reseller |
| 3 | Disembunyikan | Jumlah produk yang hidden di toko reseller |

### Pencarian

| Elemen | Deskripsi |
|--------|-----------|
| Search Box | Cari produk berdasarkan nama atau kategori |

### Mode Bulk Select

| Elemen | Deskripsi |
|--------|-----------|
| Tombol "Pilih Semua" | Memilih semua produk |
| Tombol "Tampilkan Semua" | Mengaktifkan semua produk yang dipilih |
| Tombol "Sembunyikan Semua" | Menyembunyikan semua produk yang dipilih |
| Checkbox per produk | Memilih produk individual |

### Daftar Produk

Setiap produk ditampilkan sebagai kartu/baris dengan:

| Elemen | Deskripsi |
|--------|-----------|
| Nama Produk | Nama dari tabel `products` |
| Kategori | Kategori produk |
| Harga Pusat | `harga_web` atau `harga_bot` |
| Stok | Jumlah item tersedia |
| Toggle Switch | ON = tampilkan di toko, OFF = sembunyikan |

### Logika Visibilitas Default

- Jika **tidak ada record** di `reseller_products` untuk produk tertentu → produk **ditampilkan** (default visible)
- Jika ada record dengan `is_visible = true` → produk **ditampilkan**
- Jika ada record dengan `is_visible = false` → produk **disembunyikan**

---

## Halaman 4: Harga Jual

**Route:** `/dashboard/pricing`
**API:** `GET /api/dashboard/pricing` (read), `PUT /api/dashboard/pricing` (update)

### Banner Informasi

```
ℹ️ Harga jual = Harga Pusat + Margin Anda
Atur margin untuk menentukan harga jual di toko Anda. Margin bisa berupa
nominal tetap (fixed) atau persentase dari harga pusat.
```

### Pengaturan Harga Massal (Bulk Pricing)

Di bagian atas halaman terdapat form untuk mengatur margin semua produk sekaligus:

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| Tipe Margin | Dropdown | `Fixed (Nominal)` atau `Percent (Persentase)` |
| Nilai Margin | Number input | Nilai margin (Rp untuk fixed, % untuk percent) |
| Tombol "Terapkan ke Semua" | Button | Menerapkan margin ke seluruh produk |

**Contoh:**
- Tipe: Fixed, Nilai: 5000 → Semua produk mendapat margin Rp 5.000
- Tipe: Percent, Nilai: 10 → Semua produk mendapat margin 10%

### Tabel Harga Per Produk

| Kolom | Deskripsi |
|-------|-----------|
| Produk | Nama produk |
| Harga Pusat | Harga dasar dari admin (harga_web atau harga_bot) |
| Tipe Margin | Dropdown inline: Fixed / Percent |
| Nilai Margin | Input number inline (editable) |
| Harga Jual | **Live preview** — otomatis dihitung saat margin diubah |
| Action | Tombol "Simpan" untuk menyimpan perubahan per produk |

### Live Price Preview

Saat reseller mengubah tipe atau nilai margin, kolom **Harga Jual** langsung menampilkan hasil perhitungan tanpa perlu menyimpan terlebih dahulu:

```
Contoh live preview:
┌──────────┬──────────────┬─────────────┬──────────────┬──────────────┐
│ Produk   │ Harga Pusat  │ Tipe Margin │ Nilai Margin │ Harga Jual   │
├──────────┼──────────────┼─────────────┼──────────────┼──────────────┤
│ Produk A │ Rp 15.000    │ Fixed       │ 5.000        │ Rp 20.000 ✓  │
│ Produk B │ Rp 25.000    │ Percent     │ 10           │ Rp 27.500 ✓  │
│ Produk C │ Rp 50.000    │ Fixed       │ 10.000       │ Rp 60.000 ✓  │
└──────────┴──────────────┴─────────────┴──────────────┴──────────────┘
```

---

## Halaman 5: Pengaturan Toko

**Route:** `/dashboard/store-settings`
**API:** `PUT /api/dashboard/store-settings` (update profil), `PUT /api/dashboard/store-settings/password` (ganti password)

### Form Profil Toko

| Field | Tipe Input | Validasi | Deskripsi |
|-------|------------|----------|-----------|
| Nama Toko | Text | Required, max 255 | Nama toko yang ditampilkan di storefront |
| Slug | Text | Required, auto-sanitized, URL-friendly | Bagian URL toko: `/{slug}` |
| Deskripsi | Textarea | Optional | Deskripsi/bio toko |
| Alamat | Textarea | Optional | Alamat fisik (opsional) |
| Telepon | Text | Optional, max 20 | Nomor telepon |
| WhatsApp | Text | Optional, max 20 | Nomor WhatsApp (untuk tombol kontak di toko) |
| Instagram | Text | Optional, max 100 | Username Instagram (tanpa @) |
| Warna Tema | Color Picker | Hex color | Warna utama toko (header, tombol, dll) |
| Logo URL | Text/Upload | Optional, valid URL | URL gambar logo toko |

### Auto-Sanitize Slug

Saat reseller mengetik slug, sistem otomatis:
1. Mengubah ke huruf kecil
2. Mengganti spasi dengan `-`
3. Menghapus karakter non-alfanumerik (kecuali `-`)
4. Menghapus `-` berulang

```
Input:  "Toko Digital ABC!!!"
Output: "toko-digital-abc"
```

### Preview Link Toko

Di bawah form terdapat preview link toko:

```
🔗 Link Toko Anda:
https://your-domain.com/toko-digital-abc
[📋 Salin Link]
```

Tombol **Salin Link** menyalin URL ke clipboard.

### Form Ganti Password

| Field | Tipe Input | Validasi | Deskripsi |
|-------|------------|----------|-----------|
| Password Saat Ini | Password | Required | Password yang sedang digunakan |
| Password Baru | Password | Required, min 6 karakter | Password baru |
| Konfirmasi Password | Password | Required, harus sama dengan password baru | Konfirmasi password baru |

---

## Halaman 6: Saldo & Komisi

**Route:** `/dashboard/balance`
**API:** `GET /api/dashboard/balance` (read), `POST /api/dashboard/balance/withdraw` (withdraw)

### 4 Kartu Informasi

| No | Kartu | Warna | Deskripsi |
|----|-------|-------|-----------|
| 1 | **Saldo Tersedia** | Hijau (`#10B981`) | Saldo yang bisa ditarik saat ini |
| 2 | **Total Penjualan** | Biru | Akumulasi total harga jual dari semua order selesai |
| 3 | **Total Komisi** | Ungu | Akumulasi total komisi dari semua order selesai |
| 4 | **Pending Withdrawal** | Kuning | Total penarikan yang masih dalam proses (pending/approved) |

### Form Penarikan Saldo

| Field | Tipe Input | Validasi | Deskripsi |
|-------|------------|----------|-----------|
| Jumlah Penarikan | Number | Required, min 50.000 | Jumlah yang ingin ditarik (dalam Rupiah) |
| Bank/E-Wallet | Dropdown | Required | Pilih bank atau e-wallet tujuan |
| Nomor Rekening | Text | Required | Nomor rekening atau nomor akun e-wallet |
| Nama Pemilik | Text | Required | Nama pemilik rekening/akun |

### Daftar Bank & E-Wallet yang Didukung

| Kategori | Nama |
|----------|------|
| **Bank** | BCA |
| **Bank** | BNI |
| **Bank** | BRI |
| **Bank** | Mandiri |
| **Bank** | BSI |
| **Bank** | CIMB Niaga |
| **Bank** | Permata |
| **E-Wallet** | DANA |
| **E-Wallet** | OVO |
| **E-Wallet** | GoPay |
| **E-Wallet** | ShopeePay |

### Validasi Penarikan

Sebelum penarikan diproses, sistem memvalidasi:

1. **Jumlah minimal:** Rp 50.000
2. **Saldo cukup:** `saldo >= amount`
3. **Saldo setelah pending:** `(saldo - total_pending_withdrawals) >= amount`
4. **Bank/e-wallet valid:** Harus salah satu dari daftar yang didukung
5. **Nomor rekening terisi:** Tidak boleh kosong
6. **Nama pemilik terisi:** Tidak boleh kosong

### Tabel Riwayat Penarikan

| Kolom | Deskripsi |
|-------|-----------|
| Tanggal | Waktu pengajuan penarikan |
| Jumlah | Nominal penarikan (format Rupiah) |
| Bank | Nama bank/e-wallet |
| No. Rekening | Nomor rekening/akun |
| Nama | Nama pemilik |
| Status | Badge: Pending (kuning), Approved (biru), Completed (hijau), Rejected (merah) |
| Catatan Admin | Catatan dari admin (jika ada, terutama untuk penolakan) |
| Diproses | Waktu diproses oleh admin |

### Status Penarikan

| Status | Warna Badge | Deskripsi |
|--------|-------------|-----------|
| `pending` | Kuning | Menunggu review admin |
| `approved` | Biru | Disetujui, menunggu transfer |
| `completed` | Hijau | Sudah ditransfer, saldo sudah berkurang |
| `rejected` | Merah | Ditolak oleh admin (lihat catatan) |

---

*Lanjut ke: [STOREFRONT-GUIDE.md](./STOREFRONT-GUIDE.md) — Panduan lengkap toko online reseller*
