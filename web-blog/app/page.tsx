import Link from 'next/link'
import { getSupabase, type BlogPost, type BlogCategory } from '@/lib/supabase'
import { getStoreUrl } from '@/lib/urls'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PostWithCategory = BlogPost & { _category?: BlogCategory | null }

// Category icon mapping (consistent with user web store)
const CATEGORY_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  promo: { icon: 'fa-tag', color: 'text-red-500', bg: 'bg-red-50' },
  'tips-trik': { icon: 'fa-lightbulb', color: 'text-amber-500', bg: 'bg-amber-50' },
  'tips-and-trick': { icon: 'fa-lightbulb', color: 'text-amber-500', bg: 'bg-amber-50' },
  umum: { icon: 'fa-newspaper', color: 'text-blue-500', bg: 'bg-blue-50' },
  panduan: { icon: 'fa-book', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  review: { icon: 'fa-star', color: 'text-yellow-500', bg: 'bg-yellow-50' },
  default: { icon: 'fa-folder-open', color: 'text-primary-500', bg: 'bg-primary-50' },
}

function getCategoryIcon(slug: string) {
  return CATEGORY_ICONS[slug] || CATEGORY_ICONS.default
}

async function fetchData(): Promise<{ posts: PostWithCategory[]; categories: BlogCategory[] }> {
  const supabase = getSupabase()

  // Fetch posts (no embed, defensive)
  const { data: rawPosts, error: postsErr } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'published')
    .limit(50)

  if (postsErr) {
    console.error('[blog homepage] posts error', postsErr)
    return { posts: [], categories: [] }
  }

  const { data: rawCats, error: catsErr } = await supabase
    .from('blog_categories')
    .select('*')
    .order('name')

  if (catsErr) {
    console.error('[blog homepage] cats error', catsErr)
  }

  const cats: BlogCategory[] = (rawCats as any) || []
  const catMap = new Map(cats.map(c => [c.id, c]))

  const posts: PostWithCategory[] = ((rawPosts as any as BlogPost[]) || []).map(p => ({
    ...p,
    _category: p.category_id ? catMap.get(p.category_id) || null : null,
  }))

  // Sort by published_at then created_at (defensive against null published_at)
  posts.sort((a, b) => {
    const da = new Date(a.published_at || a.created_at).getTime()
    const db = new Date(b.published_at || b.created_at).getTime()
    return db - da
  })

  return { posts, categories: cats }
}

function formatDate(s: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function HomePage({ searchParams }: { searchParams?: { kategori?: string } }) {
  const { posts, categories } = await fetchData()
  const filterSlug = searchParams?.kategori || ''

  const filtered = filterSlug
    ? posts.filter(p => p._category?.slug === filterSlug)
    : posts

  const featured = filtered[0]
  const rest = filtered.slice(1)

  return (
    <>
      {/* ===== HERO BANNER ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-500 via-primary-600 to-primary-800 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3"></div>
        </div>

        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          <div className="py-10 md:py-14 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse"></span>
              Blog & Artikel
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight mb-3">
              Tips, Panduan & Informasi
              <br />
              <span className="text-white/90">Produk Digital</span>
            </h1>
            <p className="text-white/80 text-sm md:text-base max-w-xl mx-auto">
              Temukan informasi terbaru seputar produk digital, tips penggunaan, dan promo menarik.
            </p>
          </div>
        </div>
      </section>

      {/* ===== PROMO TICKER ===== */}
      <div className="bg-primary-50 border-b border-primary-100 py-2 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-8 text-sm text-primary-600 font-medium">
          <span><i className="fa-solid fa-fire text-orange-500 mr-1"></i> Update artikel terbaru setiap minggu</span>
          <span><i className="fa-solid fa-lightbulb text-amber-500 mr-1"></i> Tips & trik untuk produk digital</span>
          <span><i className="fa-solid fa-tag text-red-500 mr-1"></i> Info promo & diskon eksklusif</span>
          <span><i className="fa-solid fa-bolt text-primary-500 mr-1"></i> Panduan instan langsung dari admin</span>
          <span><i className="fa-solid fa-fire text-orange-500 mr-1"></i> Update artikel terbaru setiap minggu</span>
          <span><i className="fa-solid fa-lightbulb text-amber-500 mr-1"></i> Tips & trik untuk produk digital</span>
          <span><i className="fa-solid fa-tag text-red-500 mr-1"></i> Info promo & diskon eksklusif</span>
          <span><i className="fa-solid fa-bolt text-primary-500 mr-1"></i> Panduan instan langsung dari admin</span>
        </div>
      </div>

      {/* ===== CATEGORY SECTION ===== */}
      {categories.length > 0 && (
        <section className="py-6 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Kategori</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto scroll-container pb-2">
              <Link
                href="/"
                className={`flex-shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl border transition-all min-w-[80px] ${
                  !filterSlug
                    ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-200 hover:bg-primary-50'
                }`}
              >
                <i className={`fa-solid fa-grid-2 text-lg ${!filterSlug ? '' : 'text-primary-400'}`}></i>
                <span className="text-[11px] font-semibold">Semua</span>
              </Link>
              {categories.map(c => {
                const ic = getCategoryIcon(c.slug)
                const active = filterSlug === c.slug
                return (
                  <Link
                    key={c.id}
                    href={`/?kategori=${c.slug}`}
                    className={`flex-shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl border transition-all min-w-[80px] ${
                      active
                        ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-200 hover:bg-primary-50'
                    }`}
                  >
                    <i className={`fa-solid ${ic.icon} text-lg ${active ? '' : ic.color}`}></i>
                    <span className="text-[11px] font-semibold whitespace-nowrap">{c.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== ARTICLES ===== */}
      <section className="py-6 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                {filterSlug ? categories.find(c => c.slug === filterSlug)?.name || 'Artikel' : 'Semua Artikel'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{filtered.length} artikel ditemukan</p>
            </div>
            {filterSlug && (
              <Link href="/" className="text-sm font-semibold text-primary-500 hover:text-primary-600">
                <i className="fa-solid fa-arrow-left mr-1"></i> Reset
              </Link>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="text-5xl text-gray-300 mb-3">
                <i className="fa-solid fa-newspaper"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Belum Ada Artikel</h3>
              <p className="text-sm text-gray-500">
                {filterSlug ? 'Belum ada artikel di kategori ini.' : 'Artikel akan segera ditambahkan.'}
              </p>
              {filterSlug && (
                <Link
                  href="/"
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl font-semibold text-sm hover:bg-primary-600 transition-colors"
                >
                  Lihat Semua Artikel
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* ===== FEATURED POST ===== */}
              {featured && (
                <Link href={`/${featured.slug}`} className="group block mb-8">
                  <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-card hover:shadow-lg transition-all">
                    <div className="grid md:grid-cols-5">
                      <div className="md:col-span-3 aspect-video md:aspect-auto bg-gradient-to-br from-primary-100 via-white to-primary-50/50 relative overflow-hidden">
                        {featured.featured_image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={featured.featured_image}
                            alt={featured.title}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-primary-200">
                            <i className="fa-solid fa-newspaper text-7xl"></i>
                          </div>
                        )}
                        <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-primary-500 text-white px-3 py-1 rounded-full text-[11px] font-bold shadow-md">
                          <i className="fa-solid fa-star"></i> Artikel Pilihan
                        </div>
                      </div>
                      <div className="md:col-span-2 p-6 md:p-7 flex flex-col justify-center">
                        {featured._category && (
                          <span className="inline-flex self-start px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 text-[11px] font-bold mb-3">
                            {featured._category.name}
                          </span>
                        )}
                        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-3 mb-2 leading-tight">
                          {featured.title}
                        </h2>
                        {featured.excerpt && (
                          <p className="text-gray-600 text-sm line-clamp-3 mb-3 leading-relaxed">{featured.excerpt}</p>
                        )}
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-xs font-bold">
                            {featured.author_name?.charAt(0).toUpperCase() || 'A'}
                          </div>
                          <span className="font-medium text-gray-700">{featured.author_name}</span>
                          <span className="text-gray-300">•</span>
                          <span>{formatDate(featured.published_at || featured.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              )}

              {/* ===== GRID ===== */}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {rest.map(p => {
                    const ic = p._category ? getCategoryIcon(p._category.slug) : null
                    return (
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
                                <i className={`fa-solid ${ic?.icon || 'fa-newspaper'} text-5xl`}></i>
                              </div>
                            )}
                            {p._category && (
                              <div className="absolute top-3 left-3">
                                <span className="inline-flex items-center bg-white/95 backdrop-blur-sm text-primary-600 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm">
                                  <i className={`fa-solid ${ic?.icon || 'fa-folder'} mr-1`}></i>
                                  {p._category.name}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-4 sm:p-5 flex-1 flex flex-col">
                            <h3 className="font-bold text-base text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2 mb-2 leading-snug">
                              {p.title}
                            </h3>
                            {p.excerpt && (
                              <p className="text-sm text-gray-600 line-clamp-2 mb-3 leading-relaxed">{p.excerpt}</p>
                            )}
                            <div className="mt-auto pt-3 border-t border-gray-50 text-xs text-gray-500 flex items-center justify-between">
                              <span className="font-medium text-gray-600 truncate">{p.author_name}</span>
                              <span className="whitespace-nowrap">{formatDate(p.published_at || p.created_at)}</span>
                            </div>
                          </div>
                        </article>
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <CTASection />
    </>
  )
}

function CTASection() {
  const storeUrl = getStoreUrl()
  if (!storeUrl) return null

  return (
    <section className="py-10 bg-gradient-to-br from-primary-50 to-white">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 md:p-8 text-center">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Tertarik dengan Produk Kami?</h2>
          <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
            Kunjungi toko untuk melihat semua produk digital yang tersedia.
          </p>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <i className="fa-solid fa-bag-shopping"></i>
            Belanja Sekarang
          </a>
        </div>
      </div>
    </section>
  )
}
