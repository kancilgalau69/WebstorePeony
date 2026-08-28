import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError, logInfo, logWarn } from '@/lib/logging/terminal-log'

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

    const matched = await reconcileQiospayPaymentByAmount(amount, request)

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
async function reconcileQiospayPaymentByAmount(
  amount: number,
  request: NextRequest
): Promise<boolean> {
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

  const webhookSecret = process.env.WEBHOOK_SECRET || ''
  const webhookUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}/api/webhook`

  const internalPayload = {
    provider: 'qiospay_internal',
    secret: webhookSecret,
    order_id: order.order_id,
    transaction_status: 'settlement',
    gross_amount: amount,
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(internalPayload),
    })
    const text = await res.text().catch(() => '')
    logInfo('QIOSPAY CALLBACK', 'Internal webhook triggered', {
      orderId: order.order_id,
      status: res.status,
      body: text.slice(0, 120),
    })
    return res.ok
  } catch (err: any) {
    logError('QIOSPAY CALLBACK', 'Failed triggering internal webhook', {
      orderId: order.order_id,
      error: err?.message || String(err),
    })
    return false
  }
}
