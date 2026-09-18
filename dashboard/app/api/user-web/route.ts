import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

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

const PAID_STATUSES = new Set(['paid', 'completed', 'settlement', 'capture', 'success'])

function jakartaDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value || '0000'
  const month = parts.find(p => p.type === 'month')?.value || '00'
  const day = parts.find(p => p.type === 'day')?.value || '00'
  return `${year}-${month}-${day}`
}

// GET - Fetch all user_web (with wallet balance + purchase statistics)
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const params = new URL(req.url).searchParams
    const period = ['day', 'month', 'year'].includes(String(params.get('period'))) ? String(params.get('period')) : 'all'
    const periodValue = period === 'day'
      ? String(params.get('date') || '')
      : period === 'month'
        ? String(params.get('month') || '')
        : period === 'year'
          ? String(params.get('year') || '')
          : ''

    const { data, error } = await supabase
      .from('user_web')
      .select('id, nama, email, phone, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    }

    const users = data || []

    // Attach wallet balances (single query, mapped by user_id).
    let balanceByUser = new Map<string, number>()
    try {
      const { data: wallets } = await supabase
        .from('user_wallets')
        .select('user_id, saldo')
      for (const w of wallets || []) {
        balanceByUser.set(String(w.user_id), Number(w.saldo || 0))
      }
    } catch {
      // wallet table optional; default 0
    }

    // Fetch all paid orders in pages so statistics are not truncated by
    // PostgREST's default 1000-row response limit.
    const orders: any[] = []
    const pageSize = 1000
    for (let from = 0; ; from += pageSize) {
      const { data: page, error: ordersError } = await supabase
        .from('orders')
        .select('user_web_id, customer_email, status, total_amount, created_at')
        .range(from, from + pageSize - 1)
      if (ordersError) return jsonNoStore({ error: ordersError.message }, 500)
      const rows = page || []
      orders.push(...rows)
      if (rows.length < pageSize) break
    }

    const userByEmail = new Map(users.map((u: any) => [String(u.email || '').toLowerCase(), String(u.id)]))
    const purchaseByUser = new Map<string, { count: number; total: number }>()
    for (const order of orders) {
      if (!PAID_STATUSES.has(String(order.status || '').toLowerCase())) continue
      const orderDate = jakartaDateKey(order.created_at)
      if (period === 'day' && periodValue && orderDate !== periodValue) continue
      if (period === 'month' && periodValue && orderDate.slice(0, 7) !== periodValue) continue
      if (period === 'year' && periodValue && orderDate.slice(0, 4) !== periodValue) continue
      const userId = order.user_web_id
        ? String(order.user_web_id)
        : userByEmail.get(String(order.customer_email || '').toLowerCase())
      if (!userId) continue
      const current = purchaseByUser.get(userId) || { count: 0, total: 0 }
      current.count += 1
      current.total += Number(order.total_amount || 0) || 0
      purchaseByUser.set(userId, current)
    }

    const withBalance = users.map((u: any) => ({
      ...u,
      saldo: balanceByUser.get(String(u.id)) || 0,
      purchase_count: purchaseByUser.get(String(u.id))?.count || 0,
      purchase_total: purchaseByUser.get(String(u.id))?.total || 0,
    }))

    return jsonNoStore({ data: withBalance, period, periodValue })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch web users' }, 500)
  }
}

// PUT - Update user_web (edit profile or toggle is_active)
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { id, ...updateFields } = body

    if (!id) {
      return jsonNoStore({ error: 'Missing user id' }, 400)
    }

    // Only allow updating specific fields from admin
    const allowedFields: Record<string, any> = {}
    if (typeof updateFields.nama === 'string') allowedFields.nama = updateFields.nama.trim()
    if (typeof updateFields.email === 'string') allowedFields.email = updateFields.email.trim().toLowerCase()
    if (typeof updateFields.phone === 'string') allowedFields.phone = updateFields.phone.trim()
    if (typeof updateFields.is_active === 'boolean') allowedFields.is_active = updateFields.is_active

    if (Object.keys(allowedFields).length === 0) {
      return jsonNoStore({ error: 'No valid fields to update' }, 400)
    }

    // Validate email format if provided
    if (allowedFields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowedFields.email)) {
      return jsonNoStore({ error: 'Format email tidak valid' }, 400)
    }

    // Validate phone format if provided
    if (allowedFields.phone && !/^[0-9+\-\s()]{8,20}$/.test(allowedFields.phone)) {
      return jsonNoStore({ error: 'Format nomor telepon tidak valid' }, 400)
    }

    // Validate nama if provided
    if (allowedFields.nama !== undefined && allowedFields.nama.length < 2) {
      return jsonNoStore({ error: 'Nama minimal 2 karakter' }, 400)
    }

    // Check for duplicate email
    if (allowedFields.email) {
      const { data: existingEmail } = await supabase
        .from('user_web')
        .select('id')
        .eq('email', allowedFields.email)
        .neq('id', id)
        .maybeSingle()

      if (existingEmail) {
        return jsonNoStore({ error: 'Email sudah digunakan oleh user lain' }, 400)
      }
    }

    // Check for duplicate phone
    if (allowedFields.phone) {
      const { data: existingPhone } = await supabase
        .from('user_web')
        .select('id')
        .eq('phone', allowedFields.phone)
        .neq('id', id)
        .maybeSingle()

      if (existingPhone) {
        return jsonNoStore({ error: 'Nomor telepon sudah digunakan oleh user lain' }, 400)
      }
    }

    allowedFields.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('user_web')
      .update(allowedFields)
      .eq('id', id)
      .select('id, nama, email, phone, is_active, created_at, updated_at')
      .single()

    if (error) {
      // Handle unique constraint violations
      if (error.code === '23505') {
        if (error.message?.includes('email')) {
          return jsonNoStore({ error: 'Email sudah digunakan oleh user lain' }, 400)
        }
        if (error.message?.includes('phone')) {
          return jsonNoStore({ error: 'Nomor telepon sudah digunakan oleh user lain' }, 400)
        }
        return jsonNoStore({ error: 'Data duplikat terdeteksi' }, 400)
      }
      return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    }

    return jsonNoStore({ data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to update web user' }, 500)
  }
}

// PATCH - Adjust a user's wallet balance.
// body: { id, mode: 'set' | 'add', amount, note? }
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const id = String(body.id || '').trim()
    const mode = body.mode === 'add' ? 'add' : 'set'
    const amount = Number(body.amount)
    const note = String(body.note || '').trim() || (mode === 'add' ? 'Penyesuaian saldo admin' : 'Set saldo admin')

    if (!id) return jsonNoStore({ error: 'Missing user id' }, 400)
    if (!Number.isFinite(amount)) return jsonNoStore({ error: 'Nominal tidak valid' }, 400)

    if (mode === 'add') {
      if (amount === 0) return jsonNoStore({ error: 'Nominal tidak boleh 0' }, 400)
      // add positive = credit, negative = debit
      if (amount > 0) {
        const { data, error } = await supabase.rpc('wallet_credit_user', {
          p_user_id: id, p_amount: amount, p_type: 'topup', p_description: note, p_ref_id: 'ADMIN-ADJUST',
        })
        if (error) return jsonNoStore({ error: error.message }, 500)
        if (!data?.ok) return jsonNoStore({ error: data?.msg || 'Gagal menambah saldo' }, 400)
        return jsonNoStore({ success: true, balance: data.balance })
      } else {
        const { data, error } = await supabase.rpc('wallet_debit_user', {
          p_user_id: id, p_amount: Math.abs(amount), p_description: note, p_ref_id: 'ADMIN-ADJUST',
        })
        if (error) return jsonNoStore({ error: error.message }, 500)
        if (!data?.ok) return jsonNoStore({ error: data?.msg === 'insufficient_balance' ? 'Saldo user tidak cukup untuk dikurangi' : (data?.msg || 'Gagal mengurangi saldo') }, 400)
        return jsonNoStore({ success: true, balance: data.balance })
      }
    }

    // mode === 'set' : absolute balance
    if (amount < 0) return jsonNoStore({ error: 'Saldo tidak boleh negatif' }, 400)
    const { data, error } = await supabase.rpc('wallet_set_user', {
      p_user_id: id, p_new_balance: amount, p_description: note,
    })
    if (error) return jsonNoStore({ error: error.message }, 500)
    if (!data?.ok) return jsonNoStore({ error: data?.msg || 'Gagal mengubah saldo' }, 400)
    return jsonNoStore({ success: true, balance: data.balance })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to adjust balance' }, 500)
  }
}

// DELETE - Delete user_web
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return jsonNoStore({ error: 'Missing user id' }, 400)
    }

    // Check if user has orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('user_web_id', id)
      .limit(1)

    if (orders && orders.length > 0) {
      return jsonNoStore({ 
        error: 'User tidak bisa dihapus karena memiliki riwayat order. Nonaktifkan user sebagai gantinya.' 
      }, 400)
    }

    const { error } = await supabase
      .from('user_web')
      .delete()
      .eq('id', id)

    if (error) {
      return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    }

    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to delete web user' }, 500)
  }
}
