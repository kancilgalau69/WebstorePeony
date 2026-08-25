"use client";

import { Suspense } from 'react'
import { useEffect, useRef, useState, useMemo } from 'react'
import ProductCard from '@/components/ProductCard'
import PromoSection from '@/components/PromoSection'
import { Database } from '@/lib/database.types'
import { useSearchParams } from 'next/navigation'
import { resolveWebPrice } from '@/lib/pricing'
import { formatCategoryName, getCategoryIcon } from '@/lib/categories'

type Product = Database['public']['Tables']['products']['Row']

function HomeInner() {
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState<string>('')
  const requestSeqRef = useRef(0)
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProducts({ silent: false })
    
    const interval = setInterval(() => {
      fetchProducts({ silent: true })
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  async function fetchProducts({ silent = false } = {}) {
    const requestSeq = ++requestSeqRef.current

    try {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      
      const res = await fetch('/api/catalog-products?aktifOnly=true', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to fetch products')

      if (requestSeq !== requestSeqRef.current) return

      const data = (json?.data || []) as Product[]
      setProducts(data)
      
      const uniqueCategories = Array.from(
        new Set((data || []).map(p => formatCategoryName(p.kategori)).filter(Boolean))
      ) as string[]
      setCategories(uniqueCategories)
    } catch (error: any) {
      console.error('Error fetching products:', error)
      if (!silent && requestSeq === requestSeqRef.current) {
        setError(error?.message || 'Failed to load products')
      }
    } finally {
      if (!silent && requestSeq === requestSeqRef.current) {
        setLoading(false)
      }
    }
  }

  const activeSearch = searchQuery || filterQuery

  let filteredProducts = products
  if (activeSearch) {
    filteredProducts = products.filter(p => {
      const cat = formatCategoryName(p.kategori)
      return (
        p.nama?.toLowerCase().includes(activeSearch.toLowerCase()) ||
        p.deskripsi?.toLowerCase().includes(activeSearch.toLowerCase()) ||
        cat.toLowerCase().includes(activeSearch.toLowerCase())
      )
    })
  } else if (selectedCategory !== 'all') {
    filteredProducts = products.filter(p => formatCategoryName(p.kategori) === selectedCategory)
  }

  // 1. Flash Sale (Product with harga_lama > harga_web & stok > 0)
  const discountProducts = useMemo(() => {
    return products.filter(p => {
      const hargaLama = (p as any).harga_lama
      const hargaWeb = resolveWebPrice(p as any)
      return hargaLama && hargaLama > hargaWeb && p.stok > 0
    }).slice(0, 8)
  }, [products])

  // 2. Produk Teratas
  const topProducts = useMemo(() => {
    return [...products]
      .filter(p => p.stok > 0)
      .sort((a, b) => b.stok - a.stok)
      .slice(0, 8)
  }, [products])

  // 3. Produk Terlaris
  const bestSellerProducts = useMemo(() => {
    return [...products]
      .filter(p => p.stok > 0)
      .sort((a, b) => {
        const hashA = a.id.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)
        const hashB = b.id.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)
        return Math.abs(hashB) - Math.abs(hashA)
      })
      .slice(0, 8)
  }, [products])

  // 4. Produk Terbaru
  const newProducts = useMemo(() => {
    return [...products]
      .filter(p => p.stok > 0)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 8)
  }, [products])

  useEffect(() => {
    if (searchQuery) {
      setTimeout(() => {
        const productsSection = document.getElementById('products')
        if (productsSection) {
          productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 300)
    }
  }, [searchQuery])

  const showSections = !loading && !activeSearch && selectedCategory === 'all'

  return (
    <div className="w-full space-y-8 animate-fadeIn">
      {/* ===== 1. PROMO BANNER SLIDER ===== */}
      {showSections && (
        <PromoSection />
      )}

      {/* ===== 2. FLASH SALE SECTION ===== */}
      {showSections && discountProducts.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-bounce">⚡</span>
              <h2 className="font-fredoka text-2xl md:text-3xl text-[#3E2D3B]">Flash Sale</h2>
              <span className="px-3 py-1 rounded-full bg-[#D9777F] text-white text-[11px] font-black tracking-wider uppercase shadow-xs">
                Promo Spesial
              </span>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 pt-1">
            {discountProducts.map(product => (
              <div key={product.id} className="shrink-0 w-[270px]">
                <ProductCard product={product} variant="horizontal" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== 3. PRODUK TERATAS SECTION ===== */}
      {showSections && topProducts.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌟</span>
            <h2 className="font-fredoka text-2xl md:text-3xl text-[#3E2D3B]">Produk Teratas</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 pt-1">
            {topProducts.map(product => (
              <div key={product.id} className="shrink-0 w-[270px]">
                <ProductCard product={product} variant="horizontal" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== 4. PRODUK TERLARIS SECTION ===== */}
      {showSections && bestSellerProducts.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <h2 className="font-fredoka text-2xl md:text-3xl text-[#3E2D3B]">Produk Terlaris</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 pt-1">
            {bestSellerProducts.map(product => (
              <div key={product.id} className="shrink-0 w-[270px]">
                <ProductCard product={product} variant="horizontal" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== 5. PRODUK TERBARU SECTION ===== */}
      {showSections && newProducts.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h2 className="font-fredoka text-2xl md:text-3xl text-[#3E2D3B]">Produk Terbaru</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2 pt-1">
            {newProducts.map(product => (
              <div key={product.id} className="shrink-0 w-[270px]">
                <ProductCard product={product} variant="horizontal" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== 6. SEMUA PRODUK / PRICELIST GRID SECTION ===== */}
      <section id="products" className="scroll-mt-24 pt-4">
        {/* Section Header */}
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-fredoka text-3xl md:text-4xl text-[#3E2D3B] tracking-wide">
            Semua Produk
          </h2>
          <span className="text-xs md:text-sm font-extrabold text-[#B0B3D6]">
            {filteredProducts.length} Produk Ready
          </span>
        </div>

        {/* Search & Category Pills Controls */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Round Search Input Bar */}
          <div className="relative w-full">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[#8E7188] pointer-events-none">
              ⌕
            </span>
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Cari aplikasi premium..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-[#F0E2EB] bg-white text-[#3E2D3B] font-extrabold text-sm outline-none shadow-sm focus:border-[#CB96BA] focus:ring-4 focus:ring-[#CB96BA]/15 transition-all"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E7188] hover:text-[#3E2D3B]"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          {/* Category Pills horizontal bar */}
          {!loading && categories.length > 0 && (
            <div ref={categoryScrollRef} className="flex gap-3 overflow-x-auto scrollbar-none py-2 px-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-6 py-2.5 rounded-full font-extrabold text-xs whitespace-nowrap border-2 transition-all flex items-center justify-center gap-2 shadow-xs shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-[#CB96BA] to-[#B0B3D6] text-white border-transparent shadow-md scale-105'
                    : 'bg-white text-[#3E2D3B] border-[#F0E2EB] hover:border-[#B0B3D6] hover:-translate-y-0.5'
                }`}
              >
                🌸 Semua
              </button>
              {categories.map(cat => {
                const icon = getCategoryIcon(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-6 py-2.5 rounded-full font-extrabold text-xs whitespace-nowrap border-2 transition-all flex items-center justify-center gap-2 shadow-xs shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-gradient-to-r from-[#CB96BA] to-[#B0B3D6] text-white border-transparent shadow-md scale-105'
                        : 'bg-white text-[#3E2D3B] border-[#F0E2EB] hover:border-[#B0B3D6] hover:-translate-y-0.5'
                    }`}
                  >
                    <i className={`fa-solid ${icon} text-xs`}></i>
                    <span>{cat}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-[#FFE4E6] border border-[#BE123C]/20 text-[#BE123C] px-5 py-4 rounded-2xl flex items-start gap-3">
            <i className="fa-solid fa-triangle-exclamation mt-0.5 text-[#BE123C]"></i>
            <div>
              <p className="font-bold text-sm">Gagal memuat produk</p>
              <p className="text-xs mt-1">{error}</p>
              <button 
                onClick={() => fetchProducts({ silent: false })}
                className="mt-2 text-xs font-bold underline"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        )}

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="peony-card h-64 animate-pulse">
                <div className="w-16 h-16 rounded-2xl bg-gray-200 mt-4 mb-3"></div>
                <div className="w-3/4 h-4 bg-gray-200 rounded mb-2"></div>
                <div className="w-1/2 h-4 bg-gray-200 rounded mb-3"></div>
                <div className="w-full h-9 bg-gray-200 rounded-xl mt-auto"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-5">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : !error ? (
          <div className="text-center py-16 bg-white rounded-3xl border-2 border-[#F0E2EB]">
            <div className="text-5xl text-[#CB96BA] mb-3">🌸</div>
            <h3 className="font-fredoka text-xl text-[#3E2D3B] mb-1">
              Produk Tidak Ditemukan
            </h3>
            <p className="text-xs text-[#8E7188] mb-4">
              Coba kata kunci pencarian lain atau pilih kategori berbeda.
            </p>
            <button
              onClick={() => { setSelectedCategory('all'); setFilterQuery('') }}
              className="btn-card-buy max-w-xs mx-auto"
            >
              Reset Filter ✦
            </button>
          </div>
        ) : null}
      </section>

      {/* ===== 7. CARA BELANJA SECTION ===== */}
      {!activeSearch && (
        <section className="py-8 px-6 rounded-3xl bg-white border-2 border-[#F0E2EB] shadow-xs my-8">
          <div className="text-center mb-6">
            <h2 className="font-fredoka text-2xl md:text-3xl text-[#3E2D3B]">Cara Belanja</h2>
            <p className="text-xs text-[#8E7188] font-bold mt-1">4 langkah mudah sampai akun aktif instan</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[{
              title: 'Pilih Produk',
              desc: 'Pilih produk digital favorit Anda.',
              icon: 'fa-magnifying-glass',
            }, {
              title: 'Tambah Keranjang',
              desc: 'Klik beli untuk masuk keranjang.',
              icon: 'fa-cart-plus',
            }, {
              title: 'Pembayaran QRIS',
              desc: 'Scan QRIS dari bank/e-wallet.',
              icon: 'fa-qrcode',
            }, {
              title: 'Akun Dikirim',
              desc: 'Otomatis dikirim via web & bot.',
              icon: 'fa-paper-plane',
            }].map((step, idx) => (
              <div key={step.title} className="flex flex-col items-center text-center p-4 rounded-2xl bg-[#F7F2F6] border border-[#F0E2EB]">
                <div className="w-10 h-10 rounded-2xl bg-[#CB96BA] text-white flex items-center justify-center text-lg mb-2 shadow-xs">
                  <i className={`fa-solid ${step.icon}`}></i>
                </div>
                <span className="font-fredoka text-xs text-[#CB96BA] mb-1">Langkah {idx + 1}</span>
                <h3 className="font-extrabold text-sm text-[#3E2D3B] mb-1">{step.title}</h3>
                <p className="text-[11px] text-[#8E7188] leading-tight">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-[#8E7188]">
        <div className="text-4xl animate-bounce mb-2">🌸</div>
        <p className="font-fredoka text-lg">Memuat Rain Store...</p>
      </div>
    }>
      <HomeInner />
    </Suspense>
  )
}
