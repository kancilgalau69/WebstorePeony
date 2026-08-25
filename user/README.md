# PBS User Store

Web Store PBS adalah aplikasi e-commerce pelanggan untuk membeli produk digital PBS melalui web.

## Ringkasan

| Item | Nilai |
|---|---|
| Framework | Next.js 14, React 18 |
| Port | 3001 |
| Command root | `npm run store` |
| Command lokal | `npm run dev` |
| Env file | `.env.local` |

## Fitur

- Katalog produk dan filter kategori.
- Detail produk dengan share dan affiliate link.
- Cart dan checkout.
- Login, register, profile, dan orders.
- Dashboard affiliate user.
- Promo/kupon.
- Pembayaran QRIS Midtrans.
- Webhook payment callback.
- Email delivery item digital setelah payment sukses.
- Halaman `order-pending`, `order-success`, dan `order-failed`.

## Struktur

```text
user/
├── app/api/checkout/          # Create order dan transaksi
├── app/api/webhook/           # Midtrans callback
├── app/api/orders/            # Order user
├── app/api/payment-status/    # Cek status pembayaran
├── app/api/catalog-products/  # Katalog produk
├── app/api/affiliate/         # Affiliate
├── app/api/promo/             # Promo
├── app/product/[id]/          # Detail produk
├── app/cart/                  # Keranjang
├── app/checkout/              # Checkout
├── app/orders/                # Riwayat/lacak order
├── app/profile/               # Profil user
├── app/login/                 # Login
├── app/register/              # Register
├── app/affiliate/             # Dashboard affiliate
├── components/                # CartProvider, AuthProvider, Header, BottomNav, ProductCard
├── lib/email/                 # SMTP/Resend email delivery
└── package.json
```

## Command

Dari root repo:

```bash
npm run store
npm run build:store
```

Dari folder ini:

```bash
npm run dev
npm run build
npm start
npm run test-flow
npm run simulate-order
```

## Environment

Buat `.env.local` di folder ini. Variabel umum:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
SMTP_URL=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=
SMTP_FROM_EMAIL=
ORDER_EMAIL_MAX_ATTEMPTS=3
ORDER_EMAIL_RETRY_DELAY_MS=1000
SMTP_FORCE_IPV4=false
RESEND_API_KEY=
```

## Flow Pembayaran

```text
User pilih produk -> Cart -> Checkout -> Server hitung total -> Reserve stock -> Midtrans QRIS -> Webhook sukses -> Finalize stock -> Item digital tampil/dikirim email
```

## Integrasi

- Admin Dashboard PBS mengelola produk, stok, promo, affiliate, dan konten terkait.
- Telegram Bot berbagi database produk dan order.
- Supabase menjadi database utama.
- Midtrans menangani pembayaran QRIS.
- Email dikirim melalui SMTP atau Resend sesuai konfigurasi.

## Catatan Kritis

- Jangan mempercayai harga dari client/cart.
- Total checkout harus dihitung server-side dari database.
- Jaga kontrak stok `reserve -> finalize -> release`.
- Webhook pembayaran dan email delivery harus idempotent.

Dokumentasi tambahan ada di `../docs/user-store/README.md`.
