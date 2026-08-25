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
    const { searchParams } = new URL(request.url)

    // Single order detail
    const orderId = searchParams.get('order_id')
    if (orderId) {
      const { data: order, error } = await supabaseAdmin
        .from('reseller_orders')
        .select('*')
        .eq('reseller_id', resellerId)
        .eq('order_id', orderId)
        .single()

      if (error || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      const { data: orderItems } = await supabaseAdmin
        .from('reseller_order_items')
        .select('*')
        .eq('order_id', order.id)

      return NextResponse.json({ order, orderItems: orderItems || [] })
    }

    // Fetch ALL reseller orders (same pattern as admin dashboard)
    const PAGE_SIZE = 1000
    let allOrders: any[] = []
    let from = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('reseller_orders')
        .select('id, order_id, customer_name, customer_email, customer_phone, total_amount, total_modal, komisi, status, payment_method, created_at, updated_at')
        .eq('reseller_id', resellerId)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        console.error('Orders fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
      }

      const rows = data || []
      allOrders = allOrders.concat(rows)

      if (rows.length < PAGE_SIZE) {
        hasMore = false
      } else {
        from += PAGE_SIZE
      }
    }

    // Fetch order_items for all orders
    const orderUUIDs = allOrders.map((o: any) => o.id).filter(Boolean)
    let orderItems: Record<string, any[]> = {}

    if (orderUUIDs.length > 0) {
      const chunkSize = 200
      for (let i = 0; i < orderUUIDs.length; i += chunkSize) {
        const chunk = orderUUIDs.slice(i, i + chunkSize)
        const { data: itemsData } = await supabaseAdmin
          .from('reseller_order_items')
          .select('id, order_id, product_code, product_name, quantity, harga_modal, harga_jual, item_data, sent, created_at')
          .in('order_id', chunk)

        ;(itemsData || []).forEach((item: any) => {
          if (!orderItems[item.order_id]) {
            orderItems[item.order_id] = []
          }
          orderItems[item.order_id].push(item)
        })
      }
    }

    return NextResponse.json({ orders: allOrders, orderItems })
  } catch (err: any) {
    console.error('Orders error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
