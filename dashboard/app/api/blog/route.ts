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

function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200)
}

// GET - List all posts (admin) + categories
export async function GET() {
  try {
    const supabase = createServerClient()

    const [postsRes, catsRes] = await Promise.all([
      supabase
        .from('blog_posts')
        .select('*, blog_categories(id, name, slug)')
        .order('created_at', { ascending: false }),
      supabase
        .from('blog_categories')
        .select('*')
        .order('name'),
    ])

    if (postsRes.error) {
      return jsonNoStore({ error: postsRes.error.message }, 500)
    }
    if (catsRes.error) {
      return jsonNoStore({ error: catsRes.error.message }, 500)
    }

    return jsonNoStore({
      posts: postsRes.data || [],
      categories: catsRes.data || [],
    })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch' }, 500)
  }
}

// POST - Create new post
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()

    const title = String(body.title || '').trim()
    if (!title) {
      return jsonNoStore({ error: 'Judul wajib diisi' }, 400)
    }

    let slug = String(body.slug || '').trim() || slugify(title)
    if (!slug) {
      return jsonNoStore({ error: 'Slug tidak valid' }, 400)
    }

    // Ensure slug unique (append -1, -2, ... if needed)
    let attempt = 0
    let finalSlug = slug
    while (attempt < 50) {
      const { data: existing } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', finalSlug)
        .maybeSingle()
      if (!existing) break
      attempt++
      finalSlug = `${slug}-${attempt}`
    }

    const payload = {
      slug: finalSlug,
      title,
      excerpt: body.excerpt || null,
      content: body.content || '',
      featured_image: body.featured_image || null,
      category_id: body.category_id || null,
      author_name: body.author_name || 'Admin',
      status: body.status === 'published' ? 'published' : 'draft',
      meta_title: body.meta_title || null,
      meta_description: body.meta_description || null,
      tags: Array.isArray(body.tags) ? body.tags : [],
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .insert(payload)
      .select()
      .single()

    if (error) {
      return jsonNoStore({ error: error.message }, 500)
    }

    return jsonNoStore({ success: true, data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to create post' }, 500)
  }
}

// PUT - Update post
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return jsonNoStore({ error: 'Missing id' }, 400)
    }

    const allowed: Record<string, any> = {}
    if (typeof updates.title === 'string') allowed.title = updates.title.trim()
    if (typeof updates.slug === 'string' && updates.slug.trim()) allowed.slug = updates.slug.trim()
    if (typeof updates.excerpt === 'string') allowed.excerpt = updates.excerpt
    if (typeof updates.content === 'string') allowed.content = updates.content
    if (typeof updates.featured_image === 'string' || updates.featured_image === null) allowed.featured_image = updates.featured_image
    if (typeof updates.category_id === 'string' || updates.category_id === null) allowed.category_id = updates.category_id
    if (typeof updates.author_name === 'string') allowed.author_name = updates.author_name.trim()
    if (typeof updates.status === 'string' && ['draft', 'published'].includes(updates.status)) allowed.status = updates.status
    if (typeof updates.meta_title === 'string' || updates.meta_title === null) allowed.meta_title = updates.meta_title
    if (typeof updates.meta_description === 'string' || updates.meta_description === null) allowed.meta_description = updates.meta_description
    if (Array.isArray(updates.tags)) allowed.tags = updates.tags

    if (Object.keys(allowed).length === 0) {
      return jsonNoStore({ error: 'No fields to update' }, 400)
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .update(allowed)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if ((error as any).code === '23505') {
        return jsonNoStore({ error: 'Slug sudah digunakan' }, 400)
      }
      return jsonNoStore({ error: error.message }, 500)
    }

    return jsonNoStore({ success: true, data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to update post' }, 500)
  }
}

// DELETE - Delete post
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return jsonNoStore({ error: 'Missing id' }, 400)

    const { error } = await supabase.from('blog_posts').delete().eq('id', id)
    if (error) return jsonNoStore({ error: error.message }, 500)

    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to delete' }, 500)
  }
}
