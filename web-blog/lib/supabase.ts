import { createClient } from '@supabase/supabase-js'

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Prefer service role for server-side fetches (bypasses RLS for blog reads)
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  if (!url || !key) {
    throw new Error('Supabase env not configured')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export type BlogPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  featured_image: string | null
  category_id: string | null
  author_name: string
  status: string
  published_at: string | null
  view_count: number
  meta_title: string | null
  meta_description: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  blog_categories?: { id: string; name: string; slug: string } | null
}

export type BlogCategory = {
  id: string
  slug: string
  name: string
  description: string | null
}
