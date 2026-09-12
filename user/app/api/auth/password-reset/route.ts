import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomInt } from 'crypto'
import { getSessionUser, hashPassword, supabaseAdmin, validatePassword, verifyPassword } from '@/lib/auth'
import { sendPasswordVerificationCode } from '@/lib/email/verification-code'

const CODE_TTL_MINUTES = 10

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

function hashCode(code: string) {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-session-secret-change-me'
  return createHash('sha256').update(`${code}:${secret}`).digest('hex')
}

function createCode() {
  return String(randomInt(100000, 1000000))
}

async function issueCode(user: any, purpose: 'forgot_password' | 'change_password') {
  const code = createCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString()

  await supabaseAdmin
    .from('password_reset_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('user_web_id', user.id)
    .eq('purpose', purpose)
    .is('used_at', null)

  const { error } = await supabaseAdmin.from('password_reset_codes').insert({
    user_web_id: user.id,
    email: user.email,
    code_hash: hashCode(code),
    purpose,
    expires_at: expiresAt,
  })
  if (error) throw new Error(error.message)

  await sendPasswordVerificationCode({ to: user.email, name: user.nama, code, purpose })
}

async function consumeCode(params: { userId: string; email: string; code: string; purpose: 'forgot_password' | 'change_password' }) {
  const now = new Date().toISOString()
  const { data } = await supabaseAdmin
    .from('password_reset_codes')
    .select('id')
    .eq('user_web_id', params.userId)
    .eq('email', params.email)
    .eq('purpose', params.purpose)
    .eq('code_hash', hashCode(params.code))
    .is('used_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.id) return false
  const { data: claimed } = await supabaseAdmin
    .from('password_reset_codes')
    .update({ used_at: now })
    .eq('id', data.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()
  return Boolean(claimed?.id)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '').trim()

    if (action === 'request_forgot') {
      const email = normalizeEmail(body.email)
      if (!email) return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
      const { data: user } = await supabaseAdmin
        .from('user_web')
        .select('id, nama, email, is_active')
        .eq('email', email)
        .maybeSingle()

      // Avoid user enumeration: return success even if email is not registered.
      if (user?.id && user.is_active !== false) await issueCode(user, 'forgot_password')
      return NextResponse.json({ success: true, message: 'Jika email terdaftar, kode verifikasi akan dikirim.' })
    }

    if (action === 'reset_forgot') {
      const email = normalizeEmail(body.email)
      const code = String(body.code || '').trim()
      const password = String(body.password || '')
      const confirmPassword = String(body.confirmPassword || '')
      if (!email || !code) return NextResponse.json({ error: 'Email dan kode wajib diisi' }, { status: 400 })
      if (password !== confirmPassword) return NextResponse.json({ error: 'Konfirmasi password tidak cocok' }, { status: 400 })
      const validation = validatePassword(password)
      if (!validation.valid) return NextResponse.json({ error: 'Password tidak memenuhi persyaratan', passwordErrors: validation.errors }, { status: 400 })

      const { data: user } = await supabaseAdmin.from('user_web').select('id, email').eq('email', email).maybeSingle()
      if (!user?.id) return NextResponse.json({ error: 'Kode verifikasi tidak valid atau sudah expired' }, { status: 400 })
      const ok = await consumeCode({ userId: user.id, email, code, purpose: 'forgot_password' })
      if (!ok) return NextResponse.json({ error: 'Kode verifikasi tidak valid atau sudah expired' }, { status: 400 })

      const passwordHash = await hashPassword(password)
      const { error } = await supabaseAdmin.from('user_web').update({ password_hash: passwordHash }).eq('id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: 'Password berhasil diubah. Silakan login.' })
    }

    if (action === 'request_change') {
      const session = await getSessionUser(request)
      if (!session) return NextResponse.json({ error: 'Unauthorized', requireAuth: true }, { status: 401 })
      const { data: user } = await supabaseAdmin.from('user_web').select('id, nama, email').eq('id', session.userId).single()
      if (!user?.id) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
      await issueCode(user, 'change_password')
      return NextResponse.json({ success: true, message: 'Kode verifikasi sudah dikirim ke email akun.' })
    }

    if (action === 'change_password') {
      const session = await getSessionUser(request)
      if (!session) return NextResponse.json({ error: 'Unauthorized', requireAuth: true }, { status: 401 })
      const currentPassword = String(body.currentPassword || '')
      const code = String(body.code || '').trim()
      const password = String(body.password || '')
      const confirmPassword = String(body.confirmPassword || '')
      if (!currentPassword || !code) return NextResponse.json({ error: 'Password lama dan kode wajib diisi' }, { status: 400 })
      if (password !== confirmPassword) return NextResponse.json({ error: 'Konfirmasi password tidak cocok' }, { status: 400 })
      const validation = validatePassword(password)
      if (!validation.valid) return NextResponse.json({ error: 'Password tidak memenuhi persyaratan', passwordErrors: validation.errors }, { status: 400 })

      const { data: user } = await supabaseAdmin.from('user_web').select('id, email, password_hash').eq('id', session.userId).single()
      if (!user?.id) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
      const currentOk = await verifyPassword(currentPassword, user.password_hash)
      if (!currentOk) return NextResponse.json({ error: 'Password lama salah' }, { status: 400 })
      const codeOk = await consumeCode({ userId: user.id, email: user.email, code, purpose: 'change_password' })
      if (!codeOk) return NextResponse.json({ error: 'Kode verifikasi tidak valid atau sudah expired' }, { status: 400 })

      const passwordHash = await hashPassword(password)
      const { error } = await supabaseAdmin.from('user_web').update({ password_hash: passwordHash }).eq('id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, message: 'Password berhasil diubah.' })
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Terjadi kesalahan server' }, { status: 500 })
  }
}
