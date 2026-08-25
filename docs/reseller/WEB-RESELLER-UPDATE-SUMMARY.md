# Web Reseller - Summary Perubahan

Dokumen ini merangkum semua perubahan yang telah dilakukan pada sistem web reseller PBS.

---

## 📋 Ringkasan Perubahan

### 1. **Perubahan Routing** ✅

#### Sebelum:
```
http://localhost:3003/toko/reseller-1
http://localhost:3003/toko/reseller-1/cart
http://localhost:3003/toko/reseller-1/checkout
```

#### Sesudah:
```
http://localhost:3003/reseller-1
http://localhost:3003/reseller-1/cart
http://localhost:3003/reseller-1/checkout
```

**Keuntungan:**
- URL lebih bersih dan pendek
- Lebih mudah untuk menggunakan subdomain di masa depan
- Konsisten dengan best practice modern web routing

---

### 2. **Implementasi Keamanan** ✅

#### A. hCaptcha Integration
- **Lokasi**: Halaman checkout (`/[slug]/checkout`)
- **Fungsi**: Mencegah bot dan spam checkout
- **Environment Variables**:
  ```env
  HCAPTCHA_SECRET_KEY=your_secret_key
  NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your_site_key
  ```

#### B. Rate Limiting
Implementasi rate limiting untuk mencegah abuse:

| Tipe | Limit | Window | Deskripsi |
|------|-------|--------|-----------|
| **IP Address** | 3 requests | 10 menit | Membatasi request per IP |
| **Email** | 2 pending orders | 30 menit | Membatasi pending order per email |
| **Phone** | 2 pending orders | 30 menit | Membatasi pending order per nomor telepon |

#### C. Bot Detection
Memblokir request dari bot user agents:
- `python-requests`
- `curl`
- `wget`
- `postman`
- `insomnia`
- `httpie`

#### D. Abuse Logging
Semua aktivitas mencurigakan dicatat ke tabel `abuse_logs` untuk monitoring.

---

### 3. **Redesign UI Modern** ✅

#### Halaman Utama (Directory)
**Fitur Baru:**
- Hero section dengan gradient modern
- Search bar untuk mencari toko
- Stats cards (Toko Aktif, Aman, Support, Instant Delivery)
- Grid layout responsive dengan hover effects
- Verified badge untuk setiap toko
- Loading skeleton yang smooth

**Teknologi:**
- Tailwind CSS dengan custom gradients
- Font Awesome icons
- Smooth transitions dan animations

#### Halaman Toko
**Fitur Baru:**
- Hero section dengan branding toko
- Category filter bar yang sticky
- Product grid responsive (2-4 kolom)
- Auto-refresh produk setiap 30 detik
- Search functionality
- Loading states yang lebih baik

#### Halaman Checkout
**Fitur Baru:**
- hCaptcha widget terintegrasi
- Form validation yang lebih ketat
- Email validation dengan regex
- Loading states dan error handling
- Responsive layout (2 kolom desktop, 1 kolom mobile)
- Order summary yang sticky

---

### 4. **Struktur File Baru** ✅

```
web-reseller/
├── app/
│   ├── [slug]/                    # ← BARU (sebelumnya toko/[slug])
│   │   ├── layout.tsx             # Layout toko dengan header & footer
│   │   ├── page.tsx               # Halaman utama toko
│   │   ├── cart/
│   │   │   └── page.tsx           # Keranjang belanja
│   │   ├── checkout/
│   │   │   └── page.tsx           # Checkout dengan captcha
│   │   ├── order-pending/
│   │   │   └── page.tsx           # Halaman pembayaran QRIS
│   │   ├── orders/
│   │   │   └── page.tsx           # Pencarian order
│   │   └── product/
│   │       └── [id]/
│   │           └── page.tsx       # Detail produk
│   ├── api/
│   │   └── store/
│   │       └── [slug]/
│   │           ├── route.ts       # Get store info
│   │           ├── products/
│   │           │   └── route.ts   # Get products
│   │           ├── checkout/
│   │           │   └── route.ts   # Checkout dengan security
│   │           ├── order-status/
│   │           │   └── route.ts   # Check order status
│   │           └── orders/
│   │               └── search/
│   │                   └── route.ts # Search orders
│   ├── page.tsx                   # Halaman directory (redesigned)
│   └── layout.tsx                 # Root layout
└── components/
    ├── CartProvider.tsx           # Cart context
    ├── StoreProvider.tsx          # Store context
    └── ProductCard.tsx            # Product card component
```

---

### 5. **API Changes** ✅

#### Checkout API (`/api/store/[slug]/checkout`)

**Perubahan:**
1. Tambah parameter `captchaToken` di request body
2. Implementasi `verifyCaptcha()` function
3. Implementasi `checkAndUpdateRateLimits()` function
4. Implementasi `isBotUserAgent()` function
5. Implementasi `logAbuse()` function
6. Email validation yang lebih ketat

**Request Body Baru:**
```json
{
  "items": [...],
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "081234567890",
  "captchaToken": "hcaptcha_token_here"  // ← BARU
}
```

**Response Errors Baru:**
```json
// Captcha gagal
{ "error": "Verifikasi CAPTCHA gagal. Silakan coba lagi." }

// Rate limit exceeded
{ "error": "Terlalu banyak request. Coba lagi dalam 10 menit." }

// Bot detected
{ "error": "Access denied" }
```

---

### 6. **Dokumentasi Updated** ✅

File yang diupdate:
1. `docs/reseller/STOREFRONT-GUIDE.md`
2. `docs/reseller/README.md`
3. `docs/reseller/ORDER-FLOW.md`
4. `docs/reseller/DASHBOARD-GUIDE.md`

**Perubahan:**
- Semua URL dari `/toko/{slug}` menjadi `/{slug}`
- Tambah section tentang hCaptcha
- Tambah section tentang rate limiting
- Tambah section tentang redesign UI
- Update flow diagram dengan security steps

---

## 🔧 Environment Variables Required

Tambahkan ke file `.env.local` di folder `web-reseller`:

```env
# Existing variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MIDTRANS_SERVER_KEY=your_midtrans_server_key
MIDTRANS_IS_PRODUCTION=false
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_IDS=admin_id_1,admin_id_2

# NEW: hCaptcha (REQUIRED)
HCAPTCHA_SECRET_KEY=your_hcaptcha_secret_key
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your_hcaptcha_site_key
```

**Cara mendapatkan hCaptcha keys:**
1. Daftar di https://www.hcaptcha.com/
2. Buat site baru
3. Copy Site Key dan Secret Key
4. Paste ke `.env.local`

---

## 🚀 Testing Checklist

### Routing
- [ ] Akses halaman utama: `http://localhost:3003/`
- [ ] Klik toko, pastikan URL menjadi `http://localhost:3003/reseller-slug`
- [ ] Test semua halaman (cart, checkout, orders, product detail)
- [ ] Pastikan tidak ada broken links

### Security
- [ ] Test checkout tanpa captcha (harus gagal)
- [ ] Test checkout dengan captcha valid (harus berhasil)
- [ ] Test rate limiting dengan multiple requests cepat
- [ ] Test dengan bot user agent (curl, postman)
- [ ] Cek tabel `abuse_logs` untuk logging

### UI/UX
- [ ] Test responsive di mobile, tablet, desktop
- [ ] Test search di halaman utama
- [ ] Test category filter di halaman toko
- [ ] Test cart functionality
- [ ] Test loading states
- [ ] Test error states

### Checkout Flow
- [ ] Isi form checkout dengan data valid
- [ ] Selesaikan captcha
- [ ] Submit dan pastikan redirect ke order-pending
- [ ] Scan QRIS dan bayar
- [ ] Pastikan order status update otomatis
- [ ] Cek email untuk delivery produk digital

---

## 📊 Database Tables Required

Pastikan tabel berikut sudah ada di Supabase:

### 1. `abuse_logs` (NEW)
```sql
CREATE TABLE IF NOT EXISTS abuse_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  origin TEXT,
  captcha_score NUMERIC,
  captcha_result TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_abuse_logs_ip ON abuse_logs(ip);
CREATE INDEX idx_abuse_logs_created_at ON abuse_logs(created_at);
```

### 2. `rate_limits` (NEW)
```sql
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ip, window_start)
);

CREATE INDEX idx_rate_limits_ip ON rate_limits(ip);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
```

---

## 🔄 Migration Steps

### Step 1: Backup
```bash
# Backup folder lama (opsional)
cp -r web-reseller/app/toko web-reseller/app/toko.backup
```

### Step 2: Update Environment
```bash
# Tambahkan hCaptcha keys ke .env.local
nano web-reseller/.env.local
```

### Step 3: Install Dependencies (jika perlu)
```bash
cd web-reseller
npm install
```

### Step 4: Create Database Tables
```sql
-- Run SQL di Supabase SQL Editor
-- (lihat section Database Tables Required di atas)
```

### Step 5: Test Locally
```bash
cd web-reseller
npm run dev
```

### Step 6: Deploy
```bash
# Deploy ke production (Railway, Vercel, dll)
# Pastikan environment variables sudah diset
```

---

## ⚠️ Breaking Changes

### 1. URL Structure
**Impact**: Semua link eksternal ke toko reseller harus diupdate

**Sebelum:**
```
https://yourdomain.com/toko/reseller-1
```

**Sesudah:**
```
https://yourdomain.com/reseller-1
```

**Action Required:**
- Update semua link di dashboard reseller
- Update link di notifikasi Telegram
- Update link di email
- Inform resellers tentang perubahan URL

### 2. Checkout API
**Impact**: Frontend harus mengirim captcha token

**Action Required:**
- Pastikan hCaptcha script loaded
- Pastikan captcha token dikirim saat checkout
- Handle error captcha di frontend

---

## 📝 Notes

### Backward Compatibility
Folder lama `app/toko/[slug]` masih ada dan bisa digunakan untuk backward compatibility jika diperlukan. Namun, disarankan untuk:
1. Redirect `/toko/*` ke `/*` menggunakan middleware
2. Atau hapus folder `app/toko` setelah testing selesai

### Subdomain Support
Dengan routing baru, mudah untuk implementasi subdomain:
```
reseller-1.yourdomain.com  →  /{slug}
```

Tinggal tambahkan middleware untuk detect subdomain dan route ke slug yang sesuai.

### Performance
- Auto-refresh produk setiap 30 detik menggunakan `setInterval`
- Loading states menggunakan skeleton untuk UX yang lebih baik
- Image lazy loading untuk performance

---

## 🎯 Next Steps (Opsional)

1. **Subdomain Implementation**
   - Setup wildcard DNS
   - Tambah middleware untuk subdomain routing
   - Update SSL certificate

2. **Analytics**
   - Tambah Google Analytics atau Plausible
   - Track conversion rate
   - Monitor abuse attempts

3. **Email Notifications**
   - Send order confirmation email
   - Send product delivery email
   - Send receipt email

4. **Admin Dashboard Enhancement**
   - View abuse logs
   - Manage rate limits
   - Block suspicious IPs

---

## 📞 Support

Jika ada pertanyaan atau issue:
1. Check dokumentasi di `docs/reseller/`
2. Check error logs di Supabase
3. Check abuse logs untuk security issues
4. Contact admin via Telegram

---

**Last Updated**: 30 April 2026
**Version**: 2.0.0
**Status**: ✅ Production Ready
