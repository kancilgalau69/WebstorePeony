# Web Reseller - Quick Start Guide

Panduan cepat untuk menjalankan web reseller dengan fitur baru (routing baru, captcha, rate limiting, dan UI modern).

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd web-reseller
npm install
```

### 2. Setup Environment Variables

Buat file `.env.local` di folder `web-reseller`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Midtrans
MIDTRANS_SERVER_KEY=your_midtrans_server_key
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your_client_key

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_IDS=admin_id_1,admin_id_2

# hCaptcha (REQUIRED - NEW!)
HCAPTCHA_SECRET_KEY=your_hcaptcha_secret_key
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your_hcaptcha_site_key
```

### 3. Setup Database Tables

Jalankan SQL migration di Supabase SQL Editor:

```bash
# File SQL ada di:
supabase/migrations/web-reseller-security-tables.sql
```

Atau copy-paste SQL berikut:

```sql
-- Abuse Logs Table
CREATE TABLE IF NOT EXISTS abuse_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  origin TEXT,
  captcha_score NUMERIC,
  captcha_result TEXT,
  source TEXT DEFAULT 'checkout',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abuse_logs_ip ON abuse_logs(ip);
CREATE INDEX IF NOT EXISTS idx_abuse_logs_created_at ON abuse_logs(created_at);

-- Rate Limits Table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ip, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
```

### 4. Get hCaptcha Keys

1. Daftar di https://www.hcaptcha.com/
2. Buat site baru
3. Copy **Site Key** dan **Secret Key**
4. Paste ke `.env.local`

### 5. Run Development Server

```bash
npm run dev
```

Buka browser: `http://localhost:3003`

---

## 🧪 Testing

### Test Routing Baru

1. Akses halaman utama: `http://localhost:3003/`
2. Klik salah satu toko
3. URL harus menjadi: `http://localhost:3003/reseller-slug` (tanpa `/toko/`)

### Test Captcha

1. Buka halaman checkout
2. Isi form
3. Selesaikan captcha challenge
4. Submit form
5. Harus berhasil redirect ke order-pending

### Test Rate Limiting

1. Buka Postman atau curl
2. Kirim 4+ request checkout dalam 10 menit
3. Request ke-4 harus ditolak dengan error rate limit

```bash
# Test dengan curl
curl -X POST http://localhost:3003/api/store/reseller-1/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [...],
    "customer_name": "Test",
    "customer_email": "test@example.com",
    "customer_phone": "081234567890",
    "captchaToken": "test"
  }'
```

### Test Bot Detection

```bash
# Test dengan curl (harus ditolak)
curl -X POST http://localhost:3003/api/store/reseller-1/checkout \
  -H "Content-Type: application/json" \
  -H "User-Agent: curl/7.68.0" \
  -d '{...}'

# Response: {"error": "Access denied"}
```

---

## 📁 File Structure

```
web-reseller/
├── app/
│   ├── [slug]/                    # ← ROUTING BARU
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── cart/
│   │   ├── checkout/              # ← DENGAN CAPTCHA
│   │   ├── order-pending/
│   │   ├── orders/
│   │   └── product/
│   ├── api/
│   │   └── store/
│   │       └── [slug]/
│   │           ├── checkout/      # ← DENGAN SECURITY
│   │           ├── products/
│   │           └── ...
│   ├── page.tsx                   # ← REDESIGNED
│   └── layout.tsx
├── components/
│   ├── CartProvider.tsx
│   ├── StoreProvider.tsx
│   └── ProductCard.tsx
└── .env.local                     # ← TAMBAH HCAPTCHA KEYS
```

---

## 🔒 Security Features

### 1. hCaptcha
- Mencegah bot checkout
- Verifikasi di server-side
- Auto-reset setelah error

### 2. Rate Limiting
- 3 requests per 10 menit per IP
- 2 pending orders per 30 menit per email
- 2 pending orders per 30 menit per phone

### 3. Bot Detection
- Blokir curl, postman, wget, dll
- Log ke `abuse_logs` table

### 4. Email Validation
- Regex validation
- Normalize email (lowercase, trim)

---

## 🎨 UI Features

### Halaman Utama
- Modern gradient design
- Search functionality
- Stats cards
- Verified badges
- Smooth animations

### Halaman Toko
- Hero section dengan branding
- Category filter (sticky)
- Auto-refresh (30 detik)
- Responsive grid

### Halaman Checkout
- hCaptcha widget
- Form validation
- Loading states
- Error handling
- Sticky order summary

---

## 🐛 Troubleshooting

### Captcha tidak muncul

**Problem**: Captcha widget tidak render

**Solution**:
1. Check console untuk error
2. Pastikan `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` sudah diset
3. Clear browser cache
4. Reload page

### Rate limit tidak bekerja

**Problem**: Bisa checkout berkali-kali

**Solution**:
1. Check tabel `rate_limits` di Supabase
2. Pastikan `SUPABASE_SERVICE_ROLE_KEY` sudah diset
3. Check console log untuk error

### URL masih `/toko/slug`

**Problem**: URL tidak berubah

**Solution**:
1. Clear Next.js cache: `rm -rf .next`
2. Restart dev server: `npm run dev`
3. Hard refresh browser: `Ctrl+Shift+R`

### Checkout gagal terus

**Problem**: Selalu error saat checkout

**Solution**:
1. Check console log
2. Check Network tab untuk response error
3. Pastikan captcha sudah diselesaikan
4. Pastikan tidak hit rate limit
5. Check Supabase logs

---

## 📊 Monitoring

### Check Abuse Logs

```sql
-- Top 10 IPs dengan abuse attempts
SELECT ip, COUNT(*) as attempts
FROM abuse_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip
ORDER BY attempts DESC
LIMIT 10;
```

### Check Rate Limits

```sql
-- IPs yang hit rate limit
SELECT ip, SUM(request_count) as total
FROM rate_limits
WHERE window_start > NOW() - INTERVAL '1 hour'
GROUP BY ip
HAVING SUM(request_count) >= 3
ORDER BY total DESC;
```

### Check Failed Captcha

```sql
-- Failed captcha attempts
SELECT ip, user_agent, created_at
FROM abuse_logs
WHERE captcha_result != 'success'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## 🚢 Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd web-reseller
vercel

# Set environment variables di Vercel dashboard
```

### Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
cd web-reseller
railway up

# Set environment variables
railway variables set HCAPTCHA_SECRET_KEY=xxx
railway variables set NEXT_PUBLIC_HCAPTCHA_SITE_KEY=xxx
```

### Environment Variables di Production

Pastikan semua environment variables sudah diset:
- ✅ Supabase credentials
- ✅ Midtrans credentials
- ✅ Telegram credentials
- ✅ **hCaptcha credentials** (REQUIRED!)

---

## 📚 Documentation

- [Summary Perubahan](./WEB-RESELLER-UPDATE-SUMMARY.md)
- [Storefront Guide](./STOREFRONT-GUIDE.md)
- [Order Flow](./ORDER-FLOW.md)
- [API Reference](./API-REFERENCE.md)

---

## 🆘 Support

Jika ada masalah:
1. Check dokumentasi di `docs/reseller/`
2. Check error logs di console
3. Check Supabase logs
4. Check `abuse_logs` table
5. Contact admin via Telegram

---

## ✅ Checklist Sebelum Production

- [ ] Environment variables sudah diset semua
- [ ] Database tables sudah dibuat
- [ ] hCaptcha keys sudah valid
- [ ] Test routing baru
- [ ] Test captcha
- [ ] Test rate limiting
- [ ] Test bot detection
- [ ] Test responsive design
- [ ] Test checkout flow end-to-end
- [ ] Setup monitoring (abuse logs, rate limits)
- [ ] Inform resellers tentang URL baru

---

**Last Updated**: 30 April 2026
**Version**: 2.0.0
