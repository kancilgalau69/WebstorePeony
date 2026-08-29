import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function jsonNoStore(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0', Pragma: 'no-cache', Expires: '0' },
  })
}

// Generate a human-friendly token like PBS-XXXX-XXXX (no ambiguous chars).
function generateToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length]
    if (i === 3) out += '-'
  }
  return `PBS-${out}`
}

// GET - list all registration tokens (newest first)
export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('registration_tokens')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return jsonNoStore({ error: error.message }, 500)

    const tokens = data || []
    const stats = {
      total: tokens.length,
      unused: tokens.filter((t: any) => t.status === 'unused').length,
      used: tokens.filter((t: any) => t.status === 'used').length,
    }
    return jsonNoStore({ tokens, stats })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch' }, 500)
  }
}

// POST - generate one or more tokens. body: { count?: number, note?: string }
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json().catch(() => ({}))
    const count = Math.min(Math.max(parseInt(String(body.count || 1), 10) || 1, 1), 100)
    const note = String(body.note || '').trim() || null

    const rows: { token: string; note: string | null }[] = []
    const seen = new Set<string>()
    while (rows.length < count) {
      const token = generateToken()
      if (seen.has(token)) continue
      seen.add(token)
      rows.push({ token, note })
    }

    const { data, error } = await supabase
      .from('registration_tokens')
      .insert(rows)
      .select('*')

    if (error) return jsonNoStore({ error: error.message }, 500)

    return jsonNoStore({ success: true, tokens: data || [] })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to generate' }, 500)
  }
}

// DELETE - remove a token by id. body: { id: string }
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json().catch(() => ({}))
    const id = String(body.id || '').trim()
    if (!id) return jsonNoStore({ error: 'id required' }, 400)

    const { error } = await supabase.from('registration_tokens').delete().eq('id', id)
    if (error) return jsonNoStore({ error: error.message }, 500)

    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to delete' }, 500)
  }
}
