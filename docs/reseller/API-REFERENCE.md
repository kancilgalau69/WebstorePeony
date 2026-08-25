# Referensi API PBS Reseller System

Dokumen ini berisi referensi lengkap untuk semua API endpoint yang tersedia di PBS Reseller System, mencakup Reseller Dashboard API (port 3002) dan Web Reseller API (port 3003).

---

## Daftar Isi

- [Informasi Umum](#informasi-umum)
- [Reseller Dashboard APIs (Port 3002)](#reseller-dashboard-apis-port-3002)
  - [Auth: Login](#1-auth-login)
  - [Auth: Logout](#2-auth-logout)
  - [Auth: Me](#3-auth-me)
  - [Dashboard: Summary](#4-dashboard-summary)
  - [Dashboard: Orders](#5-dashboard-orders)
  - [Dashboard: Products (GET)](#6-dashboard-products-get)
  - [Dashboard: Products (PUT)](#7-dashboard-products-put)
  - [Dashboard: Pricing (GET)](#8-dashboard-pricing-get)
  - [Dashboard: Pricing (PUT)](#9-dashboard-pricing-put)
  - [Dashboard: Store Settings (PUT)](#10-dashboard-store-settings-put)
  - [Dashboard: Change Password](#11-dashboard-change-password)
  - [Dashboard: Balance (GET)](#12-dashboard-balance-get)
  - [Dashboard: Withdraw](#13-dashboard-withdraw)
- [Web Reseller APIs (Port 3003)](#web-reseller-apis-port-3003)
  - [Stores: List](#1-stores-list)
  - [Store: Info](#2-store-info)
  - [Store: Products](#3-store-products)
  - [Store: Checkout](#4-store-checkout)
  - [Store: Order Status](#5-store-order-status)
  - [Store: Order Search](#6-store-order-search)
  - [Webhook: Midtrans](#7-webhook-midtrans)

---

## Informasi Umum

### Base URLs

| Service | Base URL |
|---------|----------|
| Reseller Dashboard | `http://localhost:3002` |
| Web Reseller | `http://localhost:3003` |

### Autentikasi

| Tipe | Metode | Deskripsi |
|------|--------|-----------|
| **Session Cookie** | Cookie `pbs_reseller_session` | Digunakan oleh Dashboard APIs. Cookie di-set saat login dan dikirim otomatis oleh browser. |
| **Public** | Tanpa auth | Digunakan oleh Web Reseller APIs. Dapat diakses tanpa autentikasi. |

### Format Response

Semua response menggunakan format JSON:

```json
// Sukses
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": "Pesan error"
}
```

### HTTP Status Codes

| Code | Deskripsi |
|------|-----------|
| `200` | OK — Request berhasil |
| `201` | Created — Resource berhasil dibuat |
| `400` | Bad Request — Parameter tidak valid |
| `401` | Unauthorized — Session tidak valid atau expired |
| `403` | Forbidden — Akses ditolak |
| `404` | Not Found — Resource tidak ditemukan |
| `500` | Internal Server Error — Kesalahan server |

---

## Reseller Dashboard APIs (Port 3002)

### 1. Auth: Login

Melakukan autentikasi reseller dan membuat session.

| Aspek | Detail |
|-------|--------|
| **Method** | `POST` |
| **URL** | `/api/auth/login` |
| **Auth** | Public (tanpa autentikasi) |

**Request Body:**

```json
{
  "email": "reseller@example.com",
  "password": "password123"
}
```

| Field | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `email` | `string` | Ya | Email reseller |
| `password` | `string` | Ya | Password reseller |

**Response Sukses (200):**

```json
{
  "success": true,
  "reseller": {
    "id": "uuid-reseller",
    "nama_toko": "Toko Digital ABC",
    "slug": "toko-abc",
    "email": "reseller@example.com"
  }
}
```

**Cookies yang di-set:**

| Cookie | Nilai | HttpOnly | Max-Age | Path |
|--------|-------|----------|---------|------|
| `pbs_reseller_session` | HMAC-SHA256 token | Ya | 30 hari (2592000s) | `/` |

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `400` | `"Email dan password harus diisi"` | Field kosong |
| `401` | `"Email atau password salah"` | Kredensial tidak valid |
| `403` | `"Akun reseller tidak aktif"` | `is_active = false` |
| `500` | `"Terjadi kesalahan server"` | Internal error |

---

### 2. Auth: Logout

Menghapus session reseller.

| Aspek | Detail |
|-------|--------|
| **Method** | `POST` |
| **URL** | `/api/auth/logout` |
| **Auth** | Session Cookie |

**Request Body:** Tidak ada

**Response Sukses (200):**

```json
{
  "success": true,
  "message": "Logout berhasil"
}
```

**Cookies yang dihapus:**

| Cookie | Action |
|--------|--------|
| `pbs_reseller_session` | Dihapus (Max-Age: 0) |

**Proses di server:**
1. Membaca cookie `pbs_reseller_session`
2. Menghapus `session_token` dan `session_expires_at` di tabel `resellers`
3. Menghapus cookie dari response

---

### 3. Auth: Me

Mengambil data reseller yang sedang login (fresh dari database).

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/auth/me` |
| **Auth** | Session Cookie |

**Request Body:** Tidak ada

**Response Sukses (200):**

```json
{
  "success": true,
  "reseller": {
    "id": "uuid-reseller",
    "nama_toko": "Toko Digital ABC",
    "slug": "toko-abc",
    "email": "reseller@example.com",
    "deskripsi": "Toko digital terpercaya",
    "alamat": "Jakarta",
    "phone": "081234567890",
    "whatsapp": "081234567890",
    "instagram": "tokoabc",
    "logo_url": "https://example.com/logo.png",
    "warna_tema": "#3B82F6",
    "is_active": true,
    "saldo": 150000.00,
    "total_penjualan": 1500000.00,
    "total_komisi": 300000.00,
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-15T10:30:00.000Z"
  }
}
```

**Catatan:** Semua field dari tabel `resellers` dikembalikan **kecuali** `password_hash`, `session_token`, dan `session_expires_at`.

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `401` | `"Unauthorized"` | Cookie tidak ada atau tidak valid |

---

### 4. Dashboard: Summary

Mengambil data ringkasan untuk halaman dashboard utama.

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/dashboard/summary` |
| **Auth** | Session Cookie |

**Request Body:** Tidak ada

**Response Sukses (200):**

```json
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "todayOrders": 5,
    "monthRevenue": 2500000.00,
    "totalKomisi": 500000.00,
    "chartData": [
      { "date": "09/01", "orders": 3, "revenue": 150000 },
      { "date": "10/01", "orders": 5, "revenue": 250000 },
      { "date": "11/01", "orders": 2, "revenue": 100000 },
      { "date": "12/01", "orders": 7, "revenue": 350000 },
      { "date": "13/01", "orders": 4, "revenue": 200000 },
      { "date": "14/01", "orders": 6, "revenue": 300000 },
      { "date": "15/01", "orders": 5, "revenue": 250000 }
    ],
    "recentOrders": [
      {
        "order_id": "RS-abc123",
        "customer_name": "John Doe",
        "total_amount": 55000.00,
        "status": "completed",
        "created_at": "2025-01-15T14:30:00.000Z"
      }
    ]
  }
}
```

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `totalOrders` | `number` | Total semua order |
| `todayOrders` | `number` | Order hari ini |
| `monthRevenue` | `number` | Pendapatan bulan berjalan (dari order completed) |
| `totalKomisi` | `number` | Total komisi akumulasi |
| `chartData` | `array` | Data 7 hari terakhir untuk grafik |
| `recentOrders` | `array` | 5 order terbaru |

---

### 5. Dashboard: Orders

Mengambil daftar order dengan paginasi dan filter.

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/dashboard/orders` |
| **Auth** | Session Cookie |

**Query Parameters:**

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `page` | `number` | `1` | Nomor halaman |
| `limit` | `number` | `20` | Jumlah item per halaman |
| `status` | `string` | `"all"` | Filter status: `all`, `pending`, `completed`, `cancelled` |
| `search` | `string` | `""` | Pencarian: order ID, nama, atau email pelanggan |

**Contoh Request:**
```
GET /api/dashboard/orders?page=1&limit=20&status=completed&search=john
```

**Response Sukses (200):**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "uuid-order",
        "order_id": "RS-abc123",
        "customer_name": "John Doe",
        "customer_email": "john@example.com",
        "customer_phone": "081234567890",
        "total_amount": 55000.00,
        "total_modal": 40000.00,
        "komisi": 15000.00,
        "status": "completed",
        "payment_type": "qris",
        "items_snapshot": [...],
        "created_at": "2025-01-15T14:30:00.000Z",
        "updated_at": "2025-01-15T14:35:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

### 6. Dashboard: Products (GET)

Mengambil semua produk aktif dengan status visibilitas per reseller.

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/dashboard/products` |
| **Auth** | Session Cookie |

**Request Body:** Tidak ada

**Response Sukses (200):**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "uuid-product",
        "nama": "Netflix Premium 1 Bulan",
        "kategori": "Streaming",
        "harga_bot": 15000,
        "harga_web": 15000,
        "deskripsi": "Akun Netflix Premium...",
        "is_active": true,
        "stok": 15,
        "is_visible": true
      }
    ]
  }
}
```

| Field | Deskripsi |
|-------|-----------|
| `is_visible` | Status visibilitas di toko reseller. `true` jika tidak ada record di `reseller_products` (default visible) atau `is_visible = true` |

---

### 7. Dashboard: Products (PUT)

Mengubah visibilitas produk (single atau bulk).

| Aspek | Detail |
|-------|--------|
| **Method** | `PUT` |
| **URL** | `/api/dashboard/products` |
| **Auth** | Session Cookie |

**Request Body (Single):**

```json
{
  "product_id": "uuid-product",
  "is_visible": false
}
```

**Request Body (Bulk):**

```json
{
  "product_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "is_visible": true
}
```

| Field | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `product_id` | `string` | Ya (single) | ID produk tunggal |
| `product_ids` | `string[]` | Ya (bulk) | Array ID produk |
| `is_visible` | `boolean` | Ya | Status visibilitas baru |

**Response Sukses (200):**

```json
{
  "success": true,
  "message": "Visibilitas produk berhasil diperbarui"
}
```

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `400` | `"product_id atau product_ids harus diisi"` | Parameter tidak lengkap |
| `401` | `"Unauthorized"` | Session tidak valid |

---

### 8. Dashboard: Pricing (GET)

Mengambil semua produk dengan data margin reseller.

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/dashboard/pricing` |
| **Auth** | Session Cookie |

**Response Sukses (200):**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "uuid-product",
        "nama": "Netflix Premium 1 Bulan",
        "kategori": "Streaming",
        "harga_pusat": 15000,
        "margin_type": "fixed",
        "margin_value": 5000,
        "harga_jual": 20000
      },
      {
        "id": "uuid-product-2",
        "nama": "Spotify Premium 1 Bulan",
        "kategori": "Streaming",
        "harga_pusat": 10000,
        "margin_type": null,
        "margin_value": null,
        "harga_jual": null
      }
    ]
  }
}
```

**Catatan:** Jika `margin_type`, `margin_value`, dan `harga_jual` adalah `null`, berarti reseller belum mengatur margin untuk produk tersebut. Harga yang ditampilkan di toko akan menggunakan harga pusat.

---

### 9. Dashboard: Pricing (PUT)

Mengubah margin harga (single atau bulk).

| Aspek | Detail |
|-------|--------|
| **Method** | `PUT` |
| **URL** | `/api/dashboard/pricing` |
| **Auth** | Session Cookie |

**Request Body (Single Product):**

```json
{
  "product_id": "uuid-product",
  "margin_type": "fixed",
  "margin_value": 5000
}
```

**Request Body (Bulk - Semua Produk):**

```json
{
  "bulk": true,
  "margin_type": "percent",
  "margin_value": 10
}
```

| Field | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `product_id` | `string` | Ya (single) | ID produk |
| `bulk` | `boolean` | Ya (bulk) | Set `true` untuk bulk update |
| `margin_type` | `string` | Ya | `"fixed"` atau `"percent"` |
| `margin_value` | `number` | Ya | Nilai margin (Rp atau %) |

**Response Sukses (200):**

```json
{
  "success": true,
  "message": "Harga berhasil diperbarui"
}
```

**Proses di server:**
1. Ambil harga pusat produk (`harga_web` atau `harga_bot`)
2. Hitung `harga_jual` menggunakan `calculate_reseller_price()`
3. Upsert ke tabel `reseller_prices`

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `400` | `"margin_type harus 'fixed' atau 'percent'"` | Tipe margin tidak valid |
| `400` | `"margin_value harus lebih dari 0"` | Nilai margin tidak valid |
| `401` | `"Unauthorized"` | Session tidak valid |

---

### 10. Dashboard: Store Settings (PUT)

Memperbarui pengaturan profil toko.

| Aspek | Detail |
|-------|--------|
| **Method** | `PUT` |
| **URL** | `/api/dashboard/store-settings` |
| **Auth** | Session Cookie |

**Request Body:**

```json
{
  "nama_toko": "Toko Digital ABC",
  "slug": "toko-abc",
  "deskripsi": "Toko digital terpercaya",
  "alamat": "Jakarta, Indonesia",
  "phone": "081234567890",
  "whatsapp": "081234567890",
  "instagram": "tokoabc",
  "warna_tema": "#3B82F6",
  "logo_url": "https://example.com/logo.png"
}
```

| Field | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `nama_toko` | `string` | Ya | Nama toko (max 255) |
| `slug` | `string` | Ya | Slug URL (auto-sanitized) |
| `deskripsi` | `string` | Tidak | Deskripsi toko |
| `alamat` | `string` | Tidak | Alamat fisik |
| `phone` | `string` | Tidak | Nomor telepon |
| `whatsapp` | `string` | Tidak | Nomor WhatsApp |
| `instagram` | `string` | Tidak | Username Instagram |
| `warna_tema` | `string` | Tidak | Warna tema (hex, contoh: #3B82F6) |
| `logo_url` | `string` | Tidak | URL logo |

**Response Sukses (200):**

```json
{
  "success": true,
  "message": "Pengaturan toko berhasil diperbarui",
  "reseller": {
    "id": "uuid",
    "nama_toko": "Toko Digital ABC",
    "slug": "toko-abc",
    "..."
  }
}
```

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `400` | `"Nama toko harus diisi"` | Field required kosong |
| `400` | `"Slug sudah digunakan oleh toko lain"` | Slug tidak unik |
| `401` | `"Unauthorized"` | Session tidak valid |

---

### 11. Dashboard: Change Password

Mengubah password reseller.

| Aspek | Detail |
|-------|--------|
| **Method** | `PUT` |
| **URL** | `/api/dashboard/store-settings/password` |
| **Auth** | Session Cookie |

**Request Body:**

```json
{
  "current_password": "password_lama",
  "new_password": "password_baru_123"
}
```

| Field | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `current_password` | `string` | Ya | Password saat ini |
| `new_password` | `string` | Ya | Password baru (min 6 karakter) |

**Response Sukses (200):**

```json
{
  "success": true,
  "message": "Password berhasil diubah"
}
```

**Proses di server:**
1. Verifikasi `current_password` dengan `bcrypt.compare()`
2. Hash `new_password` dengan `bcrypt.hash()`
3. Update `password_hash` di tabel `resellers`

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `400` | `"Password saat ini dan password baru harus diisi"` | Field kosong |
| `400` | `"Password baru minimal 6 karakter"` | Password terlalu pendek |
| `401` | `"Password saat ini salah"` | Password lama tidak cocok |

---

### 12. Dashboard: Balance (GET)

Mengambil informasi saldo dan riwayat penarikan.

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/dashboard/balance` |
| **Auth** | Session Cookie |

**Response Sukses (200):**

```json
{
  "success": true,
  "data": {
    "saldo": 150000.00,
    "total_penjualan": 1500000.00,
    "total_komisi": 300000.00,
    "pending_withdrawal": 50000.00,
    "withdrawals": [
      {
        "id": "uuid-wd",
        "amount": 100000.00,
        "bank_name": "BCA",
        "account_number": "1234567890",
        "account_name": "John Doe",
        "status": "completed",
        "admin_notes": null,
        "processed_at": "2025-01-14T10:00:00.000Z",
        "created_at": "2025-01-13T15:00:00.000Z"
      },
      {
        "id": "uuid-wd-2",
        "amount": 50000.00,
        "bank_name": "DANA",
        "account_number": "081234567890",
        "account_name": "John Doe",
        "status": "pending",
        "admin_notes": null,
        "processed_at": null,
        "created_at": "2025-01-15T09:00:00.000Z"
      }
    ]
  }
}
```

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `saldo` | `number` | Saldo tersedia saat ini |
| `total_penjualan` | `number` | Total penjualan akumulasi |
| `total_komisi` | `number` | Total komisi akumulasi |
| `pending_withdrawal` | `number` | Total penarikan yang masih pending/approved |
| `withdrawals` | `array` | Riwayat penarikan (terbaru dulu) |

---

### 13. Dashboard: Withdraw

Mengajukan penarikan saldo.

| Aspek | Detail |
|-------|--------|
| **Method** | `POST` |
| **URL** | `/api/dashboard/balance/withdraw` |
| **Auth** | Session Cookie |

**Request Body:**

```json
{
  "amount": 100000,
  "bank_name": "BCA",
  "account_number": "1234567890",
  "account_name": "John Doe"
}
```

| Field | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `amount` | `number` | Ya | Jumlah penarikan (min 50000) |
| `bank_name` | `string` | Ya | Nama bank/e-wallet |
| `account_number` | `string` | Ya | Nomor rekening/akun |
| `account_name` | `string` | Ya | Nama pemilik rekening |

**Response Sukses (201):**

```json
{
  "success": true,
  "message": "Penarikan berhasil diajukan",
  "withdrawal": {
    "id": "uuid-wd",
    "amount": 100000.00,
    "bank_name": "BCA",
    "account_number": "1234567890",
    "account_name": "John Doe",
    "status": "pending",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
}
```

**Validasi:**

| Validasi | Kondisi | Error |
|----------|---------|-------|
| Jumlah minimum | `amount >= 50000` | `"Minimum penarikan Rp 50.000"` |
| Saldo cukup | `saldo >= amount` | `"Saldo tidak mencukupi"` |
| Saldo setelah pending | `(saldo - pending_wd) >= amount` | `"Saldo tidak mencukupi setelah memperhitungkan penarikan pending"` |
| Bank valid | Bank ada di daftar | `"Bank/e-wallet tidak valid"` |
| Semua field terisi | Tidak ada yang kosong | `"Semua field harus diisi"` |

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `400` | `"Minimum penarikan Rp 50.000"` | Jumlah kurang dari minimum |
| `400` | `"Saldo tidak mencukupi"` | Saldo kurang |
| `400` | `"Semua field harus diisi"` | Field kosong |
| `401` | `"Unauthorized"` | Session tidak valid |

---

## Web Reseller APIs (Port 3003)

### 1. Stores: List

Mengambil daftar semua toko reseller aktif.

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/stores` |
| **Auth** | Public |

**Response Sukses (200):**

```json
{
  "success": true,
  "data": {
    "stores": [
      {
        "id": "uuid-reseller",
        "nama_toko": "Toko Digital ABC",
        "slug": "toko-abc",
        "deskripsi": "Toko digital terpercaya",
        "logo_url": "https://example.com/logo.png",
        "warna_tema": "#3B82F6"
      }
    ]
  }
}
```

**Filter:** Hanya reseller dengan `is_active = true`.

---

### 2. Store: Info

Mengambil informasi detail satu toko.

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/store/{slug}` |
| **Auth** | Public |

**Path Parameters:**

| Parameter | Deskripsi |
|-----------|-----------|
| `slug` | Slug toko reseller |

**Response Sukses (200):**

```json
{
  "success": true,
  "data": {
    "store": {
      "id": "uuid-reseller",
      "nama_toko": "Toko Digital ABC",
      "slug": "toko-abc",
      "deskripsi": "Toko digital terpercaya",
      "logo_url": "https://example.com/logo.png",
      "whatsapp": "081234567890",
      "instagram": "tokoabc",
      "warna_tema": "#3B82F6"
    }
  }
}
```

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `404` | `"Toko tidak ditemukan"` | Slug tidak ada atau toko tidak aktif |

---

### 3. Store: Products

Mengambil produk yang visible di toko reseller dengan harga reseller.

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/store/{slug}/products` |
| **Auth** | Public |

**Path Parameters:**

| Parameter | Deskripsi |
|-----------|-----------|
| `slug` | Slug toko reseller |

**Response Sukses (200):**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "uuid-product",
        "nama": "Netflix Premium 1 Bulan",
        "kode": "NETFLIX-1BLN",
        "kategori": "Streaming",
        "deskripsi": "Akun Netflix Premium...",
        "gambar_url": "https://example.com/netflix.png",
        "harga_pusat": 15000,
        "harga_jual": 20000,
        "stok": 15,
        "is_active": true
      }
    ]
  }
}
```

**Logika:**
1. Ambil semua produk aktif (`is_active = true`)
2. Filter berdasarkan visibilitas reseller (`reseller_products.is_visible != false`)
3. Terapkan harga reseller dari `reseller_prices.harga_jual`
4. Jika tidak ada harga reseller, gunakan `harga_web` atau `harga_bot`

---

### 4. Store: Checkout

Membuat pesanan baru dan memulai pembayaran QRIS.

| Aspek | Detail |
|-------|--------|
| **Method** | `POST` |
| **URL** | `/api/store/{slug}/checkout` |
| **Auth** | Public |

**Path Parameters:**

| Parameter | Deskripsi |
|-----------|-----------|
| `slug` | Slug toko reseller |

**Request Body:**

```json
{
  "items": [
    {
      "product_id": "uuid-product-1",
      "kode": "NETFLIX-1BLN",
      "nama": "Netflix Premium 1 Bulan",
      "quantity": 2,
      "harga_jual": 20000
    },
    {
      "product_id": "uuid-product-2",
      "kode": "SPOTIFY-1BLN",
      "nama": "Spotify Premium 1 Bulan",
      "quantity": 1,
      "harga_jual": 15000
    }
  ],
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "081234567890"
}
```

| Field | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `items` | `array` | Ya | Array item yang dipesan |
| `items[].product_id` | `string` | Ya | ID produk |
| `items[].kode` | `string` | Ya | Kode produk |
| `items[].nama` | `string` | Ya | Nama produk |
| `items[].quantity` | `number` | Ya | Jumlah item |
| `items[].harga_jual` | `number` | Ya | Harga jual per item |
| `customer_name` | `string` | Ya | Nama pelanggan |
| `customer_email` | `string` | Ya | Email pelanggan |
| `customer_phone` | `string` | Ya | Nomor telepon pelanggan |

**Response Sukses (201):**

```json
{
  "success": true,
  "data": {
    "order_id": "RS-abc123xyz",
    "payment_url": "https://api.midtrans.com/v2/qris/...",
    "total_amount": 55000
  }
}
```

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `order_id` | `string` | ID order (format: RS-{base36}{random}) |
| `payment_url` | `string` | URL gambar QRIS untuk ditampilkan |
| `total_amount` | `number` | Total yang harus dibayar |

**Proses di server:**

1. Validasi reseller aktif
2. Validasi semua produk ada dan aktif
3. Validasi stok mencukupi
4. Hitung `total_amount` (harga jual), `total_modal` (harga pusat), `komisi` (selisih)
5. Generate `order_id`: `RS-{base36(timestamp)}{random3chars}`
6. Reservasi item via `reserve_items_for_order` RPC
7. Buat pembayaran QRIS via Midtrans Core API
8. Simpan ke tabel `reseller_orders`
9. Kirim notifikasi ke admin via Telegram
10. Return `order_id`, `payment_url`, `total_amount`

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `400` | `"Items tidak boleh kosong"` | Array items kosong |
| `400` | `"Data pelanggan tidak lengkap"` | Field customer kosong |
| `400` | `"Stok produk {nama} tidak mencukupi"` | Stok habis |
| `404` | `"Toko tidak ditemukan"` | Slug tidak valid |
| `500` | `"Gagal membuat pembayaran"` | Error Midtrans |

---

### 5. Store: Order Status

Memeriksa status pembayaran order (untuk polling).

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/store/{slug}/order-status` |
| **Auth** | Public |

**Query Parameters:**

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `order_id` | `string` | Ya | ID order yang ingin dicek |

**Contoh Request:**
```
GET /api/store/toko-abc/order-status?order_id=RS-abc123xyz
```

**Response Sukses (200):**

```json
{
  "success": true,
  "data": {
    "status": "completed",
    "order_id": "RS-abc123xyz"
  }
}
```

| Status | Deskripsi |
|--------|-----------|
| `pending` | Menunggu pembayaran |
| `completed` | Pembayaran berhasil, item sudah dikirim |
| `cancelled` | Dibatalkan |
| `expired` | Waktu pembayaran habis |

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `400` | `"order_id harus diisi"` | Parameter kosong |
| `404` | `"Order tidak ditemukan"` | Order ID tidak valid |

---

### 6. Store: Order Search

Mencari order berdasarkan ID, email, atau nomor telepon.

| Aspek | Detail |
|-------|--------|
| **Method** | `GET` |
| **URL** | `/api/store/{slug}/orders/search` |
| **Auth** | Public |

**Query Parameters:**

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `q` | `string` | Ya | Kata kunci pencarian (order ID, email, atau phone) |

**Contoh Request:**
```
GET /api/store/toko-abc/orders/search?q=john@example.com
```

**Response Sukses (200):**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": "RS-abc123xyz",
        "customer_name": "John Doe",
        "customer_email": "john@example.com",
        "total_amount": 55000.00,
        "status": "completed",
        "created_at": "2025-01-15T14:30:00.000Z",
        "items": [
          {
            "product_name": "Netflix Premium 1 Bulan",
            "quantity": 2,
            "harga_jual": 20000,
            "item_value": "account@email.com / pass123"
          }
        ]
      }
    ]
  }
}
```

**Catatan:** `item_value` hanya ditampilkan untuk order dengan status `completed`.

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `400` | `"Parameter pencarian harus diisi"` | Query kosong |

---

### 7. Webhook: Midtrans

Menerima callback pembayaran dari Midtrans.

| Aspek | Detail |
|-------|--------|
| **Method** | `POST` |
| **URL** | `/api/webhook` |
| **Auth** | Midtrans Signature Verification |

**Request Body (dari Midtrans):**

```json
{
  "transaction_time": "2025-01-15 14:35:00",
  "transaction_status": "settlement",
  "transaction_id": "uuid-midtrans",
  "status_message": "midtrans payment notification",
  "status_code": "200",
  "signature_key": "sha512hash...",
  "payment_type": "qris",
  "order_id": "RS-abc123xyz",
  "merchant_id": "G123456789",
  "gross_amount": "55000.00",
  "fraud_status": "accept",
  "currency": "IDR"
}
```

**Proses di server:**

1. **Verifikasi Signature SHA512:**
   ```
   signature = SHA512(order_id + status_code + gross_amount + server_key)
   ```
   Bandingkan dengan `signature_key` dari request. Jika tidak cocok → tolak (403).

2. **Filter Order Reseller:**
   Hanya proses order dengan prefix `RS-` pada `order_id`. Order tanpa prefix `RS-` diabaikan (bukan order reseller).

3. **Mapping Status:**

   | Midtrans `transaction_status` | Status Order |
   |-------------------------------|-------------|
   | `settlement` | `completed` |
   | `capture` | `completed` |
   | `cancel` | `cancelled` |
   | `deny` | `cancelled` |
   | `expire` | `expired` |

4. **Jika `completed`:**
   - Panggil `finalize_items_for_order` RPC untuk mendapatkan item aktual
   - Simpan item ke tabel `reseller_order_items`
   - Kirim notifikasi ke admin via Telegram (order berhasil)
   - **Trigger `trigger_update_reseller_saldo`** otomatis menambah komisi ke saldo reseller

5. **Jika `cancelled` atau `expired`:**
   - Panggil `release_reserved_items` RPC untuk melepas reservasi item
   - Update status order

**Response (200):**

```json
{
  "success": true,
  "message": "Webhook processed"
}
```

**Error Responses:**

| Status | Error | Deskripsi |
|--------|-------|-----------|
| `403` | `"Invalid signature"` | Signature SHA512 tidak valid |
| `404` | `"Order not found"` | Order ID tidak ditemukan |
| `500` | `"Internal server error"` | Kesalahan server |

---

*Lanjut ke: [ORDER-FLOW.md](./ORDER-FLOW.md) — Alur order & pembayaran secara detail*
