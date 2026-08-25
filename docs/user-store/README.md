# PBS User Store - Web Store PBS

Web Store PBS adalah aplikasi Next.js untuk pelanggan akhir PBS Digital Store. Dokumentasi ini disinkronkan dengan `README.md` root.

## Ringkasan

| Item | Nilai |
|---|---|
| Folder | `user/` |
| Framework | Next.js 14, React 18 |
| Port | 3001 |
| Root command | `npm run store` |
| Service command | `npm run dev` |
| Env file | `user/.env.local` |

## Fitur Utama

- Katalog produk dari Supabase.
- Filter kategori dan detail produk.
- Share produk dan affiliate link.
- Cart, checkout, halaman pending, success, dan failed.
- Login, register, profile, dan riwayat order.
- Dashboard affiliate user.
- Promo/kupon web.
- Checkout QRIS Midtrans.
- Webhook payment callback.
- Email delivery item digital setelah pembayaran sukses.
- Menampilkan produk marketplace tertentu yang dipilih admin dengan margin.

## Struktur Penting

```text
user/
├── app/api/checkout/          # Membuat order dan transaksi pembayaran
├── app/api/webhook/           # Callback pembayaran Midtrans
├── app/api/orders/            # Data order user
├── app/api/payment-status/    # Cek status pembayaran
├── app/api/catalog-products/  # Katalog produk
├── app/api/affiliate/         # Affiliate user
├── app/api/promo/             # Promo/kupon
├── app/product/[id]/          # Detail produk
├── app/cart/                  # Keranjang
├── app/checkout/              # Checkout
├── app/orders/                # Riwayat/lacak order
├── app/profile/               # Profil user
├── app/login/                 # Login
├── app/register/              # Register
├── app/order-pending/         # Order pending
├── app/order-success/         # Order sukses
├── app/order-failed/          # Order gagal
├── app/affiliate/             # Dashboard affiliate user
├── components/                # CartProvider, AuthProvider, Header, BottomNav, ProductCard
├── lib/email/                 # SMTP/Resend email delivery
└── package.json
```

## Flow Checkout

```text
User pilih produk -> Cart -> Checkout -> Server hitung total -> Reserve stock -> Midtrans QRIS -> Webhook sukses -> Finalize stock -> Tampilkan/kirim item digital
```

## Command

Dari root repo:

```bash
npm run store
npm run build:store
```

Dari folder `user/`:

```bash
npm run dev
npm run build
npm start
npm run test-flow
npm run simulate-order
```

## Environment

Variabel umum di `user/.env.local`:

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

## Integrasi

- Produk dan stok dikelola dari Admin Dashboard PBS.
- Order tersimpan di Supabase dan dapat dipantau dashboard.
- Webhook Midtrans memperbarui status pembayaran.
- Telegram Bot memakai database produk/order yang sama.
- Fitur affiliate dan promo memakai tabel hasil migration terkait.
- Produk marketplace yang dipilih admin dapat muncul di Web Store PBS dengan margin.

## Guardrail

- Total checkout harus dihitung server-side dari produk yang valid.
- Jangan mempercayai harga dari cart/client.
- Jaga flow stok `reserve -> finalize -> release`.
- Email delivery harus idempotent dan retry-aware.
- Webhook payment harus aman terhadap callback duplikat.

## Referensi

- Service README: `../../user/README.md`
- Order flow: `ORDER-FLOW.md`
- Email delivery: `EMAIL-DELIVERY-SETUP.md`
- Midtrans setup: `MIDTRANS-SETUP.md`
- Webhook setup: `WEBHOOK-SETUP.md`
