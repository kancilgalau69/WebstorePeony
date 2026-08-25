import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function jsonNoStore(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

// GET - Fetch all resellers with stats
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    // Single reseller detail with full data
    if (id) {
      const { data: reseller, error } = await supabase
        .from('resellers')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !reseller) {
        return jsonNoStore({ error: 'Reseller not found' }, 404)
      }

      // Get orders
      const { data: orders } = await supabase
        .from('reseller_orders')
        .select('id, order_id, status, total_amount, total_modal, komisi, customer_name, customer_email, customer_phone, payment_method, items, created_at')
        .eq('reseller_id', id)
        .order('created_at', { ascending: false })
        .limit(50)

      // Get order items for all orders
      const orderUUIDs = (orders || []).map((o: any) => o.id).filter(Boolean)
      let orderItemsMap: Record<string, any[]> = {}
      if (orderUUIDs.length > 0) {
        const { data: allOrderItems } = await supabase
          .from('reseller_order_items')
          .select('order_id, product_name, product_code, quantity, harga_modal, harga_jual, item_data')
          .in('order_id', orderUUIDs)

        for (const item of (allOrderItems || [])) {
          if (!orderItemsMap[item.order_id]) orderItemsMap[item.order_id] = []
          orderItemsMap[item.order_id].push(item)
        }
      }

      // Get withdrawals
      const { data: withdrawals } = await supabase
        .from('reseller_withdrawals')
        .select('*')
        .eq('reseller_id', id)
        .order('created_at', { ascending: false })
        .limit(20)

      // Get product visibility count
      const { count: visibleProducts } = await supabase
        .from('reseller_products')
        .select('*', { count: 'exact', head: true })
        .eq('reseller_id', id)
        .eq('is_visible', true)

      // Get custom prices count
      const { count: customPrices } = await supabase
        .from('reseller_prices')
        .select('*', { count: 'exact', head: true })
        .eq('reseller_id', id)

      return jsonNoStore({
        data: {
          ...reseller,
          orders: orders || [],
          orderItems: orderItemsMap,
          withdrawals: withdrawals || [],
          visible_products: visibleProducts || 0,
          custom_prices: customPrices || 0,
        },
      })
    }

    // List all resellers with summary stats
    const { data: resellers, error } = await supabase
      .from('resellers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return jsonNoStore({ error: error.message }, 400)
    }

    // Get order counts per reseller
    const resellerIds = (resellers || []).map((r: any) => r.id)
    let orderStats = new Map<string, { total: number; completed: number; revenue: number; komisi: number }>()

    if (resellerIds.length > 0) {
      const { data: orders } = await supabase
        .from('reseller_orders')
        .select('reseller_id, status, total_amount, komisi')
        .in('reseller_id', resellerIds)

      for (const order of (orders || [])) {
        const stats = orderStats.get(order.reseller_id) || { total: 0, completed: 0, revenue: 0, komisi: 0 }
        stats.total += 1
        if (order.status === 'completed') {
          stats.completed += 1
          stats.revenue += Number(order.total_amount) || 0
          stats.komisi += Number(order.komisi) || 0
        }
        orderStats.set(order.reseller_id, stats)
      }
    }

    // Get pending withdrawal counts
    let withdrawalStats = new Map<string, number>()
    if (resellerIds.length > 0) {
      const { data: withdrawals } = await supabase
        .from('reseller_withdrawals')
        .select('reseller_id')
        .in('reseller_id', resellerIds)
        .eq('status', 'pending')

      for (const w of (withdrawals || [])) {
        withdrawalStats.set(w.reseller_id, (withdrawalStats.get(w.reseller_id) || 0) + 1)
      }
    }

    const enriched = (resellers || []).map((r: any) => {
      const stats = orderStats.get(r.id) || { total: 0, completed: 0, revenue: 0, komisi: 0 }
      return {
        ...r,
        order_count: stats.total,
        completed_orders: stats.completed,
        total_revenue: stats.revenue,
        total_komisi_calc: stats.komisi,
        pending_withdrawals: withdrawalStats.get(r.id) || 0,
      }
    })

    const { data: registrationSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'reseller_registration_enabled')
      .maybeSingle()

    return jsonNoStore({
      data: enriched,
      settings: {
        reseller_registration_enabled: registrationSetting?.value !== 'false',
      },
    })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch resellers' }, 500)
  }
}

// PUT - Update reseller
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { id, ...updateFields } = body

    if (!id && typeof updateFields.registration_enabled === 'boolean') {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'reseller_registration_enabled',
          value: updateFields.registration_enabled ? 'true' : 'false',
          description: 'Enable public reseller registration page',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

      if (error) {
        return jsonNoStore({ error: error.message }, 400)
      }

      return jsonNoStore({
        success: true,
        settings: { reseller_registration_enabled: updateFields.registration_enabled },
      })
    }

    if (!id) {
      return jsonNoStore({ error: 'Missing reseller id' }, 400)
    }

    const allowedFields: Record<string, any> = {}
    if (typeof updateFields.is_active === 'boolean') allowedFields.is_active = updateFields.is_active
    if (typeof updateFields.nama_reseller === 'string') allowedFields.nama_reseller = updateFields.nama_reseller.trim()
    if (typeof updateFields.nama_toko === 'string') allowedFields.nama_toko = updateFields.nama_toko.trim()
    if (typeof updateFields.email === 'string') allowedFields.email = updateFields.email.trim().toLowerCase()
    if (typeof updateFields.phone === 'string') allowedFields.phone = updateFields.phone.trim()
    if (typeof updateFields.whatsapp === 'string') allowedFields.whatsapp = updateFields.whatsapp.trim()
    if (typeof updateFields.deskripsi === 'string') allowedFields.deskripsi = updateFields.deskripsi.trim()
    if (typeof updateFields.saldo === 'number') allowedFields.saldo = updateFields.saldo

    if (Object.keys(allowedFields).length === 0) {
      return jsonNoStore({ error: 'No valid fields to update' }, 400)
    }

    allowedFields.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('resellers')
      .update(allowedFields)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return jsonNoStore({ error: error.message }, 400)
    }

    return jsonNoStore({ data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to update reseller' }, 500)
  }
}

// PATCH - Process withdrawal
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { withdrawal_id, action, admin_notes } = body

    if (!withdrawal_id || !action) {
      return jsonNoStore({ error: 'Missing withdrawal_id or action' }, 400)
    }

    if (!['approved', 'rejected', 'completed'].includes(action)) {
      return jsonNoStore({ error: 'Action must be approved, rejected, or completed' }, 400)
    }

    const { data: withdrawal, error: fetchErr } = await supabase
      .from('reseller_withdrawals')
      .select('*')
      .eq('id', withdrawal_id)
      .single()

    if (fetchErr || !withdrawal) {
      return jsonNoStore({ error: 'Withdrawal not found' }, 404)
    }

    // Validate state transitions
    if (action === 'approved' && withdrawal.status !== 'pending') {
      return jsonNoStore({ error: 'Only pending withdrawals can be approved' }, 400)
    }
    if (action === 'rejected' && !['pending', 'approved'].includes(withdrawal.status)) {
      return jsonNoStore({ error: 'Only pending or approved withdrawals can be rejected' }, 400)
    }
    if (action === 'completed' && withdrawal.status !== 'approved') {
      return jsonNoStore({ error: 'Only approved withdrawals can be marked as completed' }, 400)
    }

    const { error: updateErr } = await supabase
      .from('reseller_withdrawals')
      .update({
        status: action,
        admin_notes: admin_notes || withdrawal.admin_notes || null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawal_id)

    if (updateErr) {
      return jsonNoStore({ error: updateErr.message }, 400)
    }

    // If rejected, the saldo was never deducted (pending doesn't deduct from DB saldo),
    // so no refund needed. The balance API calculates saldo from actual data.
    // However, if the DB trigger had already deducted (for 'approved' that gets rejected),
    // we need to ensure consistency. The balance API auto-syncs, so this is safe.

    // If completed, the DB trigger (trigger_process_withdrawal) will deduct saldo automatically.
    // But since our balance API calculates from actual data, it's already consistent.

    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to process withdrawal' }, 500)
  }
}

// POST - Create new reseller
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { nama_reseller, nama_toko, email, phone, password, slug, whatsapp, deskripsi } = body

    if (!nama_reseller || !nama_toko || !email || !password || !slug) {
      return jsonNoStore({ error: 'Nama reseller, nama toko, email, slug, dan password wajib diisi' }, 400)
    }

    if (password.length < 8) {
      return jsonNoStore({ error: 'Password minimal 8 karakter' }, 400)
    }

    // Validate slug format
    const cleanSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (cleanSlug.length < 3) {
      return jsonNoStore({ error: 'Slug minimal 3 karakter (huruf kecil, angka, strip)' }, 400)
    }

    // Check email uniqueness
    const { data: existingEmail } = await supabase
      .from('resellers')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (existingEmail) {
      return jsonNoStore({ error: 'Email sudah digunakan oleh reseller lain' }, 400)
    }

    // Check slug uniqueness
    const { data: existingSlug } = await supabase
      .from('resellers')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle()

    if (existingSlug) {
      return jsonNoStore({ error: 'Slug sudah digunakan oleh reseller lain' }, 400)
    }

    // Hash password using bcrypt-compatible approach via crypto
    // Use simple hash for now (admin dashboard creates reseller, reseller-dashboard uses bcryptjs)
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(password, 12)

    const { data: newReseller, error } = await supabase
      .from('resellers')
      .insert({
        nama_reseller: nama_reseller.trim(),
        nama_toko: nama_toko.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        slug: cleanSlug,
        password_hash: passwordHash,
        whatsapp: whatsapp?.trim() || null,
        deskripsi: deskripsi?.trim() || null,
        is_active: true,
        saldo: 0,
        total_penjualan: 0,
        total_komisi: 0,
      })
      .select('id, nama_toko, slug, email')
      .single()

    if (error) {
      console.error('Create reseller error:', error)
      if (error.code === '23505') {
        return jsonNoStore({ error: 'Email atau slug sudah digunakan' }, 400)
      }
      return jsonNoStore({ error: 'Gagal membuat reseller' }, 500)
    }

    return jsonNoStore({ success: true, data: newReseller })
  } catch (err: any) {
    console.error('Create reseller error:', err)
    return jsonNoStore({ error: err?.message || 'Failed to create reseller' }, 500)
  }
}
