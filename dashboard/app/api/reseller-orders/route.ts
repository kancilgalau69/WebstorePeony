import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Fetch ALL rows from a Supabase table, bypassing the default 1000-row limit.
 */
async function fetchAll(
  supabase: ReturnType<typeof createServerClient>,
  table: string,
  options?: { orderBy?: string; ascending?: boolean }
) {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? false })
    }

    const { data, error } = await query
    if (error) throw error

    const rows = data || []
    allData = allData.concat(rows)
    hasMore = rows.length >= PAGE_SIZE
    from += PAGE_SIZE
  }

  return allData
}

export async function GET() {
  try {
    const supabase = createServerClient()

    // Fetch all reseller orders
    const orders = await fetchAll(supabase, 'reseller_orders', {
      orderBy: 'created_at',
      ascending: false,
    })

    // Fetch all resellers for name mapping
    const { data: resellers, error: resellersError } = await supabase
      .from('resellers')
      .select('id, nama_toko, slug, email')

    if (resellersError) {
      return NextResponse.json(
        { error: resellersError.message || 'Failed to load resellers' },
        { status: 500 }
      )
    }

    // Fetch reseller_order_items for all orders.
    // NOTE: In migration 014, reseller_order_items.order_id is the UUID FK to reseller_orders.id.
    const orderUUIDs = orders.map((o: any) => o.id).filter(Boolean)
    const orderItems: Record<string, any[]> = {}

    if (orderUUIDs.length > 0) {
      const chunkSize = 200
      for (let i = 0; i < orderUUIDs.length; i += chunkSize) {
        const chunk = orderUUIDs.slice(i, i + chunkSize)
        const { data: itemsData, error: itemsError } = await supabase
          .from('reseller_order_items')
          .select('*')
          .in('order_id', chunk)
          .range(0, 9999)

        if (itemsError) {
          console.error('Failed to load reseller order items:', itemsError)
          continue
        }

        ;(itemsData || []).forEach((item: any) => {
          const key = item.order_id
          if (!orderItems[key]) {
            orderItems[key] = []
          }
          orderItems[key].push(item)
        })
      }
    }

    return NextResponse.json({
      orders,
      resellers: resellers || [],
      orderItems,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load reseller orders' },
      { status: 500 }
    )
  }
}
