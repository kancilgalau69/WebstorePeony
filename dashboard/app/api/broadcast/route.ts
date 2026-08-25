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

// GET - List all broadcasts
export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return jsonNoStore({ error: error.message }, 500)

    // Get total user count for reference
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    return jsonNoStore({ broadcasts: data || [], totalUsers: count || 0 })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch' }, 500)
  }
}

// POST - Create new broadcast (draft or scheduled or immediate)
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()

    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()
    if (!title || !message) {
      return jsonNoStore({ error: 'Judul dan pesan wajib diisi' }, 400)
    }

    const parseMode = body.parse_mode === 'MarkdownV2' ? 'MarkdownV2' : 'HTML'
    const imageUrl = body.image_url ? String(body.image_url).trim() : null
    const scheduledAt = body.scheduled_at ? String(body.scheduled_at) : null

    // Determine status
    let status = 'draft'
    if (body.send_now === true) {
      status = 'draft' // will be picked up by trigger endpoint
    } else if (scheduledAt) {
      status = 'scheduled'
    }

    const { data, error } = await supabase
      .from('broadcasts')
      .insert({
        title,
        message,
        parse_mode: parseMode,
        image_url: imageUrl,
        status,
        scheduled_at: scheduledAt,
        created_by: 'dashboard',
      })
      .select()
      .single()

    if (error) return jsonNoStore({ error: error.message }, 500)

    // If send_now, trigger the bot to execute it
    if (body.send_now === true && data) {
      try {
        const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:3000'
        const webhookSecret = process.env.WEBHOOK_SECRET || 'supersecret-bot'

        await fetch(`${botUrl}/webhook/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-refresh-key': webhookSecret,
          },
          body: JSON.stringify({ broadcast_id: data.id }),
          signal: AbortSignal.timeout(5000),
        })
      } catch (triggerErr: any) {
        console.warn('Failed to trigger bot broadcast (will be picked up by scheduler):', triggerErr?.message)
      }
    }

    return jsonNoStore({ success: true, data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to create' }, 500)
  }
}

// PUT - Update broadcast (only draft/scheduled can be edited)
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)

    // Check current status
    const { data: existing } = await supabase
      .from('broadcasts')
      .select('status')
      .eq('id', id)
      .single()

    if (!existing || !['draft', 'scheduled'].includes(existing.status)) {
      return jsonNoStore({ error: 'Hanya broadcast draft/scheduled yang bisa diedit' }, 400)
    }

    const allowed: Record<string, any> = {}
    if (typeof updates.title === 'string') allowed.title = updates.title.trim()
    if (typeof updates.message === 'string') allowed.message = updates.message
    if (typeof updates.parse_mode === 'string') allowed.parse_mode = updates.parse_mode
    if (typeof updates.image_url === 'string' || updates.image_url === null) allowed.image_url = updates.image_url
    if (typeof updates.scheduled_at === 'string' || updates.scheduled_at === null) {
      allowed.scheduled_at = updates.scheduled_at
      allowed.status = updates.scheduled_at ? 'scheduled' : 'draft'
    }
    if (updates.status === 'cancelled') allowed.status = 'cancelled'

    const { data, error } = await supabase
      .from('broadcasts')
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

// DELETE - Delete broadcast (only draft/scheduled)
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)

    const { data: existing } = await supabase
      .from('broadcasts')
      .select('status')
      .eq('id', id)
      .single()

    if (!existing || !['draft', 'scheduled'].includes(existing.status)) {
      return jsonNoStore({ error: 'Hanya broadcast draft/scheduled yang bisa dihapus' }, 400)
    }

    const { error } = await supabase.from('broadcasts').delete().eq('id', id)
    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to delete' }, 500)
  }
}
