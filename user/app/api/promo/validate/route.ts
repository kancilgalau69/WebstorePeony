export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, supabaseAdmin } from '@/lib/auth'

/**
 * POST /api/promo/validate
 * Body: { code: string, cart_total: number, cart_items: [{product_id, quantity}], user_logged_in?: boolean }
 * Returns: { valid, promo, discount_amount, reward_product?, error? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const code = String(body.code || '').trim().toUpperCase()
    const cartTotal = Number(body.cart_total) || 0
    const cartItems: { product_id: string; quantity: number }[] = body.cart_items || []

    if (!code) {
      return NextResponse.json({ valid: false, error: 'Masukkan kode promo' }, { status: 400 })
    }

    // Check if user is logged in
    const session = await getSessionUser(request)
    const isLoggedIn = !!session

    // Fetch promo
    const { data: promoRows, error: promoErr } = await supabaseAdmin
      .from('web_promos')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .limit(1)

    if (promoErr) {
      console.error('[PROMO VALIDATE] Query error:', promoErr)
      return NextResponse.json({ valid: false, error: 'Gagal memvalidasi promo' }, { status: 500 })
    }

    const promo = promoRows?.[0]
    if (!promo) {
      return NextResponse.json({ valid: false, error: 'Kode promo tidak ditemukan atau tidak aktif' })
    }

    const now = new Date()

    // Check validity period
    if (promo.valid_from) {
      const validFrom = new Date(promo.valid_from)
      if (now < validFrom) {
        return NextResponse.json({ valid: false, error: `Promo berlaku mulai ${validFrom.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` })
      }
    }
    if (promo.valid_until) {
      const validUntil = new Date(promo.valid_until)
      if (now > validUntil) {
        return NextResponse.json({ valid: false, error: 'Promo sudah berakhir' })
      }
    }

    // Check eligibility
    if (promo.eligible_for === 'registered_only' && !isLoggedIn) {
      return NextResponse.json({ valid: false, error: 'Promo ini hanya untuk user yang sudah login/daftar' })
    }

    // Check usage limit (global)
    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
      return NextResponse.json({ valid: false, error: 'Promo sudah mencapai batas penggunaan' })
    }

    // Check usage per user
    if (promo.usage_per_user && session?.userId) {
      const { count } = await supabaseAdmin
        .from('web_promo_usages')
        .select('*', { count: 'exact', head: true })
        .eq('promo_id', promo.id)
        .eq('user_web_id', session.userId)

      if ((count || 0) >= promo.usage_per_user) {
        return NextResponse.json({ valid: false, error: 'Anda sudah menggunakan promo ini' })
      }
    }

    // Check minimum purchase
    if (promo.min_purchase && cartTotal < promo.min_purchase) {
      return NextResponse.json({
        valid: false,
        error: `Minimum belanja Rp ${Number(promo.min_purchase).toLocaleString('id-ID')} untuk promo ini`,
      })
    }

    // Check applicable products (if restricted to specific products)
    if (promo.applicable_product_ids && Array.isArray(promo.applicable_product_ids) && promo.applicable_product_ids.length > 0) {
      const allowedIds = new Set(promo.applicable_product_ids)
      const cartProductIds = cartItems.map(i => i.product_id)
      const hasEligibleProduct = cartProductIds.some(id => allowedIds.has(id))
      if (!hasEligibleProduct) {
        return NextResponse.json({
          valid: false,
          error: 'Promo ini hanya berlaku untuk produk tertentu yang tidak ada di keranjang Anda',
        })
      }
    }

    // Calculate discount based on type
    let discountAmount = 0
    let rewardProduct: { id: string; name: string; qty: number } | null = null

    switch (promo.promo_type) {
      case 'percent': {
        discountAmount = cartTotal * (Number(promo.discount_percent) || 0) / 100
        if (promo.max_discount && discountAmount > Number(promo.max_discount)) {
          discountAmount = Number(promo.max_discount)
        }
        break
      }
      case 'fixed': {
        discountAmount = Number(promo.discount_amount) || 0
        if (discountAmount > cartTotal) discountAmount = cartTotal // can't exceed total
        break
      }
      case 'buy_x_get_y': {
        // Check if required product is in cart with sufficient qty
        if (!promo.required_product_id) {
          return NextResponse.json({ valid: false, error: 'Promo tidak valid (konfigurasi salah)' })
        }
        const requiredItem = cartItems.find(i => i.product_id === promo.required_product_id)
        if (!requiredItem || requiredItem.quantity < (promo.required_qty || 1)) {
          // Get product name for better error message
          const { data: reqProduct } = await supabaseAdmin
            .from('products')
            .select('nama')
            .eq('id', promo.required_product_id)
            .single()
          return NextResponse.json({
            valid: false,
            error: `Promo ini membutuhkan minimal ${promo.required_qty || 1}x "${reqProduct?.nama || 'produk tertentu'}" di keranjang`,
          })
        }
        // Get reward product info
        if (promo.reward_product_id) {
          const { data: rewardProd } = await supabaseAdmin
            .from('products')
            .select('id, nama')
            .eq('id', promo.reward_product_id)
            .single()
          if (rewardProd) {
            rewardProduct = { id: rewardProd.id, name: rewardProd.nama, qty: promo.reward_qty || 1 }
          }
        }
        break
      }
      case 'buy_x_get_x': {
        // Buy X qty of product A, get 1 free of same product
        if (!promo.required_product_id) {
          return NextResponse.json({ valid: false, error: 'Promo tidak valid (konfigurasi salah)' })
        }
        const requiredItem2 = cartItems.find(i => i.product_id === promo.required_product_id)
        if (!requiredItem2 || requiredItem2.quantity < (promo.required_qty || 2)) {
          const { data: reqProduct2 } = await supabaseAdmin
            .from('products')
            .select('nama')
            .eq('id', promo.required_product_id)
            .single()
          return NextResponse.json({
            valid: false,
            error: `Promo ini membutuhkan minimal ${promo.required_qty || 2}x "${reqProduct2?.nama || 'produk tertentu'}" di keranjang`,
          })
        }
        // Reward is same product
        const { data: sameProd } = await supabaseAdmin
          .from('products')
          .select('id, nama')
          .eq('id', promo.required_product_id)
          .single()
        if (sameProd) {
          rewardProduct = { id: sameProd.id, name: sameProd.nama, qty: promo.reward_qty || 1 }
        }
        break
      }
    }

    return NextResponse.json({
      valid: true,
      promo: {
        id: promo.id,
        code: promo.code,
        title: promo.title,
        description: promo.description,
        promo_type: promo.promo_type,
        eligible_for: promo.eligible_for,
      },
      discount_amount: Math.round(discountAmount),
      reward_product: rewardProduct,
    })
  } catch (err: any) {
    console.error('Promo validate error:', err)
    return NextResponse.json({ valid: false, error: 'Gagal memvalidasi promo' }, { status: 500 })
  }
}
