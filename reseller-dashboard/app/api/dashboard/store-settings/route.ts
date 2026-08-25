export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionReseller, getResellerId, supabaseAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionReseller(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resellerId = await getResellerId(session)
    if (!resellerId) return NextResponse.json({ error: 'Reseller not found' }, { status: 404 })

    const { data: reseller, error } = await supabaseAdmin
      .from('resellers')
      .select('id, nama_toko, slug, email, phone, logo_url, deskripsi, alamat, whatsapp, instagram, warna_tema')
      .eq('id', resellerId)
      .single()

    if (error || !reseller) {
      return NextResponse.json({ error: 'Reseller tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ reseller })
  } catch (err: any) {
    console.error('Store settings GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionReseller(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resellerId = await getResellerId(session)
    if (!resellerId) return NextResponse.json({ error: 'Reseller not found' }, { status: 404 })
    const body = await request.json()
    const { nama_toko, slug, deskripsi, alamat, phone, whatsapp, instagram, warna_tema, logo_url } = body

    if (!nama_toko || !slug) {
      return NextResponse.json({ error: 'Nama toko dan slug wajib diisi' }, { status: 400 })
    }

    // Check slug uniqueness (exclude current reseller)
    const { data: existingSlug } = await supabaseAdmin
      .from('resellers')
      .select('id')
      .eq('slug', slug)
      .neq('id', resellerId)
      .maybeSingle()

    if (existingSlug) {
      return NextResponse.json({ error: 'Slug sudah digunakan oleh toko lain' }, { status: 409 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('resellers')
      .update({
        nama_toko,
        slug,
        deskripsi: deskripsi || null,
        alamat: alamat || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        instagram: instagram || null,
        warna_tema: warna_tema || '#5c63f2',
        logo_url: logo_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', resellerId)

    if (updateError) {
      console.error('Store settings update error:', updateError)
      return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 })
    }

    // Fetch fresh data after update
    const { data: fresh } = await supabaseAdmin
      .from('resellers')
      .select('id, nama_toko, slug, email, phone, logo_url, deskripsi, alamat, whatsapp, instagram, warna_tema, is_active')
      .eq('id', resellerId)
      .single()

    return NextResponse.json({ success: true, reseller: fresh })
  } catch (err: any) {
    console.error('Store settings error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
