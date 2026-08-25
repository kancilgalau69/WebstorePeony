export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data: stores, error } = await supabase
      .from('resellers')
      .select('slug, nama_toko, deskripsi, logo_url')
      .eq('is_active', true)
      .order('nama_toko')

    if (error) {
      console.error('Stores query error:', error)
      return NextResponse.json({ stores: [] })
    }

    return NextResponse.json({ stores: stores || [] })
  } catch (err: any) {
    console.error('Stores error:', err)
    return NextResponse.json({ stores: [] })
  }
}
