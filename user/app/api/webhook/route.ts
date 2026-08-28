import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import {
  isValidCustomerEmail,
  normalizeCustomerEmail,
  sendOrderDeliveryEmailWithRetry,
} from '@/lib/email/smtp-delivery'
import type { OrderDeliveryEmailPayload } from '@/lib/email/order-delivery-template'
import { logError, logInfo, logWarn, summarizeOrderForLog } from '@/lib/logging/terminal-log'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

// Initialize Supabase with server key for webhook processing
const supabase = createClient(
  supabaseUrl,
  supabaseServerKey
)

function parseAdminIds(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map((id) => id.replace(/['"]/g, '').trim())
    .filter(Boolean)
}

async function sendTelegramToAdmins(text: string, context: string) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const adminIds = parseAdminIds(process.env.TELEGRAM_ADMIN_IDS)

  if (!token || adminIds.length === 0) {
    logWarn(context, 'Telegram env missing', {
      hasToken: Boolean(token),
      adminCount: adminIds.length,
    })
    return
  }

  await Promise.all(
    adminIds.map(async (chatId) => {
      let lastError = ''

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              disable_web_page_preview: true,
            }),
          })

          if (resp.ok) {
            if (attempt > 1) {
              logInfo(context, 'Telegram send recovered', { chatId, attempt })
            }
            return
          }

          const body = await resp.text()
          lastError = `HTTP ${resp.status}: ${body.slice(0, 300)}`

          if ((resp.status === 429 || resp.status >= 500) && attempt < 3) {
            await sleep(300 * attempt)
            continue
          }

          break
        } catch (err: any) {
          lastError = String(err?.message || err)

          if (attempt < 3) {
            await sleep(300 * attempt)
            continue
          }
        }
      }

      logError(context, 'Telegram send failed', {
        chatId,
        error: lastError || 'unknown_error',
      })
    })
  )
}

async function sendTelegramToSeller(
  chatId: string | number,
  text: string,
  context: string
) {
  const token = (
    process.env.TELEGRAM_SELLER_BOT_TOKEN ||
    process.env.MARKET_NOTIF_BOT_TOKEN ||
    process.env.TELEGRAM_MARKET_BOT_TOKEN ||
    ''
  ).trim()

  if (!token) {
    logWarn(context, 'TELEGRAM_SELLER_BOT_TOKEN not set, skip seller notification', { chatId })
    return false
  }

  if (!chatId) {
    logWarn(context, 'Seller has no telegram_id, skip notification', {})
    return false
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    })

    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      logWarn(context, 'Seller Telegram notification failed', {
        chatId,
        status: resp.status,
        body: body.slice(0, 200),
      })
      return false
    }

    logInfo(context, 'Seller Telegram notification sent', { chatId })
    return true
  } catch (err: any) {
    logWarn(context, 'Seller Telegram notification exception', {
      chatId,
      error: err?.message,
    })
    return false
  }
}

function isCompletedStatus(status: string | null | undefined): boolean {
  const normalized = String(status || '').toLowerCase()
  return ['completed', 'paid', 'settlement', 'capture', 'success'].includes(normalized)
}

function isFailedStatus(status: string | null | undefined): boolean {
  const normalized = String(status || '').toLowerCase()
  return ['expired', 'expire', 'cancel', 'cancelled', 'deny', 'denied', 'failed'].includes(normalized)
}

function normalizeFailedStatusForNotification(status: string | null | undefined): string {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'cancelled') return 'cancel'
  if (normalized === 'expired') return 'expire'
  if (normalized === 'denied') return 'deny'
  if (normalized === 'failure') return 'failed'
  return normalized
}

function resolveOrderSource(orderRow: any): 'TELEGRAM BOT' | 'WEBSITE' {
  const userRef = String(orderRow?.user_ref || '').toLowerCase()
  if (userRef.startsWith('tg:')) return 'TELEGRAM BOT'
  if (orderRow?.user_id !== null && orderRow?.user_id !== undefined) return 'TELEGRAM BOT'
  return 'WEBSITE'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeErrorMessage(error: unknown, maxLength = 500) {
  const raw = String(error || 'unknown_error').replace(/\s+/g, ' ').trim()
  if (!raw) return 'unknown_error'
  return raw.length > maxLength ? raw.slice(0, maxLength) : raw
}

function resolveBotRefreshBaseUrl() {
  const candidates = [
    process.env.BOT_REFRESH_URL,
    process.env.NEXT_PUBLIC_BOT_URL,
    process.env.BOT_URL,
    'http://localhost:3000',
  ]

  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (!value) continue
    return value.replace(/\/+$/, '')
  }

  return 'http://localhost:3000'
}

async function triggerBotCatalogRefresh(orderId: string, reason: string) {
  const baseUrl = resolveBotRefreshBaseUrl()
  const refreshSecret = String(process.env.WEBHOOK_SECRET || 'supersecret-bot').trim()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    const response = await fetch(`${baseUrl}/webhook/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-refresh-key': refreshSecret,
      },
      body: JSON.stringify({
        secret: refreshSecret,
        note: `webhook_${reason}_${orderId}`,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const responseText = await response.text()
      logWarn('WEBHOOK', 'Bot refresh webhook returned non-2xx', {
        orderId,
        reason,
        baseUrl,
        status: response.status,
        responsePreview: String(responseText || '').slice(0, 300),
      })
      return
    }

    logInfo('WEBHOOK', 'Bot catalog refresh triggered', {
      orderId,
      reason,
      baseUrl,
    })
  } catch (error: unknown) {
    logWarn('WEBHOOK', 'Bot catalog refresh trigger failed', {
      orderId,
      reason,
      baseUrl,
      error: normalizeErrorMessage(error),
    })
  } finally {
    clearTimeout(timeout)
  }
}

const EMAIL_PROCESSING_STALE_MS = Math.max(
  30000,
  Number.parseInt(String(process.env.ORDER_EMAIL_PROCESSING_STALE_MS || '120000'), 10) || 120000
)

async function reclaimStaleOrderEmailProcessing(orderId: string) {
  const cutoffIso = new Date(Date.now() - EMAIL_PROCESSING_STALE_MS).toISOString()
  const nowIso = new Date().toISOString()

  const baseUpdatePayload = {
    delivery_email_status: 'processing',
    delivery_email_last_attempt_at: nowIso,
    delivery_email_last_error: 'stale_processing_reclaimed',
  }

  const staleUpdateQuery = supabase
    .from('orders')
    .update(baseUpdatePayload)
    .eq('order_id', orderId)
    .eq('status', 'completed')
    .eq('delivery_email_status', 'processing')
    .lt('delivery_email_last_attempt_at', cutoffIso)
    .select('order_id, customer_email, delivery_email_attempts')
    .maybeSingle()

  const { data: staleData, error: staleError } = await staleUpdateQuery
  if (staleError) {
    logWarn('WEBHOOK', 'Failed stale-processing reclaim query', {
      orderId,
      message: staleError.message,
    })
    return null
  }

  if (staleData) {
    logWarn('WEBHOOK', 'Reclaimed stale email processing lock', {
      orderId,
      staleCutoffIso: cutoffIso,
    })
    return staleData
  }

  const nullAttemptQuery = supabase
    .from('orders')
    .update(baseUpdatePayload)
    .eq('order_id', orderId)
    .eq('status', 'completed')
    .eq('delivery_email_status', 'processing')
    .is('delivery_email_last_attempt_at', null)
    .select('order_id, customer_email, delivery_email_attempts')
    .maybeSingle()

  const { data: nullAttemptData, error: nullAttemptError } = await nullAttemptQuery
  if (nullAttemptError) {
    logWarn('WEBHOOK', 'Failed null-attempt reclaim query', {
      orderId,
      message: nullAttemptError.message,
    })
    return null
  }

  if (nullAttemptData) {
    logWarn('WEBHOOK', 'Reclaimed processing lock with null last_attempt_at', { orderId })
    return nullAttemptData
  }

  return null
}

async function claimOrderEmailDelivery(orderId: string) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({
        delivery_email_status: 'processing',
        delivery_email_last_attempt_at: new Date().toISOString(),
        delivery_email_last_error: null,
      })
      .eq('order_id', orderId)
      .eq('status', 'completed')
      .in('delivery_email_status', ['pending', 'failed'])
      .select('order_id, customer_email, delivery_email_attempts')
      .maybeSingle()

    if (error) {
      logWarn('WEBHOOK', 'Failed to claim order email delivery', {
        orderId,
        code: error.code,
        message: error.message,
      })
      return { claimed: false as const, error: error.message }
    }

    if (!data) {
      const reclaimed = await reclaimStaleOrderEmailProcessing(orderId)
      if (reclaimed) {
        return {
          claimed: true as const,
          order: reclaimed,
        }
      }

      return { claimed: false as const }
    }

    return {
      claimed: true as const,
      order: data,
    }
  } catch (err: any) {
    const errorMessage = normalizeErrorMessage(err?.message || err)
    logWarn('WEBHOOK', 'Exception while claiming order email delivery', {
      orderId,
      error: errorMessage,
    })
    return { claimed: false as const, error: errorMessage }
  }
}

function combineOrderItemsByProductCode(orderItems: any[] = []) {
  const map: Record<string, any> = {}

  for (const item of orderItems) {
    const code = String(item?.product_code || '')
    if (!code) continue

    if (!map[code]) {
      map[code] = {
        product_code: code,
        product_name: item?.product_name || code,
        quantity: Number(item?.quantity || 1),
        price: Number(item?.price || 0),
        item_data: String(item?.item_data || ''),
      }
      continue
    }

    const previousItemData = String(map[code].item_data || '')
    const nextItemData = String(item?.item_data || '')
    map[code] = {
      ...map[code],
      quantity: Number(item?.quantity || map[code].quantity || 1),
      price: Number(item?.price || map[code].price || 0),
      item_data: [previousItemData, nextItemData].filter(Boolean).join('\n'),
    }
  }

  return map
}

async function buildOrderDeliveryEmailPayload(orderId: string): Promise<{
  payload: OrderDeliveryEmailPayload | null
  hasDeliverableItems: boolean
  error?: string
}> {
  try {
    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id, order_id, customer_name, customer_email, total_amount, paid_at, created_at, items')
      .eq('order_id', orderId)
      .maybeSingle()

    if (orderError || !orderRow) {
      return {
        payload: null,
        hasDeliverableItems: false,
        error: orderError?.message || 'order_not_found',
      }
    }

    const snapshotItems = Array.isArray(orderRow.items)
      ? orderRow.items.map((item: any) => ({
          product_code: String(item?.product_code || ''),
          product_name: String(item?.product_name || item?.product_code || ''),
          quantity: Number(item?.quantity || 1),
          price: Number(item?.price || 0),
          item_data: '',
        }))
      : []

    const { data: orderItemsRows, error: orderItemsError } = await supabase
      .from('order_items')
      .select('product_code, product_name, quantity, price, item_data')
      .eq('order_id', orderRow.id)

    if (orderItemsError) {
      return {
        payload: null,
        hasDeliverableItems: false,
        error: orderItemsError.message,
      }
    }

    const combinedOrderItems = combineOrderItemsByProductCode(orderItemsRows || [])

    let mergedItems = snapshotItems.map((snapshotItem: any) => {
      const fulfilled = combinedOrderItems[snapshotItem.product_code]
      return fulfilled ? { ...snapshotItem, ...fulfilled } : snapshotItem
    })

    for (const combinedItem of Object.values(combinedOrderItems)) {
      const code = String((combinedItem as any)?.product_code || '')
      if (!code) continue

      const alreadyExists = mergedItems.some((item: any) => item.product_code === code)
      if (!alreadyExists) {
        mergedItems.push(combinedItem)
      }
    }

    const { data: notesRows, error: notesError } = await supabase
      .from('product_items')
      .select('product_code, notes')
      .eq('order_id', orderId)
      .eq('status', 'sold')

    if (notesError) {
      logWarn('WEBHOOK', 'Failed to load product notes for email payload', {
        orderId,
        message: notesError.message,
      })
    }

    const notesMap = new Map<string, string[]>()
    for (const row of notesRows || []) {
      const code = String(row?.product_code || '').trim()
      const note = String(row?.notes || '').trim()
      if (!code || !note) continue

      const current = notesMap.get(code) || []
      if (!current.includes(note)) {
        current.push(note)
      }
      notesMap.set(code, current)
    }

    mergedItems = mergedItems.map((item: any) => ({
      ...item,
      product_notes: (notesMap.get(String(item?.product_code || '')) || []).join('\n'),
    }))

    const emailItems = mergedItems.map((item: any) => ({
      productName: String(item?.product_name || item?.product_code || '-'),
      productCode: String(item?.product_code || '-'),
      quantity: Number(item?.quantity || 1),
      price: Number(item?.price || 0),
      itemData: String(item?.item_data || ''),
      productNotes: String(item?.product_notes || ''),
    }))

    const hasDeliverableItems = emailItems.some((item) => Boolean(String(item.itemData || '').trim()))

    const payload: OrderDeliveryEmailPayload = {
      orderId: String(orderRow.order_id || orderId),
      customerName: String(orderRow.customer_name || ''),
      customerEmail: normalizeCustomerEmail(String(orderRow.customer_email || '')),
      transactionTime: String(orderRow.paid_at || orderRow.created_at || ''),
      totalAmount: Number(orderRow.total_amount || 0),
      items: emailItems,
    }

    return {
      payload,
      hasDeliverableItems,
    }
  } catch (err: any) {
    return {
      payload: null,
      hasDeliverableItems: false,
      error: normalizeErrorMessage(err?.message || err),
    }
  }
}

async function updateOrderEmailDeliveryState(
  orderId: string,
  nextState: {
    status: 'sent' | 'failed'
    attempts: number
    lastError?: string
  }
) {
  const updatePayload: Record<string, any> = {
    delivery_email_status: nextState.status,
    delivery_email_attempts: nextState.attempts,
    delivery_email_last_attempt_at: new Date().toISOString(),
    delivery_email_last_error: nextState.lastError || null,
  }

  if (nextState.status === 'sent') {
    updatePayload.delivery_email_sent_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('order_id', orderId)

  if (error) {
    logWarn('WEBHOOK', 'Failed to update order email delivery state', {
      orderId,
      code: error.code,
      message: error.message,
      nextState,
    })
  }
}

async function sendOrderDeliveryEmailForPaidOrder(orderId: string) {
  const claim = await claimOrderEmailDelivery(orderId)

  if (!claim.claimed) {
    if (claim.error) {
      logWarn('WEBHOOK', 'Skip customer delivery email due to claim error', {
        orderId,
        error: claim.error,
      })
    } else {
      logInfo('WEBHOOK', 'Skip customer delivery email (already sent or processing)', {
        orderId,
      })
    }
    return
  }

  const previousAttempts = Number(claim.order.delivery_email_attempts || 0)
  try {
    const customerEmail = normalizeCustomerEmail(String(claim.order.customer_email || ''))

    if (!isValidCustomerEmail(customerEmail)) {
      await updateOrderEmailDeliveryState(orderId, {
        status: 'failed',
        attempts: previousAttempts + 1,
        lastError: 'invalid_customer_email',
      })
      logWarn('WEBHOOK', 'Invalid customer email; skip delivery email', {
        orderId,
        customerEmail,
      })
      return
    }

    let payloadResult = await buildOrderDeliveryEmailPayload(orderId)

    if (!payloadResult.payload || !payloadResult.hasDeliverableItems) {
      // Give database writes a short window to settle after finalization.
      for (let retry = 0; retry < 2 && (!payloadResult.payload || !payloadResult.hasDeliverableItems); retry += 1) {
        await sleep(750 * (retry + 1))
        payloadResult = await buildOrderDeliveryEmailPayload(orderId)
      }
    }

    if (!payloadResult.payload) {
      const payloadError = normalizeErrorMessage(payloadResult.error || 'failed_build_email_payload')
      await updateOrderEmailDeliveryState(orderId, {
        status: 'failed',
        attempts: previousAttempts + 1,
        lastError: payloadError,
      })
      logWarn('WEBHOOK', 'Failed to build order delivery email payload', {
        orderId,
        error: payloadError,
      })
      return
    }

    if (!payloadResult.hasDeliverableItems) {
      await updateOrderEmailDeliveryState(orderId, {
        status: 'failed',
        attempts: previousAttempts + 1,
        lastError: 'delivery_items_not_ready',
      })
      logWarn('WEBHOOK', 'Delivery items not ready; email not sent', { orderId })
      return
    }

    const sendResult = await sendOrderDeliveryEmailWithRetry({
      ...payloadResult.payload,
      customerEmail,
    })

    const totalAttempts = previousAttempts + Math.max(1, Number(sendResult.attempts || 1))

    if (sendResult.ok) {
      await updateOrderEmailDeliveryState(orderId, {
        status: 'sent',
        attempts: totalAttempts,
      })
      logInfo('WEBHOOK', 'Customer delivery email sent successfully', {
        orderId,
        attempts: sendResult.attempts,
        messageId: sendResult.messageId,
      })
      return
    }

    await updateOrderEmailDeliveryState(orderId, {
      status: 'failed',
      attempts: totalAttempts,
      lastError: normalizeErrorMessage(sendResult.error || 'delivery_email_send_failed'),
    })

    logError('WEBHOOK', 'Customer delivery email failed', {
      orderId,
      attempts: sendResult.attempts,
      error: sendResult.error,
      nonRetryable: sendResult.nonRetryable,
    })
  } catch (error: unknown) {
    const unexpectedError = normalizeErrorMessage(error)
    await updateOrderEmailDeliveryState(orderId, {
      status: 'failed',
      attempts: previousAttempts + 1,
      lastError: `unexpected_exception:${unexpectedError}`,
    })

    logError('WEBHOOK', 'Unexpected exception in delivery-email flow', {
      orderId,
      error: unexpectedError,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServerKey) {
      return NextResponse.json(
        { error: 'Supabase server configuration missing for webhook' },
        { status: 500 }
      )
    }

    const body = await request.json()
    // Midtrans uses `order_id`; Tokopay callback uses `reff_id` (double-f).
    // `ref_id` is kept as a defensive fallback for status-check style payloads.
    const orderId = body?.order_id || body?.reff_id || body?.ref_id

    if (orderId && (orderId.startsWith('MKT-') || orderId.startsWith('MKT-PBS-'))) {
      const targetUrl = process.env.MARKET_STORE_WEBHOOK_URL || 'http://localhost:3007/api/webhook'
      logInfo('WEBHOOK', 'Forwarding marketplace order webhook', { orderId, targetUrl })
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        const resBody = await response.json()
        return NextResponse.json(resBody, { status: response.status })
      } catch (err: any) {
        logError('WEBHOOK', 'Failed to forward marketplace order webhook', {
          orderId,
          targetUrl,
          error: err.message,
        })
        return NextResponse.json({ error: 'Failed to forward webhook to marketplace store' }, { status: 500 })
      }
    }

    if (orderId && orderId.startsWith('RS-')) {
      const targetUrl = process.env.RESELLER_STORE_WEBHOOK_URL || 'http://localhost:3003/api/webhook'
      logInfo('WEBHOOK', 'Forwarding reseller order webhook', { orderId, targetUrl })
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        const resBody = await response.json()
        return NextResponse.json(resBody, { status: response.status })
      } catch (err: any) {
        logError('WEBHOOK', 'Failed to forward reseller order webhook', {
          orderId,
          targetUrl,
          error: err.message,
        })
        return NextResponse.json({ error: 'Failed to forward webhook to reseller store' }, { status: 500 })
      }
    }

    logInfo('WEBHOOK', 'Notification received', {
      orderId: orderId,
      bodyPreview: JSON.stringify(body).slice(0, 200)
    })

    const isTokopay = (body.ref_id !== undefined || body.reff_id !== undefined) && body.signature !== undefined
    let transactionStatus = ''
    let paymentType = ''
    let grossAmount: any = undefined

    if (isTokopay) {
      logInfo('WEBHOOK', 'Processing Tokopay webhook signature')
      const merchantId = process.env.TOKOPAY_MERCHANT_ID || ''
      const secretKey = process.env.TOKOPAY_SECRET_KEY || ''
      // Tokopay signature formula: md5(merchant_id:secret:reff_id)
      const tokopayOrderId = body.reff_id || body.ref_id || orderId
      const calculatedSignature = crypto.createHash('md5').update(`${merchantId}:${secretKey}:${tokopayOrderId}`).digest('hex')

      if (calculatedSignature !== body.signature) {
        logWarn('WEBHOOK', 'Tokopay signature verification failed', { orderId: tokopayOrderId })
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      
      logInfo('WEBHOOK', 'Tokopay signature verification passed', { orderId })

      // Tokopay statuses: Unpaid, Success, Completed, Proses Callback, Failed
      const tpStatus = String(body.status ?? '').toLowerCase()
      if (tpStatus === 'success' || tpStatus === 'completed' || body.status === 1 || body.status === true) {
        transactionStatus = 'settlement'
      } else if (tpStatus === 'failed' || tpStatus === 'canceled' || tpStatus === 'cancelled' || tpStatus === 'expired') {
        transactionStatus = 'cancel'
      } else {
        transactionStatus = 'pending'
      }
      paymentType = body?.data?.payment_channel || body.metode || 'tokopay'
      // Tokopay reports paid amounts under data.total_dibayar / total_diterima.
      grossAmount = body?.data?.total_dibayar ?? body?.data?.nominal ?? undefined
    } else {
      // Verify signature from Midtrans
      const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
      const statusCode = body.status_code
      grossAmount = body.gross_amount
      const signatureKey = body.signature_key

      // Create signature: SHA512(order_id + status_code + gross_amount + SERVER_KEY)
      const rawSignature = orderId + statusCode + grossAmount + serverKey
      const calculatedSignature = crypto
        .createHash('sha512')
        .update(rawSignature)
        .digest('hex')

      logInfo('WEBHOOK', 'Signature check', {
        orderId,
        calculated: calculatedSignature.substring(0, 16),
        received: String(signatureKey || '').substring(0, 16),
      })

      if (calculatedSignature !== signatureKey) {
        logWarn('WEBHOOK', 'Signature verification failed', { orderId })
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }

      logInfo('WEBHOOK', 'Midtrans signature verification passed', { orderId })

      transactionStatus = body.transaction_status
      paymentType = body.payment_type
    }

    // Load existing order metadata for source and idempotency decisions
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('status, user_ref, user_id')
      .eq('order_id', orderId)
      .maybeSingle()

    const orderSource = resolveOrderSource(existingOrder)
    const previousStatus = String(existingOrder?.status || '').toLowerCase()

    logInfo('WEBHOOK', 'Transaction parsed', {
      orderId,
      transactionStatus,
      paymentType,
      previousStatus,
      source: orderSource,
    })

    // Handle different payment statuses
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      // Payment successful
      logInfo('WEBHOOK', 'Payment successful', { orderId })

      let transitionedToCompleted = false

      // Update order status in database
      try {
        logInfo('WEBHOOK', 'Updating order to completed', { orderId })
        
        const { error: updateError, data: updateData } = await supabase
          .from('orders')
          .update({ 
            status: 'completed',
            paid_at: new Date().toISOString(),
          })
          .eq('order_id', orderId)
          .neq('status', 'completed')
          .select()

        if (updateError) {
          logWarn('WEBHOOK', 'Order update failed', {
            orderId,
            code: updateError.code,
            message: updateError.message,
          })
        } else {
          const updatedRows = updateData?.length || 0
          transitionedToCompleted = updatedRows > 0

          if (transitionedToCompleted) {
            logInfo('WEBHOOK', 'Order status updated', {
              orderId,
              updatedRows,
              order: summarizeOrderForLog(updateData?.[0]),
            })
          } else {
            logInfo('WEBHOOK', 'Order already completed; webhook treated as duplicate', {
              orderId,
              previousStatus,
            })
          }
        }

        // ========================================
        // FINALIZE PRODUCT ITEMS (Mark as SOLD)
        // ========================================
        logInfo('WEBHOOK', 'Finalizing product items', { orderId })
        
        try {
          // Note: user_id is NULL for web store orders, use 0 as placeholder
          const { data: finalizeResult, error: finalizeError } = await supabase
            .rpc('finalize_items_for_order', {
              p_order_id: orderId,
              p_user_id: 0  // Web store users don't have telegram user_id
            })

          if (finalizeError) {
            logError('WEBHOOK', 'Finalize items failed', {
              orderId,
              error: finalizeError.message,
            })
          } else if (finalizeResult && finalizeResult.ok) {
            logInfo('WEBHOOK', 'Finalize items success', {
              orderId,
              finalizedCount: finalizeResult.count,
              itemsCount: finalizeResult.items?.length || 0,
            })
            
            // Check order snapshot for expected quantities
            const { data: orderCheck } = await supabase
              .from('orders')
              .select('items')
              .eq('order_id', orderId)
              .single()
            
            if (orderCheck?.items) {
              const totalExpected = orderCheck.items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)
              logInfo('WEBHOOK', 'Order snapshot quantity check', {
                orderId,
                expectedTotalItems: totalExpected,
                snapshotRows: Array.isArray(orderCheck.items) ? orderCheck.items.length : 0,
              })
              if (finalizeResult.count < totalExpected) {
                logWarn('WEBHOOK', 'Quantity mismatch after finalize', {
                  orderId,
                  finalizedCount: finalizeResult.count,
                  expectedTotalItems: totalExpected,
                })
              }
            }

            // Update order_items table with actual item data
            if (finalizeResult.items && finalizeResult.items.length > 0) {
              // Get order UUID once
              const { data: orderData } = await supabase
                .from('orders')
                .select('id, items')
                .eq('order_id', orderId)
                .single()

              if (!orderData) {
                logError('WEBHOOK', 'Order UUID lookup failed for order_items update', { orderId })
              } else {
                for (const finalizedItem of finalizeResult.items) {
                  try {
                    // Find matching product from order.items snapshot
                    const orderItem = orderData.items?.find(
                      (i: any) => i.product_code === finalizedItem.product_code
                    )

                    if (!orderItem) {
                      logWarn('WEBHOOK', 'Snapshot item missing for finalized product', {
                        orderId,
                        productCode: finalizedItem.product_code,
                      })
                      continue
                    }

                    logInfo('WEBHOOK', 'Saving finalized item to order_items', {
                      orderId,
                      productCode: finalizedItem.product_code,
                      itemDataLength: String(finalizedItem.item_data || '').length,
                    })

                    // Use delete+insert; allow multiple rows per product_code (quantity > 1)
                    await supabase
                      .from('order_items')
                      .delete()
                      .eq('order_id', orderData.id)
                      .is('item_data', null)
                      .eq('product_code', finalizedItem.product_code)

                    const { error: insertError } = await supabase
                      .from('order_items')
                      .insert({
                        order_id: orderData.id,  // UUID
                        product_id: orderItem.product_id || null,  // products table UUID
                        product_code: finalizedItem.product_code,
                        product_name: orderItem.product_name || '',
                        quantity: 1,
                        price: orderItem.price || 0,
                        item_data: finalizedItem.item_data  // CRITICAL: From product_items.item_data
                      })
                    
                    if (insertError) {
                      logError('WEBHOOK', 'Failed to save finalized item', {
                        orderId,
                        productCode: finalizedItem.product_code,
                        error: insertError.message,
                        code: insertError.code,
                      })
                    } else {
                      logInfo('WEBHOOK', 'Saved finalized item', {
                        orderId,
                        productCode: finalizedItem.product_code,
                      })
                    }
                  } catch (itemErr: any) {
                    logError('WEBHOOK', 'Exception saving finalized item', {
                      orderId,
                      error: itemErr.message,
                    })
                  }
                }
              }
            }
          } else {
            logWarn('WEBHOOK', 'Finalize response indicates no update', {
              orderId,
              response: finalizeResult,
            })
          }
        } catch (finalizeErr: any) {
          logError('WEBHOOK', 'Exception finalizing items', {
            orderId,
            error: finalizeErr.message,
          })
        }
        
      } catch (dbError: any) {
        logWarn('WEBHOOK', 'Database error updating order', {
          orderId,
          error: dbError.message,
        })
      }

      // ========================================
      // FINALIZE MARKET PRODUCT ITEMS
      // ========================================
      try {
        // Load order to check has_market_items + get customer info
        const { data: pbsOrder } = await supabase
          .from('orders')
          .select('id, has_market_items, items, customer_name, customer_email, customer_phone, total_amount')
          .eq('order_id', orderId)
          .maybeSingle()

        if (pbsOrder?.has_market_items) {
          logInfo('WEBHOOK', 'Finalizing market product items for order', { orderId })

          // Fetch all reserved market items for this order
          const { data: reservedMarketItems, error: mktItemsErr } = await supabase
            .from('market_product_items')
            .select('id, product_id, item_data, product_code')
            .eq('reserved_for_order', orderId)
            .eq('status', 'reserved')

          if (mktItemsErr) {
            logError('WEBHOOK', 'Failed to fetch reserved market items', { orderId, error: mktItemsErr.message })
          } else if (reservedMarketItems && reservedMarketItems.length > 0) {
            // Mark market items as sold
            const mktItemIds = reservedMarketItems.map((r: any) => r.id)
            await supabase
              .from('market_product_items')
              .update({
                status: 'sold',
                order_id: orderId,
                sold_to_email: pbsOrder.customer_email,
                sold_at: new Date().toISOString(),
                reserved_for_order: null,
                reserved_at: null,
                reservation_expires_at: null,
              })
              .in('id', mktItemIds)

            // Group by product_id for order_items insert + seller credit
            const byProduct: Map<string, { items: any[]; productCode: string }> = new Map()
            for (const mi of (reservedMarketItems as any[])) {
              if (!byProduct.has(mi.product_id)) {
                byProduct.set(mi.product_id, { items: [], productCode: mi.product_code })
              }
              byProduct.get(mi.product_id)!.items.push(mi)
            }

            for (const [productId, { items: mItems, productCode }] of byProduct.entries()) {
              // Find matching order item snapshot for price/seller info
              const snapshotItem = Array.isArray(pbsOrder.items)
                ? pbsOrder.items.find((i: any) => i.market_product_id === productId)
                : null

              const sellerPrice = Number(snapshotItem?.market_seller_price || 0)
              const sellerId = snapshotItem?.market_seller_id
              const sellerNet = sellerPrice * mItems.length

              // Save item credentials to order_items
              for (const mItem of mItems) {
                await supabase.from('order_items').insert({
                  order_id: pbsOrder.id,
                  market_product_id: productId,
                  market_seller_id: sellerId || null,
                  market_seller_price: sellerPrice || null,
                  product_code: productCode,
                  product_name: snapshotItem?.product_name || productCode,
                  quantity: 1,
                  price: Number(snapshotItem?.price || 0),
                  item_data: mItem.item_data || null,
                })
              }

              // Credit seller saldo (seller_price * qty, NOT final_price)
              if (sellerId && sellerNet > 0) {
                try {
                  const { data: sellerNow } = await supabase
                    .from('sellers')
                    .select('saldo, total_penjualan')
                    .eq('id', sellerId)
                    .single()

                  await supabase
                    .from('sellers')
                    .update({
                      saldo: Number((sellerNow as any)?.saldo || 0) + sellerNet,
                      total_penjualan: Number((sellerNow as any)?.total_penjualan || 0) + sellerNet,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', sellerId)

                  logInfo('WEBHOOK', 'Seller saldo credited', { sellerId, amount: sellerNet })
                } catch (creditErr: any) {
                  logError('WEBHOOK', 'Failed to credit seller saldo', { sellerId, error: creditErr?.message })
                }

                // Send Telegram notification ke seller via bot seller
                try {
                  const { data: sellerRow } = await supabase
                    .from('sellers')
                    .select('saldo, total_penjualan, telegram_id, nama_toko')
                    .eq('id', sellerId)
                    .single()

                  const sellerChatId = (sellerRow as any)?.telegram_id
                  const newSaldo = Number((sellerRow as any)?.saldo || 0)

                  const notifText = [
                    '🎉 *Produk Kamu Terjual!*',
                    `🏪 Toko: ${(sellerRow as any)?.nama_toko || sellerId}`,
                    '───────────────────',
                    `📦 Produk: *${snapshotItem?.product_name || productCode}*`,
                    `🔢 Qty: ${mItems.length} item`,
                    `💰 Pendapatan: *Rp ${sellerNet.toLocaleString('id-ID')}*`,
                    '───────────────────',
                    `📧 Pembeli: ${pbsOrder.customer_email}`,
                    `🧾 Order ID: \`${orderId}\``,
                    `💳 Saldo Terkini: Rp ${newSaldo.toLocaleString('id-ID')}`,
                    '',
                    '✅ _Transaksi via PBS Web User_',
                  ].join('\n')

                  await sendTelegramToSeller(sellerChatId, notifText, 'WEBHOOK:seller-notif')
                } catch (notifErr: any) {
                  logWarn('WEBHOOK', 'Seller notification exception (non-fatal)', {
                    sellerId,
                    error: notifErr?.message,
                  })
                }
              }

              logInfo('WEBHOOK', 'Market items finalized for product', { orderId, productId, count: mItems.length })
            }
          }
        }
      } catch (mktFinalizeErr: any) {
        logError('WEBHOOK', 'Exception in market finalization (non-fatal)', { orderId, error: mktFinalizeErr.message })
      }

      const shouldNotifyAdmin = transitionedToCompleted && orderSource !== 'TELEGRAM BOT'
      if (shouldNotifyAdmin) {
        await notifyAdmin('payment-success', {
          orderId,
          amount: grossAmount,
          paymentType,
          status: transactionStatus,
          source: orderSource,
        })
      } else {
        logInfo('WEBHOOK', 'Skip admin success notification', {
          orderId,
          previousStatus,
          transitionedToCompleted,
          source: orderSource,
        })
      }

      if (orderSource !== 'TELEGRAM BOT') {
        // Keep admin notification first, then finish delivery-email job in-request
        // so status does not remain "processing" if runtime drops fire-and-forget tasks.
        await sendOrderDeliveryEmailForPaidOrder(orderId)
      } else {
        logInfo('WEBHOOK', 'Skip customer delivery email for Telegram bot source', { orderId })
      }

      await triggerBotCatalogRefresh(orderId, transactionStatus)

      // `status: true` is required by Tokopay to acknowledge the callback (stops retries).
      return NextResponse.json({ status: true, message: 'Payment received' }, { status: 200 })
    } else if (transactionStatus === 'pending') {
      logInfo('WEBHOOK', 'Payment pending', { orderId })
      return NextResponse.json({ status: true, message: 'Payment pending' }, { status: 200 })
    } else if (
      transactionStatus === 'deny' ||
      transactionStatus === 'cancel' ||
      transactionStatus === 'expire'
    ) {
      logWarn('WEBHOOK', 'Payment failed or cancelled', {
        orderId,
        status: String(transactionStatus || '').toUpperCase(),
      })

      // Update order status to cancelled
      try {
        await supabase
          .from('orders')
          .update({ 
            status: transactionStatus === 'expire' ? 'expired' : transactionStatus,
          })
          .eq('order_id', orderId)

        // ========================================
        // RELEASE RESERVED ITEMS (back to available)
        // ========================================
        logInfo('WEBHOOK', 'Releasing reserved items for cancelled order', { orderId })
        
        try {
          const { data: releaseResult, error: releaseError } = await supabase
            .rpc('release_reserved_items', {
              p_order_id: orderId
            })

          if (releaseError) {
            logError('WEBHOOK', 'Release reserved items failed', {
              orderId,
              error: releaseError.message,
            })
          } else if (releaseResult && releaseResult.ok) {
            logInfo('WEBHOOK', 'Released reserved items back to available', {
              orderId,
              releasedCount: releaseResult.count,
            })
          } else {
            logWarn('WEBHOOK', 'Release reserved items returned non-ok response', {
              orderId,
              response: releaseResult,
            })
          }
        } catch (releaseErr: any) {
          logError('WEBHOOK', 'Exception releasing reserved items', {
            orderId,
            error: releaseErr.message,
          })
        }

        // Also release reserved market items
        try {
          await supabase
            .from('market_product_items')
            .update({
              status: 'available',
              reserved_for_order: null,
              reserved_at: null,
              reservation_expires_at: null,
            })
            .eq('reserved_for_order', orderId)
            .eq('status', 'reserved')
          logInfo('WEBHOOK', 'Market reserved items released (payment failed)', { orderId })
        } catch {
          logError('WEBHOOK', 'Failed to release market reserved items on failure', { orderId })
        }

        const shouldNotifyAdmin =
          orderSource !== 'TELEGRAM BOT' &&
          normalizeFailedStatusForNotification(previousStatus) !==
            normalizeFailedStatusForNotification(transactionStatus)
        if (shouldNotifyAdmin) {
          await notifyAdmin('payment-cancelled', {
            orderId,
            amount: grossAmount,
            paymentType,
            status: transactionStatus,
            source: orderSource,
          })
        } else {
          logInfo('WEBHOOK', 'Skip admin failed notification', {
            orderId,
            previousStatus,
            source: orderSource,
          })
        }
        
      } catch (err) {
        logWarn('WEBHOOK', 'Failed to update cancelled order', {
          orderId,
          error: normalizeErrorMessage(err),
        })
      }

      await triggerBotCatalogRefresh(orderId, String(transactionStatus || 'cancelled'))

      return NextResponse.json(
        { status: true, message: `Payment ${transactionStatus}` },
        { status: 200 }
      )
    } else if (transactionStatus === 'refund') {
      logInfo('WEBHOOK', 'Refund initiated', { orderId })
      // Update order status to refunded
      try {
        await supabase
          .from('orders')
          .update({ status: 'refunded' })
          .eq('order_id', orderId)
      } catch (err) {
        logWarn('WEBHOOK', 'Failed to update refunded order', {
          orderId,
          error: normalizeErrorMessage(err),
        })
      }
      return NextResponse.json({ status: true, message: 'Refund processed' }, { status: 200 })
    }

    return NextResponse.json({ status: true, message: 'OK' }, { status: 200 })
  } catch (error: any) {
    logError('WEBHOOK', 'Unhandled webhook error', {
      error: error?.message || String(error),
    })
    return NextResponse.json(
      { error: error.message || 'Webhook error' },
      { status: 500 }
    )
  }
}

/**
 * Send notification to admin via Telegram/WhatsApp
 * This connects to your bot-telegram system
 */
async function notifyAdmin(
  type: string,
  data: { orderId: string; amount: string; paymentType: string; status?: string; source?: string }
) {
  try {
    const message = generateAdminMessage(type, data)
    logInfo('WEBHOOK', 'Sending admin notification', {
      type,
      orderId: data.orderId,
      source: data.source || 'WEBSITE',
    })

    await sendTelegramToAdmins(message, 'WEBHOOK:notify-admin')
  } catch (error) {
    logError('WEBHOOK', 'Failed to notify admin', {
      type,
      orderId: data.orderId,
      error: normalizeErrorMessage(error),
    })
  }
}

function generateAdminMessage(
  type: string,
  data: { orderId: string; amount: string; paymentType: string; status?: string; source?: string }
): string {
  const { orderId, amount, paymentType, status, source } = data
  const sourceLine = `Sumber: ${String(source || 'WEBSITE').toUpperCase()}`

  if (type === 'payment-success') {
    return `
✅ PEMBAYARAN BERHASIL!
───────────────────────
${sourceLine}
Order ID: ${orderId}
Amount: Rp ${amount}
Payment: ${paymentType.toUpperCase()}
Status: ${String(status || 'paid').toUpperCase()}

ℹ️ Produk diproses auto-delivery.
───────────────────────
    `
  }

  if (type === 'payment-cancelled') {
    return `
⌛ ORDER EXPIRED/CANCELLED
───────────────────────
${sourceLine}
Order ID: ${orderId}
Amount: Rp ${amount}
Payment: ${paymentType.toUpperCase()}
Status: ${String(status || 'cancelled').toUpperCase()}

ℹ️ Stok reserved sudah dirilis kembali.
Silakan follow up customer jika diperlukan.
───────────────────────
    `
  }

  return 'Unknown notification type'
}
