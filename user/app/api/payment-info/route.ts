import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveWebPrice } from '@/lib/pricing'
import { getSessionUser } from '@/lib/auth'
import { logWarn } from '@/lib/logging/terminal-log'
import { QIOSPAY_MAX_UNIQUE_CODE } from '@/lib/payments/qiospay'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

const supabase = createClient(supabaseUrl, supabaseServerKey)

/**
 * Payment preview endpoint.
 *
 * Given the cart + optional promo, returns the server-computed subtotal and, for
 * Qiospay, the "admin fee" (unique code) that will be added on top so the customer
 * knows the exact total BEFORE the QRIS is generated. The chosen admin fee is
 * returned so the checkout call can reuse the same code (kept consistent).
 *
 * This is a lightweight, read-only preview: no captcha, no reservation, no order.
 */
export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServerKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const rawItems: any[] = Array.isArray(body?.items) ? body.items : []

    // Normalize requested items -> product_id + quantity.
    const requestedByProductId = new Map<string, number>()
    for (const item of rawItems) {
      const productId = String(item?.product?.id || '').trim()
      const quantity = Number(item?.quantity || 0)
      if (!productId || !Number.isInteger(quantity) || quantity <= 0) continue
      requestedByProductId.set(productId, (requestedByProductId.get(productId) || 0) + quantity)
    }

    const productIds = Array.from(requestedByProductId.keys())

    // Active gateway.
    let activeGateway = 'midtrans'
    try {
      const { data: settingsData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'active_payment_gateway')
        .single()
      if (settingsData?.value) activeGateway = String(settingsData.value).toLowerCase()
    } catch (err) {
      logWarn('PAYMENT_INFO', 'Failed reading active_payment_gateway', { error: String(err) })
    }

    // Compute subtotal from DB-backed prices (never trust client).
    let subtotal = 0
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, harga_web, harga_bot, aktif')
        .in('id', productIds)

      const productById = new Map<string, any>()
      for (const p of products || []) productById.set(String(p.id), p)

      for (const [productId, quantity] of requestedByProductId.entries()) {
        const product = productById.get(productId)
        if (!product || product.aktif === false) continue
        subtotal += resolveWebPrice(product) * quantity
      }
    }

    // Apply percent/fixed promo (same rules as checkout pre-charge).
    let promoDiscount = 0
    const promoCode = String(body?.promoCode || '').trim().toUpperCase()
    if (promoCode && subtotal > 0) {
      try {
        const sessionUser = await getSessionUser(request).catch(() => null)
        const { data: promoRows } = await supabase
          .from('web_promos')
          .select('*')
          .eq('code', promoCode)
          .eq('is_active', true)
          .limit(1)

        const promo = promoRows?.[0]
        if (promo) {
          const now = new Date()
          const validFrom = promo.valid_from ? new Date(promo.valid_from) : null
          const validUntil = promo.valid_until ? new Date(promo.valid_until) : null
          const isInPeriod = (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil)
          const isUnderLimit = !promo.usage_limit || promo.usage_count < promo.usage_limit
          const meetsMinPurchase = !promo.min_purchase || subtotal >= Number(promo.min_purchase)
          const eligible = !(promo.eligible_for === 'registered_only' && !sessionUser)

          if (isInPeriod && isUnderLimit && meetsMinPurchase && eligible) {
            if (promo.promo_type === 'percent') {
              promoDiscount = (subtotal * (Number(promo.discount_percent) || 0)) / 100
              if (promo.max_discount && promoDiscount > Number(promo.max_discount)) {
                promoDiscount = Number(promo.max_discount)
              }
            } else if (promo.promo_type === 'fixed') {
              promoDiscount = Math.min(Number(promo.discount_amount) || 0, subtotal)
            }
          }
        }
      } catch {
        // Non-blocking preview
      }
    }

    const netTotal = Math.max(1, Math.round(subtotal - promoDiscount))

    // For Qiospay, pick an admin fee (unique code) not currently used by a pending order.
    let adminFee = 0
    if (activeGateway === 'qiospay') {
      const base = netTotal
      try {
        const { data: pendingOrders } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('payment_provider', 'qiospay')
          .eq('status', 'pending')
          .gte('total_amount', base + 1)
          .lte('total_amount', base + QIOSPAY_MAX_UNIQUE_CODE)

        const taken = new Set<number>((pendingOrders || []).map((o: any) => Math.round(Number(o.total_amount))))
        for (let attempt = 0; attempt < 50; attempt++) {
          const code = Math.floor(Math.random() * QIOSPAY_MAX_UNIQUE_CODE) + 1
          if (!taken.has(base + code)) {
            adminFee = code
            break
          }
        }
        if (adminFee === 0) {
          for (let code = 1; code <= QIOSPAY_MAX_UNIQUE_CODE; code++) {
            if (!taken.has(base + code)) {
              adminFee = code
              break
            }
          }
        }
      } catch {
        adminFee = 0
      }
      if (adminFee === 0) adminFee = 1
    }

    return NextResponse.json({
      gateway: activeGateway,
      subtotal: Math.round(subtotal),
      promoDiscount: Math.round(promoDiscount),
      netTotal,
      adminFee,
      total: netTotal + adminFee,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to get payment info' }, { status: 500 })
  }
}
