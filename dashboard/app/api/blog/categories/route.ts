import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100)
}

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('blog_categories')
      .select('*')
      .order('name')
    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ data: data || [] })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch' }, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const name = String(body.name || '').trim()
    if (!name) return jsonNoStore({ error: 'Nama wajib diisi' }, 400)

    const slug = String(body.slug || '').trim() || slugify(name)

    const { data, error } = await supabase
      .from('blog_categories')
      .insert({ name, slug, description: body.description || null })
      .select()
      .single()

    if (error) {
      if ((error as any).code === '23505') return jsonNoStore({ error: 'Slug sudah digunakan' }, 400)
      return jsonNoStore({ error: error.message }, 500)
    }

    return jsonNoStore({ success: true, data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to create' }, 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)

    const allowed: Record<string, any> = {}
    if (typeof updates.name === 'string') allowed.name = updates.name.trim()
    if (typeof updates.slug === 'string' && updates.slug.trim()) allowed.slug = updates.slug.trim()
    if (typeof updates.description === 'string' || updates.description === null) allowed.description = updates.description

    const { data, error } = await supabase
      .from('blog_categories')
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

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)

    const { error } = await supabase.from('blog_categories').delete().eq('id', id)
    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to delete' }, 500)
  }
}
