# Web Blog PBS

Blog publik untuk konten PBS Digital Store.

## Ringkasan

| Item | Nilai |
|---|---|
| Framework | Next.js 14, React 18 |
| Port | 3005 |
| Command root | `npm run web-blog` |
| Command lokal | `npm run dev` |
| Env file | `.env.local` |

## Fungsi Utama

- Beranda blog dengan featured post, grid artikel, dan filter kategori.
- Halaman detail artikel berdasarkan slug.
- Render konten Markdown.
- Share artikel dan related posts.
- Mengambil data blog dari Supabase.

## Struktur Penting

```text
web-blog/
├── app/page.tsx             # Beranda blog
├── app/[slug]/page.tsx      # Detail artikel
├── app/api/                 # API blog jika tersedia
├── lib/                     # Supabase/helper
└── package.json
```

## Command

Dari root repo:

```bash
npm run web-blog
npm run build:web-blog
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
```

## Integrasi

- Konten blog dikelola dari Admin Dashboard PBS.
- Data blog berada di Supabase dan dibuat melalui migration sistem blog.

Lihat overview monorepo di `../README.md`.
