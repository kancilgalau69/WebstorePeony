import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function jsonNoStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0', Pragma: 'no-cache', Expires: '0' },
  })
}

export async function GET() {
  try {
    const { data, error } = await createServerClient()
      .from('web_testimonials')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ testimonials: data || [] })
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : 'Failed to fetch testimonials' }, 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const id = String(body.id || '').trim()
    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)

    const updates: Record<string, unknown> = {}
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
    if (typeof body.sort_order === 'number') updates.sort_order = body.sort_order
    if (typeof body.title === 'string') updates.title = body.title.trim()
    if (typeof body.body === 'string') updates.body = body.body.trim()
    if (Object.keys(updates).length === 0) return jsonNoStore({ error: 'No valid updates' }, 400)

    const { data, error } = await createServerClient()
      .from('web_testimonials')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ success: true, data })
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : 'Failed to update testimonial' }, 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)
    const { error } = await createServerClient().from('web_testimonials').delete().eq('id', id)
    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ success: true })
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : 'Failed to delete testimonial' }, 500)
  }
}
