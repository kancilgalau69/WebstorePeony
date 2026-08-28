import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { logError, logInfo, logWarn } from '@/lib/logging/terminal-log'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

const supabase = createClient(supabaseUrl, supabaseServerKey)

export async function POST(request: NextRequest) {
  let requestOrderId = ''
  try {
    const startedAt = Date.now()
    const { order_id, transaction_id } = await request.json()
    requestOrderId = String(order_id || '')

    if (!order_id && !transaction_id) {
      return NextResponse.json(
        { error: 'order_id or transaction_id required' },
        { status: 400 }
      )
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const apiBase = isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com'

    // Fetch order from DB to know the provider
    const { data: orderInfo } = await supabase
      .from('orders')
      .select('payment_provider, status')
      .eq('order_id', order_id)
      .single()

    const provider = orderInfo?.payment_provider || 'midtrans'

    if (provider === 'tokopay') {
      // If webhook already settled/failed the order, short-circuit from DB.
      if (orderInfo?.status === 'completed') {
        return NextResponse.json({
          success: true,
          status: 'settlement',
          transaction_id,
          order_id,
          statusMessage: getStatusMessage('settlement'),
        })
      }
      if (orderInfo?.status === 'cancelled' || orderInfo?.status === 'failed' || orderInfo?.status === 'expired') {
        return NextResponse.json({
          success: true,
          status: 'cancel',
          transaction_id,
          order_id,
          statusMessage: getStatusMessage('cancel'),
        })
      }

      // Otherwise, actively poll Tokopay so dev (no public webhook) still works.
      const merchantId = process.env.TOKOPAY_MERCHANT_ID || ''
      const secretKey = process.env.TOKOPAY_SECRET_KEY || ''

      if (!merchantId || !secretKey) {
        // No credentials to poll with; fall back to pending.
        return NextResponse.json({
          success: true,
          status: 'pending',
          transaction_id,
          order_id,
          statusMessage: getStatusMessage('pending'),
        })
      }

      const params = new URLSearchParams({
        merchant_id: merchantId,
        secret: secretKey,
        ref_id: String(order_id),
      })
      const tokopayUrl = `https://api.tokopay.id/v1/check-order?${params.toString()}`

      let mappedStatus = 'pending'
      try {
        const tpRes = await fetch(tokopayUrl, { headers: { Accept: 'application/json' } })
        const tpText = await tpRes.text()
        const tpJson = JSON.parse(tpText)
        // Actual payment status is nested in data.status (Unpaid/Success/Completed/Failed).
        const paymentStatus = String(tpJson?.data?.status || '').toLowerCase()

        logInfo('Payment Status', 'Tokopay status polled', {
          orderId: order_id,
          paymentStatus,
        })

        if (paymentStatus === 'success' || paymentStatus === 'completed') {
          mappedStatus = 'settlement'
        } else if (paymentStatus === 'failed' || paymentStatus === 'canceled' || paymentStatus === 'expired') {
          mappedStatus = 'cancel'
        }

        // Auto-trigger local webhook on settlement (parity with Midtrans path).
        if (mappedStatus === 'settlement') {
          const reffId = tpJson?.data?.reff_id || order_id
          const signature = crypto
            .createHash('md5')
            .update(`${merchantId}:${secretKey}:${reffId}`)
            .digest('hex')

          const webhookPayload = {
            reff_id: reffId,
            reference: tpJson?.data?.trx_id,
            status: tpJson?.data?.status,
            signature,
            data: tpJson?.data || {},
          }

          const webhookUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}/api/webhook`
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
          }).catch((err) => {
            logWarn('Payment Status', 'Tokopay local webhook trigger failed', {
              orderId: order_id,
              error: err?.message,
            })
          })
        }
      } catch (tpErr: any) {
        logWarn('Payment Status', 'Tokopay status poll failed (non-fatal)', {
          orderId: order_id,
          error: tpErr?.message,
        })
      }

      return NextResponse.json({
        success: true,
        status: mappedStatus,
        transaction_id,
        order_id,
        statusMessage: getStatusMessage(mappedStatus),
      })
    }

    // Check transaction status from Midtrans API
    const auth = Buffer.from(String(serverKey) + ':').toString('base64')
    const url = `${apiBase}/v2/${encodeURIComponent(order_id)}/status`

    logInfo('Payment Status', 'Polling Midtrans status', {
      orderId: order_id,
      transactionId: transaction_id,
      endpoint: url.split('/').pop(),
    })

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    })

    const text = await response.text()

    if (!response.ok) {
      throw new Error(`Midtrans API error: ${response.status}`)
    }

    const transaction = JSON.parse(text)

    logInfo('Payment Status', 'Polling response received', {
      orderId: transaction.order_id || order_id,
      status: transaction.transaction_status,
      paymentType: transaction.payment_type,
      durationMs: Date.now() - startedAt,
    })

    // ============================================================
    // AUTO-TRIGGER WEBHOOK (tidak perlu ngrok di development)
    // Saat polling mendeteksi status settlement/capture,
    // langsung call webhook lokal agar item segera terkirim.
    // Webhook sudah punya signature verification — aman.
    // ============================================================
    const isSettled =
      transaction.transaction_status === 'settlement' ||
      transaction.transaction_status === 'capture'

    if (isSettled && serverKey) {
      try {
        // Build signature persis seperti yang Midtrans buat
        const rawSig = `${transaction.order_id}${transaction.status_code}${transaction.gross_amount}${serverKey}`
        const signature = crypto.createHash('sha512').update(rawSig).digest('hex')

        const webhookPayload = {
          order_id: transaction.order_id,
          transaction_id: transaction.transaction_id,
          transaction_status: transaction.transaction_status,
          payment_type: transaction.payment_type,
          gross_amount: transaction.gross_amount,
          status_code: transaction.status_code,
          fraud_status: transaction.fraud_status || 'accept',
          signature_key: signature,
        }

        // Call webhook endpoint secara lokal (same process, tanpa ngrok)
        const webhookUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}/api/webhook`

        logInfo('Payment Status', 'Auto-triggering local webhook for settled payment', {
          orderId: transaction.order_id,
          webhookUrl,
        })

        // Fire-and-forget — tidak await agar response ke client tetap cepat
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        })
          .then(async (r) => {
            const body = await r.text().catch(() => '')
            logInfo('Payment Status', 'Local webhook triggered', {
              orderId: transaction.order_id,
              status: r.status,
              body: body.slice(0, 100),
            })
          })
          .catch((err) => {
            logWarn('Payment Status', 'Local webhook trigger failed', {
              orderId: transaction.order_id,
              error: err?.message,
            })
          })
      } catch (webhookErr: any) {
        logWarn('Payment Status', 'Auto-webhook trigger exception (non-fatal)', {
          orderId: transaction.order_id || order_id,
          error: webhookErr?.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      status: transaction.transaction_status,
      transaction_id: transaction.transaction_id,
      order_id: transaction.order_id,
      gross_amount: transaction.gross_amount,
      payment_type: transaction.payment_type,
      transaction_time: transaction.transaction_time,
      fraud_status: transaction.fraud_status,
      statusMessage: getStatusMessage(transaction.transaction_status),
    })
  } catch (error: any) {
    logError('Payment Status', 'Polling failed', {
      orderId: requestOrderId || '-',
      error: error.message,
    })
    return NextResponse.json(
      { error: error.message || 'Failed to check payment status' },
      { status: 500 }
    )
  }
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    settlement: 'Pembayaran berhasil diterima!',
    capture: 'Pembayaran berhasil!',
    pending: 'Pembayaran masih pending...',
    deny: 'Pembayaran ditolak',
    cancel: 'Pembayaran dibatalkan',
    expire: 'QR Code sudah expired',
    refund: 'Pembayaran di-refund',
  }
  return messages[status] || 'Status tidak diketahui'
}
