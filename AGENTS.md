# PBS Digital Store - Agent Guide

This repo is a monorepo with a Telegram bot plus several Next.js apps. Prefer links to docs instead of copying large sections.

## Services
- bot-telegram: Node.js + Telegraf bot and webhook receiver.
- dashboard: Admin dashboard (Next.js 16, React 19).
- user: Customer web store (Next.js 14).
- reseller-dashboard: Reseller management (Next.js 14).
- web-reseller: Reseller storefront (Next.js 14).
- web-blog: Public blog (Next.js 14).
- supabase: SQL migrations and database docs.

## Commands (root)
- Install all: npm run install:all
- Start all services: npm start (runs start-all.js)
- Start one service: npm run bot | dashboard | store | reseller-dashboard | web-reseller | web-blog
- Build: npm run build:dashboard | build:store | build:reseller-dashboard | build:web-reseller | build:web-blog

## Service scripts
- bot-telegram: npm start | npm run dev | npm test | npm run migrate
- user: npm run dev | npm run build | npm start | npm run test-flow | npm run simulate-order
- dashboard/reseller-dashboard/web-reseller/web-blog: npm run dev | npm run build | npm start | npm run lint

## Ports and local URLs
Use package.json scripts as source of truth:
- Bot: HTTP_PORT env (default 3000).
- User store: 3001
- Reseller dashboard: 3002
- Web reseller: 3003
- Admin dashboard: 3004
- Web blog: 3005
Note: start-all.js prints dashboard as 3000, but the dashboard dev script uses 3004.

## Environment files
Each service has its own env file:
- bot-telegram/.env
- dashboard/.env.local
- user/.env.local
- reseller-dashboard/.env.local
- web-reseller/.env.local
- web-blog/.env.local
See setup guides for required keys.

## Key entry points
- Bot entry: bot-telegram/index.js
- Bot webhook handler: bot-telegram/src/bot/handlers/webhook.js
- Bot purchase flow: bot-telegram/src/bot/handlers/purchase.js
- User checkout API: user/app/api/checkout/route.ts
- User webhook API: user/app/api/webhook/route.ts
- Email delivery: user/lib/email/
- Reseller auth: reseller-dashboard/lib/auth.ts
- DB migrations: supabase/migrations/

## Known pitfalls and guardrails
- Checkout totals must be computed server-side from products table by ID. Never trust client-provided item price.
- Stock reads should use the product_inventory_summary view, not raw product_items aggregates, to avoid PostgREST row limits.
- Bot webhook forwarding can drop events if WEBHOOK_WEB_URL is misconfigured or transient; duplicate webhook guards exist.
- Email delivery should be awaited; SMTP timeouts and IPv6 issues have occurred (support SMTP_FORCE_IPV4).
- If editing stock or checkout flows, keep the reserve -> finalize -> release contract intact.

## Documentation map (link, do not duplicate)
- Overview docs: docs/README.md and docs/general/README.md
- Bot setup: docs/bot/QUICKSTART.md and docs/bot/DEVELOPER_GUIDE.md
- User store setup: docs/user-store/SETUP-GUIDE.md
- Reseller system: docs/reseller/README.md
- Database setup: docs/database/README.md and supabase/README.md
- RLS troubleshooting: docs/database/RLS-FIX-GUIDE.md
- Migration scripts: bot-telegram/scripts/README.md
