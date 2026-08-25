# Changelog - Web Reseller

All notable changes to the web reseller system.

---

## [2.0.0] - 2026-04-30

### 🎉 Major Changes

#### Routing Structure
- **BREAKING**: Changed routing from `/toko/{slug}` to `/{slug}`
- Cleaner URLs for better UX
- Easier subdomain implementation in the future
- All internal links updated

#### Security Enhancements
- **NEW**: hCaptcha integration on checkout page
- **NEW**: Rate limiting (IP, email, phone)
- **NEW**: Bot user agent detection
- **NEW**: Abuse logging system
- **NEW**: Enhanced email validation

#### UI/UX Redesign
- **NEW**: Modern gradient design
- **NEW**: Search functionality on homepage
- **NEW**: Stats cards on homepage
- **NEW**: Verified badges for stores
- **NEW**: Smooth animations and transitions
- **NEW**: Better loading states
- **NEW**: Improved responsive design

### 📝 Added

#### Frontend
- `app/[slug]/` - New routing structure (replaces `app/toko/[slug]/`)
- `app/page.tsx` - Redesigned homepage with search
- hCaptcha widget in checkout page
- Captcha state management
- Auto-render captcha on page load
- Reset captcha after error
- Button validation for captcha completion

#### Backend
- `verifyCaptcha()` - Verify hCaptcha token
- `normalizeIp()` - Normalize IP addresses (IPv4/IPv6)
- `isBotUserAgent()` - Detect bot user agents
- `checkAndUpdateRateLimits()` - Rate limit checks
- `logAbuse()` - Log suspicious activity
- Enhanced email validation with regex

#### Database
- `abuse_logs` table - Log abuse attempts
- `rate_limits` table - Track rate limits
- Indexes for performance
- Views for monitoring
- Cleanup functions

#### Documentation
- `WEB-RESELLER-UPDATE-SUMMARY.md` - Complete summary of changes
- `QUICK-START.md` - Quick start guide
- `web-reseller-security-tables.sql` - Database migration
- Updated all existing docs with new routing

### 🔧 Changed

#### Routing
- `/toko/{slug}` → `/{slug}`
- `/toko/{slug}/cart` → `/{slug}/cart`
- `/toko/{slug}/checkout` → `/{slug}/checkout`
- `/toko/{slug}/orders` → `/{slug}/orders`
- `/toko/{slug}/product/{id}` → `/{slug}/product/{id}`

#### API
- Checkout API now requires `captchaToken`
- Added rate limit checks before processing
- Added bot detection before processing
- Enhanced error messages

#### UI Components
- `ProductCard.tsx` - Updated routing
- `CartProvider.tsx` - Updated routing
- `StoreProvider.tsx` - Updated routing
- All page components updated with new routes

### 🛡️ Security

#### Rate Limits
- IP: 3 requests per 10 minutes
- Email: 2 pending orders per 30 minutes
- Phone: 2 pending orders per 30 minutes

#### Bot Detection
Blocked user agents:
- `python-requests`
- `curl`
- `wget`
- `postman`
- `insomnia`
- `httpie`

#### Captcha
- hCaptcha integration
- Server-side verification
- Auto-reset on error
- Score tracking

### 📦 Dependencies

#### New Environment Variables
```env
HCAPTCHA_SECRET_KEY=xxx
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=xxx
```

#### New Database Tables
- `abuse_logs`
- `rate_limits`

### 🐛 Fixed
- Email validation now more strict
- Better error handling in checkout
- Fixed cart persistence issues
- Fixed responsive layout issues

### ⚠️ Breaking Changes

1. **URL Structure**
   - All external links to stores must be updated
   - Old URLs (`/toko/{slug}`) will not work unless redirected

2. **Checkout API**
   - Now requires `captchaToken` parameter
   - Will reject requests without valid captcha

3. **Environment Variables**
   - `HCAPTCHA_SECRET_KEY` is now required
   - `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` is now required

### 📋 Migration Guide

1. Update environment variables
2. Run database migrations
3. Update all external links
4. Test checkout flow
5. Monitor abuse logs

See [QUICK-START.md](./QUICK-START.md) for detailed migration steps.

---

## [1.0.0] - 2025-12-01

### Initial Release

#### Features
- Multi-store support
- Custom branding per store
- QRIS payment via Midtrans
- Product catalog
- Shopping cart
- Order tracking
- Responsive design

#### Pages
- Homepage (store directory)
- Store page
- Product detail
- Cart
- Checkout
- Order pending
- Order search

#### API Endpoints
- `GET /api/stores` - List all stores
- `GET /api/store/{slug}` - Get store info
- `GET /api/store/{slug}/products` - Get products
- `POST /api/store/{slug}/checkout` - Create order
- `GET /api/store/{slug}/order-status` - Check order status
- `GET /api/store/{slug}/orders/search` - Search orders

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 2.0.0 | 2026-04-30 | Major update: New routing, security, UI redesign |
| 1.0.0 | 2025-12-01 | Initial release |

---

## Upgrade Path

### From 1.0.0 to 2.0.0

1. **Backup**
   ```bash
   cp -r web-reseller web-reseller.backup
   ```

2. **Update Code**
   ```bash
   git pull origin main
   ```

3. **Install Dependencies**
   ```bash
   cd web-reseller
   npm install
   ```

4. **Update Environment**
   ```bash
   # Add to .env.local
   HCAPTCHA_SECRET_KEY=xxx
   NEXT_PUBLIC_HCAPTCHA_SITE_KEY=xxx
   ```

5. **Run Migrations**
   ```sql
   -- Run in Supabase SQL Editor
   -- See: supabase/migrations/web-reseller-security-tables.sql
   ```

6. **Test**
   ```bash
   npm run dev
   # Test all features
   ```

7. **Deploy**
   ```bash
   # Deploy to production
   vercel --prod
   # or
   railway up
   ```

8. **Update Links**
   - Update all external links from `/toko/{slug}` to `/{slug}`
   - Inform resellers about new URLs
   - Setup redirects if needed

---

## Roadmap

### v2.1.0 (Planned)
- [ ] Subdomain support
- [ ] Email notifications
- [ ] Order history for customers
- [ ] Wishlist feature
- [ ] Product reviews

### v2.2.0 (Planned)
- [ ] Admin dashboard for abuse monitoring
- [ ] IP blocking feature
- [ ] Advanced analytics
- [ ] Multi-language support
- [ ] Dark mode

### v3.0.0 (Future)
- [ ] Mobile app
- [ ] Push notifications
- [ ] Loyalty program
- [ ] Referral system
- [ ] Advanced reporting

---

## Support

For questions or issues:
- Documentation: `docs/reseller/`
- GitHub Issues: (if applicable)
- Telegram: Contact admin

---

**Maintained by**: PBS Digital Store Team
**License**: Proprietary
