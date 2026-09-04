import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, getSessionUser, setSessionCookie, supabaseAdmin } from '@/lib/auth'

function isValidPhone(phone: string) {
  return /^(\+62|62|0)8[0-9]{7,12}$/.test(phone.replace(/\s+/g, ''))
}

function normalizePhone(phone: string) {
  return String(phone || '').trim().replace(/\s+/g, '')
}

function normalizeAvatarUrl(value: unknown) {
  const url = String(value || '').trim()
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'INVALID'
    return parsed.toString()
  } catch {
    return 'INVALID'
  }
}

export async function GET(request: NextRequest) {
  const session = await getSessionUser(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized', requireAuth: true }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('user_web')
    .select('id, nama, email, phone, avatar_url, is_active, created_at')
    .eq('id', session.userId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 })
  return NextResponse.json({ success: true, user: data })
}

export async function PUT(request: NextRequest) {
  const session = await getSessionUser(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized', requireAuth: true }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const nama = String(body.nama || '').trim()
  const phone = normalizePhone(String(body.phone || ''))
  const avatarUrl = normalizeAvatarUrl(body.avatar_url)

  if (nama.length < 2 || nama.length > 100) {
    return NextResponse.json({ error: 'Nama harus 2-100 karakter' }, { status: 400 })
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: 'Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx' }, { status: 400 })
  }
  if (avatarUrl === 'INVALID') {
    return NextResponse.json({ error: 'Link foto profil tidak valid. Gunakan URL http/https.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('user_web')
    .update({ nama, phone, avatar_url: avatarUrl })
    .eq('id', session.userId)
    .select('id, nama, email, phone, avatar_url, is_active, created_at')
    .single()

  if (error) {
    if (error.code === '23505' && String(error.message || '').includes('phone')) {
      return NextResponse.json({ error: 'Nomor HP sudah digunakan akun lain.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Gagal update profil' }, { status: 500 })
  }

  const sessionToken = await createSessionToken({ id: data.id, email: data.email, nama: data.nama, phone: data.phone })
  const response = NextResponse.json({ success: true, user: data })
  setSessionCookie(response, sessionToken)
  return response
}
