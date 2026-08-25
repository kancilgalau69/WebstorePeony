# Sistem Harga & Margin Reseller

Dokumen ini menjelaskan secara detail bagaimana sistem harga dan margin bekerja di PBS Reseller System.

---

## Daftar Isi

- [Konsep Dasar](#konsep-dasar)
- [Dua Tipe Margin](#dua-tipe-margin)
- [Harga Per Produk](#harga-per-produk)
- [Harga Massal (Bulk Pricing)](#harga-massal-bulk-pricing)
- [Prioritas Resolusi Harga](#prioritas-resolusi-harga)
- [Perhitungan Komisi](#perhitungan-komisi)
- [Contoh Perhitungan Lengkap](#contoh-perhitungan-lengkap)
- [Penyimpanan di Database](#penyimpanan-di-database)
- [Database Function](#database-function)
- [FAQ Harga](#faq-harga)

---

## Konsep Dasar

Sistem harga reseller PBS menggunakan konsep **margin** di atas harga pusat:

```
Harga Jual = Harga Pusat + Margin
```

Dimana:
- **Harga Pusat** = Harga dasar produk yang ditentukan oleh admin PBS (`harga_web` atau `harga_bot`)
- **Margin** = Keuntungan yang ditambahkan oleh reseller
- **Harga Jual** = Harga yang dibayar oleh pelanggan di toko reseller

### Ilustrasi

```
+------------------+     +------------------+     +------------------+
|   ADMIN PBS      |     |   RESELLER       |     |   PELANGGAN      |
|                  |     |                  |     |                  |
|  Harga Pusat:    |     |  Margin:         |     |  Harga Jual:     |
|  Rp 15.000       | --> |  + Rp 5.000      | --> |  Rp 20.000       |
|                  |     |  (fixed)         |     |  (yang dibayar)  |
+------------------+     +------------------+     +------------------+
```

**Penting:** Reseller **tidak bisa** mengubah harga pusat. Harga pusat sepenuhnya dikelola oleh admin PBS melalui Admin Dashboard.

---

## Dua Tipe Margin

PBS Reseller System mendukung dua tipe margin:

### 1. Fixed (Nominal Tetap)

Margin berupa **nominal Rupiah tetap** yang ditambahkan ke harga pusat.

**Rumus:**
```
harga_jual = harga_pusat + margin_value
```

**Contoh:**

| Harga Pusat | Margin Value | Harga Jual | Perhitungan |
|-------------|-------------|------------|-------------|
| Rp 15.000 | Rp 5.000 | Rp 20.000 | 15000 + 5000 = 20000 |
| Rp 25.000 | Rp 5.000 | Rp 30.000 | 25000 + 5000 = 30000 |
| Rp 50.000 | Rp 5.000 | Rp 55.000 | 50000 + 5000 = 55000 |
| Rp 100.000 | Rp 10.000 | Rp 110.000 | 100000 + 10000 = 110000 |

**Kelebihan Fixed:**
- Keuntungan per item **konsisten** (selalu sama)
- Mudah diprediksi
- Cocok jika ingin keuntungan seragam per produk

**Kekurangan Fixed:**
- Persentase keuntungan **bervariasi** (produk murah = % tinggi, produk mahal = % rendah)

### 2. Percent (Persentase)

Margin berupa **persentase** dari harga pusat.

**Rumus:**
```
harga_jual = harga_pusat + (harga_pusat * margin_value / 100)
```

**Contoh:**

| Harga Pusat | Margin Value | Harga Jual | Perhitungan |
|-------------|-------------|------------|-------------|
| Rp 15.000 | 10% | Rp 16.500 | 15000 + (15000 * 10/100) = 16500 |
| Rp 25.000 | 10% | Rp 27.500 | 25000 + (25000 * 10/100) = 27500 |
| Rp 50.000 | 10% | Rp 55.000 | 50000 + (50000 * 10/100) = 55000 |
| Rp 100.000 | 10% | Rp 110.000 | 100000 + (100000 * 10/100) = 110000 |

**Kelebihan Percent:**
- Persentase keuntungan **konsisten** di semua produk
- Proporsional - produk mahal menghasilkan keuntungan lebih besar
- Cocok untuk katalog dengan rentang harga yang luas

**Kekurangan Percent:**
- Nominal keuntungan **bervariasi** per produk
- Bisa menghasilkan harga "aneh" (contoh: Rp 16.500)

### Perbandingan Kedua Tipe

| Aspek | Fixed | Percent |
|-------|-------|---------|
| Keuntungan per item | Tetap (Rp) | Bervariasi (Rp) |
| Persentase keuntungan | Bervariasi (%) | Tetap (%) |
| Harga jual | Mudah dihitung | Bisa "aneh" |
| Cocok untuk | Keuntungan seragam | Keuntungan proporsional |

---

## Harga Per Produk

Setiap produk dapat memiliki **margin yang berbeda**. Reseller bisa mengatur tipe dan nilai margin secara individual per produk melalui halaman **Harga Jual** di dashboard.

### Contoh Konfigurasi Per Produk

| Produk | Harga Pusat | Tipe Margin | Nilai Margin | Harga Jual |
|--------|-------------|-------------|-------------|------------|
| Netflix Premium 1 Bulan | Rp 15.000 | Fixed | Rp 5.000 | Rp 20.000 |
| Netflix Premium 3 Bulan | Rp 40.000 | Percent | 15% | Rp 46.000 |
| Spotify Premium 1 Bulan | Rp 10.000 | Fixed | Rp 3.000 | Rp 13.000 |
| Disney+ Hotstar 1 Bulan | Rp 25.000 | Percent | 20% | Rp 30.000 |
| YouTube Premium 1 Bulan | Rp 20.000 | Fixed | Rp 7.000 | Rp 27.000 |

### Cara Mengatur di Dashboard

1. Buka Dashboard Reseller -> Harga Jual
2. Untuk setiap produk:
   - Pilih **Tipe Margin** (Fixed atau Percent) dari dropdown
   - Masukkan **Nilai Margin** di input field
   - Lihat **Harga Jual** yang otomatis dihitung (live preview)
   - Klik **Simpan** untuk menyimpan perubahan

---

## Harga Massal (Bulk Pricing)

Reseller juga bisa mengatur margin untuk **semua produk sekaligus** menggunakan fitur bulk pricing.

### Cara Menggunakan

1. Buka Dashboard Reseller -> Harga Jual
2. Di bagian atas, temukan form "Atur Margin Semua Produk"
3. Pilih **Tipe Margin** (Fixed atau Percent)
4. Masukkan **Nilai Margin**
5. Klik **Terapkan ke Semua**

### Contoh Bulk Pricing: Fixed Rp 5.000

| Produk | Harga Pusat | Margin | Harga Jual |
|--------|-------------|--------|------------|
| Netflix Premium | Rp 15.000 | + Rp 5.000 | Rp 20.000 |
| Spotify Premium | Rp 10.000 | + Rp 5.000 | Rp 15.000 |
| Disney+ Hotstar | Rp 25.000 | + Rp 5.000 | Rp 30.000 |
| YouTube Premium | Rp 20.000 | + Rp 5.000 | Rp 25.000 |

### Contoh Bulk Pricing: Percent 10%

| Produk | Harga Pusat | Margin | Harga Jual |
|--------|-------------|--------|------------|
| Netflix Premium | Rp 15.000 | + 10% (Rp 1.500) | Rp 16.500 |
| Spotify Premium | Rp 10.000 | + 10% (Rp 1.000) | Rp 11.000 |
| Disney+ Hotstar | Rp 25.000 | + 10% (Rp 2.500) | Rp 27.500 |
| YouTube Premium | Rp 20.000 | + 10% (Rp 2.000) | Rp 22.000 |

### Catatan Penting

- Bulk pricing **menimpa** semua margin yang sudah diatur sebelumnya
- Setelah bulk pricing, Anda masih bisa mengubah margin per produk secara individual
- Bulk pricing menggunakan API: `PUT /api/dashboard/pricing` dengan `{ bulk: true, margin_type, margin_value }`

---

## Prioritas Resolusi Harga

Saat menampilkan harga di toko reseller, sistem menggunakan prioritas berikut:

### Harga Pusat (Base Price)

```
Prioritas:
1. products.harga_web    <-- Digunakan jika ada dan > 0
2. products.harga_bot    <-- Fallback jika harga_web null atau 0
3. 0                     <-- Default jika keduanya null atau 0
```

### Harga Jual (Selling Price)

```
Prioritas:
1. reseller_prices.harga_jual  <-- Jika reseller sudah mengatur margin
2. products.harga_web          <-- Fallback: harga pusat tanpa margin
3. products.harga_bot          <-- Fallback kedua
4. 0                           <-- Default
```

### Diagram Resolusi

```
Apakah ada record di reseller_prices untuk produk ini?
|
+-- YA --> Gunakan reseller_prices.harga_jual
|
+-- TIDAK --> Apakah products.harga_web > 0?
              |
              +-- YA --> Gunakan products.harga_web (tanpa margin)
              |
              +-- TIDAK --> Apakah products.harga_bot > 0?
                            |
                            +-- YA --> Gunakan products.harga_bot
                            |
                            +-- TIDAK --> Gunakan 0
```

### Implikasi

- Jika reseller **belum mengatur margin** untuk suatu produk, harga yang ditampilkan di toko adalah **harga pusat** (tanpa keuntungan)
- Reseller disarankan untuk mengatur margin semua produk sebelum membagikan link toko
- Produk tanpa margin tetap bisa dijual, tapi komisi reseller = Rp 0

---

## Perhitungan Komisi

### Rumus Komisi per Order

```
komisi = total_amount - total_modal
```

Dimana:
- `total_amount` = SUM(harga_jual x quantity) untuk semua item dalam order
- `total_modal` = SUM(harga_pusat x quantity) untuk semua item dalam order

### Kapan Komisi Dihitung?

1. **Saat checkout** - Komisi dihitung dan disimpan di kolom `komisi` tabel `reseller_orders`
2. **Saat order completed** - Trigger database otomatis menambahkan komisi ke saldo reseller

### Alur Komisi ke Saldo

```
Order dibuat (status: pending)
  -> komisi dihitung dan disimpan di reseller_orders.komisi
  -> saldo belum berubah

Pembayaran berhasil (status: completed)
  -> trigger_update_reseller_saldo berjalan
  -> saldo += komisi
  -> total_penjualan += total_amount
  -> total_komisi += komisi

Pembayaran gagal (status: cancelled/expired)
  -> saldo TIDAK berubah
  -> komisi TIDAK ditambahkan
```

---

## Contoh Perhitungan Lengkap

### Skenario: Order dengan 3 Produk Berbeda

**Konfigurasi margin reseller:**

| Produk | Harga Pusat | Tipe Margin | Nilai Margin | Harga Jual |
|--------|-------------|-------------|-------------|------------|
| Netflix Premium 1 Bulan | Rp 15.000 | Fixed | Rp 5.000 | Rp 20.000 |
| Spotify Premium 1 Bulan | Rp 10.000 | Percent | 20% | Rp 12.000 |
| Disney+ Hotstar 1 Bulan | Rp 25.000 | Fixed | Rp 8.000 | Rp 33.000 |

**Pelanggan memesan:**

| Produk | Qty | Harga Pusat | Harga Jual | Subtotal Pusat | Subtotal Jual |
|--------|-----|-------------|------------|----------------|---------------|
| Netflix Premium | 2 | Rp 15.000 | Rp 20.000 | Rp 30.000 | Rp 40.000 |
| Spotify Premium | 1 | Rp 10.000 | Rp 12.000 | Rp 10.000 | Rp 12.000 |
| Disney+ Hotstar | 3 | Rp 25.000 | Rp 33.000 | Rp 75.000 | Rp 99.000 |
| **Total** | **6** | | | **Rp 115.000** | **Rp 151.000** |

**Hasil:**

```
total_amount = Rp 151.000  (yang dibayar pelanggan)
total_modal  = Rp 115.000  (harga pusat)
komisi       = Rp 151.000 - Rp 115.000 = Rp 36.000  (keuntungan reseller)
```

**Breakdown komisi per produk:**

| Produk | Qty | Komisi per Item | Total Komisi |
|--------|-----|-----------------|-------------|
| Netflix Premium | 2 | Rp 5.000 | Rp 10.000 |
| Spotify Premium | 1 | Rp 2.000 | Rp 2.000 |
| Disney+ Hotstar | 3 | Rp 8.000 | Rp 24.000 |
| **Total** | | | **Rp 36.000** |

### Skenario: Produk Tanpa Margin

Jika reseller belum mengatur margin untuk suatu produk:

| Produk | Harga Pusat | Margin | Harga Jual | Komisi |
|--------|-------------|--------|------------|--------|
| Produk A | Rp 15.000 | (belum diatur) | Rp 15.000 | Rp 0 |
| Produk B | Rp 25.000 | Fixed Rp 5.000 | Rp 30.000 | Rp 5.000 |

Produk A tetap bisa dijual, tapi reseller tidak mendapat komisi dari produk tersebut.

---

## Penyimpanan di Database

### Tabel `reseller_prices`

Harga jual disimpan secara **pre-calculated** di tabel `reseller_prices` untuk optimasi performa:

```sql
-- Contoh data di reseller_prices
SELECT * FROM reseller_prices WHERE reseller_id = 'uuid-reseller';

| id   | reseller_id | product_id | margin_type | margin_value | harga_jual | created_at | updated_at |
|------|-------------|------------|-------------|-------------|------------|------------|------------|
| uuid | uuid-res    | uuid-prod1 | fixed       | 5000.00     | 20000.00   | 2025-01-01 | 2025-01-01 |
| uuid | uuid-res    | uuid-prod2 | percent     | 10.00       | 16500.00   | 2025-01-01 | 2025-01-15 |
| uuid | uuid-res    | uuid-prod3 | fixed       | 8000.00     | 33000.00   | 2025-01-01 | 2025-01-01 |
```

### Mengapa Pre-Calculated?

Kolom `harga_jual` menyimpan harga yang **sudah dihitung** (bukan dihitung on-the-fly) karena:

1. **Performa**: Tidak perlu menghitung margin setiap kali produk ditampilkan
2. **Konsistensi**: Harga yang ditampilkan di toko selalu sama dengan yang disimpan
3. **Audit**: Mudah melacak harga jual yang berlaku pada saat tertentu

### Kapan `harga_jual` Dihitung Ulang?

`harga_jual` dihitung ulang saat:
1. Reseller mengubah margin per produk (PUT `/api/dashboard/pricing`)
2. Reseller menerapkan bulk pricing (PUT `/api/dashboard/pricing` dengan `bulk: true`)

**Catatan:** Jika admin mengubah `harga_web` atau `harga_bot` di tabel `products`, `harga_jual` di `reseller_prices` **TIDAK otomatis berubah**. Reseller perlu mengatur ulang margin agar harga jual diperbarui.

---

## Database Function

### `calculate_reseller_price(base_price, margin_type, margin_value)`

Fungsi database yang digunakan untuk menghitung harga jual:

```sql
CREATE OR REPLACE FUNCTION calculate_reseller_price(
  base_price DECIMAL,
  margin_type VARCHAR,
  margin_value DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  IF margin_type = 'percent' THEN
    RETURN base_price + (base_price * margin_value / 100);
  ELSE
    RETURN base_price + margin_value;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Penggunaan di API:**

```sql
-- Saat reseller mengatur margin
UPDATE reseller_prices
SET
  margin_type = 'fixed',
  margin_value = 5000,
  harga_jual = calculate_reseller_price(15000, 'fixed', 5000),
  updated_at = NOW()
WHERE reseller_id = 'uuid' AND product_id = 'uuid';
```

---

## FAQ Harga

### Q: Apakah reseller bisa menjual di bawah harga pusat?

**A:** Tidak. Margin value harus >= 0, sehingga harga jual selalu >= harga pusat. Margin minimum adalah Rp 0 (fixed) atau 0% (percent).

### Q: Apa yang terjadi jika admin mengubah harga pusat?

**A:** Harga jual di `reseller_prices` **tidak otomatis berubah**. Reseller perlu mengatur ulang margin untuk memperbarui harga jual. Namun, saat checkout, sistem akan menggunakan harga pusat terbaru untuk menghitung `total_modal` dan `komisi`.

### Q: Bisakah reseller mengatur margin Rp 0?

**A:** Ya. Dengan margin Rp 0, harga jual = harga pusat, dan komisi reseller = Rp 0. Ini berguna jika reseller ingin menjual tanpa keuntungan (misalnya untuk promosi).

### Q: Bagaimana jika produk baru ditambahkan oleh admin?

**A:** Produk baru otomatis muncul di toko reseller (default visible) dengan harga pusat (tanpa margin). Reseller perlu mengatur margin untuk produk baru tersebut melalui dashboard.

### Q: Apakah harga jual bisa berbeda antar reseller?

**A:** Ya. Setiap reseller memiliki konfigurasi margin sendiri di tabel `reseller_prices`. Dua reseller bisa menjual produk yang sama dengan harga berbeda.

### Q: Bagaimana pembulatan harga untuk margin percent?

**A:** Harga disimpan sebagai `DECIMAL(12,2)` sehingga mendukung 2 angka di belakang koma. Contoh: 15000 * 7% = 16050.00. Tidak ada pembulatan khusus.

---

*Lanjut ke: [WITHDRAWAL-SYSTEM.md](./WITHDRAWAL-SYSTEM.md) - Sistem saldo dan penarikan*
