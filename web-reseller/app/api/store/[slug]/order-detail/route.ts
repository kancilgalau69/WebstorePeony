export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

function hasNonEmptyItemData(value: unknown) {
  return String(value || '').trim().length > 0
}

async function attachProductNotes(supabase: any, items: any[], orderId: string) {
  try {
    if (!items || items.length === 0 || !orderId) return items
    const codes = Array.from(new Set(items.map((it: any) => it.product_code).filter(Boolean)))
    if (codes.length === 0) return items

    const { data } = await supabase
      .from('product_items')
      .select('product_code, notes')
      .eq('order_id', orderId)
      .eq('status', 'sold')
      .in('product_code', codes)

    const notesMap = new Map<string, string[]>()
    for (const row of (data || [])) {
      const code = row.product_code
      const note = String(row.notes || '').trim()
      if (!code || !note) continue
      const list = notesMap.get(code) || []
      if (!list.includes(note)) list.push(note)
      notesMap.set(code, list)
    }

    return items.map((it: any) => ({
      ...it,
      product_notes: (notesMap.get(it.product_code) || []).join('\n'),
    }))
  } catch {
    return items
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    const supabase = getSupabaseAdmin()

    // Get order
    const { data: order, error } = await supabase
      .from('reseller_orders')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: NO_CACHE_HEADERS })
    }

    // If order is not completed yet, return current status
    if (order.status !== 'completed') {
      const snapshotItems = (order.items || []).map((item: any) => ({
        product_name: item.product_name,
        product_code: item.product_code,
        quantity: item.quantity,
        price: Number(item.harga_jual) || 0,
        item_data: null,
      }))

      return NextResponse.json({
        success: true,
        orderId: order.order_id,
        status: order.status,
        totalAmount: Number(order.total_amount) || 0,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        items: snapshotItems,
        itemsReady: false,
      }, { headers: NO_CACHE_HEADERS })
    }

    // Order is completed - try to get fulfilled items from reseller_order_items
    const { data: orderItems } = await supabase
      .from('reseller_order_items')
      .select('product_name, product_code, quantity, harga_jual, item_data')
      .eq('order_id', order.id)

    // Check if items have actual item_data
    const itemsWithData = (orderItems || []).filter((item: any) => hasNonEmptyItemData(item.item_data))

    if (itemsWithData.length > 0) {
      // Items are ready - attach product notes and return
      const itemsWithNotes = await attachProductNotes(
        supabase,
        orderItems!.map((item: any) => ({
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          price: Number(item.harga_jual) || 0,
          item_data: item.item_data || null,
        })),
        orderId
      )

      return NextResponse.json({
        success: true,
        orderId: order.order_id,
        status: 'completed',
        totalAmount: Number(order.total_amount) || 0,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        items: itemsWithNotes,
        itemsReady: true,
      }, { headers: NO_CACHE_HEADERS })
    }

    // Items not ready yet - attempt finalization
    const snapshotItems = order.items || []
    let finalizedAny = false

    // Step 1: Try finalize_items_for_order RPC
    if (snapshotItems.length > 0 && (!orderItems || orderItems.length === 0)) {
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_items_for_order', {
          p_order_id: orderId,
          p_user_id: 0,
        })

        // RPC returns JSON object: { ok: true, items: [...], count: N }
        const rpcItemsArray = rpcResult?.ok && Array.isArray(rpcResult.items) ? rpcResult.items : []

        if (!rpcError && rpcItemsArray.length > 0) {
          // RPC returned items - save them
          for (const item of snapshotItems) {
            const itemDataParts = rpcItemsArray
              .filter((r: any) => r.product_code === item.product_code)
              .map((r: any) => r.item_data)
              .filter(Boolean)

            const combinedItemData = itemDataParts.join('\n') || null
            if (!combinedItemData) continue

            // Check if already saved
            const { data: existing } = await supabase
              .from('reseller_order_items')
              .select('id')
              .eq('order_id', order.id)
              .eq('product_code', item.product_code)
              .maybeSingle()

            if (!existing) {
              await supabase.from('reseller_order_items').insert({
                order_id: order.id,
                product_id: item.product_id,
                product_code: item.product_code,
                product_name: item.product_name,
                quantity: item.quantity,
                harga_modal: item.harga_modal,
                harga_jual: item.harga_jual,
                item_data: combinedItemData,
                sent: true,
                sent_at: new Date().toISOString(),
              })
            } else {
              await supabase.from('reseller_order_items')
                .update({ item_data: combinedItemData, sent: true, sent_at: new Date().toISOString() })
                .eq('id', existing.id)
            }
          }
          finalizedAny = true
        }
      } catch (rpcErr: any) {
        console.error('Finalize RPC error:', rpcErr.message)
      }
    }

    // Step 2: Fallback - query product_items directly for sold items with this order_id
    if (!finalizedAny) {
      try {
        const productCodes = snapshotItems.map((i: any) => i.product_code).filter(Boolean)

        if (productCodes.length > 0) {
          const { data: soldItems } = await supabase
            .from('product_items')
            .select('product_code, item_data')
            .eq('order_id', orderId)
            .eq('status', 'sold')
            .in('product_code', productCodes)

          if (soldItems && soldItems.length > 0) {
            // Group by product_code
            const soldByCode = new Map<string, string[]>()
            for (const sold of soldItems) {
              const code = sold.product_code
              if (!soldByCode.has(code)) soldByCode.set(code, [])
              if (sold.item_data) soldByCode.get(code)!.push(sold.item_data)
            }

            // Save to reseller_order_items
            for (const item of snapshotItems) {
              const itemDataParts = soldByCode.get(item.product_code) || []
              const combinedItemData = itemDataParts.join('\n') || null

              if (combinedItemData) {
                const { data: existing } = await supabase
                  .from('reseller_order_items')
                  .select('id')
                  .eq('order_id', order.id)
                  .eq('product_code', item.product_code)
                  .maybeSingle()

                if (!existing) {
                  await supabase.from('reseller_order_items').insert({
                    order_id: order.id,
                    product_id: item.product_id,
                    product_code: item.product_code,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    harga_modal: item.harga_modal,
                    harga_jual: item.harga_jual,
                    item_data: combinedItemData,
                    sent: true,
                    sent_at: new Date().toISOString(),
                  })
                } else {
                  await supabase.from('reseller_order_items')
                    .update({ item_data: combinedItemData, sent: true, sent_at: new Date().toISOString() })
                    .eq('id', existing.id)
                }
                finalizedAny = true
              }
            }
          }
        }
      } catch (fallbackErr: any) {
        console.error('Sold items fallback error:', fallbackErr.message)
      }
    }

    // Re-fetch items after finalization attempts
    const { data: finalItems } = await supabase
      .from('reseller_order_items')
      .select('product_name, product_code, quantity, harga_jual, item_data')
      .eq('order_id', order.id)

    const finalItemsWithData = (finalItems || []).filter((item: any) => hasNonEmptyItemData(item.item_data))
    const itemsReady = finalItemsWithData.length > 0

    // Build response items - use fulfilled items if available, otherwise snapshot
    const responseItems = (finalItems && finalItems.length > 0)
      ? finalItems.map((item: any) => ({
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          price: Number(item.harga_jual) || 0,
          item_data: item.item_data || null,
        }))
      : snapshotItems.map((item: any) => ({
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          price: Number(item.harga_jual) || 0,
          item_data: null,
        }))

    // Return "processing" if items still don't have data (keeps frontend polling)
    const effectiveStatus = itemsReady ? 'completed' : 'processing'

    return NextResponse.json({
      success: true,
      orderId: order.order_id,
      status: effectiveStatus,
      totalAmount: Number(order.total_amount) || 0,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      items: responseItems,
      itemsReady,
    }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('Order detail error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}
