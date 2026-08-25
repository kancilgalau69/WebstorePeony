# Reseller Dashboard PBS

Dashboard untuk reseller PBS mengelola toko, produk yang dijual, harga/margin, order, saldo, dan withdrawal.

## Ringkasan

| Item | Nilai |
|---|---|
| Framework | Next.js 14, React 18 |
| Port | 3002 |
| Command root | `npm run reseller-dashboard` |
| Command lokal | `npm run dev` |
| Env file | `.env.local` |

## Fungsi Utama

- Ringkasan performa toko reseller.
- Kelola produk yang ditampilkan dari katalog pusat PBS.
- Atur harga custom dan margin fixed/persen.
- Pantau order pelanggan reseller.
- Kelola branding toko seperti nama, slug, logo, warna, dan kontak.
- Lihat saldo komisi dan ajukan withdrawal.

## Struktur Penting

```text
reseller-dashboard/
├── app/dashboard/          # Ringkasan, orders, products, pricing, balance, store-settings
├── app/api/                # API dashboard reseller
├── lib/auth.ts             # Custom session HMAC-SHA256 cookie
├── lib/                    # Supabase/helper
└── package.json
```

## Command

Dari root repo:

```bash
npm run reseller-dashboard
npm run build:reseller-dashboard
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
SESSION_SECRET=
```

## Integrasi

- Berbagi database Supabase dengan produk pusat PBS.
- Storefront publik reseller berada di `web-reseller/`.
- Order reseller memakai stok dan flow pembayaran yang terhubung ke Midtrans.
- Komisi dihitung dari selisih harga jual reseller dan harga pusat.

Dokumentasi lengkap reseller ada di `../docs/reseller/README.md`.
