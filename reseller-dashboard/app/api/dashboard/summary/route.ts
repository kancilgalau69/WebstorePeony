export const dynamic = 'force-dynamic'
export const revalidate = 0

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
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 })
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // ============================================================
    // SINGLE SOURCE OF TRUTH: Calculate from actual order data
    // ============================================================

    // Fetch all orders for this reseller
    const { data: allOrders } = await supabaseAdmin
      .from('reseller_orders')
      .select('id, order_id, customer_name, status, total_amount, komisi, created_at')
      .eq('reseller_id', resellerId)
      .order('created_at', { ascending: false })

    const orders = allOrders || []

    // Calculate lifetime stats from actual completed orders
    const completedOrders = orders.filter(o => o.status === 'completed')
    const lifetimePenjualan = completedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    const lifetimeKomisi = completedOrders.reduce((sum, o) => sum + Number(o.komisi || 0), 0)

    // Calculate saldo: total komisi - withdrawn
    const { data: completedWd } = await supabaseAdmin
      .from('reseller_withdrawals')
      .select('amount')
      .eq('reseller_id', resellerId)
      .eq('status', 'completed')

    const { data: pendingWd } = await supabaseAdmin
      .from('reseller_withdrawals')
      .select('amount')
      .eq('reseller_id', resellerId)
      .in('status', ['pending', 'approved'])

    const withdrawnAmount = (completedWd || []).reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)
    const pendingAmount = (pendingWd || []).reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)
    const saldo = Math.max(0, lifetimeKomisi - withdrawnAmount - pendingAmount)

    // Stats
    const totalOrders = orders.length
    const todayOrders = orders.filter(o => o.created_at >= todayStart).length
    const monthCompleted = completedOrders.filter(o => o.created_at >= monthStart)
    const monthRevenue = monthCompleted.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    const monthKomisi = monthCompleted.reduce((sum, o) => sum + Number(o.komisi || 0), 0)

    // Chart data: last 7 days order count + revenue
    const chartData = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString()
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString()

      const dayOrders = orders.filter(o => o.created_at >= dayStart && o.created_at < dayEnd)
      const dayCompleted = dayOrders.filter(o => o.status === 'completed')
      const dayRevenue = dayCompleted.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)

      chartData.push({
        date: date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        orders: dayOrders.length,
        revenue: dayRevenue,
      })
    }

    // Recent orders (last 5) — already have all fields from the query above
    const recentOrders = orders.slice(0, 5).map(o => ({
      id: o.id,
      order_id: o.order_id,
      customer_name: o.customer_name || '-',
      total_amount: Number(o.total_amount || 0),
      komisi: Number(o.komisi || 0),
      status: o.status,
      created_at: o.created_at,
    }))

    return NextResponse.json({
      // Stats
      totalOrders,
      todayOrders,
      monthRevenue,
      monthKomisi,
      // Lifetime (calculated from actual data, not DB trigger values)
      saldo,
      lifetimePenjualan,
      lifetimeKomisi,
      // Chart
      chartData,
      // Recent
      recentOrders,
    })
  } catch (err: any) {
    console.error('Summary error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
