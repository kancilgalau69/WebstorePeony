export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 })
    }

    // Find reseller by email
    const { data: reseller, error } = await supabaseAdmin
      .from('resellers')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !reseller) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
    }

    // Check if active
    if (!reseller.is_active) {
      return NextResponse.json({ error: 'Akun reseller Anda tidak aktif. Hubungi admin.' }, { status: 403 })
    }

    // Verify password
    const isValid = await verifyPassword(password, reseller.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
    }

    // Create session
    const token = await createSessionToken({
      id: reseller.id,
      email: reseller.email,
      nama_toko: reseller.nama_toko,
      slug: reseller.slug,
    })

    const response = NextResponse.json({
      success: true,
      reseller: {
        id: reseller.id,
        nama_toko: reseller.nama_toko,
        slug: reseller.slug,
        email: reseller.email,
      },
    })

    setSessionCookie(response, token)
    return response
  } catch (err: any) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
