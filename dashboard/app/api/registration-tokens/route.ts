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

// Generate a human-friendly token like RAIN-XXXX-XXXX (no ambiguous chars).
function generateToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length]
    if (i === 3) out += '-'
  }
  return `RAIN-${out}`
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

    const tokens = (data || []).map((t: any) => {
      const maxUses = Number(t.max_uses ?? 1) || 1
      const usedCount = Number(t.used_count ?? (t.status === 'used' ? 1 : 0)) || 0
      return { ...t, max_uses: maxUses, used_count: usedCount, remaining_uses: Math.max(0, maxUses - usedCount) }
    })
    const stats = {
      total: tokens.length,
      unused: tokens.filter((t: any) => t.status === 'unused').length,
      used: tokens.filter((t: any) => t.status === 'used').length,
      // Total registration slots still available across all tokens.
      slotsLeft: tokens.reduce((sum: number, t: any) => sum + t.remaining_uses, 0),
    }
    return jsonNoStore({ tokens, stats })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch' }, 500)
  }
}

// POST - generate one or more tokens. body: { count?: number, note?: string, maxUses?: number }
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json().catch(() => ({}))
    const count = Math.min(Math.max(parseInt(String(body.count || 1), 10) || 1, 1), 100)
    // How many users each generated token may be redeemed by (>=1).
    const maxUses = Math.min(Math.max(parseInt(String(body.maxUses ?? 1), 10) || 1, 1), 1000)
    const note = String(body.note || '').trim() || null

    const rows: { token: string; note: string | null; max_uses: number }[] = []
    const seen = new Set<string>()
    while (rows.length < count) {
      const token = generateToken()
      if (seen.has(token)) continue
      seen.add(token)
      rows.push({ token, note, max_uses: maxUses })
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
