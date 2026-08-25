# Alur Order & Pembayaran Reseller

Dokumen ini menjelaskan secara detail alur lengkap dari saat pelanggan mengunjungi toko reseller hingga order selesai dan komisi diterima.

---

## Daftar Isi

- [Gambaran Umum Alur](#gambaran-umum-alur)
- [Langkah 1: Pelanggan Mengunjungi Toko](#langkah-1-pelanggan-mengunjungi-toko)
- [Langkah 2: Menambah ke Keranjang](#langkah-2-menambah-ke-keranjang)
- [Langkah 3: Checkout](#langkah-3-checkout)
- [Langkah 4: Proses Checkout di Server](#langkah-4-proses-checkout-di-server)
- [Langkah 5: Pembayaran QRIS](#langkah-5-pembayaran-qris)
- [Langkah 6: Polling Status](#langkah-6-polling-status)
- [Langkah 7: Webhook Midtrans](#langkah-7-webhook-midtrans)
- [Langkah 8: Order Selesai](#langkah-8-order-selesai)
- [Perhitungan Harga](#perhitungan-harga)
- [Format Order ID](#format-order-id)
- [Reservasi Stok](#reservasi-stok)
- [Diagram Sequence](#diagram-sequence)

---

## Gambaran Umum Alur

```
+------------+    +------------+    +------------+    +------------+    +------------+
| 1. Browse  |--->| 2. Cart    |--->| 3. Check   |--->| 4. Pay     |--->| 5. Done    |
|   Toko     |    |  Belanja   |    |   out      |    |  QRIS      |    |  Komisi    |
+------------+    +------------+    +------------+    +------------+    +------------+
     |                 |                 |                 |                 |
     v                 v                 v                 v                 v
  /{slug}    localStorage    POST /checkout    Scan QR Code    Trigger DB
  GET /products   cart_{slug}     Reserve items     Midtrans        Update saldo
                                  Create QRIS       Webhook         Finalize items
```

---

## Langkah 1: Pelanggan Mengunjungi Toko

### URL Toko
```
http://localhost:3003/{slug}
```

### Proses
1. Pelanggan membuka URL toko reseller
2. Frontend memanggil `GET /api/store/{slug}` untuk mengambil info toko
3. Frontend memanggil `GET /api/store/{slug}/products` untuk mengambil daftar produk
4. Produk ditampilkan dalam grid dengan harga reseller
5. Pelanggan bisa:
   - Browse semua produk
   - Filter berdasarkan kategori
   - Cari produk berdasarkan nama
   - Klik produk untuk melihat detail

### Data yang Ditampilkan
- Nama produk
- Kategori
- Harga jual (harga reseller, sudah termasuk margin)
- Stok tersedia
- Gambar produk

### Auto-Refresh
Daftar produk otomatis di-refresh setiap **30 detik** untuk memastikan stok dan harga terkini.

---

## Langkah 2: Menambah ke Keranjang

### Penyimpanan
Cart disimpan di **localStorage** browser dengan key unik per toko:

```
Key: pbs_reseller_cart_{slug}
```

### Contoh Data Cart

```json
[
  {
    "product_id": "550e8400-e29b-41d4-a716-446655440001",
    "kode": "NETFLIX-1BLN",
    "nama": "Netflix Premium 1 Bulan",
    "harga_jual": 20000,
    "quantity": 2,
    "stok": 15
  },
  {
    "product_id": "550e8400-e29b-41d4-a716-446655440002",
    "kode": "SPOTIFY-1BLN",
    "nama": "Spotify Premium 1 Bulan",
    "harga_jual": 15000,
    "quantity": 1,
    "stok": 10
  }
]
```

### Isolasi Cart per Toko
Setiap toko reseller memiliki cart terpisah. Jika pelanggan mengunjungi `toko-abc` dan `toko-xyz`, masing-masing memiliki cart sendiri:

```
pbs_reseller_cart_toko-abc  -->  [item dari toko ABC]
pbs_reseller_cart_toko-xyz  -->  [item dari toko XYZ]
```

### Operasi Cart

| Operasi | Deskripsi |
|---------|-----------|
| Tambah item | Jika produk sudah ada, quantity bertambah. Jika belum, item baru ditambahkan. |
| Ubah quantity | Update quantity item (min 1, max stok) |
| Hapus item | Hapus item dari cart |
| Kosongkan | Hapus semua item (dilakukan setelah checkout berhasil) |

---

## Langkah 3: Checkout

### Form Data Pelanggan

Pelanggan mengisi form dengan data:

| Field | Required | Validasi |
|-------|----------|----------|
| Nama Lengkap | Ya | Tidak boleh kosong |
| Email | Ya | Format email valid |
| WhatsApp | Ya | Tidak boleh kosong |
| hCaptcha | Ya | Token captcha valid |

### Keamanan Checkout

Sistem checkout dilindungi dengan:

| Fitur | Deskripsi |
|-------|-----------|
| **hCaptcha** | Verifikasi CAPTCHA untuk mencegah bot |
| **Rate Limiting** | Max 5 checkout per 15 menit per IP |
| **Server-Side Validation** | Validasi ulang semua data di server |

### Request ke Server

Setelah pelanggan mengklik "Bayar Sekarang", frontend mengirim:

```
POST /api/store/{slug}/checkout
```

```json
{
  "items": [
    {
      "product_id": "550e8400-e29b-41d4-a716-446655440001",
      "kode": "NETFLIX-1BLN",
      "nama": "Netflix Premium 1 Bulan",
      "quantity": 2,
      "harga_jual": 20000
    },
    {
      "product_id": "550e8400-e29b-41d4-a716-446655440002",
      "kode": "SPOTIFY-1BLN",
      "nama": "Spotify Premium 1 Bulan",
      "quantity": 1,
      "harga_jual": 15000
    }
  ],
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "081234567890",
  "captcha_token": "hcaptcha-token-here"
}
```

---

## Langkah 4: Proses Checkout di Server

Berikut adalah langkah-langkah yang terjadi di server saat menerima request checkout:

### 4a. Verifikasi hCaptcha

```
1. Ambil captcha_token dari request body
2. Kirim request ke hCaptcha API untuk verifikasi
3. Jika verifikasi gagal -> return error 400 "Invalid captcha"
```

### 4b. Rate Limiting

```
1. Cek jumlah checkout dari IP dalam 15 menit terakhir
2. Jika > 5 request -> return error 429 "Too many requests"
3. Simpan timestamp request untuk tracking
```

### 4c. Validasi Reseller

```
1. Cari reseller berdasarkan slug
2. Periksa is_active = true
3. Jika tidak aktif -> return error 404
```

### 4d. Validasi Produk dan Stok

```
Untuk setiap item dalam request:
  1. Cari produk di tabel products berdasarkan product_id
  2. Periksa is_active = true
  3. Periksa stok >= quantity yang diminta
  4. Jika stok tidak cukup -> return error 400
```

### 4e. Perhitungan Harga

```
Untuk setiap item:
  harga_pusat = products.harga_web ?? products.harga_bot ?? 0
  harga_jual  = reseller_prices.harga_jual ?? harga_pusat

total_amount = SUM(harga_jual x quantity)      <-- yang dibayar pelanggan
total_modal  = SUM(harga_pusat x quantity)     <-- harga dasar
komisi       = total_amount - total_modal       <-- keuntungan reseller
```

**Contoh perhitungan:**

| Item | Qty | Harga Pusat | Harga Jual | Subtotal Pusat | Subtotal Jual |
|------|-----|-------------|------------|----------------|---------------|
| Netflix Premium | 2 | Rp 15.000 | Rp 20.000 | Rp 30.000 | Rp 40.000 |
| Spotify Premium | 1 | Rp 10.000 | Rp 15.000 | Rp 10.000 | Rp 15.000 |
| **Total** | **3** | | | **Rp 40.000** | **Rp 55.000** |

```
total_amount = Rp 55.000 (yang dibayar pelanggan)
total_modal  = Rp 40.000 (harga pusat)
komisi       = Rp 55.000 - Rp 40.000 = Rp 15.000 (keuntungan reseller)
```

### 4f. Generate Order ID

Format: `RS-{base36(timestamp)}{random3chars}`

```javascript
const timestamp = Date.now().toString(36);        // contoh: "lq5xz8k"
const random = Math.random().toString(36).substring(2, 5).toUpperCase(); // contoh: "A7B"
const orderId = `RS-${timestamp}${random}`;       // contoh: "RS-lq5xz8kA7B"
```

| Komponen | Deskripsi |
|----------|-----------|
| `RS-` | Prefix tetap untuk order reseller |
| `base36(timestamp)` | Timestamp dalam base36 (kompak, unik) |
| `random3chars` | 3 karakter random uppercase untuk menghindari collision |

### 4g. Reservasi Item

```
Panggil RPC: reserve_items_for_order(order_id, items)
```

Fungsi ini:
1. Mengambil item dari tabel `items` yang statusnya `available`
2. Mengubah status item menjadi `reserved`
3. Mengaitkan item dengan `order_id`
4. Mengembalikan daftar item yang berhasil direservasi

### 4h. Buat Pembayaran QRIS via Midtrans

```javascript
// Request ke Midtrans Core API
const midtransPayload = {
  payment_type: "qris",
  transaction_details: {
    order_id: "RS-lq5xz8kA7B",
    gross_amount: 55000
  },
  qris: {
    acquirer: "gopay"
  }
};

// POST ke https://api.midtrans.com/v2/charge
// (atau https://api.sandbox.midtrans.com/v2/charge untuk sandbox)
```

Response dari Midtrans berisi `actions` dengan URL QRIS:

```json
{
  "status_code": "201",
  "transaction_id": "uuid-midtrans",
  "order_id": "RS-lq5xz8kA7B",
  "gross_amount": "55000.00",
  "payment_type": "qris",
  "actions": [
    {
      "name": "generate-qr-code",
      "method": "GET",
      "url": "https://api.midtrans.com/v2/qris/.../qr-code"
    }
  ]
}
```

### 4i. Simpan ke Database

```sql
INSERT INTO reseller_orders (
  reseller_id, order_id, customer_name, customer_email, customer_phone,
  total_amount, total_modal, komisi, status, payment_type, payment_url,
  midtrans_response, items_snapshot
) VALUES (
  'uuid-reseller', 'RS-lq5xz8kA7B', 'John Doe', 'john@example.com',
  '081234567890', 55000, 40000, 15000, 'pending', 'qris',
  'https://api.midtrans.com/v2/qris/.../qr-code',
  '{"transaction_id": "...", ...}',
  '[{"product_id": "...", "nama": "...", ...}]'
);
```

### 4j. Notifikasi Admin via Telegram

```
ORDER RESELLER BARU!

Order ID: RS-lq5xz8kA7B
Toko: Toko Digital ABC
Pelanggan: John Doe
Email: john@example.com
WhatsApp: 081234567890

Item:
- Netflix Premium 1 Bulan x2
- Spotify Premium 1 Bulan x1

Total: Rp 55.000
Modal: Rp 40.000
Komisi Reseller: Rp 15.000

Status: Menunggu Pembayaran
```

### 4k. Return Response ke Frontend

```json
{
  "success": true,
  "data": {
    "order_id": "RS-lq5xz8kA7B",
    "payment_url": "https://api.midtrans.com/v2/qris/.../qr-code",
    "total_amount": 55000
  }
}
```

---

## Langkah 5: Pembayaran QRIS

### Tampilan ke Pelanggan

Frontend menampilkan halaman `/{slug}/order-pending` dengan:
1. **QR Code QRIS** - gambar dari `payment_url`
2. **Order ID** - untuk referensi
3. **Total pembayaran** - jumlah yang harus dibayar
4. **Instruksi** - scan QR code menggunakan aplikasi e-wallet

### Cara Pembayaran

Pelanggan scan QR code menggunakan:
- GoPay
- OVO
- DANA
- ShopeePay
- LinkAja
- Atau aplikasi mobile banking yang mendukung QRIS

### Batas Waktu

Pembayaran QRIS memiliki batas waktu **15 menit** (default Midtrans). Jika tidak dibayar dalam waktu tersebut, order akan expire.

---

## Langkah 6: Polling Status

### Mekanisme Polling

Frontend secara otomatis memeriksa status order setiap **5 detik**:

```javascript
// Polling setiap 5 detik
const pollInterval = setInterval(async () => {
  const response = await fetch(
    `/api/store/${slug}/order-status?order_id=${orderId}`
  );
  const data = await response.json();

  switch (data.data.status) {
    case 'completed':
      clearInterval(pollInterval);
      clearCart();  // Kosongkan keranjang
      // Redirect ke halaman sukses
      router.push(`/toko/${slug}/order-success?order_id=${orderId}`);
      break;

    case 'cancelled':
    case 'expired':
      clearInterval(pollInterval);
      // Tampilkan pesan gagal/expired
      setOrderFailed(true);
      break;

    case 'pending':
      // Tetap polling
      break;
  }
}, 5000);
```

### Alur Status

```
                    +--- settlement ---> completed ---> Redirect ke sukses
                    |
pending --webhook-->+--- cancel/deny --> cancelled --> Tampilkan pesan gagal
                    |
                    +--- expire -------> expired -----> Tampilkan pesan expired
```

---

## Langkah 7: Webhook Midtrans

### URL Webhook
```
POST /api/webhook (port 3003)
```

### Alur Proses Webhook

#### 7a. Verifikasi Signature SHA512

```javascript
const crypto = require('crypto');

// Data dari Midtrans
const { order_id, status_code, gross_amount, signature_key } = req.body;

// Hitung signature
const serverKey = process.env.MIDTRANS_SERVER_KEY;
const payload = order_id + status_code + gross_amount + serverKey;
const calculatedSignature = crypto
  .createHash('sha512')
  .update(payload)
  .digest('hex');

// Bandingkan
if (calculatedSignature !== signature_key) {
  return res.status(403).json({ error: 'Invalid signature' });
}
```

#### 7b. Filter Order Reseller

```javascript
// Hanya proses order dengan prefix RS-
if (!order_id.startsWith('RS-')) {
  // Bukan order reseller, abaikan atau forward ke handler lain
  return res.status(200).json({ message: 'Not a reseller order' });
}
```

#### 7c. Mapping Status Midtrans

| `transaction_status` dari Midtrans | Status Order di Database |
|-------------------------------------|------------------------|
| `settlement` | `completed` |
| `capture` | `completed` |
| `cancel` | `cancelled` |
| `deny` | `cancelled` |
| `expire` | `expired` |
| `pending` | `pending` (tidak diubah) |

#### 7d. Jika Status = completed

```
1. Update reseller_orders SET status = 'completed'

2. Panggil RPC: finalize_items_for_order(order_id)
   -> Mengubah status item dari 'reserved' ke 'sold'
   -> Mengembalikan data item (nilai akun, voucher, dll)

3. Simpan ke reseller_order_items:
   INSERT INTO reseller_order_items (
     order_id, reseller_order_id, product_id, product_name,
     product_code, item_id, item_value, harga_pusat, harga_jual, quantity
   ) VALUES (...)

4. Kirim notifikasi Telegram ke admin:
   ORDER RESELLER BERHASIL!
   Order ID: RS-lq5xz8kA7B
   Toko: Toko Digital ABC
   Total: Rp 55.000
   Komisi: Rp 15.000

5. TRIGGER OTOMATIS (database):
   trigger_update_reseller_saldo:
   -> saldo += komisi (15000)
   -> total_penjualan += total_amount (55000)
   -> total_komisi += komisi (15000)
```

#### 7e. Jika Status = cancelled atau expired

```
1. Update reseller_orders SET status = 'cancelled' / 'expired'

2. Panggil RPC: release_reserved_items(order_id)
   -> Mengubah status item dari 'reserved' kembali ke 'available'
   -> Stok kembali tersedia untuk order lain

3. (Opsional) Kirim notifikasi Telegram ke admin
```

#### 7f. Trigger Database Otomatis

Setelah status order diubah menjadi `completed`, trigger `trigger_update_reseller_saldo` secara otomatis:

```sql
-- Trigger ini berjalan otomatis, tidak perlu dipanggil manual
UPDATE resellers SET
  saldo = saldo + NEW.komisi,
  total_penjualan = total_penjualan + NEW.total_amount,
  total_komisi = total_komisi + NEW.komisi,
  updated_at = NOW()
WHERE id = NEW.reseller_id;
```

---

## Langkah 8: Order Selesai

### Sisi Pelanggan

1. Frontend mendeteksi status `completed` dari polling
2. Keranjang belanja dikosongkan
3. Pelanggan diarahkan ke halaman sukses
4. Pelanggan bisa melihat detail order dan item yang diterima melalui halaman pencarian order (`/{slug}/orders`)

### Sisi Reseller

1. Order muncul di dashboard dengan status `completed`
2. Saldo bertambah sebesar komisi
3. Total penjualan bertambah
4. Total komisi bertambah
5. Reseller bisa melihat detail order di halaman Riwayat Order

### Sisi Admin

1. Menerima notifikasi Telegram tentang order berhasil
2. Bisa melihat order di admin dashboard (jika diimplementasikan)

---

## Perhitungan Harga

### Resolusi Harga Pusat

Harga pusat ditentukan dengan urutan prioritas berikut:

```
1. products.harga_web    <-- Prioritas utama
2. products.harga_bot    <-- Fallback jika harga_web null/0
3. 0                     <-- Default jika keduanya null/0
```

### Resolusi Harga Jual Reseller

Harga jual ditentukan dengan urutan prioritas:

```
1. reseller_prices.harga_jual  <-- Jika reseller sudah atur margin
2. products.harga_web          <-- Fallback (tanpa margin)
3. products.harga_bot          <-- Fallback kedua
4. 0                           <-- Default
```

### Rumus Margin

| Tipe Margin | Rumus | Contoh |
|-------------|-------|--------|
| **Fixed** (Nominal) | `harga_jual = harga_pusat + margin_value` | 15000 + 5000 = 20000 |
| **Percent** (Persentase) | `harga_jual = harga_pusat + (harga_pusat * margin_value / 100)` | 15000 + (15000 * 10 / 100) = 16500 |

### Perhitungan Komisi per Order

```
komisi = total_amount - total_modal
```

Dimana:
- `total_amount` = Total harga jual (yang dibayar pelanggan)
- `total_modal` = Total harga pusat (harga dasar dari admin)
- `komisi` = Selisih yang menjadi keuntungan reseller

---

## Format Order ID

### Struktur

```
RS-{base36(timestamp)}{random3chars}
```

### Komponen

| Bagian | Deskripsi | Contoh |
|--------|-----------|--------|
| `RS-` | Prefix tetap, menandakan order reseller | `RS-` |
| `base36(timestamp)` | `Date.now()` dikonversi ke base36 | `lq5xz8k` |
| `random3chars` | 3 karakter acak uppercase (A-Z, 0-9) | `A7B` |

### Contoh

```
RS-lq5xz8kA7B
RS-lq5y2m1X9F
RS-lq60abc3K2
```

### Mengapa Base36?

- **Kompak**: Timestamp 13 digit menjadi 7-8 karakter
- **Unik**: Berbasis waktu, hampir tidak mungkin collision
- **Readable**: Mudah dibaca dan diketik oleh pelanggan
- **Sortable**: Urutan kronologis terjaga

### Mengapa Prefix RS-?

- **Identifikasi**: Membedakan order reseller dari order bot/web
- **Routing**: Webhook Midtrans bisa merouting berdasarkan prefix
- **Filtering**: Mudah difilter di database

---

## Reservasi Stok

### Mengapa Perlu Reservasi?

Reservasi stok mencegah **overselling** - situasi dimana dua pelanggan membeli item yang sama secara bersamaan.

### Alur Reservasi

```
1. CHECKOUT: reserve_items_for_order(order_id, items)
   items status: available -> reserved
   
2a. PAYMENT SUCCESS: finalize_items_for_order(order_id)
    items status: reserved -> sold
    
2b. PAYMENT FAILED/EXPIRED: release_reserved_items(order_id)
    items status: reserved -> available
```

### RPC Functions (Existing)

Fungsi-fungsi ini sudah ada di database PBS dan digunakan bersama oleh bot Telegram, web, dan reseller:

| Fungsi | Deskripsi |
|--------|-----------|
| `reserve_items_for_order(order_id, items)` | Reservasi item, ubah status ke 'reserved' |
| `finalize_items_for_order(order_id)` | Finalisasi item, ubah status ke 'sold', return data item |
| `release_reserved_items(order_id)` | Lepas reservasi, ubah status kembali ke 'available' |

### Catatan Penting

- Item yang di-reserve memiliki batas waktu (sesuai batas waktu pembayaran Midtrans, ~15 menit)
- Jika pembayaran expire, item otomatis dilepas kembali
- Sistem ini **shared** dengan bot Telegram dan web - stok terintegrasi

---

## Diagram Sequence

```
Pelanggan          Frontend           Server            Midtrans          Database         Telegram
   |                  |                  |                  |                  |                |
   |  Buka toko       |                  |                  |                  |                |
   |----------------->|                  |                  |                  |                |
   |                  |  GET /store/slug |                  |                  |                |
   |                  |----------------->|                  |                  |                |
   |                  |                  |  SELECT reseller |                  |                |
   |                  |                  |---------------------------------->|                |
   |                  |                  |  reseller data   |                  |                |
   |                  |                  |<----------------------------------|                |
   |                  |  store info      |                  |                  |                |
   |                  |<-----------------|                  |                  |                |
   |                  |                  |                  |                  |                |
   |                  |  GET /products   |                  |                  |                |
   |                  |----------------->|                  |                  |                |
   |                  |                  |  SELECT products |                  |                |
   |                  |                  |---------------------------------->|                |
   |                  |                  |  products + prices                 |                |
   |                  |                  |<----------------------------------|                |
   |                  |  products list   |                  |                  |                |
   |                  |<-----------------|                  |                  |                |
   |  tampilkan produk|                  |                  |                  |                |
   |<-----------------|                  |                  |                  |                |
   |                  |                  |                  |                  |                |
   |  tambah ke cart  |                  |                  |                  |                |
   |----------------->|                  |                  |                  |                |
   |                  |  save localStorage                  |                  |                |
   |                  |                  |                  |                  |                |
   |  checkout        |                  |                  |                  |                |
   |----------------->|                  |                  |                  |                |
   |                  |  POST /checkout  |                  |                  |                |
   |                  |----------------->|                  |                  |                |
   |                  |                  |  validate        |                  |                |
   |                  |                  |  reserve items   |                  |                |
   |                  |                  |---------------------------------->|                |
   |                  |                  |  items reserved  |                  |                |
   |                  |                  |<----------------------------------|                |
   |                  |                  |  create QRIS     |                  |                |
   |                  |                  |----------------->|                  |                |
   |                  |                  |  QRIS URL        |                  |                |
   |                  |                  |<-----------------|                  |                |
   |                  |                  |  save order      |                  |                |
   |                  |                  |---------------------------------->|                |
   |                  |                  |  notify admin    |                  |                |
   |                  |                  |------------------------------------------------------>|
   |                  |  order_id + QRIS |                  |                  |                |
   |                  |<-----------------|                  |                  |                |
   |  tampilkan QR    |                  |                  |                  |                |
   |<-----------------|                  |                  |                  |                |
   |                  |                  |                  |                  |                |
   |  scan & bayar    |                  |                  |                  |                |
   |-------------------------------------------->|                  |                          |
   |                  |                  |                  |                  |                |
   |                  |  poll status     |                  |                  |                |
   |                  |  (setiap 5 dtk)  |                  |                  |                |
   |                  |----------------->|                  |                  |                |
   |                  |  status: pending |                  |                  |                |
   |                  |<-----------------|                  |                  |                |
   |                  |                  |                  |                  |                |
   |                  |                  |  POST /webhook   |                  |                |
   |                  |                  |<-----------------|                  |                |
   |                  |                  |  verify signature|                  |                |
   |                  |                  |  update order    |                  |                |
   |                  |                  |---------------------------------->|                |
   |                  |                  |  finalize items  |                  |                |
   |                  |                  |---------------------------------->|                |
   |                  |                  |  item values     |                  |                |
   |                  |                  |<----------------------------------|                |
   |                  |                  |  TRIGGER: update saldo            |                |
   |                  |                  |  notify admin    |                  |                |
   |                  |                  |------------------------------------------------------>|
   |                  |                  |  200 OK          |                  |                |
   |                  |                  |----------------->|                  |                |
   |                  |                  |                  |                  |                |
   |                  |  poll status     |                  |                  |                |
   |                  |----------------->|                  |                  |                |
   |                  |  status:completed|                  |                  |                |
   |                  |<-----------------|                  |                  |                |
   |  redirect sukses |                  |                  |                  |                |
   |<-----------------|                  |                  |                  |                |
   |                  |                  |                  |                  |                |
```

---

*Lanjut ke: [PRICING-SYSTEM.md](./PRICING-SYSTEM.md) - Sistem harga dan margin secara detail*
