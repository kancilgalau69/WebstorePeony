export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionReseller, getResellerId, supabaseAdmin, verifyPassword, hashPassword } from '@/lib/auth'

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionReseller(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resellerId = await getResellerId(session)
    if (!resellerId) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 })
    }

    const { current_password, new_password } = await request.json()

    if (!current_password || !new_password) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
    }

    if (new_password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }

    // Get current password hash
    const { data: reseller } = await supabaseAdmin
      .from('resellers')
      .select('password_hash')
      .eq('id', resellerId)
      .single()

    if (!reseller) {
      return NextResponse.json({ error: 'Reseller tidak ditemukan' }, { status: 404 })
    }

    // Verify current password
    const isValid = await verifyPassword(current_password, reseller.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: 'Password saat ini salah' }, { status: 401 })
    }

    // Hash new password
    const newHash = await hashPassword(new_password)

    const { error } = await supabaseAdmin
      .from('resellers')
      .update({
        password_hash: newHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', resellerId)

    if (error) {
      return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Password change error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
