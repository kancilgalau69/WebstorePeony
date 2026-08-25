export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = getSupabaseAdmin()
    const { data: store, error } = await supabase
      .from('resellers')
      .select('id, nama_toko, slug, deskripsi, logo_url, whatsapp, instagram, warna_tema')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .single()

    if (error || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: NO_CACHE_HEADERS })
    }

    return NextResponse.json({ store }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('Store fetch error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}
