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

// GET - List all affiliates + pending withdrawals
export async function GET() {
  try {
    const supabase = createServerClient()

    // All affiliates joined with user_web for name/email
    const { data: affiliates, error: affErr } = await supabase
      .from('user_web_affiliates')
      .select('*, user_web(id, nama, email, phone)')
      .order('total_earnings', { ascending: false })

    if (affErr) {
      return jsonNoStore({ error: affErr.message || JSON.stringify(affErr) }, 500)
    }

    // All withdrawals
    const { data: withdrawals, error: wdErr } = await supabase
      .from('affiliate_withdrawals')
      .select('*')
      .order('created_at', { ascending: false })

    if (wdErr) {
      return jsonNoStore({ error: wdErr.message || JSON.stringify(wdErr) }, 500)
    }

    // Pending counts
    const pendingWithdrawals = (withdrawals || []).filter(w => w.status === 'pending').length

    // Current affiliate settings
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['affiliate_enabled', 'affiliate_commission_percent', 'affiliate_min_withdraw'])

    const settings: Record<string, string> = {}
    for (const r of settingsRows || []) settings[r.key] = r.value

    return jsonNoStore({
      data: {
        affiliates: affiliates || [],
        withdrawals: withdrawals || [],
        pendingWithdrawals,
        settings,
      },
    })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch affiliates' }, 500)
  }
}

// PATCH - Process withdrawal (approved | rejected | completed)
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

    const { data: wd, error: fetchErr } = await supabase
      .from('affiliate_withdrawals')
      .select('*')
      .eq('id', withdrawal_id)
      .single()

    if (fetchErr || !wd) {
      return jsonNoStore({ error: 'Withdrawal not found' }, 404)
    }

    if (action === 'approved' && wd.status !== 'pending') {
      return jsonNoStore({ error: 'Only pending withdrawals can be approved' }, 400)
    }
    if (action === 'rejected' && !['pending', 'approved'].includes(wd.status)) {
      return jsonNoStore({ error: 'Only pending or approved withdrawals can be rejected' }, 400)
    }
    if (action === 'completed' && wd.status !== 'approved') {
      return jsonNoStore({ error: 'Only approved withdrawals can be completed' }, 400)
    }

    const { error: updErr } = await supabase
      .from('affiliate_withdrawals')
      .update({
        status: action,
        admin_notes: admin_notes || wd.admin_notes || null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawal_id)

    if (updErr) {
      return jsonNoStore({ error: updErr.message }, 500)
    }

    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to process withdrawal' }, 500)
  }
}

// PUT - Update affiliate settings (commission percent, min withdraw, enabled)
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { commission_percent, min_withdraw, enabled } = body

    const updates: { key: string; value: string }[] = []
    if (commission_percent !== undefined) {
      const v = Number(commission_percent)
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        return jsonNoStore({ error: 'Komisi harus angka 0-100' }, 400)
      }
      updates.push({ key: 'affiliate_commission_percent', value: String(v) })
    }
    if (min_withdraw !== undefined) {
      const v = Number(min_withdraw)
      if (!Number.isFinite(v) || v < 0) {
        return jsonNoStore({ error: 'Minimum withdraw harus angka positif' }, 400)
      }
      updates.push({ key: 'affiliate_min_withdraw', value: String(v) })
    }
    if (enabled !== undefined) {
      updates.push({ key: 'affiliate_enabled', value: enabled ? 'true' : 'false' })
    }

    if (updates.length === 0) {
      return jsonNoStore({ error: 'No fields to update' }, 400)
    }

    for (const u of updates) {
      await supabase
        .from('settings')
        .upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    }

    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to update settings' }, 500)
  }
}
