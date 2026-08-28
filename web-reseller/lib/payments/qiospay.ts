/**
 * Qiospay QRIS integration helpers.
 *
 * Qiospay is fundamentally different from Midtrans/Tokopay:
 *  - There is NO create-order endpoint. The merchant owns a STATIC store QRIS
 *    (QIOSPAY_QRIS_STRING). To bill a specific nominal we convert that static
 *    QRIS into a DYNAMIC QRIS (inject amount tag 54 + recompute CRC16) ourselves.
 *  - Payment notifications (callback + mutasi) carry only amount/refid/time,
 *    with NO order reference. So we reconcile a payment to an order by matching
 *    the exact (unique) nominal that we billed.
 *
 * Docs: https://qiospay.id/api_docs.php
 */

/**
 * Maximum "admin fee" (unique code, in rupiah) added on top of an order total to
 * make each pending Qiospay order uniquely identifiable by amount. Codes run 1..MAX.
 * Configurable via QIOSPAY_MAX_ADMIN_FEE (default 300). Keep checkout and the
 * payment-info preview in sync via this single source.
 */
export const QIOSPAY_MAX_UNIQUE_CODE = (() => {
  const raw = Number.parseInt(String(process.env.QIOSPAY_MAX_ADMIN_FEE || ''), 10)
  // Clamp to a sane range: at least 1, at most 999 (QRIS amount stays small).
  if (Number.isFinite(raw) && raw >= 1 && raw <= 999) return raw
  return 300
})()

/**
 * CRC16-CCITT (False) checksum used by the EMVCo QRIS spec.
 * Poly 0x1021, init 0xFFFF, no reflection, no final xor. Returns 4 uppercase hex chars.
 */
export function qrisCrc16(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc <<= 1
      }
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Validate a static QRIS payload:
 *  - CRC (tag 63) must match a fresh CRC16 over the preceding data.
 *  - Mandatory top-level EMVCo tags must be present (52 MCC, 53 currency, 58 country, 59 name).
 *
 * A common failure is a truncated/miscopied string where tag 26 (merchant account
 * info) has a wrong length and swallows the mandatory tags — such a QR will not scan.
 * Returns { valid, error } instead of throwing so callers can decide how to react.
 */
export function validateStaticQris(staticQris: string): { valid: boolean; error?: string } {
  const cleaned = String(staticQris || '').trim()
  if (cleaned.length < 8) {
    return { valid: false, error: 'QRIS string too short/empty' }
  }

  // CRC check: last 4 chars vs computed over everything before them.
  const storedCrc = cleaned.slice(-4).toUpperCase()
  const computedCrc = qrisCrc16(cleaned.slice(0, -4))
  if (storedCrc !== computedCrc) {
    return {
      valid: false,
      error: `QRIS CRC mismatch (stored ${storedCrc}, computed ${computedCrc}) — the string is likely truncated or miscopied`,
    }
  }

  // Walk top-level TLV tags.
  const present = new Set<string>()
  let i = 0
  while (i < cleaned.length) {
    const tag = cleaned.substr(i, 2)
    const len = parseInt(cleaned.substr(i + 2, 2), 10)
    if (Number.isNaN(len)) {
      return { valid: false, error: `Malformed TLV at position ${i}` }
    }
    present.add(tag)
    i += 4 + len
    if (tag === '63') break
  }

  const mandatory = ['52', '53', '58', '59']
  const missing = mandatory.filter((m) => !present.has(m))
  if (missing.length > 0) {
    return {
      valid: false,
      error: `QRIS missing mandatory top-level tag(s): ${missing.join(', ')} — check the merchant account info (tag 26) length`,
    }
  }

  return { valid: true }
}

/**
 * Convert a static QRIS payload into a dynamic one that embeds a fixed amount.
 *
 * Steps (standard EMVCo transformation):
 *  1. Validate the static QRIS (CRC + mandatory tags) — refuse to build from a broken source.
 *  2. Strip the trailing CRC (tag 63).
 *  3. Flip point-of-initiation from static (010211) to dynamic (010212).
 *  4. Insert the transaction amount (tag 54) right before the country code (tag 58 / "5802ID").
 *  5. Recompute the CRC16 over everything up to and including "6304".
 */
export function buildDynamicQris(staticQris: string, amount: number): string {
  const cleaned = String(staticQris || '').trim()
  if (!cleaned) {
    throw new Error('QIOSPAY_QRIS_STRING is empty')
  }

  const validation = validateStaticQris(cleaned)
  if (!validation.valid) {
    throw new Error(`Invalid QIOSPAY_QRIS_STRING: ${validation.error}`)
  }

  const roundedAmount = Math.round(Number(amount))
  if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    throw new Error(`Invalid QRIS amount: ${amount}`)
  }

  // Remove the existing CRC (last 4 hex chars). The remainder ends with "6304".
  let payload = cleaned.slice(0, -4)

  // 2. Static -> dynamic point of initiation.
  payload = payload.replace('010211', '010212')

  // 3. Build amount tag 54 and insert it before the country code tag (5802ID).
  const amountStr = String(roundedAmount)
  const amountTag = '54' + amountStr.length.toString().padStart(2, '0') + amountStr

  const countryIdx = payload.indexOf('5802ID')
  if (countryIdx === -1) {
    // Fallback: insert right before the trailing "6304".
    const crcIdx = payload.lastIndexOf('6304')
    payload = payload.slice(0, crcIdx) + amountTag + payload.slice(crcIdx)
  } else {
    payload = payload.slice(0, countryIdx) + amountTag + payload.slice(countryIdx)
  }

  // 4. Recompute CRC over the payload (which ends with "6304") and append it.
  const crc = qrisCrc16(payload)
  return payload + crc
}

export interface QiospayMutasiEntry {
  date?: string
  amount: number
  type: string
  brand_name?: string
  issuer_reff?: string
  buyer_reff?: string
  balance?: string
  refid?: string | number
}

/**
 * Pull recent QRIS mutations (incoming transactions) from Qiospay.
 * Returns a normalized list of credit (CR) entries with numeric amounts.
 */
export async function fetchQiospayMutasi(): Promise<QiospayMutasiEntry[]> {
  const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || ''
  const apiKey = process.env.QIOSPAY_API_KEY || ''

  if (!merchantCode || !apiKey) {
    throw new Error('Qiospay credentials not configured')
  }

  const url = `https://qiospay.id/api/mutasi/qris/${encodeURIComponent(merchantCode)}/${encodeURIComponent(apiKey)}`

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const text = await res.text()

  if (!res.ok) {
    throw new Error(`Qiospay mutasi error: ${res.status} ${text.slice(0, 200)}`)
  }

  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Qiospay mutasi response not JSON: ${text.slice(0, 200)}`)
  }

  const rows: any[] = Array.isArray(json?.data) ? json.data : []
  return rows
    .map((row) => ({
      date: row?.date,
      amount: Number(row?.amount),
      type: String(row?.type || ''),
      brand_name: row?.brand_name,
      issuer_reff: row?.issuer_reff,
      buyer_reff: row?.buyer_reff,
      balance: row?.balance,
      refid: row?.refid,
    }))
    .filter((row) => Number.isFinite(row.amount))
}

/**
 * Whether a mutation entry represents incoming money (credit).
 */
export function isCreditEntry(entry: QiospayMutasiEntry): boolean {
  return String(entry.type || '').toUpperCase() === 'CR'
}
