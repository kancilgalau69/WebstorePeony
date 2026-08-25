export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  supabaseAdmin,
  hashPassword,
  verifyCaptcha,
  checkAuthRateLimit,
  logAuthAbuse,
  validatePassword,
  getClientIp,
  normalizeIp,
} from '@/lib/auth'

const ADMIN_WHATSAPP = process.env.NEXT_PUBLIC_RESELLER_ADMIN_WHATSAPP || '6282340915319'

function jsonNoStore(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

async function isRegistrationEnabled() {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'reseller_registration_enabled')
      .maybeSingle()

    return data?.value !== 'false'
  } catch {
    return true
  }
}

async function notifyAdminNewReseller(reseller: {
  nama_reseller: string
  nama_toko: string
  email: string
  whatsapp?: string | null
}) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(id => id.trim()).filter(Boolean)

    if (!botToken || adminIds.length === 0) return

    const message = [
      '*PENDAFTARAN RESELLER BARU*',
      '',
      `Nama Reseller: *${reseller.nama_reseller}*`,
      `Nama Toko: *${reseller.nama_toko}*`,
      `Email: ${reseller.email}`,
      `WhatsApp: ${reseller.whatsapp || '-'}`,
      '',
      'Status: Menunggu aktivasi admin pusat',
      '',
      'Buka Dashboard Admin -> Resellers untuk mengaktifkan akun.',
    ].join('\n')

    const sendUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    await Promise.allSettled(
      adminIds.map(chatId =>
        fetch(sendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }),
        }),
      ),
    )
  } catch (err: any) {
    console.error('Reseller registration notify error:', err?.message || err)
  }
}

export async function GET() {
  const enabled = await isRegistrationEnabled()
  return jsonNoStore({ enabled, adminWhatsapp: ADMIN_WHATSAPP })
}

export async function POST(req: NextRequest) {
  try {
    const enabled = await isRegistrationEnabled()
    if (!enabled) {
      return jsonNoStore({ error: 'Pendaftaran reseller sedang ditutup sementara.' }, 403)
    }

    const ip = getClientIp(req)
    const rateLimit = await checkAuthRateLimit(normalizeIp(ip))
    if (!rateLimit.allowed) {
      return jsonNoStore({ error: rateLimit.reason || 'Terlalu banyak percobaan. Coba lagi nanti.' }, 429)
    }

    const body = await req.json()
    const {
      nama_reseller,
      nama_toko,
      slug,
      email,
      phone,
      whatsapp,
      password,
      confirmPassword,
      deskripsi,
      captchaToken,
    } = body

    if (!nama_reseller || !nama_toko || !slug || !email || !password || !confirmPassword) {
      return jsonNoStore({ error: 'Harap isi semua field wajib (*)' }, 400)
    }

    const captchaResult = await verifyCaptcha(captchaToken)
    if (!captchaResult.success) {
      await logAuthAbuse(req, captchaResult, 'register_reseller')
      return jsonNoStore({ error: 'Verifikasi keamanan (hCaptcha) gagal. Silakan coba lagi.' }, 400)
    }

    const cleanNamaReseller = String(nama_reseller).trim()
    if (cleanNamaReseller.length < 2 || cleanNamaReseller.length > 100) {
      return jsonNoStore({ error: 'Nama reseller harus 2-100 karakter' }, 400)
    }

    const cleanNamaToko = String(nama_toko).trim()
    if (cleanNamaToko.length < 2 || cleanNamaToko.length > 100) {
      return jsonNoStore({ error: 'Nama toko harus 2-100 karakter' }, 400)
    }

    const cleanSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (cleanSlug.length < 3) {
      return jsonNoStore({ error: 'Slug URL minimal 3 karakter (huruf kecil, angka, strip)' }, 400)
    }

    const cleanEmail = String(email).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return jsonNoStore({ error: 'Format email tidak valid' }, 400)
    }

    const cleanPhone = String(phone || '').trim()
    if (cleanPhone && !/^[0-9+\-\s()]{8,20}$/.test(cleanPhone)) {
      return jsonNoStore({ error: 'Format nomor telepon tidak valid (8-20 digit)' }, 400)
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return jsonNoStore({ error: passwordValidation.error || 'Password tidak valid' }, 400)
    }

    if (password !== confirmPassword) {
      return jsonNoStore({ error: 'Konfirmasi password tidak cocok' }, 400)
    }

    const { data: existingEmail } = await supabaseAdmin
      .from('resellers')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existingEmail) {
      return jsonNoStore({ error: 'Email sudah terdaftar sebagai reseller' }, 409)
    }

    const { data: existingSlug } = await supabaseAdmin
      .from('resellers')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle()

    if (existingSlug) {
      return jsonNoStore({ error: 'Slug URL sudah digunakan toko lain' }, 409)
    }

    const passwordHash = await hashPassword(password)
    const { data: newReseller, error: insertError } = await supabaseAdmin
      .from('resellers')
      .insert({
        nama_reseller: cleanNamaReseller,
        nama_toko: cleanNamaToko,
        slug: cleanSlug,
        email: cleanEmail,
        phone: cleanPhone || null,
        whatsapp: String(whatsapp || '').trim() || null,
        password_hash: passwordHash,
        deskripsi: String(deskripsi || '').trim() || null,
        is_active: false,
        saldo: 0,
        total_penjualan: 0,
        total_komisi: 0,
      })
      .select('id, nama_reseller, nama_toko, slug, email, whatsapp')
      .single()

    if (insertError || !newReseller) {
      console.error('Public reseller register insert error:', insertError)
      return jsonNoStore({ error: 'Gagal melakukan pendaftaran reseller' }, 500)
    }

    notifyAdminNewReseller(newReseller)

    return jsonNoStore({
      success: true,
      pendingActivation: true,
      message: 'Pendaftaran berhasil. Akun reseller Anda menunggu aktivasi admin pusat.',
      reseller: newReseller,
      adminWhatsapp: ADMIN_WHATSAPP,
    })
  } catch (err: any) {
    console.error('Public reseller register error:', err)
    return jsonNoStore({ error: err?.message || 'Server error' }, 500)
  }
}
