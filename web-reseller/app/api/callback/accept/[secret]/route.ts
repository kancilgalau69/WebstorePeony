export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Qiospay QRIS callback endpoint for the reseller storefront.
 *
 *   POST /api/callback/accept/{secret_key}
 *   body: { status: "success", data: { amount, type: "CR", refid, time, ... } }
 *
 * The callback carries no order reference, only the paid amount, so we reconcile
 * it to a pending Qiospay reseller order by matching the exact unique amount, then
 * hand off to the main webhook as an authenticated internal event.
 *
 * Response contract (per Qiospay docs): { status: 'accept' | 'reject' }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { secret: string } }
) {
  try {
    const providedSecret = params?.secret || ''
    const expectedSecret = process.env.QIOSPAY_SECRET_KEY || ''

    if (!expectedSecret || providedSecret !== expectedSecret) {
      console.warn('QIOSPAY CALLBACK: invalid secret key')
      return NextResponse.json(
        { status: 'reject', message: 'Invalid secret key', data: null },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const data = body?.data

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { status: 'reject', message: 'Missing data', data: null },
        { status: 400 }
      )
    }

    const amount = Math.round(Number(data.amount))
    const type = String(data.type || '').toUpperCase()

    if (type !== 'CR' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ status: 'accept', message: 'Ignored non-credit/invalid amount', data: null })
    }

    const matched = await reconcileQiospayPaymentByAmount(amount, request)

    return NextResponse.json({
      status: 'accept',
      message: matched ? 'Payment matched and processed' : 'No matching pending order',
      data: null,
    })
  } catch (err: any) {
    console.error('QIOSPAY CALLBACK error:', err?.message || err)
    return NextResponse.json({ status: 'accept', message: 'Error handled', data: null }, { status: 200 })
  }
}

async function reconcileQiospayPaymentByAmount(amount: number, request: NextRequest): Promise<boolean> {
  const supabase = getSupabaseAdmin()

  const { data: orders, error } = await supabase
    .from('reseller_orders')
    .select('order_id, total_amount, status, created_at')
    .eq('payment_provider', 'qiospay')
    .eq('status', 'pending')
    .eq('total_amount', amount)
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) {
    console.error('QIOSPAY CALLBACK: query error', error.message)
    return false
  }

  const order = orders?.[0]
  if (!order) {
    console.warn('QIOSPAY CALLBACK: no pending order matches amount', amount)
    return false
  }

  const webhookSecret = process.env.WEBHOOK_SECRET || ''
  const webhookUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}/api/webhook`

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'qiospay_internal',
        secret: webhookSecret,
        order_id: order.order_id,
        transaction_status: 'settlement',
        gross_amount: amount,
      }),
    })
    return res.ok
  } catch (err: any) {
    console.error('QIOSPAY CALLBACK: internal webhook failed', err?.message)
    return false
  }
}
