// src/payments/tokopay.js
import crypto from 'crypto';
import fs from 'fs';

/* =========================
   Helper: Env & Logging
   ========================= */

let BOT_CONFIG;
try {
  const module = await import('../bot/config.js');
  BOT_CONFIG = module.BOT_CONFIG;
} catch {
  // Fallback
  const envModule = await import('../config/env.js');
  BOT_CONFIG = {
    TOKOPAY_MERCHANT_ID: process.env.TOKOPAY_MERCHANT_ID,
    TOKOPAY_SECRET_KEY: process.env.TOKOPAY_SECRET_KEY,
    MID_LOG_FILE: envModule.ENV.MID_LOG_FILE,
  };
}

function logLine(...args) {
  console.log('[TOKOPAY]', ...args);
  if (BOT_CONFIG.MID_LOG_FILE) {
    const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n';
    try { fs.appendFileSync(BOT_CONFIG.MID_LOG_FILE, `[${new Date().toISOString()}] ${line}`); } catch {}
  }
}

/* =========================
   Helper: Map Tokopay payment status -> Midtrans-like status
   ========================= */
function mapTokopayStatus(rawStatus) {
  const status = String(rawStatus || '').toLowerCase();
  // Tokopay payment statuses: Unpaid, Success, Completed, Proses Callback, Failed
  if (status === 'success' || status === 'completed') return 'settlement';
  if (status === 'failed' || status === 'canceled' || status === 'cancelled' || status === 'expired') return 'cancel';
  // Unpaid, Proses Callback, or anything else -> still waiting
  return 'pending';
}

/* =========================
   Core API: Status
   ========================= */
export async function tokopayStatus(order_id) {
  const merchantId = BOT_CONFIG.TOKOPAY_MERCHANT_ID || process.env.TOKOPAY_MERCHANT_ID;
  const secretKey = BOT_CONFIG.TOKOPAY_SECRET_KEY || process.env.TOKOPAY_SECRET_KEY;

  // Official status endpoint: GET /v1/check-order with merchant_id + secret + ref_id
  const params = new URLSearchParams({
    merchant_id: merchantId || '',
    secret: secretKey || '',
    ref_id: order_id,
  });
  const url = `https://api.tokopay.id/v1/check-order?${params.toString()}`;

  logLine('Status Request:', order_id);

  const res = await fetch(url, { headers: { 'accept': 'application/json' } });
  const text = await res.text();

  logLine('Status Response:', res.status, text.slice(0, 200));

  if (!res.ok) throw new Error('Tokopay status error: ' + res.status + ' ' + text);
  const json = JSON.parse(text);

  // Response shape: { status: 1, rc: 200, data: { status: "Success", nominal, trx_id, reff_id, ... } }
  // The actual PAYMENT status lives in json.data.status, NOT the top-level json.status
  // (top-level status/rc only indicate whether the lookup itself succeeded).
  const info = json.data || {};
  const paymentStatus = info.status;

  return {
    transaction_status: mapTokopayStatus(paymentStatus),
    transaction_id: info.trx_id,
    order_id: info.reff_id || order_id,
    gross_amount: info.nominal,
    payment_type: 'tokopay',
    _raw: json
  };
}

/* =========================
   Core API: Create Charge
   ========================= */
export async function createTokopayCharge({ order_id, gross_amount, customer_name, customer_email, customer_phone, ttl_ms }) {
  const merchantId = BOT_CONFIG.TOKOPAY_MERCHANT_ID || process.env.TOKOPAY_MERCHANT_ID;
  const secretKey = BOT_CONFIG.TOKOPAY_SECRET_KEY || process.env.TOKOPAY_SECRET_KEY;

  if (!merchantId || !secretKey) {
    throw new Error('Tokopay credentials not configured');
  }

  const reff_id = order_id;
  const signature = crypto.createHash('md5')
    .update(`${merchantId}:${secretKey}:${reff_id}`)
    .digest('hex');

  // expired_ts is a Unix timestamp (seconds). Align it with the bot payment TTL
  // so the QR expires at the same time the order is released. 0 = Tokopay default (24h).
  const ttlMs = Number(ttl_ms) > 0 ? Number(ttl_ms) : Number(BOT_CONFIG.PAYMENT_TTL_MS) || 0;
  const expired_ts = ttlMs > 0 ? Math.floor((Date.now() + ttlMs) / 1000) : 0;

  const payload = {
    merchant_id: merchantId,
    kode_channel: 'QRISREALTIME', // Hardcoded QRISREALTIME for telegram bot currently
    reff_id: reff_id,
    amount: Math.round(gross_amount),
    customer_name: customer_name || 'Customer',
    customer_email: customer_email || 'customer@example.com',
    customer_phone: customer_phone || '081111111111',
    redirect_url: 'https://tokopay.id',
    expired_ts,
    signature: signature
  };

  const url = `https://api.tokopay.id/v1/order`;
  logLine('Charge Request:', order_id, gross_amount);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  logLine('Charge Response:', res.status, text.slice(0, 200));

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error('Tokopay response not JSON: ' + text);
  }

  // On create-order, the top-level `status` reflects the create result ("Success").
  const data = json.data || {};
  const createOk = json.status === 'Success' || json.status === true || json.status === 1;
  const hasQr = Boolean(data.qr_link || data.qr_string || data.pay_url || data.checkout_url);

  if (!res.ok || (!createOk && !hasQr)) {
    throw new Error('Tokopay create charge error: ' + res.status + ' ' + text);
  }

  // For QRIS: qr_string is the raw QR payload (render to image), qr_link is the PNG URL,
  // pay_url is the hosted checkout page.
  const qr_string = data.qr_string || null;
  const qr_url = data.qr_link || null;
  const payment_url = data.pay_url || data.checkout_url || null;

  logLine('Tokopay Created:', { order_id, has_qr_string: !!qr_string, has_qr_url: !!qr_url });

  return {
    transaction_id: data.trx_id,
    order_id: reff_id,
    gross_amount: data.total_bayar ?? data.nominal ?? Math.round(gross_amount),
    payment_type: 'tokopay',
    transaction_status: 'pending',
    qr_string,
    qr_url,
    payment_url,
    expired_at: expired_ts ? new Date(expired_ts * 1000).toISOString() : null,
    _raw: json
  };
}
