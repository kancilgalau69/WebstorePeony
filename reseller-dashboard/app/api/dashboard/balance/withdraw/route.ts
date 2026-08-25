export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionReseller, getResellerId, supabaseAdmin } from '@/lib/auth'

const MIN_WITHDRAWAL = 50000

/**
 * Send Telegram notification to admin(s) about new withdrawal request
 */
async function notifyAdminWithdrawal(reseller: { nama_toko: string; email: string }, withdrawal: { amount: number; bank_name: string; account_number: string; account_name: string }) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(id => id.trim()).filter(Boolean)

    if (!botToken || adminIds.length === 0) {
      console.warn('[WD NOTIFY] TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_IDS not configured, skipping notification')
      return
    }

    const message = [
      '💸 *WITHDRAWAL REQUEST BARU*',
      '',
      `🏪 Reseller: *${reseller.nama_toko}*`,
      `📧 Email: ${reseller.email}`,
      '',
      `💰 Jumlah: *Rp ${withdrawal.amount.toLocaleString('id-ID')}*`,
      `🏦 Bank: ${withdrawal.bank_name}`,
      `🔢 No. Rekening: \`${withdrawal.account_number}\``,
      `👤 Atas Nama: ${withdrawal.account_name}`,
      '',
      '⏳ Status: Menunggu persetujuan admin',
      '',
      '👉 Buka Dashboard Admin → Resellers untuk memproses',
    ].join('\n')

    const sendUrl = `https://api.telegram.org/bot${botToken}/sendMessage`

    await Promise.allSettled(
      adminIds.map(chatId =>
        fetch(sendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }),
        })
      )
    )
  } catch (err: any) {
    console.error('[WD NOTIFY] Failed to send Telegram notification:', err.message)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionReseller(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resellerId = await getResellerId(session)
    if (!resellerId) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 })
    }

    const { amount, bank_name, account_number, account_name } = await request.json()

    if (!amount || amount < MIN_WITHDRAWAL) {
      return NextResponse.json({ error: `Minimal withdraw Rp ${MIN_WITHDRAWAL.toLocaleString('id-ID')}` }, { status: 400 })
    }

    if (!bank_name || !account_number || !account_name) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
    }

    // Calculate actual available saldo from data (same logic as balance API)
    const { data: completedOrders } = await supabaseAdmin
      .from('reseller_orders')
      .select('komisi')
      .eq('reseller_id', resellerId)
      .eq('status', 'completed')

    const totalKomisi = (completedOrders || []).reduce((sum: number, o: any) => sum + Number(o.komisi || 0), 0)

    const { data: completedWd } = await supabaseAdmin
      .from('reseller_withdrawals')
      .select('amount')
      .eq('reseller_id', resellerId)
      .eq('status', 'completed')

    const withdrawnAmount = (completedWd || []).reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)

    const { data: pendingWd } = await supabaseAdmin
      .from('reseller_withdrawals')
      .select('amount')
      .eq('reseller_id', resellerId)
      .in('status', ['pending', 'approved'])

    const pendingTotal = (pendingWd || []).reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)

    const availableSaldo = Math.max(0, totalKomisi - withdrawnAmount - pendingTotal)

    if (amount > availableSaldo) {
      return NextResponse.json({
        error: `Saldo tersedia: Rp ${availableSaldo.toLocaleString('id-ID')}. Tidak cukup untuk withdraw Rp ${amount.toLocaleString('id-ID')}.`
      }, { status: 400 })
    }

    // Create withdrawal request
    const { error } = await supabaseAdmin
      .from('reseller_withdrawals')
      .insert({
        reseller_id: resellerId,
        amount,
        bank_name,
        account_number,
        account_name,
        status: 'pending',
      })

    if (error) {
      console.error('Withdrawal insert error:', error)
      return NextResponse.json({ error: 'Gagal mengajukan withdraw' }, { status: 500 })
    }

    // Send Telegram notification to admin (non-blocking)
    const { data: resellerData } = await supabaseAdmin
      .from('resellers')
      .select('nama_toko, email')
      .eq('id', resellerId)
      .single()

    if (resellerData) {
      notifyAdminWithdrawal(resellerData, { amount, bank_name, account_number, account_name })
    }

    return NextResponse.json({ success: true, message: 'Permintaan withdraw berhasil diajukan' })
  } catch (err: any) {
    console.error('Withdraw error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
