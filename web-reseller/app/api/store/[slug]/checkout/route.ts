export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// Rate limiting constants
const RATE_LIMIT_REQUESTS_PER_IP = 3
const RATE_LIMIT_WINDOW_IP = 10 * 60 * 1000 // 10 minutes
const RATE_LIMIT_PENDING_ORDERS_PER_EMAIL = 2
const RATE_LIMIT_PENDING_ORDERS_PER_PHONE = 2
const RATE_LIMIT_PENDING_ORDERS_PER_IP = 2
const RATE_LIMIT_WINDOW_ORDERS = 30 * 60 * 1000 // 30 minutes

// CAPTCHA configuration
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY || ''
const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Bot user agents to block
const BOT_USER_AGENTS = [
  'python-requests',
  'curl',
  'wget',
  'postman',
  'insomnia',
  'httpie',
]

async function verifyCaptcha(token: string): Promise<{ success: boolean; score?: number; error?: string }> {
  if (!HCAPTCHA_SECRET) {
    if (IS_PRODUCTION) {
      console.error('CAPTCHA: HCaptcha secret not configured in production')
      return { success: false, error: 'CAPTCHA configuration error' }
    }
    console.warn('CAPTCHA: HCaptcha secret not configured, skipping verification in dev mode')
    return { success: true } // Allow in dev mode only
  }

  if (!token || token.trim() === '') {
    return { success: false, error: 'CAPTCHA token missing' }
  }

  try {
    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: HCAPTCHA_SECRET,
        response: token,
      }),
    })

    const result = await response.json()
    return {
      success: result.success,
      score: result.score,
      error: result['error-codes']?.join(', '),
    }
  } catch (error: any) {
    console.error('CAPTCHA: Failed to verify captcha', error.message)
    return { success: false, error: 'Verification failed' }
  }
}

function normalizeIp(ip: string): string {
  try {
    // Handle IPv6 by taking /64 prefix
    if (ip.includes(':')) {
      const parts = ip.split(':')
      // Take first 4 segments (64 bits)
      return parts.slice(0, 4).join(':') + '::/64'
    }
    return ip
  } catch {
    return ip
  }
}

function isBotUserAgent(userAgent: string): boolean {
  const ua = (userAgent || '').toLowerCase().trim()

  // Check for empty or null UA
  if (!ua || ua === 'null' || ua === 'undefined') {
    return true
  }

  return BOT_USER_AGENTS.some(botUa => ua.includes(botUa.toLowerCase()))
}

async function checkAndUpdateRateLimits(
  supabase: any,
  normalizedIp: string,
  email: string,
  phone: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_ORDERS).toISOString()

    // Check pending orders by email
    const { count: emailPending } = await supabase
      .from('reseller_orders')
      .select('*', { count: 'exact', head: true })
      .eq('customer_email', email)
      .eq('status', 'pending')
      .gte('created_at', windowStart)

    if ((emailPending || 0) >= RATE_LIMIT_PENDING_ORDERS_PER_EMAIL) {
      return { allowed: false, reason: 'Terlalu banyak order pending untuk email ini. Selesaikan pembayaran sebelumnya atau tunggu 30 menit.' }
    }

    // Check pending orders by phone
    const { count: phonePending } = await supabase
      .from('reseller_orders')
      .select('*', { count: 'exact', head: true })
      .eq('customer_phone', phone)
      .eq('status', 'pending')
      .gte('created_at', windowStart)

    if ((phonePending || 0) >= RATE_LIMIT_PENDING_ORDERS_PER_PHONE) {
      return { allowed: false, reason: 'Terlalu banyak order pending untuk nomor telepon ini. Selesaikan pembayaran sebelumnya atau tunggu 30 menit.' }
    }

    // Check IP-based rate limit via rate_limits table (if exists)
    try {
      const ipWindowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_IP).toISOString()
      const { data: rateLimitRow } = await supabase
        .from('rate_limits')
        .select('request_count')
        .eq('ip', normalizedIp)
        .gte('window_start', ipWindowStart)
        .order('window_start', { ascending: false })
        .limit(1)
        .single()

      if (rateLimitRow && rateLimitRow.request_count >= RATE_LIMIT_REQUESTS_PER_IP) {
        return { allowed: false, reason: 'Terlalu banyak request dari IP ini. Coba lagi dalam 10 menit.' }
      }
    } catch {
      // rate_limits table might not exist or query failed — skip IP check
    }

    // Update IP rate counter
    try {
      const now = new Date()
      const windowKey = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), Math.floor(now.getMinutes() / 10) * 10).toISOString()

      await supabase
        .from('rate_limits')
        .upsert({
          ip: normalizedIp,
          request_count: 1,
          window_start: windowKey,
          updated_at: now.toISOString(),
        }, { onConflict: 'ip,window_start' })
        .select()
    } catch {
      // Non-critical — IP rate tracking failed, but checkout should still proceed
    }

    return { allowed: true }
  } catch (error: any) {
    // If rate limit check itself fails, ALLOW the request
    console.error('RATE_LIMIT: Rate limit check failed, allowing request as fallback', error.message)
    return { allowed: true }
  }
}

async function logAbuse(
  supabase: any,
  request: NextRequest,
  captchaResult: { success: boolean; score?: number; error?: string },
  source: string = 'reseller_checkout'
) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1'

    await supabase
      .from('abuse_logs')
      .insert({
        ip,
        user_agent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        origin: request.headers.get('origin'),
        captcha_score: captchaResult.score,
        captcha_result: captchaResult.success ? 'success' : (captchaResult.error || 'failed'),
        source,
      })
  } catch (error: any) {
    console.warn('ABUSE_LOG: Failed to log abuse', error.message)
  }
}

function normalizeCustomerEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

function isValidCustomerEmail(email: string) {
  const normalized = normalizeCustomerEmail(email)
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = getSupabaseAdmin()

    // Get reseller
    const { data: reseller } = await supabase
      .from('resellers')
      .select('id, nama_toko, slug')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .single()

    if (!reseller) {
      return NextResponse.json({ error: 'Toko tidak ditemukan' }, { status: 404 })
    }

    const body = await request.json()
    const { items, customer_name, customer_email, customer_phone, captchaToken } = body

    // Normalize customer data
    const normalizedCustomerName = String(customer_name || '').trim()
    const normalizedCustomerEmail = normalizeCustomerEmail(customer_email)
    const normalizedCustomerPhone = String(customer_phone || '').trim()

    // Get client metadata
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     '127.0.0.1'
    const normalizedIp = normalizeIp(clientIp)
    const userAgent = request.headers.get('user-agent') || ''

    // Block bot user agents
    if (isBotUserAgent(userAgent)) {
      await logAbuse(supabase, request, { success: false, error: 'bot_user_agent' }, 'bot_block')
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Basic validation
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 })
    }
    if (!normalizedCustomerName || !normalizedCustomerEmail || !normalizedCustomerPhone) {
      return NextResponse.json({ error: 'Data pembeli wajib diisi' }, { status: 400 })
    }

    if (!isValidCustomerEmail(normalizedCustomerEmail)) {
      return NextResponse.json(
        { error: 'Email tidak valid. Gunakan email aktif yang benar.' },
        { status: 400 }
      )
    }

    // CAPTCHA verification
    const captchaResult = await verifyCaptcha(captchaToken || '')
    if (!captchaResult.success) {
      await logAbuse(supabase, request, captchaResult, 'reseller_checkout')
      return NextResponse.json(
        { error: 'Verifikasi CAPTCHA gagal. Silakan coba lagi.' },
        { status: 400 }
      )
    }

    // Rate limit checks
    const rateLimitCheck = await checkAndUpdateRateLimits(supabase, normalizedIp, normalizedCustomerEmail, normalizedCustomerPhone)
    if (!rateLimitCheck.allowed) {
      await logAbuse(supabase, request, captchaResult, 'rate_limit')
      return NextResponse.json(
        { error: rateLimitCheck.reason || 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Validate products and calculate prices
    let totalAmount = 0
    let totalModal = 0
    const orderItems = []

    for (const item of items) {
      const { data: product } = await supabase
        .from('products')
        .select('id, kode, nama, harga_web, harga_bot, stok, aktif')
        .eq('id', item.product_id)
        .single()

      if (!product || !product.aktif) {
        return NextResponse.json({ error: `Produk "${item.nama}" tidak tersedia` }, { status: 400 })
      }

      // Use product_inventory_summary for accurate stock validation
      let effectiveStock = product.stok || 0
      try {
        const { data: invRow } = await supabase
          .from('product_inventory_summary')
          .select('available_items, total_items')
          .eq('product_id', product.id)
          .single()

        if (invRow && Number(invRow.total_items) > 0) {
          effectiveStock = Number(invRow.available_items) || 0
        }
      } catch {
        // Fallback to products.stok if inventory summary unavailable
      }

      if (effectiveStock < item.quantity) {
        return NextResponse.json({ error: `Stok "${item.nama}" tidak cukup (tersisa ${effectiveStock})` }, { status: 400 })
      }

      const hargaModal = Number(product.harga_web) || Number(product.harga_bot) || 0
      const hargaJual = item.harga_jual || hargaModal

      totalAmount += hargaJual * item.quantity
      totalModal += hargaModal * item.quantity

      orderItems.push({
        product_id: product.id,
        product_code: product.kode,
        product_name: product.nama,
        quantity: item.quantity,
        harga_modal: hargaModal,
        harga_jual: hargaJual,
      })
    }

    const komisi = totalAmount - totalModal

    // Generate order ID
    const orderId = `RS-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`

    // Reserve items for order
    for (const item of orderItems) {
      try {
        await supabase.rpc('reserve_items_for_order', {
          p_order_id: orderId,
          p_product_code: item.product_code,
          p_quantity: item.quantity,
        })
      } catch (err: any) {
        console.error('Reserve items error:', err)
        // Continue - will handle via stock reservation fallback
      }
    }

    // Create QRIS payment via Midtrans
    let paymentUrl = ''
    let midtransToken = ''
    let transactionId = ''

    try {
      const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
      const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
      const baseUrl = isProduction
        ? 'https://api.midtrans.com/v2/charge'
        : 'https://api.sandbox.midtrans.com/v2/charge'

      const chargePayload = {
        payment_type: 'qris',
        transaction_details: {
          order_id: orderId,
          gross_amount: totalAmount,
        },
        customer_details: {
          first_name: normalizedCustomerName,
          email: normalizedCustomerEmail,
          phone: normalizedCustomerPhone,
        },
        qris: {
          acquirer: 'gopay',
        },
      }

      // Append webhook URL so Midtrans sends notification directly to this app
      const devWebhook = process.env.MIDTRANS_DEV_WEBHOOK_URL || ''

      const chargeRes = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(serverKey + ':').toString('base64')}`,
          ...(devWebhook ? { 'X-Append-Notification': devWebhook } : {}),
        },
        body: JSON.stringify(chargePayload),
      })

      const chargeData = await chargeRes.json()

      if (chargeData.status_code === '201' || chargeData.status_code === '200') {
        transactionId = chargeData.transaction_id
        // Find QRIS URL
        const qrisAction = chargeData.actions?.find((a: any) => a.name === 'generate-qr-code')
        paymentUrl = qrisAction?.url || chargeData.actions?.[0]?.url || ''
      } else {
        console.error('Midtrans charge failed:', chargeData)
        return NextResponse.json({ error: 'Gagal membuat pembayaran. Coba lagi.' }, { status: 500 })
      }
    } catch (err: any) {
      console.error('Midtrans error:', err)
      return NextResponse.json({ error: 'Gagal menghubungi payment gateway' }, { status: 500 })
    }

    // Save order to reseller_orders
    const { error: orderError } = await supabase
      .from('reseller_orders')
      .insert({
        order_id: orderId,
        reseller_id: reseller.id,
        customer_name: normalizedCustomerName,
        customer_email: normalizedCustomerEmail,
        customer_phone: normalizedCustomerPhone,
        status: 'pending',
        total_amount: totalAmount,
        total_modal: totalModal,
        komisi,
        payment_method: 'qris',
        payment_url: paymentUrl,
        midtrans_token: midtransToken,
        transaction_id: transactionId,
        items: orderItems,
      })

    if (orderError) {
      console.error('Order insert error:', orderError)
      return NextResponse.json({ error: 'Gagal menyimpan order' }, { status: 500 })
    }

    // Notify admin via Telegram
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').filter(Boolean)

      if (botToken && adminIds.length > 0) {
        const itemLines = orderItems.map((item: any, i: number) =>
          `   ${i + 1}. ${item.product_name} x${item.quantity} — Rp ${Number(item.harga_jual).toLocaleString('id-ID')}`
        ).join('\n')

        const msg = `🛒 *Order Reseller Baru!*\n\n📋 Order: \`${orderId}\`\n🏪 Toko: ${reseller.nama_toko}\n👤 Customer: ${normalizedCustomerName}\n📱 Phone: ${normalizedCustomerPhone}\n\n🛍 *Produk:*\n${itemLines}\n\n💰 Total: Rp ${totalAmount.toLocaleString('id-ID')}\n💵 Komisi: Rp ${komisi.toLocaleString('id-ID')}`

        for (const adminId of adminIds) {
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: adminId.trim(),
              text: msg,
              parse_mode: 'Markdown',
            }),
          }).catch(() => {})
        }
      }
    } catch {}

    return NextResponse.json({
      success: true,
      order_id: orderId,
      payment_url: paymentUrl,
      total_amount: totalAmount,
    })
  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
