# Admin Dashboard Peony Store

Admin Dashboard Peony Store adalah panel admin pusat untuk monorepo Peony Store.

## Ringkasan

| Item | Nilai |
|---|---|
| Framework | Next.js 16, React 19 |
| Port | 3004 |
| Command root | `npm run dashboard` |
| Command lokal | `npm run dev` |
| Env file | `.env.local` |

## Fungsi

- Kelola produk dan item digital.
- Pantau order dan user.
- Kelola reseller, affiliate, promo, broadcast, blog, backup, analytics, dan settings.
- Menjadi sumber administrasi data untuk Telegram Bot, Web Store Peony Store, dan blog.

## Struktur

```text
dashboard/
├── app/dashboard/          # Halaman admin utama
├── app/api/                # API route dashboard
├── lib/                    # Supabase/auth/helper
├── middleware.ts           # Middleware auth jika digunakan
└── package.json
```

## Command

Dari root repo:

```bash
npm run dashboard
npm run build:dashboard
```

Dari folder ini:

```bash
npm run dev
npm run build
npm start
npm run lint
```

## Environment

Buat `.env.local` di folder ini. Variabel umum:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Tambahkan secret auth/admin sesuai implementasi aktif.

## Catatan

- Port dashboard yang benar adalah 3004.
- Untuk overview lengkap monorepo, lihat `../README.md`.
- Untuk dokumentasi dashboard terpusat, lihat `../docs/dashboard/README.md`.
