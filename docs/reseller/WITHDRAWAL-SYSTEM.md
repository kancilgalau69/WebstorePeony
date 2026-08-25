# Sistem Saldo & Penarikan (Withdraw)

Dokumen ini menjelaskan secara detail bagaimana sistem saldo dan penarikan dana bekerja di PBS Reseller System.

---

## Daftar Isi

- [Konsep Saldo](#konsep-saldo)
- [Bagaimana Saldo Bertambah](#bagaimana-saldo-bertambah)
- [Alur Penarikan (Withdrawal)](#alur-penarikan-withdrawal)
- [Validasi Penarikan](#validasi-penarikan)
- [Status Penarikan](#status-penarikan)
- [Bank dan E-Wallet yang Didukung](#bank-dan-e-wallet-yang-didukung)
- [Catatan Admin (Admin Notes)](#catatan-admin-admin-notes)
- [Trigger Database](#trigger-database)
- [Contoh Skenario](#contoh-skenario)
- [FAQ Saldo dan Penarikan](#faq-saldo-dan-penarikan)

---

## Konsep Saldo

Saldo reseller adalah **akumulasi komisi** dari semua order yang berstatus `completed`. Saldo bertambah secara otomatis melalui database trigger setiap kali ada order yang berhasil.

### Kolom Terkait di Tabel `resellers`

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `saldo` | `DECIMAL(12,2)` | Saldo yang bisa ditarik saat ini |
| `total_penjualan` | `DECIMAL(15,2)` | Akumulasi total harga jual dari semua order completed |
| `total_komisi` | `DECIMAL(15,2)` | Akumulasi total komisi dari semua order completed |

### Hubungan Antar Kolom

```
saldo          = total_komisi - total_penarikan_completed
total_komisi   = SUM(komisi) dari semua order completed
total_penjualan = SUM(total_amount) dari semua order completed
```

### Perbedaan Saldo vs Total Komisi

| Aspek | Saldo | Total Komisi |
|-------|-------|-------------|
| **Deskripsi** | Saldo yang bisa ditarik saat ini | Total komisi sepanjang waktu |
| **Bertambah** | Saat order completed | Saat order completed |
| **Berkurang** | Saat withdrawal completed | Tidak pernah berkurang |
| **Contoh** | Rp 150.000 (sisa setelah penarikan) | Rp 500.000 (total komisi dari awal) |

---

## Bagaimana Saldo Bertambah

Saldo bertambah secara **otomatis** melalui database trigger `trigger_update_reseller_saldo` yang berjalan saat status order berubah menjadi `completed`.

### Alur Penambahan Saldo

```
1. Pelanggan melakukan pembayaran QRIS
2. Midtrans mengirim webhook (settlement)
3. Server mengubah status order menjadi 'completed'
4. Database trigger otomatis berjalan:
   - saldo += komisi
   - total_penjualan += total_amount
   - total_komisi += komisi
5. Saldo reseller bertambah tanpa aksi manual
```

### Contoh

Sebelum order:
```
saldo           = Rp 100.000
total_penjualan = Rp 1.000.000
total_komisi    = Rp 200.000
```

Order masuk: `total_amount = Rp 55.000`, `komisi = Rp 15.000`

Setelah order completed:
```
saldo           = Rp 100.000 + Rp 15.000 = Rp 115.000
total_penjualan = Rp 1.000.000 + Rp 55.000 = Rp 1.055.000
total_komisi    = Rp 200.000 + Rp 15.000 = Rp 215.000
```

### Catatan Penting

- Saldo **hanya bertambah** saat order berstatus `completed`
- Order dengan status `pending`, `cancelled`, atau `expired` **tidak menambah** saldo
- Proses ini sepenuhnya otomatis melalui database trigger
- Tidak ada aksi manual yang diperlukan dari reseller atau admin

---

## Alur Penarikan (Withdrawal)

### Langkah-langkah Penarikan

```
+------------------+     +------------------+     +------------------+
| 1. RESELLER      |     | 2. ADMIN         |     | 3. TRIGGER DB    |
|                  |     |                  |     |                  |
| Ajukan penarikan | --> | Review & proses  | --> | Kurangi saldo    |
| (amount, bank,   |     | (approve/reject) |     | otomatis         |
|  account info)   |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

### Detail Setiap Langkah

#### Langkah 1: Reseller Mengajukan Penarikan

1. Buka Dashboard Reseller -> Saldo & Komisi
2. Isi form penarikan:
   - **Jumlah Penarikan**: Minimum Rp 50.000
   - **Bank/E-Wallet**: Pilih dari dropdown
   - **Nomor Rekening**: Nomor rekening/akun tujuan
   - **Nama Pemilik**: Nama pemilik rekening/akun
3. Klik "Ajukan Penarikan"
4. Sistem memvalidasi dan membuat record di `reseller_withdrawals` dengan status `pending`

#### Langkah 2: Admin Memproses Penarikan

1. Admin melihat daftar penarikan pending di Admin Dashboard
2. Admin mereview detail penarikan (jumlah, bank, rekening)
3. Admin memilih salah satu aksi:
   - **Approve** -> Status berubah ke `approved` (menunggu transfer)
   - **Reject** -> Status berubah ke `rejected` (dengan catatan alasan)
4. Setelah transfer dilakukan:
   - **Complete** -> Status berubah ke `completed`
   - Trigger database otomatis mengurangi saldo

#### Langkah 3: Trigger Database Mengurangi Saldo

Saat status withdrawal berubah menjadi `completed`, trigger `trigger_process_withdrawal` otomatis:

```sql
UPDATE resellers
SET saldo = saldo - withdrawal_amount
WHERE id = reseller_id;
```

---

## Validasi Penarikan

Sebelum penarikan diproses, sistem melakukan beberapa validasi:

### Validasi di Sisi Server

| No | Validasi | Kondisi | Pesan Error |
|----|----------|---------|-------------|
| 1 | Jumlah minimum | `amount >= 50000` | "Minimum penarikan Rp 50.000" |
| 2 | Saldo cukup | `saldo >= amount` | "Saldo tidak mencukupi" |
| 3 | Saldo setelah pending | `(saldo - total_pending_wd) >= amount` | "Saldo tidak mencukupi setelah memperhitungkan penarikan pending" |
| 4 | Bank valid | Bank ada di daftar yang didukung | "Bank/e-wallet tidak valid" |
| 5 | Field lengkap | Semua field terisi | "Semua field harus diisi" |

### Penjelasan Validasi Saldo Setelah Pending

Validasi ini mencegah reseller mengajukan penarikan melebihi saldo yang tersedia setelah memperhitungkan penarikan yang masih dalam proses.

**Contoh:**

```
Saldo saat ini:       Rp 200.000
Pending withdrawal:   Rp 100.000 (sudah diajukan, belum diproses)
Saldo efektif:        Rp 200.000 - Rp 100.000 = Rp 100.000

Penarikan baru Rp 150.000?
  -> DITOLAK (Rp 100.000 < Rp 150.000)

Penarikan baru Rp 80.000?
  -> DITERIMA (Rp 100.000 >= Rp 80.000)
```

### Perhitungan Pending Withdrawal

```sql
-- Total penarikan yang masih pending atau approved
SELECT COALESCE(SUM(amount), 0) as total_pending
FROM reseller_withdrawals
WHERE reseller_id = 'uuid'
AND status IN ('pending', 'approved');
```

---

## Status Penarikan

### Daftar Status

| Status | Warna Badge | Deskripsi | Aksi Selanjutnya |
|--------|-------------|-----------|------------------|
| `pending` | Kuning | Menunggu review admin | Admin approve/reject |
| `approved` | Biru | Disetujui, menunggu transfer | Admin complete setelah transfer |
| `completed` | Hijau | Transfer selesai, saldo sudah berkurang | Final (tidak bisa diubah) |
| `rejected` | Merah | Ditolak oleh admin | Final (tidak bisa diubah) |

### Diagram Transisi Status

```
                   +----------+
                   |          |
            +----->| approved |------+
            |      |          |      |
            |      +----------+      |
            |                        v
+----------+|                  +----------+
|          |+                  |          |
| pending  |                   | completed|
|          |+                  |          |
+----------+|                  +----------+
            |
            |      +----------+
            |      |          |
            +----->| rejected |
                   |          |
                   +----------+
```

### Apa yang Terjadi di Setiap Transisi

| Transisi | Aksi |
|----------|------|
| `pending` -> `approved` | Admin menyetujui, menandai siap transfer |
| `approved` -> `completed` | Admin sudah transfer, trigger mengurangi saldo |
| `pending` -> `rejected` | Admin menolak dengan catatan alasan |

### Catatan Penting

- Status `completed` dan `rejected` bersifat **final** - tidak bisa diubah lagi
- Saldo **hanya berkurang** saat status berubah ke `completed`
- Status `rejected` **tidak mengurangi** saldo
- Penarikan `pending` dan `approved` dihitung sebagai "pending withdrawal" untuk validasi penarikan baru

---

## Bank dan E-Wallet yang Didukung

### Daftar Lengkap

| No | Kategori | Nama | Keterangan |
|----|----------|------|------------|
| 1 | Bank | **BCA** | Bank Central Asia |
| 2 | Bank | **BNI** | Bank Negara Indonesia |
| 3 | Bank | **BRI** | Bank Rakyat Indonesia |
| 4 | Bank | **Mandiri** | Bank Mandiri |
| 5 | Bank | **BSI** | Bank Syariah Indonesia |
| 6 | Bank | **CIMB Niaga** | CIMB Niaga |
| 7 | Bank | **Permata** | Bank Permata |
| 8 | E-Wallet | **DANA** | - |
| 9 | E-Wallet | **OVO** | - |
| 10 | E-Wallet | **GoPay** | - |
| 11 | E-Wallet | **ShopeePay** | - |

### Format Nomor Rekening/Akun

| Kategori | Format | Contoh |
|----------|--------|--------|
| Bank | Nomor rekening bank | `1234567890` |
| DANA | Nomor HP terdaftar | `081234567890` |
| OVO | Nomor HP terdaftar | `081234567890` |
| GoPay | Nomor HP terdaftar | `081234567890` |
| ShopeePay | Nomor HP terdaftar | `081234567890` |

---

## Catatan Admin (Admin Notes)

Kolom `admin_notes` pada tabel `reseller_withdrawals` digunakan oleh admin untuk memberikan catatan, terutama saat menolak penarikan.

### Penggunaan

| Skenario | Contoh Catatan |
|----------|----------------|
| Penolakan - rekening salah | "Nomor rekening tidak valid. Silakan periksa kembali." |
| Penolakan - nama tidak cocok | "Nama pemilik rekening tidak sesuai dengan data reseller." |
| Penolakan - saldo tidak cukup | "Saldo tidak mencukupi setelah verifikasi ulang." |
| Approval | "Disetujui, akan ditransfer dalam 1x24 jam." |
| Completed | "Transfer berhasil. Ref: TRF-20250115-001" |

### Tampilan di Dashboard Reseller

Catatan admin ditampilkan di tabel riwayat penarikan pada kolom "Catatan Admin". Ini membantu reseller memahami alasan penolakan atau status transfer.

---

## Trigger Database

### Trigger 1: `trigger_update_reseller_saldo`

**Tabel:** `reseller_orders`
**Event:** AFTER INSERT OR UPDATE
**Kondisi:** Status berubah menjadi `completed`

```sql
CREATE OR REPLACE FUNCTION update_reseller_saldo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE resellers
    SET
      saldo = saldo + NEW.komisi,
      total_penjualan = total_penjualan + NEW.total_amount,
      total_komisi = total_komisi + NEW.komisi,
      updated_at = NOW()
    WHERE id = NEW.reseller_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Efek:**

| Kolom | Perubahan |
|-------|-----------|
| `saldo` | + komisi |
| `total_penjualan` | + total_amount |
| `total_komisi` | + komisi |

### Trigger 2: `trigger_process_withdrawal`

**Tabel:** `reseller_withdrawals`
**Event:** AFTER UPDATE
**Kondisi:** Status berubah menjadi `completed`

```sql
CREATE OR REPLACE FUNCTION process_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE resellers
    SET
      saldo = saldo - NEW.amount,
      updated_at = NOW()
    WHERE id = NEW.reseller_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Efek:**

| Kolom | Perubahan |
|-------|-----------|
| `saldo` | - amount |

### Keamanan Trigger

- Trigger hanya berjalan **sekali** per transisi status (cek `OLD.status != 'completed'`)
- Mencegah duplikasi penambahan/pengurangan saldo jika row di-update multiple kali
- Kondisi `OLD IS NULL` pada trigger order menangani kasus INSERT langsung dengan status `completed`

---

## Contoh Skenario

### Skenario 1: Reseller Baru, Mulai dari Nol

```
Awal:
  saldo = Rp 0
  total_penjualan = Rp 0
  total_komisi = Rp 0

Order 1 completed (total: Rp 55.000, komisi: Rp 15.000):
  saldo = Rp 15.000
  total_penjualan = Rp 55.000
  total_komisi = Rp 15.000

Order 2 completed (total: Rp 100.000, komisi: Rp 25.000):
  saldo = Rp 40.000
  total_penjualan = Rp 155.000
  total_komisi = Rp 40.000

Order 3 cancelled (total: Rp 30.000, komisi: Rp 8.000):
  saldo = Rp 40.000 (TIDAK BERUBAH - order dibatalkan)
  total_penjualan = Rp 155.000
  total_komisi = Rp 40.000
```

### Skenario 2: Penarikan Saldo

```
Saldo awal: Rp 200.000

Penarikan 1: Rp 100.000 ke BCA (status: pending)
  saldo = Rp 200.000 (belum berubah)
  saldo efektif = Rp 200.000 - Rp 100.000 = Rp 100.000

Penarikan 1 disetujui (status: approved)
  saldo = Rp 200.000 (belum berubah)
  saldo efektif = Rp 200.000 - Rp 100.000 = Rp 100.000

Penarikan 1 selesai (status: completed)
  saldo = Rp 200.000 - Rp 100.000 = Rp 100.000 (BERKURANG)
  saldo efektif = Rp 100.000
```

### Skenario 3: Penarikan Ditolak

```
Saldo awal: Rp 200.000

Penarikan 1: Rp 150.000 ke DANA (status: pending)
  saldo = Rp 200.000
  saldo efektif = Rp 200.000 - Rp 150.000 = Rp 50.000

Admin menolak (status: rejected, notes: "Nomor HP tidak valid")
  saldo = Rp 200.000 (TIDAK BERUBAH - ditolak)
  saldo efektif = Rp 200.000 (pending sudah hilang)

Reseller bisa mengajukan penarikan baru dengan data yang benar.
```

### Skenario 4: Multiple Penarikan Bersamaan

```
Saldo awal: Rp 300.000

Penarikan 1: Rp 100.000 ke BCA (status: pending)
  saldo efektif = Rp 300.000 - Rp 100.000 = Rp 200.000

Penarikan 2: Rp 150.000 ke BNI (status: pending)
  saldo efektif = Rp 300.000 - Rp 100.000 - Rp 150.000 = Rp 50.000

Penarikan 3: Rp 100.000 ke DANA
  -> DITOLAK oleh sistem (Rp 50.000 < Rp 100.000)

Penarikan 3: Rp 50.000 ke DANA
  -> DITERIMA (Rp 50.000 >= Rp 50.000)
  saldo efektif = Rp 0
```

---

## FAQ Saldo dan Penarikan

### Q: Berapa minimum penarikan?

**A:** Minimum penarikan adalah **Rp 50.000** per transaksi.

### Q: Berapa lama proses penarikan?

**A:** Tergantung admin. Setelah diajukan, admin akan mereview dan memproses penarikan. Waktu proses bervariasi tergantung kebijakan admin PBS.

### Q: Apakah ada biaya penarikan?

**A:** Saat ini tidak ada biaya penarikan (fee = Rp 0). Jumlah yang diajukan = jumlah yang diterima.

### Q: Apakah saldo bisa minus?

**A:** Tidak. Kolom `saldo` memiliki constraint `CHECK >= 0`. Sistem juga memvalidasi saldo sebelum membuat penarikan.

### Q: Apa yang terjadi jika penarikan ditolak?

**A:** Saldo **tidak berubah**. Penarikan yang ditolak tidak mengurangi saldo. Reseller bisa mengajukan penarikan baru dengan data yang benar.

### Q: Bisakah reseller membatalkan penarikan yang sudah diajukan?

**A:** Saat ini tidak ada fitur pembatalan dari sisi reseller. Hubungi admin jika ingin membatalkan penarikan.

### Q: Apakah ada batas maksimum penarikan?

**A:** Tidak ada batas maksimum selain saldo yang tersedia. Reseller bisa menarik seluruh saldo (selama >= Rp 50.000) dalam satu transaksi.

### Q: Apakah saldo otomatis bertambah saat ada order?

**A:** Ya, **sepenuhnya otomatis**. Database trigger `trigger_update_reseller_saldo` menambahkan komisi ke saldo saat order berstatus `completed`. Tidak perlu aksi manual.

### Q: Bagaimana jika admin mengubah status order dari completed ke cancelled?

**A:** Trigger hanya berjalan saat status **berubah ke** `completed`. Jika admin mengubah dari `completed` ke status lain, saldo **tidak otomatis berkurang**. Ini perlu ditangani secara manual oleh admin.

### Q: Ke bank/e-wallet apa saja bisa ditarik?

**A:** Penarikan didukung ke 7 bank (BCA, BNI, BRI, Mandiri, BSI, CIMB Niaga, Permata) dan 4 e-wallet (DANA, OVO, GoPay, ShopeePay).

---

*Kembali ke: [README.md](./README.md) - Dokumentasi utama PBS Reseller System*
