# Web Reseller (Toko Online) - Panduan Lengkap

Dokumen ini menjelaskan secara detail setiap halaman dan fitur yang tersedia di Web Reseller — toko online yang diakses oleh pelanggan reseller.

---

## Daftar Isi

- [Gambaran Umum](#gambaran-umum)
- [Halaman Utama (Directory)](#halaman-utama-directory)
- [Layout Toko](#layout-toko)
- [Halaman Toko (Store Page)](#halaman-toko-store-page)
- [Detail Produk](#detail-produk)
- [Keranjang Belanja](#keranjang-belanja)
- [Checkout](#checkout)
- [Order Pending (Pembayaran)](#order-pending-pembayaran)
- [Pencarian Order](#pencarian-order)
- [Kustomisasi Toko](#kustomisasi-toko)

---

## Gambaran Umum

Web Reseller adalah storefront (toko online) yang berjalan di **port 3003**. Setiap reseller memiliki toko sendiri dengan URL unik berformat `/{slug}`.

```
Contoh URL toko:
http://localhost:3003/digital-store-abc
http://localhost:3003/toko-gaming-xyz
```

### Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| Multi-store | Satu deployment mendukung banyak toko reseller |
| Custom branding | Setiap toko memiliki warna, logo, dan info sendiri |
| QRIS Payment | Pembayaran otomatis via QRIS (Midtrans) |
| Responsive | Tampilan optimal di desktop dan mobile |
| Real-time | Auto-refresh produk setiap 30 detik |
| Cart per store | Keranjang belanja terpisah per toko |

---

## Halaman Utama (Directory)

**Route:** `/`
**API:** `GET /api/stores`

Halaman utama menampilkan **direktori semua toko reseller aktif**. Setiap toko ditampilkan sebagai kartu (card) dengan informasi:

| Elemen | Deskripsi |
|--------|-----------|
| Logo | Logo toko (jika ada) |
| Nama Toko | Nama toko reseller |
| Deskripsi | Deskripsi singkat toko |
| Warna Tema | Border/accent menggunakan `warna_tema` |
| Link | Klik untuk masuk ke toko → `/{slug}` |

### Tampilan

```
┌─────────────────────────────────────────────────────────┐
│                   PBS Digital Store                       │
│              Pilih Toko untuk Berbelanja                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   [Logo]     │  │   [Logo]     │  │   [Logo]     │  │
│  │  Toko ABC    │  │  Toko XYZ    │  │  Toko 123    │  │
│  │  Toko digital│  │  Gaming shop │  │  Akun premium│  │
│  │  terpercaya  │  │  terlengkap  │  │  murah       │  │
│  │  [Kunjungi]  │  │  [Kunjungi]  │  │  [Kunjungi]  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Filter:** Hanya toko dengan `is_active = true` yang ditampilkan.

---

## Layout Toko

Setiap toko reseller memiliki layout yang konsisten:

### Fetch Data Toko

Saat halaman toko dimuat, sistem:
1. Mengambil data toko dari `GET /api/store/{slug}`
2. Memuat informasi: `id`, `nama_toko`, `slug`, `deskripsi`, `logo_url`, `whatsapp`, `instagram`, `warna_tema`
3. Menerapkan `warna_tema` sebagai warna utama di seluruh halaman

### Header Toko

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]  Nama Toko          [🔍 Search] [🛒 Cart] [📱 WA]│
└─────────────────────────────────────────────────────────┘
```

| Elemen | Deskripsi |
|--------|-----------|
| Logo | Gambar logo toko (dari `logo_url`) |
| Nama Toko | Nama toko (dari `nama_toko`) |
| Search | Tombol/input pencarian produk |
| Cart | Ikon keranjang dengan badge jumlah item |
| WhatsApp | Tombol kontak WhatsApp (jika `whatsapp` diisi) |

### Footer Toko

```
┌─────────────────────────────────────────────────────────┐
│  © 2025 Nama Toko                                        │
│  📱 WhatsApp: 08xxxxxxxxxx                                │
│  📷 Instagram: @username                                  │
│  Powered by PBS Digital Store                             │
└─────────────────────────────────────────────────────────┘
```

| Elemen | Deskripsi |
|--------|-----------|
| Copyright | Nama toko + tahun |
| WhatsApp | Link ke WhatsApp (jika diisi) |
| Instagram | Link ke Instagram (jika diisi) |
| Powered by | Credit PBS Digital Store |

### Bottom Navigation (Mobile)

Pada layar mobile (< 768px), muncul bottom navigation bar:

```
┌─────────────────────────────────────────────────────────┐
│     🏠 Home     │     🛒 Cart     │     📋 Orders      │
└─────────────────────────────────────────────────────────┘
```

| Tab | Route | Deskripsi |
|-----|-------|-----------|
| Home | `/{slug}` | Kembali ke halaman utama toko |
| Cart | `/{slug}/cart` | Keranjang belanja |
| Orders | `/{slug}/orders` | Cari order |

---

## Halaman Toko (Store Page)

**Route:** `/{slug}`
**API:** `GET /api/store/{slug}/products`

### Hero Section

Di bagian atas halaman terdapat hero section dengan branding toko:

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│     ████████████████████████████████████████████         │
│     ██                                      ██         │
│     ██         [Logo Toko]                  ██         │
│     ██         Nama Toko                    ██         │
│     ██         Deskripsi singkat toko       ██         │
│     ██                                      ██         │
│     ████████████████████████████████████████████         │
│                                                          │
│     Background color: warna_tema                         │
└─────────────────────────────────────────────────────────┘
```

Hero section menggunakan `warna_tema` sebagai warna background atau gradient.

### Category Filter Bar

Bar filter kategori horizontal yang bisa di-scroll:

```
[Semua] [Streaming] [Gaming] [VPN] [Sosial Media] [Produktivitas] ...
```

| Aspek | Detail |
|-------|--------|
| **Default** | "Semua" (menampilkan semua produk) |
| **Sumber** | Kategori unik dari produk yang visible |
| **Interaksi** | Klik untuk filter, klik lagi untuk reset |

### Product Grid

Produk ditampilkan dalam grid responsive:

```
Desktop: 4 kolom
Tablet:  3 kolom
Mobile:  2 kolom
```

### ProductCard Component

Setiap produk ditampilkan sebagai kartu:

```
┌──────────────┐
│   [Gambar]   │
│              │
│  Nama Produk │
│  Kategori    │
│              │
│  Rp 25.000   │  ← Harga jual reseller
│  [Beli]      │
└──────────────┘
```

| Elemen | Deskripsi |
|--------|-----------|
| Gambar | Gambar produk (jika ada) |
| Nama | Nama produk |
| Kategori | Badge kategori |
| Harga | Harga jual reseller (sudah termasuk margin) |
| Stok | Badge stok tersedia |
| Tombol | Link ke halaman detail |

### Pencarian via URL Parameter

Pencarian produk menggunakan URL parameter `?search=`:

```
/toko-abc?search=netflix
```

Pencarian dilakukan pada nama produk dan kategori (client-side filter).

### Auto-Refresh

Daftar produk otomatis di-refresh setiap **30 detik** untuk memastikan stok dan harga selalu terbaru.

```javascript
// Interval auto-refresh
useEffect(() => {
  const interval = setInterval(() => {
    fetchProducts(); // Refresh data produk
  }, 30000); // 30 detik
  
  return () => clearInterval(interval);
}, []);
```

---

## Detail Produk

**Route:** `/{slug}/product/{id}`
**API:** `GET /api/store/{slug}/products` (filtered by product ID)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Breadcrumb: Toko > Kategori > Nama Produk               │
├──────────────────────┬──────────────────────────────────┤
│                      │                                   │
│   [Gambar Produk]    │  Nama Produk                     │
│                      │  Kategori: Streaming              │
│                      │                                   │
│                      │  ~~Rp 15.000~~  ← Harga pusat    │
│                      │  Rp 20.000     ← Harga jual      │
│                      │                                   │
│                      │  Stok: ✅ Tersedia (15)           │
│                      │                                   │
│                      │  Jumlah: [- 1 +]                  │
│                      │                                   │
│                      │  [🛒 Tambah ke Keranjang]         │
│                      │                                   │
│                      │  Deskripsi:                       │
│                      │  Lorem ipsum dolor sit amet...    │
│                      │                                   │
└──────────────────────┴──────────────────────────────────┘
```

### Elemen Detail

| Elemen | Deskripsi |
|--------|-----------|
| **Breadcrumb** | Navigasi: Toko > Kategori > Nama Produk |
| **Gambar** | Gambar produk (kolom kiri) |
| **Nama Produk** | Judul produk |
| **Kategori** | Badge kategori |
| **Harga Pusat** | Harga asli dengan strikethrough (~~Rp XX.XXX~~) |
| **Harga Jual** | Harga reseller (lebih besar, bold, warna tema) |
| **Stok Badge** | Hijau jika tersedia, merah jika habis |
| **Quantity Selector** | Tombol -/+ dengan input angka, min 1, max = stok |
| **Tombol Tambah** | Menambahkan produk ke keranjang |
| **Deskripsi** | Deskripsi lengkap produk |

### Layout Responsif

| Layar | Layout |
|-------|--------|
| Desktop | 2 kolom (gambar kiri, info kanan) |
| Mobile | 1 kolom (gambar atas, info bawah) |

---

## Keranjang Belanja

**Route:** `/{slug}/cart`
**Penyimpanan:** `localStorage`

### Penyimpanan Cart

Cart disimpan di **localStorage** browser dengan key unik per toko:

```
Key: pbs_reseller_cart_{slug}

Contoh:
Key: pbs_reseller_cart_toko-abc
Value: [
  {
    "product_id": "uuid-1",
    "kode": "NETFLIX-1BLN",
    "nama": "Netflix Premium 1 Bulan",
    "harga_jual": 20000,
    "quantity": 2,
    "stok": 15
  },
  {
    "product_id": "uuid-2",
    "kode": "SPOTIFY-1BLN",
    "nama": "Spotify Premium 1 Bulan",
    "harga_jual": 15000,
    "quantity": 1,
    "stok": 10
  }
]
```

**Catatan:** Setiap toko reseller memiliki keranjang terpisah. Jika pelanggan mengunjungi dua toko berbeda, keranjang tidak tercampur.

### Tampilan Cart

```
┌─────────────────────────────────────────────────────────┐
│  🛒 Keranjang Belanja                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Netflix Premium 1 Bulan                         │    │
│  │ Rp 20.000 x [- 2 +]  = Rp 40.000    [🗑️ Hapus]│    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Spotify Premium 1 Bulan                         │    │
│  │ Rp 15.000 x [- 1 +]  = Rp 15.000    [🗑️ Hapus]│    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Ringkasan:                                     │    │
│  │  Subtotal (3 item):          Rp 55.000          │    │
│  │  ─────────────────────────────────────          │    │
│  │  Total:                      Rp 55.000          │    │
│  │                                                 │    │
│  │  [🛍️ Checkout]                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Fitur Cart

| Fitur | Deskripsi |
|-------|-----------|
| **Ubah Quantity** | Tombol -/+ untuk mengubah jumlah item |
| **Hapus Item** | Tombol hapus untuk menghapus item dari cart |
| **Ringkasan** | Subtotal dan total harga |
| **Checkout** | Tombol untuk lanjut ke halaman checkout |
| **Cart Kosong** | Pesan "Keranjang kosong" dengan link kembali ke toko |

---

## Checkout

**Route:** `/{slug}/checkout`
**API:** `POST /api/store/{slug}/checkout`

### Keamanan Checkout

Halaman checkout dilindungi dengan beberapa fitur keamanan:

| Fitur | Deskripsi |
|-------|-----------|
| **hCaptcha** | Verifikasi CAPTCHA untuk mencegah bot dan spam |
| **Rate Limiting** | Pembatasan jumlah request checkout per IP (max 5 per 15 menit) |
| **Validasi Server-Side** | Semua data divalidasi ulang di server untuk mencegah manipulasi |

### Form Data Pelanggan

### Form Data Pelanggan

| Field | Tipe | Validasi | Deskripsi |
|-------|------|----------|-----------|
| Nama Lengkap | Text | Required | Nama pelanggan |
| Email | Email | Required, valid email | Email untuk notifikasi |
| WhatsApp | Text | Required | Nomor WhatsApp pelanggan |
| hCaptcha | Captcha | Required | Verifikasi CAPTCHA untuk keamanan |

### Review Item

Sebelum membayar, pelanggan melihat ringkasan item:

```
┌─────────────────────────────────────────────────────────┐
│  📋 Ringkasan Pesanan                                    │
├─────────────────────────────────────────────────────────┤
│  Netflix Premium 1 Bulan    x2    Rp 40.000             │
│  Spotify Premium 1 Bulan    x1    Rp 15.000             │
│  ───────────────────────────────────────────             │
│  Total:                           Rp 55.000             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Data Pelanggan:                                         │
│  Nama: John Doe                                          │
│  Email: john@example.com                                 │
│  WhatsApp: 081234567890                                  │
│                                                          │
│  [💳 Bayar Sekarang]                                     │
└─────────────────────────────────────────────────────────┘
```

### Proses Checkout

Saat tombol "Bayar Sekarang" diklik:

1. Validasi hCaptcha (verifikasi token captcha)
2. Validasi form (semua field required terisi)
3. Kirim `POST /api/store/{slug}/checkout` dengan body:
   ```json
   {
     "items": [
       {
         "product_id": "uuid-1",
         "kode": "NETFLIX-1BLN",
         "nama": "Netflix Premium 1 Bulan",
         "quantity": 2,
         "harga_jual": 20000
       }
     ],
     "customer_name": "John Doe",
     "customer_email": "john@example.com",
      "customer_phone": "081234567890",
      "captcha_token": "hcaptcha-token-here"
    }
    ```
4. Server memproses:
    - Verifikasi hCaptcha token
    - Validasi rate limiting (max 5 checkout per 15 menit per IP)
    - Validasi reseller aktif
    - Validasi stok produk
    - Hitung total, modal, komisi
    - Reservasi item
    - Buat pembayaran QRIS via Midtrans Core API
    - Simpan order
    - Notifikasi admin via Telegram
5. Response: `{ order_id, payment_url, total_amount }`
6. Redirect ke halaman order-pending

### Pembayaran QRIS via Midtrans

Pembayaran menggunakan **Midtrans Core API** dengan:

| Parameter | Nilai |
|-----------|-------|
| `payment_type` | `qris` |
| `acquirer` | `gopay` |
| `transaction_details.order_id` | `RS-{base36}{random}` |
| `transaction_details.gross_amount` | Total harga jual |

---

## Order Pending (Pembayaran)

**Route:** `/{slug}/order-pending`
**API:** `GET /api/store/{slug}/order-status?order_id=`

### Tampilan QRIS

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│          📱 Scan QR Code untuk Membayar                  │
│                                                          │
│          ┌──────────────────────┐                        │
│          │                      │                        │
│          │     [QR CODE]        │                        │
│          │                      │                        │
│          │                      │                        │
│          └──────────────────────┘                        │
│                                                          │
│          Order ID: RS-abc123xyz                           │
│          Total: Rp 55.000                                │
│                                                          │
│          ⏳ Menunggu pembayaran...                        │
│          Scan QR code di atas menggunakan                │
│          aplikasi e-wallet (GoPay, OVO, dll)             │
│                                                          │
│          ⏱️ Batas waktu: 15 menit                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Auto-Poll Status

Halaman ini secara otomatis memeriksa status pembayaran setiap **5 detik**:

```javascript
// Polling setiap 5 detik
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/store/${slug}/order-status?order_id=${orderId}`);
    const data = await res.json();
    
    if (data.status === 'completed') {
      // Redirect ke halaman sukses
      clearCart();
      router.push(`/${slug}/order-success?order_id=${orderId}`);
    } else if (data.status === 'cancelled' || data.status === 'expired') {
      // Tampilkan pesan gagal
      setStatus('failed');
    }
  }, 5000); // 5 detik
  
  return () => clearInterval(interval);
}, []);
```

### Alur Status

```
Pending ──→ Completed (pembayaran berhasil) ──→ Redirect ke halaman sukses
         └→ Cancelled (dibatalkan) ──→ Tampilkan pesan gagal
         └→ Expired (timeout) ──→ Tampilkan pesan expired
```

---

## Pencarian Order

**Route:** `/{slug}/orders`
**API:** `GET /api/store/{slug}/orders/search?q=`

### Form Pencarian

```
┌─────────────────────────────────────────────────────────┐
│  🔍 Cari Pesanan                                         │
│                                                          │
│  Masukkan Order ID, Email, atau Nomor Telepon:           │
│  ┌──────────────────────────────────┐  [🔍 Cari]        │
│  │ RS-abc123xyz                     │                    │
│  └──────────────────────────────────┘                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Pencarian Berdasarkan

| Field | Contoh | Deskripsi |
|-------|--------|-----------|
| Order ID | `RS-abc123xyz` | Pencarian exact match |
| Email | `john@example.com` | Pencarian berdasarkan email pelanggan |
| Nomor Telepon | `081234567890` | Pencarian berdasarkan nomor telepon |

### Hasil Pencarian

```
┌─────────────────────────────────────────────────────────┐
│  Hasil Pencarian:                                        │
│                                                          │
│  Order: RS-abc123xyz                                     │
│  Status: ✅ Completed                                    │
│  Tanggal: 15/01/2025 14:30                              │
│  Total: Rp 55.000                                        │
│                                                          │
│  Item:                                                   │
│  - Netflix Premium 1 Bulan (x2)                          │
│  - Spotify Premium 1 Bulan (x1)                          │
│                                                          │
│  Detail Item (jika completed):                           │
│  - netflix_account_1@email.com / pass123                 │
│  - netflix_account_2@email.com / pass456                 │
│  - spotify_account@email.com / pass789                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Kustomisasi Toko

Setiap toko reseller dapat dikustomisasi melalui Dashboard Reseller. Berikut aspek-aspek yang dapat dikustomisasi:

### Elemen yang Dapat Dikustomisasi

| Elemen | Sumber Data | Lokasi Tampil | Deskripsi |
|--------|-------------|---------------|-----------|
| **Warna Tema** | `warna_tema` | Header, tombol, link, hero | Warna utama toko (hex color) |
| **Logo** | `logo_url` | Header, hero section | Gambar logo toko |
| **Nama Toko** | `nama_toko` | Header, hero, footer, title | Nama toko |
| **Deskripsi** | `deskripsi` | Hero section, directory | Bio/deskripsi toko |
| **WhatsApp** | `whatsapp` | Header (tombol WA), footer | Nomor kontak WhatsApp |
| **Instagram** | `instagram` | Footer | Link profil Instagram |

### Penerapan Warna Tema

Warna tema (`warna_tema`) diterapkan secara dinamis ke elemen-elemen berikut:

```css
/* Elemen yang menggunakan warna tema */
.hero-section     { background-color: var(--theme-color); }
.btn-primary      { background-color: var(--theme-color); }
.link-active      { color: var(--theme-color); }
.category-active  { background-color: var(--theme-color); }
.price-highlight  { color: var(--theme-color); }
.header-accent    { border-bottom-color: var(--theme-color); }
```

### Contoh Tampilan dengan Tema Berbeda

```
Toko A (warna_tema: #3B82F6 - Biru):
┌─────────────────────────────────┐
│  ████ BIRU ████  Header         │
│  [Produk dengan aksen biru]     │
└─────────────────────────────────┘

Toko B (warna_tema: #10B981 - Hijau):
┌─────────────────────────────────┐
│  ████ HIJAU ████  Header        │
│  [Produk dengan aksen hijau]    │
└─────────────────────────────────┘

Toko C (warna_tema: #8B5CF6 - Ungu):
┌─────────────────────────────────┐
│  ████ UNGU ████  Header         │
│  [Produk dengan aksen ungu]     │
└─────────────────────────────────┘
```

### Konfigurasi dari Dashboard

Semua kustomisasi dilakukan melalui halaman **Pengaturan Toko** di Dashboard Reseller (`/dashboard/store-settings`). Perubahan langsung diterapkan di toko online tanpa perlu restart service.

---

## Redesign UI Modern

Toko online reseller telah mengalami redesign dengan tampilan yang lebih modern dan user-friendly:

### Fitur UI Baru

| Fitur | Deskripsi |
|-------|-----------|
| **Gradient Hero** | Hero section dengan gradient warna tema yang menarik |
| **Card Modern** | Kartu produk dengan shadow dan hover effect |
| **Smooth Animation** | Transisi dan animasi yang halus di seluruh halaman |
| **Better Typography** | Hierarki teks yang jelas dan mudah dibaca |
| **Responsive Grid** | Layout grid yang optimal di semua ukuran layar |
| **Loading States** | Skeleton loading dan spinner untuk UX yang lebih baik |
| **Toast Notifications** | Notifikasi toast untuk feedback user action |
| **Bottom Sheet (Mobile)** | Bottom sheet untuk cart dan filter di mobile |

### Peningkatan UX

- **Faster Navigation**: Navigasi yang lebih cepat dengan prefetching
- **Better Feedback**: Feedback visual yang jelas untuk setiap aksi user
- **Improved Accessibility**: Kontras warna dan ukuran font yang lebih baik
- **Mobile-First**: Desain yang mengutamakan pengalaman mobile
- **Dark Mode Ready**: Struktur CSS yang siap untuk dark mode (opsional)

---

*Lanjut ke: [API-REFERENCE.md](./API-REFERENCE.md) — Referensi lengkap API endpoint*
