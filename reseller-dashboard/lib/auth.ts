import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// Server-side Supabase client with service role
function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServerKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  return createClient(supabaseUrl, supabaseServerKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const supabaseAdmin = createSupabaseAdmin()

// ============================================
// Reliable reseller ID lookup (always from DB by email)
// ============================================
export async function getResellerId(session: { resellerId: string; email: string }): Promise<string | null> {
  // Try email lookup first (most reliable)
  if (session.email) {
    const { data } = await createSupabaseAdmin()
      .from('resellers')
      .select('id')
      .eq('email', session.email.toLowerCase().trim())
      .maybeSingle()
    if (data?.id) return data.id
  }
  // Fallback to session value
  return String(session.resellerId || '').trim() || null
}

// ============================================
// Password utilities
// ============================================
const BCRYPT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ============================================
// Session token (HMAC-SHA256 signed)
// ============================================
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'reseller-session-secret'
const SESSION_COOKIE_NAME = 'pbs_reseller_session'
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days

interface ResellerSessionPayload {
  resellerId: string
  email: string
  namaToko: string
  slug: string
  iat: number
  exp: number
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64url')
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf-8')
}

async function sign(payload: string): Promise<string> {
  const { createHmac } = await import('crypto')
  return createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
}

export async function createSessionToken(reseller: {
  id: string
  email: string
  nama_toko: string
  slug: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: ResellerSessionPayload = {
    resellerId: reseller.id,
    email: reseller.email,
    namaToko: reseller.nama_toko,
    slug: reseller.slug,
    iat: now,
    exp: now + SESSION_MAX_AGE,
  }

  const payloadStr = base64UrlEncode(JSON.stringify(payload))
  const signature = await sign(payloadStr)
  return `${payloadStr}.${signature}`
}

export async function verifySessionToken(token: string): Promise<ResellerSessionPayload | null> {
  try {
    const [payloadStr, signature] = token.split('.')
    if (!payloadStr || !signature) return null

    const expectedSig = await sign(payloadStr)
    if (signature !== expectedSig) return null

    const payload: ResellerSessionPayload = JSON.parse(base64UrlDecode(payloadStr))
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) return null

    return payload
  } catch {
    return null
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

export function getSessionToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value || null
}

export async function getSessionReseller(request: NextRequest): Promise<ResellerSessionPayload | null> {
  const token = getSessionToken(request)
  if (!token) return null
  return verifySessionToken(token)
}

// ============================================
// Public registration security helpers
// ============================================
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY || ''
const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const AUTH_RATE_LIMIT_REQUESTS = 5

export function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
}

export function normalizeIp(ip: string): string {
  try {
    if (ip.includes(':')) {
      const parts = ip.split(':')
      return parts.slice(0, 4).join(':') + '::/64'
    }
    return ip
  } catch {
    return ip
  }
}

export async function verifyCaptcha(token: string): Promise<{ success: boolean; score?: number; error?: string }> {
  if (!HCAPTCHA_SECRET) {
    if (IS_PRODUCTION) {
      return { success: false, error: 'CAPTCHA configuration error' }
    }
    return { success: true }
  }

  if (!token || token.trim() === '') {
    return { success: false, error: 'CAPTCHA token missing' }
  }

  try {
    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: HCAPTCHA_SECRET,
        response: token,
      }),
    })

    const result = await response.json()
    return {
      success: result.success,
      score: result.score,
      error: result['error-codes']?.join(', '),
    }
  } catch {
    return { success: false, error: 'Verification failed' }
  }
}

export async function checkAuthRateLimit(normalizedIp: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const now = new Date()
    const windowKey = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      Math.floor(now.getMinutes() / 10) * 10,
    ).toISOString()

    const { data: rateLimitRow } = await supabaseAdmin
      .from('rate_limits')
      .select('id, request_count, window_start')
      .eq('ip', normalizedIp)
      .eq('window_start', windowKey)
      .maybeSingle()

    if (rateLimitRow && rateLimitRow.request_count >= AUTH_RATE_LIMIT_REQUESTS) {
      return { allowed: false, reason: 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.' }
    }

    if (rateLimitRow?.id) {
      await supabaseAdmin
        .from('rate_limits')
        .update({
          request_count: Number(rateLimitRow.request_count || 0) + 1,
          updated_at: now.toISOString(),
        })
        .eq('id', rateLimitRow.id)
    } else {
      await supabaseAdmin
        .from('rate_limits')
        .insert({
          ip: normalizedIp,
          request_count: 1,
          window_start: windowKey,
          updated_at: now.toISOString(),
        })
    }

    return { allowed: true }
  } catch {
    return { allowed: true }
  }
}

export async function logAuthAbuse(
  request: NextRequest,
  captchaResult: { success: boolean; score?: number; error?: string },
  source: string,
) {
  try {
    await supabaseAdmin
      .from('abuse_logs')
      .insert({
        ip: getClientIp(request),
        user_agent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        origin: request.headers.get('origin'),
        captcha_score: captchaResult.score,
        captcha_result: captchaResult.success ? 'success' : (captchaResult.error || 'failed'),
        source,
      })
  } catch {
    // Non-critical logging only.
  }
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password minimal 8 karakter' }
  }
  if (password.length > 64) {
    return { valid: false, error: 'Password maksimal 64 karakter' }
  }
  return { valid: true }
}
