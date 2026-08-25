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

const VALID_CATEGORIES = ['info', 'warning', 'error']
const VALID_FREQUENCIES = ['once_per_session', 'once_per_day', 'always']

// GET — list all announcements
export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('web_announcements')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ announcements: data || [] })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch' }, 500)
  }
}

// POST — create announcement
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()

    const title = String(body.title || '').trim()
    if (!title) return jsonNoStore({ error: 'Judul wajib diisi' }, 400)

    const payload = {
      title,
      body: body.body ? String(body.body).trim() : null,
      image_url: body.image_url ? String(body.image_url).trim() : null,
      button_label: body.button_label ? String(body.button_label).trim() : null,
      button_url: body.button_url ? String(body.button_url).trim() : null,
      category: VALID_CATEGORIES.includes(body.category) ? body.category : 'info',
      show_frequency: VALID_FREQUENCIES.includes(body.show_frequency) ? body.show_frequency : 'once_per_session',
      is_active: body.is_active !== false,
      sort_order: Number(body.sort_order) || 0,
      valid_from: body.valid_from || null,
      valid_until: body.valid_until || null,
    }

    const { data, error } = await supabase
      .from('web_announcements')
      .insert(payload)
      .select()
      .single()

    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ success: true, data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to create' }, 500)
  }
}

// PUT — update announcement
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)

    const allowed: any = {}
    if (typeof updates.title === 'string') allowed.title = updates.title.trim()
    if (updates.body !== undefined) allowed.body = updates.body ? String(updates.body).trim() : null
    if (updates.image_url !== undefined) allowed.image_url = updates.image_url ? String(updates.image_url).trim() : null
    if (updates.button_label !== undefined) allowed.button_label = updates.button_label ? String(updates.button_label).trim() : null
    if (updates.button_url !== undefined) allowed.button_url = updates.button_url ? String(updates.button_url).trim() : null
    if (updates.category && VALID_CATEGORIES.includes(updates.category)) allowed.category = updates.category
    if (updates.show_frequency && VALID_FREQUENCIES.includes(updates.show_frequency)) allowed.show_frequency = updates.show_frequency
    if (typeof updates.is_active === 'boolean') allowed.is_active = updates.is_active
    if (updates.sort_order !== undefined) allowed.sort_order = Number(updates.sort_order) || 0
    if (updates.valid_from !== undefined) allowed.valid_from = updates.valid_from || null
    if (updates.valid_until !== undefined) allowed.valid_until = updates.valid_until || null

    const { data, error } = await supabase
      .from('web_announcements')
      .update(allowed)
      .eq('id', id)
      .select()
      .single()

    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ success: true, data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to update' }, 500)
  }
}

// DELETE — delete announcement
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)

    const { error } = await supabase.from('web_announcements').delete().eq('id', id)
    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to delete' }, 500)
  }
}
