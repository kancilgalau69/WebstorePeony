import { NextRequest, NextResponse } from 'next/server'
import {
  supabaseAdmin,
  hashPassword,
  validatePassword,
  verifyCaptcha,
  checkAuthRateLimit,
  logAuthAbuse,
  isBotUserAgent,
  getClientIp,
  normalizeIp,
  createSessionToken,
  setSessionCookie,
} from '@/lib/auth'
import { sendTelegramToAdmins } from '@/lib/telegram-admin'

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizeEmail(email))
}

function normalizePhone(phone: string) {
  return String(phone || '').trim().replace(/\s+/g, '')
}

function isValidPhone(phone: string) {
  const p = normalizePhone(phone)
  // Indonesian phone: 08xxx or +628xxx, 10-15 digits
  return /^(\+62|62|0)8[0-9]{7,12}$/.test(p)
}

export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || ''
    const clientIp = getClientIp(request)
    const normalizedIp = normalizeIp(clientIp)

    // 1. Block bots
    if (isBotUserAgent(userAgent)) {
      await logAuthAbuse(request, { success: false, error: 'bot_user_agent' }, 'register_bot_block')
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 2. Parse body
    const body = await request.json()
    const { nama, email, phone, password, confirmPassword, captchaToken, token } = body

    const trimmedNama = String(nama || '').trim()
    const normalizedEmail = normalizeEmail(email)
    const normalizedPhone = normalizePhone(phone)
    const rawPassword = String(password || '')
    const rawConfirmPassword = String(confirmPassword || '')
    const normalizedToken = String(token || '').trim().toUpperCase()

    // 3. Basic validation
    if (!trimmedNama) {
      return NextResponse.json({ error: 'Nama tidak boleh kosong' }, { status: 400 })
    }
    if (trimmedNama.length < 2 || trimmedNama.length > 100) {
      return NextResponse.json({ error: 'Nama harus 2-100 karakter' }, { status: 400 })
    }

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 })
    }

    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      return NextResponse.json({ error: 'Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx' }, { status: 400 })
    }

    // 3b. Registration token validation (admin-issued, may allow multiple uses).
    if (!normalizedToken) {
      return NextResponse.json({ error: 'Token pendaftaran wajib diisi. Minta token ke admin.' }, { status: 400 })
    }

    const { data: tokenRow } = await supabaseAdmin
      .from('registration_tokens')
      .select('id, status, used_count, max_uses')
      .eq('token', normalizedToken)
      .limit(1)
      .single()

    if (!tokenRow) {
      return NextResponse.json({ error: 'Token pendaftaran tidak valid.' }, { status: 400 })
    }
    // Early, friendly check. The authoritative (atomic) claim happens after the
    // user row is created, so a race can never over-consume the token.
    const maxUses = Number(tokenRow.max_uses ?? 1) || 1
    const usedCount = Number(tokenRow.used_count ?? (tokenRow.status === 'used' ? 1 : 0)) || 0
    if (tokenRow.status !== 'unused' || usedCount >= maxUses) {
      return NextResponse.json({ error: 'Token pendaftaran sudah habis digunakan.' }, { status: 400 })
    }

    // 4. Password validation
    const passwordValidation = validatePassword(rawPassword)
    if (!passwordValidation.valid) {
      return NextResponse.json({
        error: 'Password tidak memenuhi persyaratan',
        passwordErrors: passwordValidation.errors,
      }, { status: 400 })
    }

    if (rawPassword !== rawConfirmPassword) {
      return NextResponse.json({ error: 'Konfirmasi password tidak cocok' }, { status: 400 })
    }

    // 5. CAPTCHA verification
    const captchaResult = await verifyCaptcha(captchaToken || '')
    if (!captchaResult.success) {
      await logAuthAbuse(request, captchaResult, 'register')
      return NextResponse.json({ error: 'Verifikasi CAPTCHA gagal. Silakan coba lagi.' }, { status: 400 })
    }

    // 6. Rate limit
    const rateLimitCheck = await checkAuthRateLimit(normalizedIp, 'register')
    if (!rateLimitCheck.allowed) {
      await logAuthAbuse(request, captchaResult, 'register_rate_limit')
      return NextResponse.json({ error: rateLimitCheck.reason || 'Rate limit exceeded' }, { status: 429 })
    }

    // 7. Check if email or phone already exists
    const { data: existingEmail } = await supabaseAdmin
      .from('user_web')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .single()

    if (existingEmail) {
      return NextResponse.json({ error: 'Email sudah terdaftar. Silakan login atau gunakan email lain.' }, { status: 409 })
    }

    const { data: existingPhone } = await supabaseAdmin
      .from('user_web')
      .select('id')
      .eq('phone', normalizedPhone)
      .limit(1)
      .single()

    if (existingPhone) {
      return NextResponse.json({ error: 'Nomor HP sudah terdaftar. Silakan login atau gunakan nomor lain.' }, { status: 409 })
    }

    // 8. Hash password
    const passwordHash = await hashPassword(rawPassword)

    // 9. Insert user
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('user_web')
      .insert({
        nama: trimmedNama,
        email: normalizedEmail,
        phone: normalizedPhone,
        password_hash: passwordHash,
      })
      .select('id, nama, email, phone, created_at')
      .single()

    if (insertError) {
      // Handle unique constraint violations
      if (insertError.code === '23505') {
        if (insertError.message.includes('email')) {
          return NextResponse.json({ error: 'Email sudah terdaftar.' }, { status: 409 })
        }
        if (insertError.message.includes('phone')) {
          return NextResponse.json({ error: 'Nomor HP sudah terdaftar.' }, { status: 409 })
        }
      }
      console.error('Register insert error:', insertError)
      return NextResponse.json({ error: 'Gagal mendaftarkan akun. Silakan coba lagi.' }, { status: 500 })
    }

    if (!newUser) {
      return NextResponse.json({ error: 'Gagal mendaftarkan akun.' }, { status: 500 })
    }

    // 9b. Consume one slot of the registration token.
    //     Atomic: the UPDATE only matches while a slot is still free, so two
    //     concurrent registrations can never share the last remaining slot.
    const { data: claimedToken } = await supabaseAdmin
      .rpc('claim_registration_token', {
        p_token: normalizedToken,
        p_user_id: newUser.id,
        p_email: normalizedEmail,
      })
      .maybeSingle()

    if (!claimedToken) {
      // Another request consumed the last slot first — roll back the new user.
      await supabaseAdmin.from('user_web').delete().eq('id', newUser.id)
      return NextResponse.json({ error: 'Token pendaftaran sudah habis digunakan.' }, { status: 400 })
    }

    // 10. Create session token & set cookie
    const sessionToken = await createSessionToken({
      id: newUser.id,
      email: newUser.email,
      nama: newUser.nama,
      phone: newUser.phone,
    })

    const response = NextResponse.json({
      success: true,
      message: 'Registrasi berhasil!',
      user: {
        id: newUser.id,
        nama: newUser.nama,
        email: newUser.email,
        phone: newUser.phone,
      },
    })

    setSessionCookie(response, sessionToken)
    try {
      await sendTelegramToAdmins([
        '👤 USER BARU TERDAFTAR',
        '',
        `Nama: ${newUser.nama}`,
        `Email: ${newUser.email}`,
        `Phone: ${newUser.phone}`,
        `Token: ${normalizedToken}`,
        `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
      ].join('\n'), 'REGISTER:new-user')
    } catch (notifyError: any) {
      console.warn('Failed sending new user Telegram notification', notifyError?.message || notifyError)
    }
    return response
  } catch (error: any) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: `Terjadi kesalahan: ${error.message || 'unknown error'}` },
      { status: 500 }
    )
  }
}
