# Admin Dashboard PBS

Admin Dashboard PBS adalah aplikasi Next.js untuk operasional pusat PBS Digital Store. Informasi port dan service mengikuti `README.md` root.

## Ringkasan

| Item | Nilai |
|---|---|
| Folder | `dashboard/` |
| Framework | Next.js 16, React 19 |
| Port dev/start | 3004 |
| Root command | `npm run dashboard` |
| Service command | `npm run dev` |
| Env file | `dashboard/.env.local` |

## Fungsi Utama

- Mengelola produk pusat PBS.
- Mengelola item digital per produk.
- Melihat dan memproses order.
- Mengelola user, reseller, affiliate, promo, broadcast, blog, backup, analytics, dan settings.
- Menjadi pusat administrasi untuk data yang digunakan Telegram Bot, Web Store PBS, reseller, dan sebagian integrasi marketplace.

## Struktur Penting

```text
dashboard/
├── app/dashboard/          # Halaman admin utama
├── app/api/                # API route dashboard
├── lib/                    # Supabase/auth/helper dashboard
├── middleware.ts           # Middleware auth bila tersedia
└── package.json
```

Area halaman dashboard mengikuti struktur aktual di `app/dashboard/`, termasuk produk, item, order, reseller, affiliate, promo, broadcast, blog, backup, users, analytics, dan settings.

## Command

Dari root repo:

```bash
npm run dashboard
npm run build:dashboard
```

Dari folder `dashboard/`:

```bash
npm run dev
npm run build
npm start
npm run lint
```

## Environment

Gunakan `dashboard/.env.local`. Nilai pasti mengikuti implementasi dan setup environment, tetapi dashboard umumnya membutuhkan:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Tambahkan secret auth/admin sesuai kebutuhan implementasi dashboard.

## Integrasi

- Supabase sebagai database utama.
- Telegram Bot membaca data produk, order, user, dan settings yang dikelola admin.
- Web Store PBS memakai katalog, promo, announcement, dan stok dari database yang sama.
- Sistem reseller memakai katalog pusat dan stok item yang sama.
- Blog publik mengambil konten dari data blog yang dikelola dashboard.

## Catatan Sinkronisasi

- Port dashboard adalah 3004, bukan 3000.
- README root adalah sumber kebenaran utama untuk daftar service dan command.
- Jangan mengubah flow stok tanpa memeriksa dampaknya ke bot, user store, reseller, dan marketplace.
