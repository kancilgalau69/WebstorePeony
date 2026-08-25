export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getSessionReseller, getResellerId, supabaseAdmin } from '@/lib/auth'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionReseller(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resellerId = await getResellerId(session)
    if (!resellerId) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404, headers: NO_CACHE_HEADERS })
    }

    // ============================================================
    // SINGLE SOURCE OF TRUTH: Calculate everything from actual data
    // This ensures consistency between local dev and production,
    // regardless of whether DB triggers have run or not.
    // ============================================================

    // 1. Get all completed orders for this reseller
    const { data: completedOrders } = await supabaseAdmin
      .from('reseller_orders')
      .select('total_amount, komisi')
      .eq('reseller_id', resellerId)
      .eq('status', 'completed')

    const totalPenjualan = (completedOrders || []).reduce(
      (sum: number, o: any) => sum + Number(o.total_amount || 0), 0
    )
    const totalKomisi = (completedOrders || []).reduce(
      (sum: number, o: any) => sum + Number(o.komisi || 0), 0
    )

    // 2. Get all completed withdrawals (money already sent out)
    const { data: completedWd } = await supabaseAdmin
      .from('reseller_withdrawals')
      .select('amount')
      .eq('reseller_id', resellerId)
      .eq('status', 'completed')

    const withdrawnAmount = (completedWd || []).reduce(
      (sum: number, w: any) => sum + Number(w.amount || 0), 0
    )

    // 3. Get pending/approved withdrawals (reserved but not yet sent)
    const { data: pendingWd } = await supabaseAdmin
      .from('reseller_withdrawals')
      .select('amount')
      .eq('reseller_id', resellerId)
      .in('status', ['pending', 'approved'])

    const pendingAmount = (pendingWd || []).reduce(
      (sum: number, w: any) => sum + Number(w.amount || 0), 0
    )

    // 4. Calculate saldo: total komisi earned - already withdrawn - pending withdrawal
    // This is the actual available balance
    const saldo = Math.max(0, totalKomisi - withdrawnAmount - pendingAmount)

    // 5. Sync DB trigger values if they've drifted
    // (non-blocking — fire and forget to keep response fast)
    const { data: reseller } = await supabaseAdmin
      .from('resellers')
      .select('saldo, total_penjualan, total_komisi')
      .eq('id', resellerId)
      .single()

    const dbSaldo = Number(reseller?.saldo || 0)
    const dbPenjualan = Number(reseller?.total_penjualan || 0)
    const dbKomisi = Number(reseller?.total_komisi || 0)

    // Expected DB saldo = totalKomisi - withdrawnAmount (trigger doesn't account for pending)
    const expectedDbSaldo = Math.max(0, totalKomisi - withdrawnAmount)

    // If DB values have drifted significantly, correct them
    const saldoDrift = Math.abs(dbSaldo - expectedDbSaldo)
    const komisiDrift = Math.abs(dbKomisi - totalKomisi)
    const penjualanDrift = Math.abs(dbPenjualan - totalPenjualan)

    if (saldoDrift > 1 || komisiDrift > 1 || penjualanDrift > 1) {
      // Auto-correct the resellers table to match actual calculated values
      supabaseAdmin
        .from('resellers')
        .update({
          saldo: expectedDbSaldo,
          total_penjualan: totalPenjualan,
          total_komisi: totalKomisi,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resellerId)
        .then(({ error }) => {
          if (error) {
            console.error('Balance auto-sync failed:', error.message)
          } else {
            console.log(`Balance auto-synced for reseller ${resellerId}: saldo=${expectedDbSaldo}, komisi=${totalKomisi}, penjualan=${totalPenjualan}`)
          }
        })
    }

    // 6. Get withdrawal history
    const { data: withdrawals } = await supabaseAdmin
      .from('reseller_withdrawals')
      .select('*')
      .eq('reseller_id', resellerId)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      saldo,
      total_penjualan: totalPenjualan,
      total_komisi: totalKomisi,
      pending_withdrawal: pendingAmount,
      withdrawn_total: withdrawnAmount,
      withdrawals: withdrawals || [],
    }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('Balance error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}
