export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { QIOSPAY_MAX_UNIQUE_CODE } from '@/lib/payments/qiospay'

/**
 * Payment preview for the reseller storefront.
 *
 * Returns the active gateway and, for Qiospay, the "admin fee" (unique code) that
 * will be added on top of the subtotal — so the customer sees the exact total
 * BEFORE the QRIS is generated. The chosen fee is returned so checkout can reuse it.
 *
 * Read-only: no captcha, no reservation, no order.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json().catch(() => ({}))
    const items: any[] = Array.isArray(body?.items) ? body.items : []

    // Subtotal from selling prices (harga_jual) validated against active products.
    let subtotal = 0
    for (const item of items) {
      const qty = Number(item?.quantity || 0)
      if (!qty || qty <= 0) continue
      const productId = String(item?.product_id || '').trim()
      let unit = Number(item?.harga_jual || 0)

      if (productId) {
        try {
          const { data: product } = await supabase
            .from('products')
            .select('harga_web, harga_bot, aktif')
            .eq('id', productId)
            .single()
          if (product && product.aktif === false) continue
          // Floor selling price at modal to avoid negative commission previews.
          const modal = Number(product?.harga_web) || Number(product?.harga_bot) || 0
          if (!unit || unit < 0) unit = modal
        } catch {
          // keep client-provided harga_jual as fallback
        }
      }
      subtotal += unit * qty
    }

    subtotal = Math.round(subtotal)

    // Active gateway
    let gateway = 'midtrans'
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', 'active_payment_gateway').single()
      if (data?.value) gateway = String(data.value).toLowerCase()
    } catch {}

    // Qiospay admin fee (unique code) not currently used by a pending order.
    let adminFee = 0
    if (gateway === 'qiospay' && subtotal > 0) {
      const base = subtotal
      try {
        const { data: pendingOrders } = await supabase
          .from('reseller_orders')
          .select('total_amount')
          .eq('payment_provider', 'qiospay')
          .eq('status', 'pending')
          .gte('total_amount', base + 1)
          .lte('total_amount', base + QIOSPAY_MAX_UNIQUE_CODE)

        const taken = new Set<number>((pendingOrders || []).map((o: any) => Math.round(Number(o.total_amount))))
        for (let attempt = 0; attempt < 50; attempt++) {
          const code = Math.floor(Math.random() * QIOSPAY_MAX_UNIQUE_CODE) + 1
          if (!taken.has(base + code)) { adminFee = code; break }
        }
        if (adminFee === 0) {
          for (let code = 1; code <= QIOSPAY_MAX_UNIQUE_CODE; code++) {
            if (!taken.has(base + code)) { adminFee = code; break }
          }
        }
      } catch {
        adminFee = 0
      }
      if (adminFee === 0) adminFee = 1
    }

    return NextResponse.json({
      gateway,
      subtotal,
      adminFee,
      total: subtotal + adminFee,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get payment info' }, { status: 500 })
  }
}
