export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { sendResellerOrderEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      transaction_id,
    } = body

    // Verify Midtrans signature
    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex')

    if (signature_key !== expectedSignature) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    // Only process reseller orders (RS- prefix)
    if (!order_id?.startsWith('RS-')) {
      return NextResponse.json({ message: 'Not a reseller order, skipped' })
    }

    const supabase = getSupabaseAdmin()

    // Determine status
    let newStatus = 'pending'
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      if (fraud_status === 'accept' || !fraud_status) {
        newStatus = 'completed'
      }
    } else if (transaction_status === 'cancel' || transaction_status === 'deny') {
      newStatus = 'cancelled'
    } else if (transaction_status === 'expire') {
      newStatus = 'expired'
    }

    // Get current order
    const { data: order } = await supabase
      .from('reseller_orders')
      .select('*')
      .eq('order_id', order_id)
      .single()

    if (!order) {
      console.error('Order not found:', order_id)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Don't process if already completed
    if (order.status === 'completed') {
      return NextResponse.json({ message: 'Order already completed' })
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('reseller_orders')
      .update({
        status: newStatus,
        transaction_id: transaction_id || order.transaction_id,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', order_id)

    if (updateError) {
      console.error('Order update error:', updateError)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    // If completed, finalize items and create order_items
    if (newStatus === 'completed') {
      const items = order.items || []

      // Call finalize RPC ONCE for the whole order
      let rpcItems: any[] = []
      try {
        const { data: rpcResult } = await supabase.rpc('finalize_items_for_order', {
          p_order_id: order_id,
          p_user_id: 0,
        })
        // RPC returns JSON object: { ok: true, items: [...], count: N }
        if (rpcResult?.ok && Array.isArray(rpcResult.items)) {
          rpcItems = rpcResult.items
        }
      } catch (err: any) {
        console.error('Finalize RPC error:', err)
      }

      // Fallback: query product_items directly if RPC returned nothing
      if (rpcItems.length === 0) {
        try {
          const productCodes = items.map((i: any) => i.product_code).filter(Boolean)
          const { data: soldItems } = await supabase
            .from('product_items')
            .select('product_code, item_data')
            .eq('order_id', order_id)
            .eq('status', 'sold')
            .in('product_code', productCodes)

          if (soldItems && soldItems.length > 0) {
            rpcItems = soldItems
          }
        } catch (fallbackErr: any) {
          console.error('Sold items fallback error:', fallbackErr)
        }
      }

      // Group item_data by product_code
      const dataByCode = new Map<string, string[]>()
      for (const rpcItem of rpcItems) {
        const code = rpcItem.product_code
        if (!code) continue
        if (!dataByCode.has(code)) dataByCode.set(code, [])
        if (rpcItem.item_data) dataByCode.get(code)!.push(rpcItem.item_data)
      }

      // Save to reseller_order_items
      for (const item of items) {
        try {
          const itemDataParts = dataByCode.get(item.product_code) || []
          const combinedItemData = itemDataParts.join('\n') || null

          // Check if already exists
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
        } catch (err: any) {
          console.error('Insert order item error:', err)
        }
      }

      // Notify admin
      let resellerStoreName = ''
      try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').filter(Boolean)

        if (botToken && adminIds.length > 0) {
          // Get reseller name
          const { data: reseller } = await supabase
            .from('resellers')
            .select('nama_toko')
            .eq('id', order.reseller_id)
            .single()

          resellerStoreName = reseller?.nama_toko || ''

          const items = order.items || []
          const itemLines = items.map((item: any, i: number) =>
            `   ${i + 1}. ${item.product_name} x${item.quantity} — Rp ${Number(item.harga_jual).toLocaleString('id-ID')}`
          ).join('\n')

          const msg = `✅ *Pembayaran Reseller Berhasil!*\n\n📋 Order: \`${order_id}\`\n🏪 Toko: ${reseller?.nama_toko || '-'}\n👤 Customer: ${order.customer_name}\n📧 Email: ${order.customer_email || '-'}\n\n🛍 *Produk:*\n${itemLines}\n\n💰 Total: Rp ${Number(order.total_amount).toLocaleString('id-ID')}\n💵 Komisi: Rp ${Number(order.komisi).toLocaleString('id-ID')}`

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

      // Send delivery email to customer
      try {
        // Fetch stored order items with item_data
        const { data: orderItems } = await supabase
          .from('reseller_order_items')
          .select('product_name, product_code, quantity, harga_jual, item_data')
          .eq('order_id', order.id)

        // If no reseller name fetched yet, fetch it now
        if (!resellerStoreName) {
          const { data: reseller } = await supabase
            .from('resellers')
            .select('nama_toko')
            .eq('id', order.reseller_id)
            .single()
          resellerStoreName = reseller?.nama_toko || ''
        }

        const emailResult = await sendResellerOrderEmail({
          orderId: order_id,
          customerName: order.customer_name || 'Customer',
          customerEmail: order.customer_email,
          totalAmount: Number(order.total_amount) || 0,
          storeName: resellerStoreName || undefined,
          items: (orderItems || items).map((item: any) => ({
            productName: item.product_name,
            productCode: item.product_code,
            quantity: item.quantity,
            price: Number(item.harga_jual) || 0,
            itemData: item.item_data || null,
          })),
        })

        if (!emailResult.ok) {
          console.error('Reseller order email failed:', emailResult.error)
        } else {
          console.log('Reseller order email sent to:', order.customer_email)
        }
      } catch (emailErr: any) {
        console.error('Reseller order email error:', emailErr.message)
      }
    }

    // If cancelled/expired, release items
    if (newStatus === 'cancelled' || newStatus === 'expired') {
      try {
        await supabase.rpc('release_reserved_items', { p_order_id: order_id })
      } catch (err: any) {
        console.error('Release items error:', err)
      }
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
