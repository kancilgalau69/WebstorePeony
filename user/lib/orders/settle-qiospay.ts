import { createClient } from '@supabase/supabase-js'
import {
  isValidCustomerEmail,
  normalizeCustomerEmail,
  sendOrderDeliveryEmailWithRetry,
} from '@/lib/email/smtp-delivery'
import { logError, logInfo, logWarn } from '@/lib/logging/terminal-log'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

const supabase = createClient(supabaseUrl, supabaseServerKey)

const hasData = (v: unknown) => String(v || '').trim().length > 0

export interface SettleResult {
  completed: boolean
  itemsReady: boolean
  alreadyCompleted?: boolean
}

/**
 * Settle a paid Qiospay order IN-PROCESS (no self-HTTP).
 *
 * Steps (idempotent):
 *  1. Flip order pending -> completed (guarded by .neq completed).
 *  2. finalize_items_for_order RPC (reserved -> sold), with product_items fallback.
 *  3. Persist item_data into order_items.
 *  4. Send the delivery email (claimed via delivery_email_status lock).
 *
 * Safe to call from the webhook, the payment-status poller, and the callback route.
 */
export async function settleQiospayOrder(orderId: string, expectedAmount?: number): Promise<SettleResult> {
  // Load order
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_id, status, customer_name, customer_email, total_amount, items, paid_at, created_at, delivery_email_status, delivery_email_attempts')
    .eq('order_id', orderId)
    .single()

  if (!order) {
    logWarn('SETTLE', 'Order not found', { orderId })
    return { completed: false, itemsReady: false }
  }

  const alreadyCompleted = String(order.status).toLowerCase() === 'completed'

  // 1. Mark completed (idempotent)
  if (!alreadyCompleted) {
    const { error: updErr } = await supabase
      .from('orders')
      .update({ status: 'completed', paid_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .neq('status', 'completed')
    if (updErr) {
      logWarn('SETTLE', 'Order update failed', { orderId, message: updErr.message })
    }
  }

  // 2. Finalize items (reserved -> sold)
  let finalized: any[] = []
  try {
    const { data: rpc, error } = await supabase.rpc('finalize_items_for_order', {
      p_order_id: orderId,
      p_user_id: 0,
    })
    if (error) {
      logWarn('SETTLE', 'finalize RPC error', { orderId, message: error.message })
    } else if (rpc?.ok && Array.isArray(rpc.items)) {
      finalized = rpc.items
    }
  } catch (e: any) {
    logWarn('SETTLE', 'finalize RPC threw', { orderId, error: e?.message })
  }

  // Fallback: fetch already-sold items for this order
  if (finalized.length === 0) {
    try {
      const codes = (order.items || []).map((i: any) => i.product_code).filter(Boolean)
      if (codes.length > 0) {
        const { data: sold } = await supabase
          .from('product_items')
          .select('product_code, item_data')
          .eq('order_id', orderId)
          .eq('status', 'sold')
          .in('product_code', codes)
        if (sold && sold.length > 0) finalized = sold
      }
    } catch (e: any) {
      logWarn('SETTLE', 'sold fallback error', { orderId, error: e?.message })
    }
  }

  // 3. Persist into order_items (group item_data by product_code)
  const dataByCode = new Map<string, string[]>()
  for (const it of finalized) {
    const code = it.product_code
    if (!code) continue
    if (!dataByCode.has(code)) dataByCode.set(code, [])
    if (it.item_data) dataByCode.get(code)!.push(it.item_data)
  }

  for (const snap of order.items || []) {
    const parts = dataByCode.get(snap.product_code) || []
    const combined = parts.join('\n') || null
    if (!combined) continue
    try {
      const { data: existing } = await supabase
        .from('order_items')
        .select('id, item_data')
        .eq('order_id', order.id)
        .eq('product_code', snap.product_code)
        .maybeSingle()

      if (!existing) {
        await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: snap.product_id || null,
          product_code: snap.product_code,
          product_name: snap.product_name || snap.product_code,
          quantity: snap.quantity || 1,
          price: snap.price || 0,
          item_data: combined,
          sent: true,
        })
      } else if (!hasData(existing.item_data)) {
        await supabase.from('order_items')
          .update({ item_data: combined, sent: true })
          .eq('id', existing.id)
      }
    } catch (e: any) {
      logWarn('SETTLE', 'order_items upsert error', { orderId, code: snap.product_code, error: e?.message })
    }
  }

  // Verify items ready
  const { data: finalItems } = await supabase
    .from('order_items')
    .select('product_code, item_data')
    .eq('order_id', order.id)
  const itemsReady = (finalItems || []).some((i: any) => hasData(i.item_data))

  // 4. Send delivery email (claim lock to avoid duplicates)
  if (itemsReady) {
    await sendDeliveryEmail(order.id, orderId)
  }

  logInfo('SETTLE', 'Qiospay order settled', {
    orderId, itemsReady, finalizedCount: finalized.length, alreadyCompleted,
  })

  return { completed: true, itemsReady, alreadyCompleted }
}

async function sendDeliveryEmail(orderUuid: string, orderId: string) {
  try {
    // Claim: only send if status is pending/failed
    const { data: claimed } = await supabase
      .from('orders')
      .update({
        delivery_email_status: 'processing',
        delivery_email_last_attempt_at: new Date().toISOString(),
        delivery_email_last_error: null,
      })
      .eq('order_id', orderId)
      .in('delivery_email_status', ['pending', 'failed'])
      .select('order_id, customer_name, customer_email, total_amount, paid_at, created_at, delivery_email_attempts')
      .maybeSingle()

    if (!claimed) {
      // Already sent or being processed elsewhere
      return
    }

    const email = normalizeCustomerEmail(String(claimed.customer_email || ''))
    if (!isValidCustomerEmail(email)) {
      await supabase.from('orders').update({
        delivery_email_status: 'failed',
        delivery_email_last_error: 'invalid_customer_email',
      }).eq('order_id', orderId)
      return
    }

    // Build items with notes
    const { data: rows } = await supabase
      .from('order_items')
      .select('product_code, product_name, quantity, price, item_data')
      .eq('order_id', orderUuid)

    const { data: notesRows } = await supabase
      .from('product_items')
      .select('product_code, notes')
      .eq('order_id', orderId)
      .eq('status', 'sold')

    const notesByCode = new Map<string, string[]>()
    for (const n of notesRows || []) {
      const note = String(n.notes || '').trim()
      if (!n.product_code || !note) continue
      const list = notesByCode.get(n.product_code) || []
      if (!list.includes(note)) list.push(note)
      notesByCode.set(n.product_code, list)
    }

    const payload = {
      orderId,
      customerName: String(claimed.customer_name || ''),
      customerEmail: email,
      transactionTime: String(claimed.paid_at || claimed.created_at || ''),
      totalAmount: Number(claimed.total_amount || 0),
      items: (rows || []).map((it: any) => ({
        productName: String(it.product_name || it.product_code || '-'),
        productCode: String(it.product_code || '-'),
        quantity: Number(it.quantity || 1),
        price: Number(it.price || 0),
        itemData: String(it.item_data || ''),
        productNotes: (notesByCode.get(it.product_code) || []).join('\n'),
      })),
    }

    const prevAttempts = Number(claimed.delivery_email_attempts || 0)
    const result = await sendOrderDeliveryEmailWithRetry(payload)
    const attempts = prevAttempts + Math.max(1, Number(result.attempts || 1))

    if (result.ok) {
      await supabase.from('orders').update({
        delivery_email_status: 'sent',
        delivery_email_attempts: attempts,
        delivery_email_sent_at: new Date().toISOString(),
        delivery_email_last_attempt_at: new Date().toISOString(),
      }).eq('order_id', orderId)
      logInfo('SETTLE', 'Delivery email sent', { orderId, attempts: result.attempts })
    } else {
      await supabase.from('orders').update({
        delivery_email_status: 'failed',
        delivery_email_attempts: attempts,
        delivery_email_last_attempt_at: new Date().toISOString(),
        delivery_email_last_error: String(result.error || 'send_failed').slice(0, 500),
      }).eq('order_id', orderId)
      logWarn('SETTLE', 'Delivery email failed', { orderId, error: result.error })
    }
  } catch (e: any) {
    logError('SETTLE', 'sendDeliveryEmail exception', { orderId, error: e?.message })
  }
}
