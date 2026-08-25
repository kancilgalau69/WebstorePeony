export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, supabaseAdmin } from '@/lib/auth'

/**
 * Send Telegram notification to admin(s) about new affiliate withdrawal
 */
async function notifyAdminWithdrawal(
  userInfo: { nama: string; email: string; affiliate_code: string },
  withdrawal: { amount: number; bank_name: string; account_number: string; account_name: string }
) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(id => id.trim()).filter(Boolean)
    if (!botToken || adminIds.length === 0) return

    const message = [
      '💸 *AFFILIATE WITHDRAWAL REQUEST*',
      '',
      `👤 User: *${userInfo.nama}*`,
      `📧 Email: ${userInfo.email}`,
      `🔗 Kode Affiliate: \`${userInfo.affiliate_code}\``,
      '',
      `💰 Jumlah: *Rp ${withdrawal.amount.toLocaleString('id-ID')}*`,
      `🏦 Bank: ${withdrawal.bank_name}`,
      `🔢 No. Rekening: \`${withdrawal.account_number}\``,
      `👤 Atas Nama: ${withdrawal.account_name}`,
      '',
      '⏳ Status: Menunggu persetujuan admin',
      '',
      '👉 Buka Dashboard Admin → Affiliates untuk memproses',
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
    console.error('[AFF WD NOTIFY] Failed to send Telegram notification:', err.message)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { amount, bank_name, account_number, account_name } = await request.json()
    const amt = Number(amount)

    if (!amt || amt <= 0) {
      return NextResponse.json({ error: 'Jumlah tidak valid' }, { status: 400 })
    }
    if (!bank_name || !account_number || !account_name) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
    }

    // Read min withdraw from settings
    const { data: minSetting } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'affiliate_min_withdraw')
      .single()
    const minWithdraw = Number(minSetting?.value || 50000)

    if (amt < minWithdraw) {
      return NextResponse.json(
        { error: `Minimal withdraw Rp ${minWithdraw.toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // Get affiliate
    const { data: affiliate } = await supabaseAdmin
      .from('user_web_affiliates')
      .select('id, saldo, affiliate_code')
      .eq('user_web_id', session.userId)
      .single()

    if (!affiliate) {
      return NextResponse.json({ error: 'Profil affiliate tidak ditemukan' }, { status: 404 })
    }

    // Check available saldo (saldo - pending/approved withdrawals)
    const { data: pendingWd } = await supabaseAdmin
      .from('affiliate_withdrawals')
      .select('amount')
      .eq('affiliate_id', affiliate.id)
      .in('status', ['pending', 'approved'])

    const pendingTotal = (pendingWd || []).reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)
    const available = Math.max(0, Number(affiliate.saldo || 0) - pendingTotal)

    if (amt > available) {
      return NextResponse.json(
        { error: `Saldo tersedia: Rp ${available.toLocaleString('id-ID')}. Tidak cukup untuk withdraw Rp ${amt.toLocaleString('id-ID')}.` },
        { status: 400 }
      )
    }

    // Create withdrawal
    const { error } = await supabaseAdmin.from('affiliate_withdrawals').insert({
      affiliate_id: affiliate.id,
      amount: amt,
      bank_name: String(bank_name).trim(),
      account_number: String(account_number).trim(),
      account_name: String(account_name).trim(),
      status: 'pending',
    })

    if (error) {
      console.error('Affiliate withdrawal insert error:', error)
      return NextResponse.json({ error: 'Gagal mengajukan withdraw' }, { status: 500 })
    }

    // Notify admin (non-blocking)
    notifyAdminWithdrawal(
      { nama: session.nama, email: session.email, affiliate_code: affiliate.affiliate_code },
      { amount: amt, bank_name, account_number, account_name }
    )

    return NextResponse.json({ success: true, message: 'Permintaan withdraw berhasil diajukan' })
  } catch (err: any) {
    console.error('Affiliate withdraw error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
