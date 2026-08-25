# Supabase Migrations

Folder ini berisi SQL migration untuk database bersama PBS Digital Store dan KlikVirtual.ID.

## Sumber Kebenaran

- Overview monorepo dan daftar migration ringkas: `../README.md`.
- Dokumentasi database teknis: `../docs/database/README.md`.
- SQL migration aktual: `migrations/`.

## Cara Menjalankan Migration

1. Buka Supabase Dashboard.
2. Masuk ke SQL Editor.
3. Jalankan file di `migrations/` secara berurutan.
4. Verifikasi tabel, function, trigger, view, dan policy yang dibuat.

## Area Migration

- Schema awal produk, order, user, settings.
- Product item digital dan stok individual.
- Stock reservation, finalize, release, dan cleanup.
- Web Store PBS order, user web, email tracking, promo, affiliate, announcement.
- Sistem reseller, pricing, order, balance, withdrawal.
- Blog dan broadcast Telegram.
- Marketplace multi-seller KlikVirtual.ID.
- Chat seller-buyer.
- Fee breakdown order marketplace.
- Wallet user dan topup saldo.
- Digiflazz PPOB.
- Security table khusus web reseller.

## Function Penting

- `get_available_stock(product_id)` untuk stok tersedia.
- `reserve_stock(order_id, product_code, quantity, user_ref)` untuk reservasi stok.
- `finalize_stock(order_id, total)` untuk finalisasi order sukses.
- `release_stock(order_id, reason)` untuk melepas reservasi.
- `clean_expired_reservations()` untuk cleanup reservasi expired.

## Guardrail

- Jalankan migration secara berurutan.
- Jangan menghapus atau mengubah migration lama jika sudah pernah diterapkan di production. Buat migration baru.
- Setelah mengubah schema, cek dampak ke `bot-telegram/`, `dashboard/`, `user/`, `reseller-dashboard/`, `web-reseller/`, `market-dashboard/`, dan `market-store/`.
- Untuk stok, pertahankan kontrak `reserve -> finalize -> release`.
- Untuk checkout, hitung total server-side dan jangan mempercayai harga dari client.
- Untuk RLS, uji akses anon key dan service role sesuai kebutuhan tiap service.

## Scheduled Job Disarankan

```sql
SELECT cron.schedule(
  'clean-expired-reservations',
  '*/5 * * * *',
  $$ SELECT clean_expired_reservations(); $$
);
```
