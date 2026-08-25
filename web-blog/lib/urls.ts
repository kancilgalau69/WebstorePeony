import { headers } from 'next/headers'

/**
 * Resolve the absolute base URL of this blog site.
 * Order of preference:
 *   1. NEXT_PUBLIC_SITE_URL env (explicit override, recommended in production)
 *   2. Request headers (host + protocol) — automatic in production
 *   3. http://localhost:3005 fallback (dev only)
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  try {
    const h = headers()
    const host = h.get('x-forwarded-host') || h.get('host')
    const protoHeader = h.get('x-forwarded-proto')
    const proto = protoHeader || (host && host.startsWith('localhost') ? 'http' : 'https')
    if (host) return `${proto}://${host}`
  } catch {
    // headers() not available outside request context
  }

  return 'http://localhost:3005'
}

/**
 * Resolve the URL of the user-facing store (linked back from blog).
 * If env is not set, the store link is hidden in the UI.
 */
export function getStoreUrl(): string {
  return (process.env.NEXT_PUBLIC_STORE_URL || '').trim().replace(/\/$/, '')
}

/**
 * Build absolute URL of a blog post by slug.
 */
export function getPostUrl(slug: string): string {
  return `${getSiteUrl()}/${slug}`
}
