import { supabase } from '../database/supabase.js';

const MAX_UNIQUE_CODE = (() => {
  const value = Number.parseInt(String(process.env.QIOSPAY_MAX_ADMIN_FEE || ''), 10);
  return Number.isFinite(value) && value >= 1 && value <= 999 ? value : 300;
})();

const AMOUNT_REUSE_WINDOW_MS = 24 * 60 * 60 * 1000;

function crc16(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function validateStaticQris(value) {
  const qris = String(value || '').trim();
  if (qris.length < 8) throw new Error('QIOSPAY_QRIS_STRING kosong/tidak valid');
  const stored = qris.slice(-4).toUpperCase();
  const computed = crc16(qris.slice(0, -4));
  if (stored !== computed) throw new Error(`QIOSPAY_QRIS_STRING CRC mismatch (${stored} != ${computed})`);
  const present = new Set();
  let offset = 0;
  while (offset < qris.length) {
    const tag = qris.slice(offset, offset + 2);
    const length = Number.parseInt(qris.slice(offset + 2, offset + 4), 10);
    if (!tag || !Number.isFinite(length)) throw new Error(`QIOSPAY_QRIS_STRING malformed pada posisi ${offset}`);
    present.add(tag);
    offset += 4 + length;
    if (tag === '63') break;
  }
  for (const tag of ['52', '53', '58', '59']) {
    if (!present.has(tag)) throw new Error(`QIOSPAY_QRIS_STRING tidak memiliki tag ${tag}`);
  }
  return qris;
}

export function buildDynamicQris(staticQris, amount) {
  const qris = validateStaticQris(staticQris);
  const rounded = Math.round(Number(amount));
  if (!Number.isFinite(rounded) || rounded <= 0) throw new Error('Nominal QRIS tidak valid');

  let payload = qris.slice(0, -4).replace('010211', '010212');
  const amountText = String(rounded);
  const amountTag = `54${String(amountText.length).padStart(2, '0')}${amountText}`;
  const countryIndex = payload.indexOf('5802ID');
  const insertIndex = countryIndex >= 0 ? countryIndex : payload.lastIndexOf('6304');
  if (insertIndex < 0) throw new Error('Payload QRIS tidak memiliki posisi amount yang valid');
  payload = payload.slice(0, insertIndex) + amountTag + payload.slice(insertIndex);
  return payload + crc16(payload);
}

async function computeUniqueAmount(baseAmount) {
  const base = Math.round(Number(baseAmount));
  const windowStart = new Date(Date.now() - AMOUNT_REUSE_WINDOW_MS).toISOString();
  const [{ data: orders, error: orderError }, { data: topups, error: topupError }] = await Promise.all([
    supabase.from('orders').select('total_amount').eq('payment_provider', 'qiospay')
      .gte('created_at', windowStart).gte('total_amount', base + 1).lte('total_amount', base + MAX_UNIQUE_CODE),
    supabase.from('saldo_topup_orders').select('total_amount')
      .gte('created_at', windowStart).gte('total_amount', base + 1).lte('total_amount', base + MAX_UNIQUE_CODE),
  ]);
  if (orderError) throw orderError;
  if (topupError) throw topupError;

  const taken = new Set();
  for (const row of orders || []) taken.add(Math.round(Number(row.total_amount)));
  for (const row of topups || []) taken.add(Math.round(Number(row.total_amount)));

  for (let attempt = 0; attempt < 60; attempt++) {
    const code = Math.floor(Math.random() * MAX_UNIQUE_CODE) + 1;
    if (!taken.has(base + code)) return { amount: base + code, adminFee: code };
  }
  for (let code = 1; code <= MAX_UNIQUE_CODE; code++) {
    if (!taken.has(base + code)) return { amount: base + code, adminFee: code };
  }
  throw new Error('Semua kode unik Qiospay sedang digunakan');
}

export async function createQiospayCharge({ order_id, gross_amount, ttl_ms }) {
  const staticQris = process.env.QIOSPAY_QRIS_STRING || '';
  if (!process.env.QIOSPAY_MERCHANT_CODE || !process.env.QIOSPAY_API_KEY || !staticQris) {
    throw new Error('Qiospay credentials not configured');
  }

  const { amount, adminFee } = await computeUniqueAmount(gross_amount);
  const qrString = buildDynamicQris(staticQris, amount);
  const expiresAt = Date.now() + (Number(ttl_ms) || 15 * 60 * 1000);
  return {
    transaction_status: 'pending',
    transaction_id: order_id,
    order_id,
    gross_amount: amount,
    base_amount: Math.round(Number(gross_amount)),
    admin_fee: adminFee,
    payment_type: 'qiospay',
    qr_string: qrString,
    qr_url: null,
    expired_at: expiresAt,
  };
}

async function fetchMutasi() {
  const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || '';
  const apiKey = process.env.QIOSPAY_API_KEY || '';
  if (!merchantCode || !apiKey) throw new Error('Qiospay credentials not configured');
  const response = await fetch(`https://qiospay.id/api/mutasi/qris/${encodeURIComponent(merchantCode)}/${encodeURIComponent(apiKey)}`, {
    headers: { Accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Qiospay mutasi error: ${response.status} ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  return (Array.isArray(json?.data) ? json.data : []).map((row) => ({
    date: row?.date,
    time: row?.time,
    amount: Number(row?.amount),
    type: String(row?.type || ''),
    refid: row?.refid,
  })).filter((row) => Number.isFinite(row.amount));
}

function entryTimestamp(entry) {
  const datePart = String(entry.date || '').trim();
  const timePart = String(entry.time || '').trim();
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(datePart) && /^\d{2}:\d{2}(?::\d{2})?$/.test(timePart)
    ? `${datePart} ${timePart}`
    : String(datePart || timePart).trim();
  if (!raw) return null;
  if (/^\d{10,13}$/.test(raw)) return raw.length === 10 ? Number(raw) * 1000 : Number(raw);
  const sql = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (sql) {
    const [, y, m, d, hh, mm, ss = '00'] = sql;
    const parsed = Date.parse(`${y}-${m}-${d}T${hh}:${mm}:${ss}+07:00`);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function qiospayStatus(order_id, order = {}) {
  const expected = Math.round(Number(order.total));
  const created = Number(order.createdAt);
  const expires = Number(order.expiresAt || created + 15 * 60 * 1000);
  if (!Number.isFinite(expected) || !Number.isFinite(created)) throw new Error('Qiospay order data order tidak lengkap');

  const mutations = await fetchMutasi();
  const paid = mutations.find((entry) => {
    if (entry.type.toUpperCase() !== 'CR' || Math.round(entry.amount) !== expected) return false;
    const paidAt = entryTimestamp(entry);
    return paidAt !== null && paidAt >= created - 2 * 60 * 1000 && paidAt <= expires + 5 * 60 * 1000;
  });

  return {
    transaction_status: paid ? 'settlement' : 'pending',
    transaction_id: paid?.refid || order_id,
    order_id,
    gross_amount: expected,
    payment_type: 'qiospay',
    _raw: paid || null,
  };
}
