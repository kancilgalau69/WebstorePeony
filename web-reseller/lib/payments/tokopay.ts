/**
 * Tokopay QRIS integration helpers (TypeScript).
 *
 * - Create order: POST https://api.tokopay.id/v1/order
 *   Response (QRIS): { status: "Success", data: { qr_string, qr_link, pay_url, trx_id, total_bayar, ... } }
 * - Check status:  GET  https://api.tokopay.id/v1/check-order?merchant_id&secret&ref_id
 *   Response: { status: 1, data: { status: "Unpaid"|"Success"|"Completed"|"Failed", ... } }
 *   NOTE: the actual payment status is data.status, NOT the top-level status.
 * - Signature: md5(merchant_id:secret:reff_id)
 *
 * Docs: https://docs.tokopay.id/
 */
import crypto from 'crypto'

function tokopayCreds() {
  const merchantId = process.env.TOKOPAY_MERCHANT_ID || ''
  const secretKey = process.env.TOKOPAY_SECRET_KEY || ''
  return { merchantId, secretKey }
}

function tokopaySignature(reffId: string): string {
  const { merchantId, secretKey } = tokopayCreds()
  return crypto.createHash('md5').update(`${merchantId}:${secretKey}:${reffId}`).digest('hex')
}

/** Map a Tokopay payment status string to a Midtrans-like transaction status. */
export function mapTokopayStatus(rawStatus: unknown): 'settlement' | 'cancel' | 'pending' {
  const status = String(rawStatus || '').toLowerCase()
  if (status === 'success' || status === 'completed') return 'settlement'
  if (status === 'failed' || status === 'canceled' || status === 'cancelled' || status === 'expired') return 'cancel'
  return 'pending'
}

export interface TokopayChargeResult {
  transactionId?: string
  orderId: string
  grossAmount?: number
  qrString: string | null
  qrUrl: string | null
  paymentUrl: string | null
  expiredAt: string | null
  raw: any
}

/**
 * Create a Tokopay QRIS order and return the QR payload.
 * `ttlMs` aligns the QR expiry (expired_ts, Unix seconds) with the order TTL.
 */
export async function createTokopayCharge(opts: {
  orderId: string
  grossAmount: number
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  ttlMs?: number
}): Promise<TokopayChargeResult> {
  const { merchantId, secretKey } = tokopayCreds()
  if (!merchantId || !secretKey) {
    throw new Error('Tokopay credentials not configured')
  }

  const reffId = opts.orderId
  const ttlMs = Number(opts.ttlMs) > 0 ? Number(opts.ttlMs) : 0
  const expiredTs = ttlMs > 0 ? Math.floor((Date.now() + ttlMs) / 1000) : 0

  const payload = {
    merchant_id: merchantId,
    kode_channel: 'QRISREALTIME',
    reff_id: reffId,
    amount: Math.round(opts.grossAmount),
    customer_name: opts.customerName || 'Customer',
    customer_email: opts.customerEmail || 'customer@example.com',
    customer_phone: opts.customerPhone || '081111111111',
    redirect_url: 'https://tokopay.id',
    expired_ts: expiredTs,
    signature: tokopaySignature(reffId),
  }

  const res = await fetch('https://api.tokopay.id/v1/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Tokopay response not JSON: ' + text.slice(0, 200))
  }

  const data = json.data || {}
  const createOk = json.status === 'Success' || json.status === true || json.status === 1
  const hasQr = Boolean(data.qr_link || data.qr_string || data.pay_url || data.checkout_url)

  if (!res.ok || (!createOk && !hasQr)) {
    throw new Error('Tokopay create charge error: ' + res.status + ' ' + text.slice(0, 200))
  }

  return {
    transactionId: data.trx_id,
    orderId: reffId,
    grossAmount: data.total_bayar ?? data.nominal ?? Math.round(opts.grossAmount),
    qrString: data.qr_string || null,
    qrUrl: data.qr_link || null,
    paymentUrl: data.pay_url || data.checkout_url || null,
    expiredAt: expiredTs ? new Date(expiredTs * 1000).toISOString() : null,
    raw: json,
  }
}

export interface TokopayStatusResult {
  transactionStatus: 'settlement' | 'cancel' | 'pending'
  transactionId?: string
  orderId: string
  grossAmount?: number
  raw: any
}

/** Check a Tokopay order status via the official check-order endpoint. */
export async function tokopayStatus(orderId: string): Promise<TokopayStatusResult> {
  const { merchantId, secretKey } = tokopayCreds()
  const params = new URLSearchParams({
    merchant_id: merchantId,
    secret: secretKey,
    ref_id: orderId,
  })
  const url = `https://api.tokopay.id/v1/check-order?${params.toString()}`

  const res = await fetch(url, { headers: { accept: 'application/json' } })
  const text = await res.text()
  if (!res.ok) throw new Error('Tokopay status error: ' + res.status + ' ' + text.slice(0, 200))

  const json = JSON.parse(text)
  const info = json.data || {}

  return {
    transactionStatus: mapTokopayStatus(info.status),
    transactionId: info.trx_id,
    orderId: info.reff_id || orderId,
    grossAmount: info.nominal,
    raw: json,
  }
}

/** Verify a Tokopay callback signature: md5(merchant_id:secret:reff_id). */
export function verifyTokopaySignature(reffId: string, signature: string): boolean {
  if (!signature) return false
  return tokopaySignature(reffId) === signature
}
