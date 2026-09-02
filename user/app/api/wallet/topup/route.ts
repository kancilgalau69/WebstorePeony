import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'
import { buildDynamicQris, QIOSPAY_MAX_UNIQUE_CODE } from '@/lib/payments/qiospay'
import { logError, logInfo, logWarn } from '@/lib/logging/terminal-log'
import { formatTelegramCurrency, sendTelegramToAdmins } from '@/lib/telegram-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

const supabase = createClient(supabaseUrl, supabaseServerKey)

const MIN_TOPUP = 1000
const MAX_TOPUP = 10000000

/**
 * Pick a unique total (base + code 1..MAX) not currently used by any pending
 * order OR topup, so the amount uniquely identifies this payment.
 */
async function computeUniqueAmount(base: number): Promise<{ amount: number; adminFee: number }> {
  const MAX = QIOSPAY_MAX_UNIQUE_CODE
  const taken = new Set<number>()
  try {
    const [{ data: orders }, { data: topups }] = await Promise.all([
      supabase.from('orders').select('total_amount').eq('payment_provider', 'qiospay').eq('status', 'pending').gte('total_amount', base + 1).lte('total_amount', base + MAX),
      supabase.from('saldo_topup_orders').select('total_amount').eq('status', 'pending').gte('total_amount', base + 1).lte('total_amount', base + MAX),
    ])
    for (const o of orders || []) taken.add(Math.round(Number(o.total_amount)))
    for (const t of topups || []) taken.add(Math.round(Number(t.total_amount)))
  } catch (e: any) {
    logWarn('TOPUP', 'unique amount scan failed, fallback +1', { error: e?.message })
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const code = Math.floor(Math.random() * MAX) + 1
    if (!taken.has(base + code)) return { amount: base + code, adminFee: code }
  }
  for (let code = 1; code <= MAX; code++) {
    if (!taken.has(base + code)) return { amount: base + code, adminFee: code }
  }
  return { amount: base + 1, adminFee: 1 }
}

// POST - create a deposit (topup) order and return QRIS to pay.
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser(request)
    if (!session) {
      return NextResponse.json({ error: 'Anda harus login untuk deposit saldo.', requireAuth: true }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const amount = Math.round(Number(body.amount))

    if (!Number.isFinite(amount) || amount < MIN_TOPUP) {
      return NextResponse.json({ error: `Minimal deposit Rp ${MIN_TOPUP.toLocaleString('id-ID')}` }, { status: 400 })
    }
    if (amount > MAX_TOPUP) {
      return NextResponse.json({ error: `Maksimal deposit Rp ${MAX_TOPUP.toLocaleString('id-ID')}` }, { status: 400 })
    }

    // Active gateway (only Qiospay supported for topup right now)
    let activeGateway = 'qiospay'
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', 'active_payment_gateway').single()
      if (data?.value) activeGateway = String(data.value).toLowerCase()
    } catch {}

    if (activeGateway !== 'qiospay') {
      return NextResponse.json({ error: 'Deposit saldo saat ini hanya tersedia via QRIS Qiospay.' }, { status: 400 })
    }

    const qrisStatic = process.env.QIOSPAY_QRIS_STRING
    if (!qrisStatic || !process.env.QIOSPAY_MERCHANT_CODE || !process.env.QIOSPAY_API_KEY) {
      return NextResponse.json({ error: 'Server belum dikonfigurasi (Qiospay)' }, { status: 500 })
    }

    const { amount: uniqueAmount, adminFee } = await computeUniqueAmount(amount)

    let dynamicQris: string
    try {
      dynamicQris = buildDynamicQris(qrisStatic, uniqueAmount)
    } catch (e: any) {
      logError('TOPUP', 'Failed building dynamic QRIS', { error: e?.message })
      return NextResponse.json({ error: 'Gagal membuat QRIS deposit' }, { status: 500 })
    }

    const topupId = `TOPUP-${Date.now()}`
    const { error: insertError } = await supabase.from('saldo_topup_orders').insert({
      topup_id: topupId,
      user_id: session.userId,
      amount, // credited to wallet on success
      gateway_fee: adminFee,
      total_amount: uniqueAmount, // what the customer must pay (unique)
      status: 'pending',
      payment_method: 'qris',
      qr_code_url: null,
    })

    if (insertError) {
      logError('TOPUP', 'Failed to insert topup order', { topupId, error: insertError.message })
      return NextResponse.json({ error: 'Gagal membuat order deposit' }, { status: 500 })
    }

    logInfo('TOPUP', 'Topup order created', { topupId, amount, uniqueAmount })
    try {
      await sendTelegramToAdmins([
        '💰 DEPOSIT BARU MASUK',
        '',
        `Topup ID: ${topupId}`,
        `User: ${session.nama}`,
        `Email: ${session.email}`,
        `Phone: ${session.phone}`,
        `Nominal Saldo: ${formatTelegramCurrency(amount)}`,
        `Admin Fee: ${formatTelegramCurrency(adminFee)}`,
        `Total Bayar: ${formatTelegramCurrency(uniqueAmount)}`,
        'Status: pending',
        `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
      ].join('\n'), 'TOPUP:new-deposit')
    } catch (notifyError: any) {
      logWarn('TOPUP', 'Failed sending admin deposit notification', { error: notifyError?.message })
    }

    return NextResponse.json({
      success: true,
      topupId,
      qrString: dynamicQris,
      amount: uniqueAmount,        // total to pay
      baseAmount: amount,          // credited to wallet
      adminFee,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create topup' }, { status: 500 })
  }
}

// GET - poll a topup status (mutasi match) so deposit completes without public callback.
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const topupId = String(searchParams.get('topup_id') || '')
    if (!topupId) return NextResponse.json({ error: 'topup_id required' }, { status: 400 })

    const { data: topup } = await supabase
      .from('saldo_topup_orders')
      .select('topup_id, user_id, status, total_amount')
      .eq('topup_id', topupId)
      .single()

    if (!topup || topup.user_id !== session.userId) {
      return NextResponse.json({ error: 'Topup tidak ditemukan' }, { status: 404 })
    }

    if (topup.status === 'completed') {
      return NextResponse.json({ success: true, status: 'completed' })
    }
    if (topup.status === 'expired' || topup.status === 'failed') {
      return NextResponse.json({ success: true, status: topup.status })
    }

    // Poll Qiospay mutasi and settle if the unique amount was paid.
    try {
      const { fetchQiospayMutasi, isCreditEntry } = await import('@/lib/payments/qiospay')
      const { settleTopupOrder } = await import('@/lib/orders/settle-topup')
      const expected = Math.round(Number(topup.total_amount))
      const mutasi = await fetchQiospayMutasi()
      const paid = mutasi.some((e) => isCreditEntry(e) && Math.round(e.amount) === expected)
      if (paid) {
        const res = await settleTopupOrder(topupId)
        return NextResponse.json({ success: true, status: res.completed ? 'completed' : 'pending' })
      }
    } catch (e: any) {
      logWarn('TOPUP', 'mutasi poll failed (non-fatal)', { topupId, error: e?.message })
    }

    return NextResponse.json({ success: true, status: 'pending' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to check topup' }, { status: 500 })
  }
}
