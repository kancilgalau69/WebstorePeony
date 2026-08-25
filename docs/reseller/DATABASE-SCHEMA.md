# Skema Database PBS Reseller System

Dokumen ini berisi referensi lengkap untuk semua tabel, fungsi, trigger, dan kebijakan keamanan database yang digunakan oleh PBS Reseller System.

---

## Daftar Isi

- [Diagram Relasi](#diagram-relasi)
- [Tabel 1: resellers](#tabel-1-resellers)
- [Tabel 2: reseller_products](#tabel-2-reseller_products)
- [Tabel 3: reseller_prices](#tabel-3-reseller_prices)
- [Tabel 4: reseller_orders](#tabel-4-reseller_orders)
- [Tabel 5: reseller_order_items](#tabel-5-reseller_order_items)
- [Tabel 6: reseller_withdrawals](#tabel-6-reseller_withdrawals)
- [Database Function](#database-function)
- [Database Triggers](#database-triggers)
- [Row Level Security (RLS)](#row-level-security-rls)
- [Indexes](#indexes)

---

## Diagram Relasi

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE RELATIONSHIP DIAGRAM                        │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐
  │    products       │  (Tabel existing - dikelola admin)
  │──────────────────│
  │ id (PK)          │
  │ nama             │
  │ kategori         │
  │ harga_bot        │
  │ harga_web        │
  │ deskripsi        │
  │ is_active        │
  │ ...              │
  └────────┬─────────┘
           │
           │ 1:N                    1:N
           ├──────────────────────────────────────────────┐
           │                                              │
           ▼                                              ▼
  ┌──────────────────┐                         ┌──────────────────┐
  │ reseller_products │                         │  reseller_prices  │
  │──────────────────│                         │──────────────────│
  │ id (PK)          │                         │ id (PK)          │
  │ reseller_id (FK) │──┐                   ┌──│ reseller_id (FK) │
  │ product_id (FK)  │  │                   │  │ product_id (FK)  │
  │ is_visible       │  │                   │  │ margin_type      │
  │ created_at       │  │                   │  │ margin_value     │
  └──────────────────┘  │                   │  │ harga_jual       │
                        │                   │  │ created_at       │
                        │                   │  │ updated_at       │
                        │                   │  └──────────────────┘
                        │                   │
                        ▼                   ▼
              ┌──────────────────────────────────┐
              │            resellers              │
              │──────────────────────────────────│
              │ id (PK)                          │
              │ nama_toko                        │
              │ slug (UNIQUE)                    │
              │ email (UNIQUE)                   │
              │ password_hash                    │
              │ deskripsi                        │
              │ alamat                           │
              │ phone                            │
              │ whatsapp                         │
              │ instagram                        │
              │ logo_url                         │
              │ warna_tema                       │
              │ is_active                        │
              │ saldo                            │
              │ total_penjualan                  │
              │ total_komisi                     │
              │ session_token                    │
              │ session_expires_at               │
              │ created_at                       │
              │ updated_at                       │
              └──────────┬───────────────────────┘
                         │
                         │ 1:N                    1:N
                         ├────────────────────────────────────┐
                         │                                    │
                         ▼                                    ▼
              ┌──────────────────┐                 ┌──────────────────────┐
              │  reseller_orders  │                 │ reseller_withdrawals │
              │──────────────────│                 │──────────────────────│
              │ id (PK)          │                 │ id (PK)              │
              │ reseller_id (FK) │                 │ reseller_id (FK)     │
              │ order_id (UNIQUE)│                 │ amount               │
              │ customer_name    │                 │ bank_name            │
              │ customer_email   │                 │ account_number       │
              │ customer_phone   │                 │ account_name         │
              │ total_amount     │                 │ status               │
              │ total_modal      │                 │ admin_notes          │
              │ komisi           │                 │ processed_at         │
              │ status           │                 │ created_at           │
              │ payment_type     │                 │ updated_at           │
              │ payment_url      │                 └──────────────────────┘
              │ midtrans_response│
              │ items_snapshot   │
              │ notes            │
              │ created_at       │
              │ updated_at       │
              └────────┬─────────┘
                       │
                       │ 1:N
                       ▼
              ┌────────────────────────┐
              │  reseller_order_items   │
              │────────────────────────│
              │ id (PK)                │
              │ order_id (FK)          │
              │ reseller_order_id (FK) │
              │ product_id             │
              │ product_name           │
              │ product_code           │
              │ item_id                │
              │ item_value             │
              │ harga_pusat            │
              │ harga_jual             │
              │ quantity               │
              │ created_at             │
              └────────────────────────┘
```

---

## Tabel 1: resellers

Tabel utama yang menyimpan data profil, kredensial, dan saldo reseller.

**Jumlah kolom:** 20

| No | Kolom | Tipe Data | Default | Nullable | Constraint | Deskripsi |
|----|-------|-----------|---------|----------|------------|-----------|
| 1 | `id` | `UUID` | `gen_random_uuid()` | NOT NULL | PRIMARY KEY | ID unik reseller |
| 2 | `nama_toko` | `VARCHAR(255)` | - | NOT NULL | - | Nama toko reseller |
| 3 | `slug` | `VARCHAR(100)` | - | NOT NULL | UNIQUE | Slug URL toko (huruf kecil, tanpa spasi, URL-friendly) |
| 4 | `email` | `VARCHAR(255)` | - | NOT NULL | UNIQUE | Email login reseller |
| 5 | `password_hash` | `TEXT` | - | NOT NULL | - | Hash bcrypt dari password |
| 6 | `deskripsi` | `TEXT` | `NULL` | YES | - | Deskripsi/bio toko |
| 7 | `alamat` | `TEXT` | `NULL` | YES | - | Alamat fisik toko (opsional) |
| 8 | `phone` | `VARCHAR(20)` | `NULL` | YES | - | Nomor telepon |
| 9 | `whatsapp` | `VARCHAR(20)` | `NULL` | YES | - | Nomor WhatsApp untuk kontak pelanggan |
| 10 | `instagram` | `VARCHAR(100)` | `NULL` | YES | - | Username Instagram (tanpa @) |
| 11 | `logo_url` | `TEXT` | `NULL` | YES | - | URL logo toko |
| 12 | `warna_tema` | `VARCHAR(7)` | `'#3B82F6'` | YES | - | Warna tema toko (hex color, contoh: #3B82F6) |
| 13 | `is_active` | `BOOLEAN` | `true` | NOT NULL | - | Status aktif reseller |
| 14 | `saldo` | `DECIMAL(12,2)` | `0` | NOT NULL | CHECK >= 0 | Saldo yang bisa ditarik |
| 15 | `total_penjualan` | `DECIMAL(15,2)` | `0` | NOT NULL | - | Akumulasi total penjualan |
| 16 | `total_komisi` | `DECIMAL(15,2)` | `0` | NOT NULL | - | Akumulasi total komisi |
| 17 | `session_token` | `TEXT` | `NULL` | YES | - | Token sesi aktif (HMAC-SHA256) |
| 18 | `session_expires_at` | `TIMESTAMPTZ` | `NULL` | YES | - | Waktu kedaluwarsa sesi |
| 19 | `created_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | - | Waktu pembuatan akun |
| 20 | `updated_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | - | Waktu terakhir diperbarui |

---

## Tabel 2: reseller_products

Tabel untuk mengatur visibilitas produk per reseller. Jika tidak ada record untuk suatu produk, maka produk tersebut **ditampilkan secara default** (visible).

**Jumlah kolom:** 5

| No | Kolom | Tipe Data | Default | Nullable | Constraint | Deskripsi |
|----|-------|-----------|---------|----------|------------|-----------|
| 1 | `id` | `UUID` | `gen_random_uuid()` | NOT NULL | PRIMARY KEY | ID unik record |
| 2 | `reseller_id` | `UUID` | - | NOT NULL | FOREIGN KEY → resellers(id) ON DELETE CASCADE | ID reseller |
| 3 | `product_id` | `UUID` | - | NOT NULL | FOREIGN KEY → products(id) ON DELETE CASCADE | ID produk dari tabel products |
| 4 | `is_visible` | `BOOLEAN` | `true` | NOT NULL | - | Apakah produk ditampilkan di toko reseller |
| 5 | `created_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | - | Waktu pembuatan record |

**Constraint tambahan:**
- `UNIQUE(reseller_id, product_id)` — Satu reseller hanya bisa memiliki satu record per produk

---

## Tabel 3: reseller_prices

Tabel untuk menyimpan harga jual custom per produk per reseller, termasuk tipe dan nilai margin.

**Jumlah kolom:** 8

| No | Kolom | Tipe Data | Default | Nullable | Constraint | Deskripsi |
|----|-------|-----------|---------|----------|------------|-----------|
| 1 | `id` | `UUID` | `gen_random_uuid()` | NOT NULL | PRIMARY KEY | ID unik record |
| 2 | `reseller_id` | `UUID` | - | NOT NULL | FOREIGN KEY → resellers(id) ON DELETE CASCADE | ID reseller |
| 3 | `product_id` | `UUID` | - | NOT NULL | FOREIGN KEY → products(id) ON DELETE CASCADE | ID produk |
| 4 | `margin_type` | `VARCHAR(10)` | `'fixed'` | NOT NULL | CHECK IN ('fixed', 'percent') | Tipe margin: 'fixed' (nominal) atau 'percent' (persentase) |
| 5 | `margin_value` | `DECIMAL(10,2)` | `0` | NOT NULL | CHECK >= 0 | Nilai margin (nominal dalam Rupiah atau persentase) |
| 6 | `harga_jual` | `DECIMAL(12,2)` | `0` | NOT NULL | CHECK >= 0 | Harga jual final yang sudah dihitung (pre-calculated) |
| 7 | `created_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | - | Waktu pembuatan record |
| 8 | `updated_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | - | Waktu terakhir diperbarui |

**Constraint tambahan:**
- `UNIQUE(reseller_id, product_id)` — Satu reseller hanya bisa memiliki satu record harga per produk

**Catatan:** Kolom `harga_jual` adalah **pre-calculated** untuk performa. Nilainya dihitung saat reseller mengatur margin dan disimpan langsung, sehingga tidak perlu dihitung ulang setiap kali produk ditampilkan.

---

## Tabel 4: reseller_orders

Tabel utama untuk menyimpan pesanan yang masuk melalui toko reseller.

**Jumlah kolom:** 17

| No | Kolom | Tipe Data | Default | Nullable | Constraint | Deskripsi |
|----|-------|-----------|---------|----------|------------|-----------|
| 1 | `id` | `UUID` | `gen_random_uuid()` | NOT NULL | PRIMARY KEY | ID unik internal |
| 2 | `reseller_id` | `UUID` | - | NOT NULL | FOREIGN KEY → resellers(id) | ID reseller pemilik toko |
| 3 | `order_id` | `VARCHAR(50)` | - | NOT NULL | UNIQUE | ID order yang ditampilkan (format: RS-{base36}{random}) |
| 4 | `customer_name` | `VARCHAR(255)` | - | NOT NULL | - | Nama pelanggan |
| 5 | `customer_email` | `VARCHAR(255)` | - | NOT NULL | - | Email pelanggan |
| 6 | `customer_phone` | `VARCHAR(20)` | `NULL` | YES | - | Nomor telepon/WhatsApp pelanggan |
| 7 | `total_amount` | `DECIMAL(12,2)` | - | NOT NULL | CHECK > 0 | Total harga jual (yang dibayar pelanggan) |
| 8 | `total_modal` | `DECIMAL(12,2)` | - | NOT NULL | CHECK >= 0 | Total harga pusat/modal |
| 9 | `komisi` | `DECIMAL(12,2)` | - | NOT NULL | CHECK >= 0 | Komisi reseller (total_amount - total_modal) |
| 10 | `status` | `VARCHAR(20)` | `'pending'` | NOT NULL | CHECK IN ('pending', 'completed', 'cancelled', 'expired') | Status pesanan |
| 11 | `payment_type` | `VARCHAR(50)` | `'qris'` | YES | - | Tipe pembayaran (selalu 'qris') |
| 12 | `payment_url` | `TEXT` | `NULL` | YES | - | URL gambar QRIS dari Midtrans |
| 13 | `midtrans_response` | `JSONB` | `NULL` | YES | - | Response lengkap dari Midtrans API |
| 14 | `items_snapshot` | `JSONB` | `NULL` | YES | - | Snapshot item saat checkout (untuk referensi) |
| 15 | `notes` | `TEXT` | `NULL` | YES | - | Catatan tambahan |
| 16 | `created_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | - | Waktu pembuatan order |
| 17 | `updated_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | - | Waktu terakhir diperbarui |

---

## Tabel 5: reseller_order_items

Tabel detail item per pesanan. Diisi setelah pembayaran berhasil (status = 'completed').

**Jumlah kolom:** 12

| No | Kolom | Tipe Data | Default | Nullable | Constraint | Deskripsi |
|----|-------|-----------|---------|----------|------------|-----------|
| 1 | `id` | `UUID` | `gen_random_uuid()` | NOT NULL | PRIMARY KEY | ID unik record |
| 2 | `order_id` | `VARCHAR(50)` | - | NOT NULL | FOREIGN KEY → reseller_orders(order_id) | ID order (referensi ke reseller_orders) |
| 3 | `reseller_order_id` | `UUID` | - | NOT NULL | FOREIGN KEY → reseller_orders(id) | ID internal order (UUID) |
| 4 | `product_id` | `UUID` | - | NOT NULL | - | ID produk |
| 5 | `product_name` | `VARCHAR(255)` | - | NOT NULL | - | Nama produk (snapshot) |
| 6 | `product_code` | `VARCHAR(100)` | `NULL` | YES | - | Kode produk (snapshot) |
| 7 | `item_id` | `UUID` | `NULL` | YES | - | ID item yang diberikan (dari tabel items) |
| 8 | `item_value` | `TEXT` | `NULL` | YES | - | Nilai/konten item (akun, voucher, dll) |
| 9 | `harga_pusat` | `DECIMAL(12,2)` | - | NOT NULL | - | Harga pusat/modal per item |
| 10 | `harga_jual` | `DECIMAL(12,2)` | - | NOT NULL | - | Harga jual per item (harga reseller) |
| 11 | `quantity` | `INTEGER` | `1` | NOT NULL | CHECK > 0 | Jumlah item |
| 12 | `created_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | - | Waktu pembuatan record |

---

## Tabel 6: reseller_withdrawals

Tabel untuk menyimpan riwayat penarikan saldo reseller.

**Jumlah kolom:** 11

| No | Kolom | Tipe Data | Default | Nullable | Constraint | Deskripsi |
|----|-------|-----------|---------|----------|------------|-----------|
| 1 | `id` | `UUID` | `gen_random_uuid()` | NOT NULL | PRIMARY KEY | ID unik record |
| 2 | `reseller_id` | `UUID` | - | NOT NULL | FOREIGN KEY → resellers(id) ON DELETE CASCADE | ID reseller |
| 3 | `amount` | `DECIMAL(12,2)` | - | NOT NULL | CHECK > 0 | Jumlah penarikan (dalam Rupiah) |
| 4 | `bank_name` | `VARCHAR(50)` | - | NOT NULL | - | Nama bank/e-wallet tujuan |
| 5 | `account_number` | `VARCHAR(50)` | - | NOT NULL | - | Nomor rekening/akun tujuan |
| 6 | `account_name` | `VARCHAR(255)` | - | NOT NULL | - | Nama pemilik rekening/akun |
| 7 | `status` | `VARCHAR(20)` | `'pending'` | NOT NULL | CHECK IN ('pending', 'approved', 'completed', 'rejected') | Status penarikan |
| 8 | `admin_notes` | `TEXT` | `NULL` | YES | - | Catatan dari admin (alasan penolakan, dll) |
| 9 | `processed_at` | `TIMESTAMPTZ` | `NULL` | YES | - | Waktu diproses oleh admin |
| 10 | `created_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | - | Waktu pengajuan penarikan |
| 11 | `updated_at` | `TIMESTAMPTZ` | `NOW()` | NOT NULL | - | Waktu terakhir diperbarui |

---

## Database Function

### `calculate_reseller_price(base_price, margin_type, margin_value)`

Fungsi untuk menghitung harga jual reseller berdasarkan harga pusat dan margin.

**Parameter:**

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `base_price` | `DECIMAL` | Harga pusat/dasar produk |
| `margin_type` | `VARCHAR` | Tipe margin: `'fixed'` atau `'percent'` |
| `margin_value` | `DECIMAL` | Nilai margin |

**Return:** `DECIMAL` — Harga jual final

**Logika:**

```sql
CREATE OR REPLACE FUNCTION calculate_reseller_price(
  base_price DECIMAL,
  margin_type VARCHAR,
  margin_value DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  IF margin_type = 'percent' THEN
    -- Harga jual = harga pusat + (harga pusat * margin / 100)
    RETURN base_price + (base_price * margin_value / 100);
  ELSE
    -- Harga jual = harga pusat + margin (nominal)
    RETURN base_price + margin_value;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Contoh penggunaan:**

```sql
-- Fixed margin: 15000 + 5000 = 20000
SELECT calculate_reseller_price(15000, 'fixed', 5000);
-- Result: 20000.00

-- Percent margin: 15000 + (15000 * 10 / 100) = 16500
SELECT calculate_reseller_price(15000, 'percent', 10);
-- Result: 16500.00

-- Percent margin: 50000 + (50000 * 20 / 100) = 60000
SELECT calculate_reseller_price(50000, 'percent', 20);
-- Result: 60000.00
```

---

## Database Triggers

### Trigger 1: `trigger_update_reseller_saldo`

**Tabel:** `reseller_orders`
**Event:** `AFTER INSERT OR UPDATE`
**Kondisi:** Ketika kolom `status` berubah menjadi `'completed'`

**Fungsi yang dijalankan:** `update_reseller_saldo()`

**Logika:**

```sql
CREATE OR REPLACE FUNCTION update_reseller_saldo()
RETURNS TRIGGER AS $$
BEGIN
  -- Hanya proses jika status berubah menjadi 'completed'
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE resellers
    SET
      saldo = saldo + NEW.komisi,                    -- Tambah komisi ke saldo
      total_penjualan = total_penjualan + NEW.total_amount,  -- Tambah ke total penjualan
      total_komisi = total_komisi + NEW.komisi,       -- Tambah ke total komisi
      updated_at = NOW()
    WHERE id = NEW.reseller_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reseller_saldo
  AFTER INSERT OR UPDATE ON reseller_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_reseller_saldo();
```

**Yang terjadi saat order selesai:**

| Kolom di `resellers` | Perubahan |
|----------------------|-----------|
| `saldo` | `saldo + komisi` (dari order) |
| `total_penjualan` | `total_penjualan + total_amount` (dari order) |
| `total_komisi` | `total_komisi + komisi` (dari order) |
| `updated_at` | `NOW()` |

**Contoh:**
- Order dengan `total_amount = 100000`, `total_modal = 80000`, `komisi = 20000`
- Sebelum: `saldo = 50000`, `total_penjualan = 500000`, `total_komisi = 100000`
- Sesudah: `saldo = 70000`, `total_penjualan = 600000`, `total_komisi = 120000`

---

### Trigger 2: `trigger_process_withdrawal`

**Tabel:** `reseller_withdrawals`
**Event:** `AFTER UPDATE`
**Kondisi:** Ketika kolom `status` berubah menjadi `'completed'`

**Fungsi yang dijalankan:** `process_withdrawal()`

**Logika:**

```sql
CREATE OR REPLACE FUNCTION process_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
  -- Hanya proses jika status berubah menjadi 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE resellers
    SET
      saldo = saldo - NEW.amount,   -- Kurangi saldo sebesar jumlah penarikan
      updated_at = NOW()
    WHERE id = NEW.reseller_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_process_withdrawal
  AFTER UPDATE ON reseller_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION process_withdrawal();
```

**Yang terjadi saat penarikan selesai:**

| Kolom di `resellers` | Perubahan |
|----------------------|-----------|
| `saldo` | `saldo - amount` (dari withdrawal) |
| `updated_at` | `NOW()` |

**Contoh:**
- Withdrawal dengan `amount = 50000`
- Sebelum: `saldo = 200000`
- Sesudah: `saldo = 150000`

---

## Row Level Security (RLS)

Semua 6 tabel reseller memiliki **Row Level Security (RLS) enabled**. Kebijakan yang diterapkan:

### Policy: Service Role Full Access

```sql
-- Diterapkan ke semua 6 tabel reseller
CREATE POLICY "Service role has full access"
  ON [table_name]
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

| Tabel | RLS Enabled | Policy |
|-------|-------------|--------|
| `resellers` | ✅ Ya | `service_role` full access |
| `reseller_products` | ✅ Ya | `service_role` full access |
| `reseller_prices` | ✅ Ya | `service_role` full access |
| `reseller_orders` | ✅ Ya | `service_role` full access |
| `reseller_order_items` | ✅ Ya | `service_role` full access |
| `reseller_withdrawals` | ✅ Ya | `service_role` full access |

**Catatan:** Semua akses ke tabel reseller dilakukan melalui API routes (server-side) menggunakan `SUPABASE_SERVICE_ROLE_KEY`, sehingga RLS tidak menghalangi operasi normal. Akses langsung dari client-side dengan `anon key` akan **ditolak** oleh RLS.

---

## Indexes

### Tabel `resellers`

| Index | Kolom | Tipe | Deskripsi |
|-------|-------|------|-----------|
| PRIMARY KEY | `id` | B-tree | Primary key |
| UNIQUE | `slug` | B-tree | Pencarian toko berdasarkan slug |
| UNIQUE | `email` | B-tree | Login dan pencarian berdasarkan email |
| INDEX | `is_active` | B-tree | Filter reseller aktif |
| INDEX | `session_token` | B-tree | Validasi session token |

### Tabel `reseller_products`

| Index | Kolom | Tipe | Deskripsi |
|-------|-------|------|-----------|
| PRIMARY KEY | `id` | B-tree | Primary key |
| UNIQUE | `(reseller_id, product_id)` | B-tree (composite) | Satu record per reseller per produk |
| INDEX | `reseller_id` | B-tree | Filter produk per reseller |

### Tabel `reseller_prices`

| Index | Kolom | Tipe | Deskripsi |
|-------|-------|------|-----------|
| PRIMARY KEY | `id` | B-tree | Primary key |
| UNIQUE | `(reseller_id, product_id)` | B-tree (composite) | Satu record harga per reseller per produk |
| INDEX | `reseller_id` | B-tree | Filter harga per reseller |

### Tabel `reseller_orders`

| Index | Kolom | Tipe | Deskripsi |
|-------|-------|------|-----------|
| PRIMARY KEY | `id` | B-tree | Primary key |
| UNIQUE | `order_id` | B-tree | Pencarian order berdasarkan order_id |
| INDEX | `reseller_id` | B-tree | Filter order per reseller |
| INDEX | `status` | B-tree | Filter berdasarkan status |
| INDEX | `created_at` | B-tree | Sorting berdasarkan waktu |
| INDEX | `customer_email` | B-tree | Pencarian berdasarkan email pelanggan |

### Tabel `reseller_order_items`

| Index | Kolom | Tipe | Deskripsi |
|-------|-------|------|-----------|
| PRIMARY KEY | `id` | B-tree | Primary key |
| INDEX | `order_id` | B-tree | Join dengan reseller_orders |
| INDEX | `reseller_order_id` | B-tree | Join dengan reseller_orders (UUID) |

### Tabel `reseller_withdrawals`

| Index | Kolom | Tipe | Deskripsi |
|-------|-------|------|-----------|
| PRIMARY KEY | `id` | B-tree | Primary key |
| INDEX | `reseller_id` | B-tree | Filter penarikan per reseller |
| INDEX | `status` | B-tree | Filter berdasarkan status |
| INDEX | `created_at` | B-tree | Sorting berdasarkan waktu |

---

*Lanjut ke: [DASHBOARD-GUIDE.md](./DASHBOARD-GUIDE.md) — Panduan lengkap dashboard reseller*
