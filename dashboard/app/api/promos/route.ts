import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function jsonNoStore(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0', Pragma: 'no-cache', Expires: '0' },
  })
}

// GET - List all promos + products (for dropdowns)
export async function GET() {
  try {
    const supabase = createServerClient()
    const [promosRes, productsRes] = await Promise.all([
      supabase.from('web_promos').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, kode, nama').eq('aktif', true).order('nama'),
    ])

    if (promosRes.error) return jsonNoStore({ error: promosRes.error.message }, 500)

    return jsonNoStore({
      promos: promosRes.data || [],
      products: productsRes.data || [],
    })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch' }, 500)
  }
}

// POST - Create promo
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()

    const code = String(body.code || '').trim().toUpperCase()
    const title = String(body.title || '').trim()
    if (!code || !title) return jsonNoStore({ error: 'Kode dan judul wajib diisi' }, 400)
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return jsonNoStore({ error: 'Kode hanya boleh huruf besar, angka, - dan _ (3-30 karakter)' }, 400)

    const payload: any = {
      code,
      title,
      description: body.description || null,
      promo_type: ['percent', 'fixed', 'buy_x_get_y', 'buy_x_get_x'].includes(body.promo_type) ? body.promo_type : 'percent',
      discount_percent: Number(body.discount_percent) || 0,
      discount_amount: Number(body.discount_amount) || 0,
      max_discount: body.max_discount ? Number(body.max_discount) : null,
      min_purchase: Number(body.min_purchase) || 0,
      required_product_id: body.required_product_id || null,
      required_qty: Number(body.required_qty) || 1,
      reward_product_id: body.reward_product_id || null,
      reward_qty: Number(body.reward_qty) || 1,
      eligible_for: body.eligible_for === 'all' ? 'all' : 'registered_only',
      is_public: body.is_public !== false,
      is_active: body.is_active !== false,
      valid_from: body.valid_from || null,
      valid_until: body.valid_until || null,
      usage_limit: body.usage_limit ? Number(body.usage_limit) : null,
      usage_per_user: body.usage_per_user ? Number(body.usage_per_user) : 1,
      applicable_product_ids: Array.isArray(body.applicable_product_ids) && body.applicable_product_ids.length > 0 ? body.applicable_product_ids : null,
    }

    const { data, error } = await supabase.from('web_promos').insert(payload).select().single()
    if (error) {
      if ((error as any).code === '23505') return jsonNoStore({ error: 'Kode promo sudah digunakan' }, 400)
      return jsonNoStore({ error: error.message }, 500)
    }
    return jsonNoStore({ success: true, data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to create' }, 500)
  }
}

// PUT - Update promo
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)

    const allowed: any = {}
    if (typeof updates.code === 'string') allowed.code = updates.code.trim().toUpperCase()
    if (typeof updates.title === 'string') allowed.title = updates.title.trim()
    if (typeof updates.description === 'string' || updates.description === null) allowed.description = updates.description
    if (updates.promo_type) allowed.promo_type = updates.promo_type
    if (updates.discount_percent !== undefined) allowed.discount_percent = Number(updates.discount_percent) || 0
    if (updates.discount_amount !== undefined) allowed.discount_amount = Number(updates.discount_amount) || 0
    if (updates.max_discount !== undefined) allowed.max_discount = updates.max_discount ? Number(updates.max_discount) : null
    if (updates.min_purchase !== undefined) allowed.min_purchase = Number(updates.min_purchase) || 0
    if (updates.required_product_id !== undefined) allowed.required_product_id = updates.required_product_id || null
    if (updates.required_qty !== undefined) allowed.required_qty = Number(updates.required_qty) || 1
    if (updates.reward_product_id !== undefined) allowed.reward_product_id = updates.reward_product_id || null
    if (updates.reward_qty !== undefined) allowed.reward_qty = Number(updates.reward_qty) || 1
    if (updates.eligible_for !== undefined) allowed.eligible_for = updates.eligible_for === 'all' ? 'all' : 'registered_only'
    if (typeof updates.is_public === 'boolean') allowed.is_public = updates.is_public
    if (typeof updates.is_active === 'boolean') allowed.is_active = updates.is_active
    if (updates.valid_from !== undefined) allowed.valid_from = updates.valid_from || null
    if (updates.valid_until !== undefined) allowed.valid_until = updates.valid_until || null
    if (updates.usage_limit !== undefined) allowed.usage_limit = updates.usage_limit ? Number(updates.usage_limit) : null
    if (updates.usage_per_user !== undefined) allowed.usage_per_user = updates.usage_per_user ? Number(updates.usage_per_user) : 1
    if (updates.applicable_product_ids !== undefined) allowed.applicable_product_ids = Array.isArray(updates.applicable_product_ids) && updates.applicable_product_ids.length > 0 ? updates.applicable_product_ids : null

    const { data, error } = await supabase.from('web_promos').update(allowed).eq('id', id).select().single()
    if (error) {
      if ((error as any).code === '23505') return jsonNoStore({ error: 'Kode promo sudah digunakan' }, 400)
      return jsonNoStore({ error: error.message }, 500)
    }
    return jsonNoStore({ success: true, data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to update' }, 500)
  }
}

// DELETE - Delete promo
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)

    const { error } = await supabase.from('web_promos').delete().eq('id', id)
    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to delete' }, 500)
  }
}
