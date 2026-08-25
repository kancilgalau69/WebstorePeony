# Supabase Database - PBS Digital Store / KlikVirtual.ID

Dokumen ini merangkum setup database Supabase untuk monorepo. Daftar migration terbaru mengikuti `README.md` root dan file aktual di `supabase/migrations/`.

## Ringkasan

Semua service berbagi satu database Supabase PostgreSQL:

- Telegram Bot PBS.
- Admin Dashboard PBS.
- Web Store PBS.
- Reseller Dashboard dan Web Reseller.
- Web Blog.
- Market Dashboard dan Market Store KlikVirtual.ID.

## Setup Cepat

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan migration di `supabase/migrations/` secara berurutan.
4. Pastikan env setiap service memakai URL/key Supabase yang sesuai.

## Area Schema Utama

| Area | Tabel/Fitur |
|---|---|
| Produk PBS | `products`, `product_items`, stock summary/view |
| Order PBS | `orders`, `order_items` |
| User | `users`, `user_web` |
| Stok | `stock_reservations`, reserve/finalize/release functions |
| Settings | `settings`, banner, announcement, public config |
| Promo | promo web, kupon, applicable products |
| Affiliate | komisi, saldo, withdrawal affiliate |
| Reseller | reseller account, produk, harga, order, withdrawal |
| Blog | post, kategori, SEO metadata |
| Broadcast | broadcast Telegram, schedule, tracking |
| Marketplace | seller, produk marketplace, order, fee breakdown |
| Chat Seller | `seller_chats`, `seller_chat_messages` |
| Wallet | `user_wallets`, `wallet_transactions`, topup order |
| PPOB | Digiflazz product dan order |

## Function Penting

| Function | Fungsi |
|---|---|
| `get_available_stock(product_id)` | Mengambil stok tersedia setelah memperhitungkan reservasi |
| `reserve_stock(order_id, product_code, quantity, user_ref)` | Reservasi stok saat order pending |
| `finalize_stock(order_id, total)` | Finalisasi order sukses dan pengurangan stok |
| `release_stock(order_id, reason)` | Melepas reservasi saat order gagal/expired |
| `clean_expired_reservations()` | Membersihkan reservasi expired |

## Migration Penting

| File | Isi |
|---|---|
| `001_initial_schema.sql` | Schema awal: products, orders, users, settings |
| `002_product_items.sql` | Sistem stok item digital per produk |
| `004_fix_rls_policies.sql` | Row Level Security policies |
| `005_settings_table.sql` | Tabel settings konfigurasi global |
| `007_add_web_store_orders.sql` | Order web store PBS |
| `011_add_order_delivery_email_tracking.sql` | Tracking pengiriman email |
| `012_add_rate_limiting_and_abuse_logging.sql` | Rate limit dan abuse log |
| `013_create_user_web_table.sql` | Akun pembeli Web Store PBS |
| `014_reseller_system.sql` | Sistem reseller |
| `015_affiliate_system.sql` | Program affiliate |
| `016_blog_system.sql` | Sistem blog |
| `017_broadcast_system.sql` | Broadcast Telegram |
| `018_web_promo_system.sql` | Promo dan kupon web |
| `021_marketplace_system.sql` | Marketplace multi-seller |
| `025_seller_chat_system.sql` | Sistem chat seller-buyer |
| `027_wallet_system.sql` | Wallet user |
| `028_digiflazz_system.sql` | Integrasi Digiflazz PPOB |
| `web-reseller-security-tables.sql` | Tabel keamanan khusus web reseller |

## Guardrail Database

- Checkout harus menghitung total server-side dari tabel produk/order yang valid.
- Jangan mempercayai harga, fee, margin, atau total dari client.
- Stock flow wajib menjaga kontrak `reserve -> finalize -> release`.
- Gunakan `product_inventory_summary` untuk membaca stok jika tersedia, bukan agregasi raw `product_items`.
- Webhook pembayaran harus idempotent.
- Perubahan RLS perlu diuji ke semua service yang memakai anon key dan service role.
- Migration baru harus didokumentasikan di `README.md` root dan `supabase/README.md`.

## Scheduled Maintenance

Jalankan cleanup reservasi expired secara periodik, misalnya dengan Supabase Cron:

```sql
SELECT cron.schedule(
  'clean-expired-reservations',
  '*/5 * * * *',
  $$ SELECT clean_expired_reservations(); $$
);
```

## Referensi

- Root overview: `../../README.md`
- Supabase folder README: `../../supabase/README.md`
- RLS troubleshooting: `RLS-FIX-GUIDE.md`
