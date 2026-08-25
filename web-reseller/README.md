# Web Reseller PBS

Storefront publik untuk toko reseller PBS. Setiap reseller memiliki URL berbasis slug dan branding masing-masing.

## Ringkasan

| Item | Nilai |
|---|---|
| Framework | Next.js 14, React 18 |
| Port | 3003 |
| Command root | `npm run web-reseller` |
| Command lokal | `npm run dev` |
| Env file | `.env.local` |

## Fungsi Utama

- Menampilkan toko reseller di route `/{slug}`.
- Katalog produk reseller berdasarkan produk yang dipilih/diaktifkan reseller.
- Detail produk, cart, checkout, dan halaman status order.
- Pembayaran QRIS Midtrans.
- Delivery item digital setelah pembayaran sukses.
- Branding toko reseller seperti logo, warna tema, deskripsi, dan kontak.

## Struktur Penting

```text
web-reseller/
├── app/[slug]/              # Halaman toko dinamis reseller
├── app/[slug]/product/[id]/ # Detail produk reseller
├── app/[slug]/cart/         # Keranjang
├── app/[slug]/checkout/     # Checkout
├── app/[slug]/order-*/      # Status order
├── app/api/                 # API storefront reseller
├── lib/                     # Supabase/payment/email/helper
└── package.json
```

## Command

Dari root repo:

```bash
npm run web-reseller
npm run build:web-reseller
```

Dari folder ini:

```bash
npm run dev
npm run build
npm start
npm run lint
```

## Environment

Variabel umum di `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

## Catatan Kritis

- Harga reseller harus dihitung server-side dari konfigurasi margin reseller dan harga pusat.
- Jangan mempercayai harga cart dari client.
- Jaga kontrak stok `reserve -> finalize -> release`.
- Storefront ini berpasangan dengan `reseller-dashboard/`.

Dokumentasi lengkap reseller ada di `../docs/reseller/README.md`.
