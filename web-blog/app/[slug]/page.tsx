import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { getSupabase, type BlogPost, type BlogCategory } from '@/lib/supabase'
import { getSiteUrl, getStoreUrl, getPostUrl } from '@/lib/urls'
import ShareButton from '@/components/ShareButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PostWithCategory = BlogPost & { _category?: BlogCategory | null }

async function fetchPost(slug: string): Promise<PostWithCategory | null> {
  const supabase = getSupabase()
  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!post) return null

  let category: BlogCategory | null = null
  if (post.category_id) {
    const { data: cat } = await supabase
      .from('blog_categories')
      .select('*')
      .eq('id', post.category_id)
      .single()
    category = (cat as any) || null
  }

  return { ...(post as any as BlogPost), _category: category }
}

async function fetchRelated(currentId: string, categoryId: string | null): Promise<PostWithCategory[]> {
  const supabase = getSupabase()

  // Step 1: Try same-category posts first
  let posts: BlogPost[] = []
  if (categoryId) {
    const { data: sameCat } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .neq('id', currentId)
      .eq('category_id', categoryId)
      .limit(3)
    posts = ((sameCat as any) || []) as BlogPost[]
  }

  // Step 2: If less than 3, fill in with latest posts from any category
  if (posts.length < 3) {
    const haveIds = posts.map(p => p.id).concat(currentId)
    const { data: more } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .not('id', 'in', `(${haveIds.map(id => `"${id}"`).join(',')})`)
      .limit(3 - posts.length)
    posts = posts.concat(((more as any) || []) as BlogPost[])
  }

  // Sort by published_at then created_at
  posts.sort((a, b) => {
    const da = new Date(a.published_at || a.created_at).getTime()
    const db = new Date(b.published_at || b.created_at).getTime()
    return db - da
  })

  // Resolve categories
  const catIds = Array.from(new Set(posts.map(p => p.category_id).filter(Boolean) as string[]))
  let cats: BlogCategory[] = []
  if (catIds.length > 0) {
    const { data: catRows } = await supabase
      .from('blog_categories')
      .select('*')
      .in('id', catIds)
    cats = (catRows as any) || []
  }
  const catMap = new Map(cats.map(c => [c.id, c]))

  return posts.map(p => ({
    ...p,
    _category: p.category_id ? catMap.get(p.category_id) || null : null,
  }))
}

async function incrementViewCount(id: string) {
  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('blog_posts')
      .select('view_count')
      .eq('id', id)
      .single()
    if (data) {
      await supabase
        .from('blog_posts')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', id)
    }
  } catch {
    // non-critical
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await fetchPost(params.slug)
  if (!post) return { title: 'Tidak ditemukan' }

  const url = getPostUrl(params.slug)

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt || undefined,
    alternates: { canonical: url },
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || undefined,
      url,
      siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Blog',
      images: post.featured_image ? [post.featured_image] : undefined,
      type: 'article',
      publishedTime: post.published_at || undefined,
      authors: post.author_name ? [post.author_name] : undefined,
      tags: post.tags || undefined,
    },
    twitter: {
      card: post.featured_image ? 'summary_large_image' : 'summary',
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || undefined,
      images: post.featured_image ? [post.featured_image] : undefined,
    },
  }
}

function formatDate(s: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug)
  if (!post) notFound()

  // Fire-and-forget: increment view count
  incrementViewCount(post.id)

  const related = await fetchRelated(post.id, post.category_id)

  return (
    <article>
      {/* ===== HERO ===== */}
      <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-primary-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3"></div>
        </div>

        <div className="container mx-auto px-4 max-w-3xl py-10 md:py-12 relative z-10">
          {/* Breadcrumb */}
          <div className="text-sm text-white/80 mb-4 flex items-center gap-2 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">
              <i className="fa-solid fa-house text-xs mr-1"></i> Blog
            </Link>
            {post._category && (
              <>
                <i className="fa-solid fa-chevron-right text-[10px] text-white/50"></i>
                <Link
                  href={`/?kategori=${post._category.slug}`}
                  className="hover:text-white transition-colors"
                >
                  {post._category.name}
                </Link>
              </>
            )}
          </div>

          {post._category && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-semibold mb-4">
              <i className="fa-solid fa-folder-open mr-1.5 text-[10px]"></i>
              {post._category.name}
            </span>
          )}

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-white/85 text-base md:text-lg max-w-2xl mb-5 leading-relaxed">
              {post.excerpt}
            </p>
          )}

          <div className="flex items-center gap-3 text-sm text-white/85 flex-wrap">
            <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-base font-bold">
              {post.author_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{post.author_name}</p>
              <p className="text-xs text-white/70">
                {formatDate(post.published_at || post.created_at)}
                <span className="mx-1.5">•</span>
                <i className="fa-solid fa-eye text-[10px] mr-0.5"></i> {post.view_count} kali dilihat
              </p>
            </div>

            {/* Share button (white-on-glass variant for hero) */}
            <div className="ml-auto">
              <ShareButton
                title={post.title}
                slug={post.slug}
                excerpt={post.excerpt}
                variant="floating"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===== FEATURED IMAGE (overlap) ===== */}
      {post.featured_image && (
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-primary-100 to-primary-50 -translate-y-8 shadow-xl border border-white/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* ===== CONTENT ===== */}
      <div className={`container mx-auto px-4 max-w-3xl ${post.featured_image ? '-mt-2' : 'pt-8'} pb-12`}>
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 md:p-10">
          <div className="prose prose-lg max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {post.content || ''}
            </ReactMarkdown>
          </div>

          {/* Share box (after content) */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-2xl p-5 border border-primary-100 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm md:text-base">Suka artikel ini?</p>
                <p className="text-xs text-gray-600 mt-0.5">Bagikan ke teman atau keluarga Anda biar mereka juga tahu.</p>
              </div>
              <ShareButton title={post.title} slug={post.slug} excerpt={post.excerpt} variant="inline" />
            </div>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Tag</p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium hover:bg-primary-100 transition-colors"
                  >
                    <i className="fa-solid fa-hashtag text-[10px] mr-1 opacity-60"></i>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Back to blog */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <i className="fa-solid fa-arrow-left text-xs"></i>
              Kembali ke Blog
            </Link>
            {getStoreUrl() && (
              <a
                href={getStoreUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md hover:shadow-lg transition-all"
              >
                <i className="fa-solid fa-bag-shopping text-xs"></i>
                Belanja di Toko
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ===== RELATED ===== */}
      {related.length > 0 && (
        <section className="bg-gradient-to-br from-primary-50 to-white border-t border-gray-100 py-10">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-newspaper text-primary-500"></i>
                <h2 className="text-lg md:text-xl font-bold text-gray-900">Artikel Terkait</h2>
              </div>
              <Link href="/" className="text-sm font-semibold text-primary-500 hover:text-primary-600">
                Lihat Semua <i className="fa-solid fa-chevron-right text-xs ml-1"></i>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {related.map(p => (
                <Link key={p.id} href={`/${p.slug}`} className="group">
                  <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-card hover:shadow-md hover:border-primary-200 transition-all h-full flex flex-col">
                    <div className="aspect-video bg-gradient-to-br from-primary-100 via-white to-primary-50/50 relative overflow-hidden">
                      {p.featured_image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.featured_image}
                          alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-primary-200">
                          <i className="fa-solid fa-newspaper text-5xl"></i>
                        </div>
                      )}
                      {p._category && (
                        <div className="absolute top-3 left-3">
                          <span className="inline-flex items-center bg-white/95 backdrop-blur-sm text-primary-600 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm">
                            {p._category.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 sm:p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2 mb-1.5 leading-snug">
                        {p.title}
                      </h3>
                      {p.excerpt && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{p.excerpt}</p>
                      )}
                      <div className="mt-auto pt-2 text-xs text-gray-500 flex items-center justify-between">
                        <span className="font-medium text-gray-600 truncate">{p.author_name}</span>
                        <span className="whitespace-nowrap">{formatDate(p.published_at || p.created_at)}</span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  )
}
