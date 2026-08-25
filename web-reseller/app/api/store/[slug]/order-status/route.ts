export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { sendResellerOrderEmail } from '@/lib/email'

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
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    const supabase = getSupabaseAdmin()

    const { data: order, error } = await supabase
      .from('reseller_orders')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: NO_CACHE_HEADERS })
    }

    // If DB already shows completed/cancelled/expired, return immediately
    if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'expired') {
      return NextResponse.json({ status: order.status, order_id: order.order_id }, { headers: NO_CACHE_HEADERS })
    }

    // DB still shows pending - check Midtrans directly for real-time status
    const midtransStatus = await checkMidtransStatus(orderId)

    if (midtransStatus) {
      const { transactionStatus, fraudStatus } = midtransStatus

      let resolvedStatus = 'pending'
      if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
        if (fraudStatus === 'accept' || !fraudStatus) {
          resolvedStatus = 'completed'
        }
      } else if (transactionStatus === 'cancel' || transactionStatus === 'deny') {
        resolvedStatus = 'cancelled'
      } else if (transactionStatus === 'expire') {
        resolvedStatus = 'expired'
      }

      // If Midtrans shows a final status different from DB, sync it
      if (resolvedStatus !== 'pending' && resolvedStatus !== order.status) {
        try {
          const { data: updated } = await supabase
            .from('reseller_orders')
            .update({
              status: resolvedStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('order_id', orderId)
            .eq('status', 'pending') // Only update if still pending (avoid race condition with webhook)
            .select('*')
            .single()

          // If we successfully claimed the status update and it's completed,
          // run item finalization (same as webhook) to avoid stuck orders
          if (updated && resolvedStatus === 'completed') {
            await finalizeOrderItems(supabase, updated, orderId)
          }

          // If cancelled/expired, release reserved items
          if (updated && (resolvedStatus === 'cancelled' || resolvedStatus === 'expired')) {
            try {
              await supabase.rpc('release_reserved_items', { p_order_id: orderId })
            } catch {}
          }
        } catch (syncErr: any) {
          console.error('Order status sync error:', syncErr)
        }

        return NextResponse.json({
          status: resolvedStatus,
          order_id: order.order_id,
          midtrans_status: transactionStatus,
        }, { headers: NO_CACHE_HEADERS })
      }

      return NextResponse.json({
        status: order.status,
        order_id: order.order_id,
        midtrans_status: transactionStatus,
      }, { headers: NO_CACHE_HEADERS })
    }

    // Midtrans check failed, return DB status as fallback
    return NextResponse.json({ status: order.status, order_id: order.order_id }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('Order status error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}

async function finalizeOrderItems(supabase: any, order: any, orderId: string) {
  try {
    const items = order.items || []
    if (items.length === 0) return

    // Check if items already exist in reseller_order_items
    const { data: existingItems } = await supabase
      .from('reseller_order_items')
      .select('product_code, item_data')
      .eq('order_id', order.id)

    const hasExistingData = (existingItems || []).some((i: any) =>
      i.item_data && String(i.item_data).trim().length > 0
    )

    // If items already finalized, skip
    if (hasExistingData) return

    // Step 1: Call finalize RPC ONCE for the whole order
    let rpcItems: any[] = []
    try {
      const { data: rpcResult } = await supabase.rpc('finalize_items_for_order', {
        p_order_id: orderId,
        p_user_id: 0,
      })
      // RPC returns JSON object: { ok: true, items: [...], count: N }
      if (rpcResult?.ok && Array.isArray(rpcResult.items)) {
        rpcItems = rpcResult.items
      }
    } catch (rpcErr: any) {
      console.error('Finalize RPC error (status-check):', rpcErr.message)
    }

    // Step 2: If RPC didn't return items, fallback to querying product_items directly
    if (rpcItems.length === 0) {
      try {
        const productCodes = items.map((i: any) => i.product_code).filter(Boolean)
        const { data: soldItems } = await supabase
          .from('product_items')
          .select('product_code, item_data')
          .eq('order_id', orderId)
          .eq('status', 'sold')
          .in('product_code', productCodes)

        if (soldItems && soldItems.length > 0) {
          rpcItems = soldItems
        }
      } catch (fallbackErr: any) {
        console.error('Sold items fallback error (status-check):', fallbackErr.message)
      }
    }

    // Step 3: Group item_data by product_code and save to reseller_order_items
    const dataByCode = new Map<string, string[]>()
    for (const rpcItem of rpcItems) {
      const code = rpcItem.product_code
      if (!code) continue
      if (!dataByCode.has(code)) dataByCode.set(code, [])
      if (rpcItem.item_data) dataByCode.get(code)!.push(rpcItem.item_data)
    }

    for (const item of items) {
      const itemDataParts = dataByCode.get(item.product_code) || []
      const combinedItemData = itemDataParts.join('\n') || null

      try {
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
        } else if (combinedItemData) {
          await supabase.from('reseller_order_items')
            .update({ item_data: combinedItemData, sent: true, sent_at: new Date().toISOString() })
            .eq('id', existing.id)
        }
      } catch (insertErr: any) {
        console.error('Insert order item error (status-check):', insertErr.message)
      }
    }

    // Send email to customer (only if we have item data)
    if (rpcItems.length > 0) {
      try {
        const { data: orderItems } = await supabase
          .from('reseller_order_items')
          .select('product_name, product_code, quantity, harga_jual, item_data')
          .eq('order_id', order.id)

        let storeName = ''
        try {
          const { data: reseller } = await supabase
            .from('resellers')
            .select('nama_toko')
            .eq('id', order.reseller_id)
            .single()
          storeName = reseller?.nama_toko || ''
        } catch {}

        await sendResellerOrderEmail({
          orderId,
          customerName: order.customer_name || 'Customer',
          customerEmail: order.customer_email,
          totalAmount: Number(order.total_amount) || 0,
          storeName: storeName || undefined,
          items: (orderItems || []).map((item: any) => ({
            productName: item.product_name,
            productCode: item.product_code,
            quantity: item.quantity,
            price: Number(item.harga_jual) || 0,
            itemData: item.item_data || null,
          })),
        })
      } catch (emailErr: any) {
        console.error('Email send error (status-check):', emailErr.message)
      }
    }

    // Notify admin via Telegram
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').filter(Boolean)

      if (botToken && adminIds.length > 0) {
        let storeName = ''
        try {
          const { data: reseller } = await supabase
            .from('resellers')
            .select('nama_toko')
            .eq('id', order.reseller_id)
            .single()
          storeName = reseller?.nama_toko || ''
        } catch {}

        const items = order.items || []
        const itemLines = items.map((item: any, i: number) =>
          `   ${i + 1}. ${item.product_name} x${item.quantity} — Rp ${Number(item.harga_jual).toLocaleString('id-ID')}`
        ).join('\n')

        const msg = `✅ *Pembayaran Reseller Berhasil!*\n\n📋 Order: \`${orderId}\`\n🏪 Toko: ${storeName || '-'}\n👤 Customer: ${order.customer_name}\n📧 Email: ${order.customer_email || '-'}\n\n🛍 *Produk:*\n${itemLines}\n\n💰 Total: Rp ${Number(order.total_amount).toLocaleString('id-ID')}\n💵 Komisi: Rp ${Number(order.komisi || 0).toLocaleString('id-ID')}\n⚠️ _Detected via polling_`

        for (const adminId of adminIds) {
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: adminId.trim(),
              text: msg,
              parse_mode: 'Markdown',
            }),
          }).catch(() => {})
        }
      }
    } catch {}
  } catch (err: any) {
    console.error('finalizeOrderItems error:', err)
  }
}

async function checkMidtransStatus(orderId: string): Promise<{ transactionStatus: string; fraudStatus?: string } | null> {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    if (!serverKey) return null

    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const apiBase = isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com'

    const auth = Buffer.from(serverKey + ':').toString('base64')
    const url = `${apiBase}/v2/${encodeURIComponent(orderId)}/status`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    })

    if (!response.ok) {
      console.error(`Midtrans status check failed: ${response.status}`)
      return null
    }

    const data = await response.json()
    return {
      transactionStatus: data.transaction_status || 'pending',
      fraudStatus: data.fraud_status,
    }
  } catch (err: any) {
    console.error('Midtrans status check error:', err.message)
    return null
  }
}
