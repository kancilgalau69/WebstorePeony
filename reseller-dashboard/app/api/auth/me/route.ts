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
    if (!resellerId) {
      return NextResponse.json({ error: 'Reseller tidak ditemukan' }, { status: 404 })
    }

    // Get fresh data from database
    const { data: reseller, error } = await supabaseAdmin
      .from('resellers')
      .select('id, nama_toko, slug, email, phone, logo_url, deskripsi, alamat, whatsapp, instagram, warna_tema, is_active, saldo, total_penjualan, total_komisi, created_at')
      .eq('id', resellerId)
      .single()

    if (error || !reseller) {
      return NextResponse.json({ error: 'Reseller tidak ditemukan' }, { status: 404 })
    }

    // Always calculate saldo from actual order data (don't rely on trigger)
    const { data: completedOrders } = await supabaseAdmin
      .from('reseller_orders')
      .select('total_amount, komisi')
      .eq('reseller_id', resellerId)
      .eq('status', 'completed')

    const calcKomisi = (completedOrders || []).reduce((sum: number, o: any) => sum + Number(o.komisi || 0), 0)
    const calcPenjualan = (completedOrders || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0)

    // Get total withdrawn
    const { data: completedWd } = await supabaseAdmin
      .from('reseller_withdrawals')
      .select('amount')
      .eq('reseller_id', resellerId)
      .eq('status', 'completed')

    const withdrawn = (completedWd || []).reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)

    // Saldo = total komisi earned - total withdrawn
    reseller.saldo = Math.max(0, calcKomisi - withdrawn)
    reseller.total_penjualan = calcPenjualan
    reseller.total_komisi = calcKomisi

    return NextResponse.json({ reseller })
  } catch (err: any) {
    console.error('Auth me error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
