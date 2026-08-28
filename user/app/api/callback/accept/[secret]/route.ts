import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError, logInfo, logWarn } from '@/lib/logging/terminal-log'
import { settleQiospayOrder } from '@/lib/orders/settle-qiospay'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

const supabase = createClient(supabaseUrl, supabaseServerKey)

/**
 * Qiospay QRIS callback endpoint.
 *
 * Qiospay POSTs here as soon as it detects an incoming QRIS payment:
 *   POST /api/callback/accept/{secret_key}
 *   body: { status: "success", data: { amount, type: "CR", refid, time, ... } }
 *
 * The callback carries NO order reference, only the paid amount. We reconcile it
 * to a pending Qiospay order by matching the exact unique amount, then hand off
 * to the main webhook as an authenticated internal event (single source of truth
 * for finalize + email delivery).
 *
 * Response contract mirrors the Qiospay docs: { status: 'accept' | 'reject' }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { secret: string } }
) {
  try {
    const providedSecret = params?.secret || ''
    const expectedSecret = process.env.QIOSPAY_SECRET_KEY || ''

    if (!expectedSecret || providedSecret !== expectedSecret) {
      logWarn('QIOSPAY CALLBACK', 'Invalid secret key on callback')
      return NextResponse.json(
        { status: 'reject', message: 'Invalid secret key', data: null },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const data = body?.data

    if (!data || typeof data !== 'object') {
      logWarn('QIOSPAY CALLBACK', 'Missing data in callback payload')
      return NextResponse.json(
        { status: 'reject', message: 'Missing data', data: null },
        { status: 400 }
      )
    }

    const amount = Math.round(Number(data.amount))
    const type = String(data.type || '').toUpperCase()

    logInfo('QIOSPAY CALLBACK', 'Callback received', {
      amount,
      type,
      refid: data.refid,
      time: data.time,
    })

    // Only incoming credit transactions represent customer payments.
    if (type !== 'CR' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({
        status: 'accept',
        message: 'Ignored non-credit or invalid amount',
        data: null,
      })
    }

    const matched = await reconcileQiospayPaymentByAmount(amount)

    return NextResponse.json({
      status: 'accept',
      message: matched ? 'Payment matched and processed' : 'No matching pending order',
      data: null,
    })
  } catch (error: any) {
    logError('QIOSPAY CALLBACK', 'Unhandled callback error', {
      error: error?.message || String(error),
    })
    // Still return accept to avoid infinite retries hammering us on transient errors.
    return NextResponse.json(
      { status: 'accept', message: 'Error handled', data: null },
      { status: 200 }
    )
  }
}

/**
 * Find a pending Qiospay order whose unique total matches the paid amount,
 * then trigger the main webhook as an internal settlement event.
 * Returns true if a matching order was found and handed off.
 */
async function reconcileQiospayPaymentByAmount(amount: number): Promise<boolean> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('order_id, total_amount, status, created_at')
    .eq('payment_provider', 'qiospay')
    .eq('status', 'pending')
    .eq('total_amount', amount)
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) {
    logError('QIOSPAY CALLBACK', 'Failed querying pending orders by amount', {
      amount,
      error: error.message,
    })
    return false
  }

  const order = orders?.[0]
  if (!order) {
    logWarn('QIOSPAY CALLBACK', 'No pending Qiospay order matches amount', { amount })
    return false
  }

  logInfo('QIOSPAY CALLBACK', 'Matched pending order by amount', {
    orderId: order.order_id,
    amount,
  })

  // Settle in-process (awaited) — reliable on Railway/serverless where a
  // fire-and-forget self-HTTP call to /api/webhook can be dropped.
  try {
    const result = await settleQiospayOrder(order.order_id, amount)
    logInfo('QIOSPAY CALLBACK', 'Order settled', {
      orderId: order.order_id,
      completed: result.completed,
      itemsReady: result.itemsReady,
    })
    return result.completed
  } catch (err: any) {
    logError('QIOSPAY CALLBACK', 'Settle failed', {
      orderId: order.order_id,
      error: err?.message || String(err),
    })
    return false
  }
}
