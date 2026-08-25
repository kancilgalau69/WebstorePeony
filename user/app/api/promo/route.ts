export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/auth'

/**
 * GET /api/promo — list public active promos (for homepage display)
 */
export async function GET() {
  try {
    // Fetch all active + public promos (filter dates in JS for reliability)
    const { data, error } = await supabaseAdmin
      .from('web_promos')
      .select('id, code, title, description, promo_type, discount_percent, discount_amount, max_discount, min_purchase, eligible_for, valid_from, valid_until, required_product_id, reward_product_id, required_qty, reward_qty')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[PROMO API] Error fetching promos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const now = new Date()

    // Filter by date in JS (avoids PostgREST .or() syntax issues with null + comparison)
    const validPromos = (data || []).filter(p => {
      if (p.valid_from && new Date(p.valid_from) > now) return false
      if (p.valid_until && new Date(p.valid_until) < now) return false
      return true
    })

    // Resolve product names for buy_x_get_y/x promos
    const productIds = new Set<string>()
    for (const p of validPromos) {
      if (p.required_product_id) productIds.add(p.required_product_id)
      if (p.reward_product_id) productIds.add(p.reward_product_id)
    }

    let productMap = new Map<string, string>()
    if (productIds.size > 0) {
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, nama')
        .in('id', Array.from(productIds))
      for (const p of products || []) {
        productMap.set(p.id, p.nama)
      }
    }

    const promos = validPromos.map(p => ({
      ...p,
      required_product_name: p.required_product_id ? productMap.get(p.required_product_id) || null : null,
      reward_product_name: p.reward_product_id ? productMap.get(p.reward_product_id) || null : null,
    }))

    return NextResponse.json({ promos }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (err: any) {
    console.error('[PROMO API] Error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch promos' }, { status: 500 })
  }
}
