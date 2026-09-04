"use client";

import { Suspense } from 'react'
import { useEffect, useRef, useState, useMemo } from 'react'
import ProductCard from '@/components/ProductCard'
import PromoSection from '@/components/PromoSection'
import { Database } from '@/lib/database.types'
import { useSearchParams } from 'next/navigation'
import { resolveWebPrice } from '@/lib/pricing'
import { formatCategoryName, getCategoryIcon } from '@/lib/categories'
import { useAuth } from '@/components/AuthProvider'

type Product = Database['public']['Tables']['products']['Row']

type Testimonial = {
  id: string
  name: string
  title: string
  body: string
  rating: number
  created_at: string
}

const testimonialTitles = ['LOVE', 'mantap', 'good', 'keren banget', 'satset', 'recommended']

function HomeInner() {
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  const { user } = useAuth()
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState<string>('')
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [testimonialPage, setTestimonialPage] = useState(0)
  const [testimonialText, setTestimonialText] = useState('')
  const [testimonialTitle, setTestimonialTitle] = useState('good')
  const [testimonialRating, setTestimonialRating] = useState(5)
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false)
  const [testimonialMessage, setTestimonialMessage] = useState('')
  const requestSeqRef = useRef(0)
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProducts({ silent: false })
    
    const interval = setInterval(() => {
      fetchProducts({ silent: true })
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const response = await fetch('/api/testimonials', { cache: 'no-store' })
        const json = await response.json()
        if (response.ok) setTestimonials(json.testimonials || [])
      } catch (err) {
        console.error('Error fetching testimonials:', err)
      }
    }
    fetchTestimonials()
  }, [])

  const submitTestimonial = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!testimonialText.trim()) return
    try {
      setTestimonialSubmitting(true)
      setTestimonialMessage('')
      const response = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testimonial: testimonialText, title: testimonialTitle, rating: testimonialRating }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Gagal mengirim testimoni')
      setTestimonialText('')
      setTestimonialMessage('Testimoni berhasil dikirim dan menunggu persetujuan admin.')
    } catch (err) {
      setTestimonialMessage(err instanceof Error ? err.message : 'Gagal mengirim testimoni')
    } finally {
      setTestimonialSubmitting(false)
    }
  }

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
        new Set(
          (data || [])
            .map(p => formatCategoryName(p.kategori))
            .filter(Boolean)
            .filter(cat => isNaN(Number(cat))) // Filter out numeric categories like "5000"
        )
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
    <div className="w-full animate-fadeIn font-jakarta">
      {/* ===== HERO (Light full width) ===== */}
      <section className="w-full bg-gradient-to-b from-[#FBEEF1] to-[#FDF6F8] pt-10 pb-32 relative">
        <div className="max-w-[1160px] mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="font-fredoka text-3xl md:text-4xl leading-[1.3] text-[#720002]">
              <span className="text-[#DB8291]">𖣁 𓈒 🏩 ꒰ GET YOUR PREMIUM ♡ ꒱ ⑅ ¨ 💭</span>
            </h1>
            <div className="text-sm md:text-base text-[#8A3A44] leading-relaxed mt-6 max-w-xl space-y-3 font-medium">
              <p>𓊔 ₊ 𓂂 looking for premium apps for yourself or your customers? say no more, 𝐏𝐞𝐨𝐧𝐲 is here! ⟡ 𓊔 💗</p>
              <p>🎀 𖣠 ̥݁ streaming sepuasnya 🗒️ ⊹ ꔛ ₊ editing lebih bebas ៶៲៸ ✉️ belajar tanpa batas ˖ 👛 𖠗 atau nikmati musik favoritmu 𓂂 𓐍 🎧 ⑅˚</p>
              <p>𓏮 💒 ⠏𓈒 ݁ semuanya bisa kamu temukan . . di 𝐏𝐞𝐨𝐧𝐲 𝐒𝐭𝐨𝐫𝐞! 🌸 🎠 ◎</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-8">
              <a href="#products" className="strawberry-gradient text-white font-extrabold text-sm px-8 py-3.5 rounded-full shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2">
                <i className="fa-solid fa-bag-shopping"></i> Belanja Sekarang
              </a>
              <a href="/register" className="bg-white border-2 border-[#DB8291] text-[#720002] font-extrabold text-sm px-8 py-3.5 rounded-full hover:bg-[#FBEEF1] transition-all flex items-center gap-2">
                <i className="fa-solid fa-user-plus"></i> Daftar Akun
              </a>
            </div>

            {/* Stats inline */}
            <div className="flex items-center gap-10 mt-12">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-box-open text-2xl text-[#DB8291]"></i>
                <div>
                  <div className="font-fredoka text-xl text-[#720002]">14.0K</div>
                  <div className="text-[10px] uppercase font-bold text-[#9E6B72]">Produk terjual</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-layer-group text-2xl text-[#DB8291]"></i>
                <div>
                  <div className="font-fredoka text-xl text-[#720002]">89</div>
                  <div className="text-[10px] uppercase font-bold text-[#9E6B72]">Total produk</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-users text-2xl text-[#DB8291]"></i>
                <div>
                  <div className="font-fredoka text-xl text-[#720002]">1.8K</div>
                  <div className="text-[10px] uppercase font-bold text-[#9E6B72]">Total pembeli</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex justify-end">
             <div className="relative w-full max-w-md aspect-square bg-white border-[6px] border-[#FBEEF1] rounded-3xl shadow-xl overflow-hidden flex items-center justify-center">
               <img src="https://cdn.phototourl.com/free/2026-08-30-e950ef59-7f03-4f4c-aed8-5b905bb8cb2d.jpg" alt="Peony Store" className="w-full h-full object-cover" />
             </div>
          </div>
        </div>
      </section>

      {/* ===== PAYMENT METHODS BANNER (Overlapping) ===== */}
      <section className="w-full max-w-[1160px] mx-auto px-4 -mt-16 relative z-20">
        <div className="ticket-wrapper">
          <div className="bg-[#FDF6F8] rounded-2xl ticket-shape p-2">
            <div className="border-2 border-dashed border-[#DB8291]/70 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
              <div className="flex items-center gap-3 md:w-1/4">
                <i className="fa-solid fa-credit-card text-[#DB8291] text-xl"></i>
                <h3 className="font-bold text-[#720002] text-sm">Mendukung Berbagai Pembayaran</h3>
              </div>
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-[#F4D6DC] flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-qrcode text-[#DB8291]"></i>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#720002]">QRIS</div>
                    <div className="text-[10px] text-[#9E6B72]">Scan via bank/e-wallet</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-[#F4D6DC] flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-wallet text-[#DB8291]"></i>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#720002]">E-Wallet</div>
                    <div className="text-[10px] text-[#9E6B72]">Dana, OVO, Gopay, dll</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-[#F4D6DC] flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-building-columns text-[#DB8291]"></i>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#720002]">Virtual Account</div>
                    <div className="text-[10px] text-[#9E6B72]">BCA, BRI, BNI, dll</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PILIHAN PRODUK BERKUALITAS ===== */}
      <section className="w-full bg-gradient-to-r from-[#720002] via-[#9E1120] to-[#DB8291] mt-16 py-16 shadow-md">
        <div className="max-w-[1160px] mx-auto px-4 text-center">
          <h2 className="font-fredoka text-3xl md:text-4xl text-white mb-10">
            ꒰ choose what you want ♡ ꒱ 🌷
          </h2>

          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {/* All Products Button */}
            <button
              onClick={() => { setSelectedCategory('all'); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }}
              className={`rounded-xl px-5 py-3 flex items-center gap-3 font-bold text-sm transition-colors shadow-sm ${selectedCategory === 'all' ? 'bg-[#720002] text-white ring-2 ring-white ring-offset-2 ring-offset-[#9E1120]' : 'bg-[#FDF6F8] hover:bg-white text-[#720002]'}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-[#FBEEF1] text-[#DB8291]'}`}>
                <i className="fa-solid fa-border-all text-xs"></i>
              </div>
              Semua Produk
            </button>

            {/* Dynamic Categories */}
            {categories.slice(0, 8).map(cat => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }}
                className={`rounded-xl px-5 py-3 flex items-center gap-3 font-bold text-sm transition-colors shadow-sm ${selectedCategory === cat ? 'bg-[#720002] text-white ring-2 ring-white ring-offset-2 ring-offset-[#9E1120]' : 'bg-[#FDF6F8] hover:bg-white text-[#720002]'}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${selectedCategory === cat ? 'bg-white/20 text-white' : 'bg-[#FBEEF1] text-[#DB8291]'}`}>
                  <i className={`fa-solid ${getCategoryIcon(cat)} text-xs`}></i>
                </div>
                {cat}
              </button>
            ))}
            
            {categories.length === 0 && (
               <span className="text-white text-sm">Memuat Kategori...</span>
            )}
          </div>
        </div>
      </section>

      {/* ===== SEMUA PRODUK GRID ===== */}
      <section id="products" className="w-full bg-[#FDF6F8] py-16 scroll-mt-20">
        <div className="max-w-[1160px] mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
             <h2 className="font-fredoka text-2xl text-[#720002]">Katalog <span className="text-[#DB8291]">Produk</span></h2>
             
             {/* Search input */}
             <div className="relative w-full sm:w-72">
               <input
                 type="text"
                 value={filterQuery}
                 onChange={(e) => setFilterQuery(e.target.value)}
                 placeholder="Cari aplikasi..."
                 className="w-full pl-4 pr-10 py-2.5 rounded-full border border-[#F4D6DC] bg-white text-sm font-bold text-[#720002] focus:border-[#DB8291] outline-none"
               />
               <i className="fa-solid fa-magnifying-glass absolute right-4 top-1/2 -translate-y-1/2 text-[#DB8291] text-sm"></i>
             </div>
          </div>
          
          {error && (
            <div className="mb-6 bg-[#FFE4E6] border border-[#BE123C]/20 text-[#BE123C] px-5 py-4 rounded-xl text-sm font-bold text-center">
              Gagal memuat produk: {error}
            </div>
          )}

          {/* Product Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl h-60 animate-pulse border border-[#F4D6DC]"></div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : !error ? (
            <div className="text-center py-16 text-[#9E6B72]">
               Tidak ada produk yang cocok.
            </div>
          ) : null}
        </div>
      </section>

      {/* ===== SIAPA KAMI (White background) ===== */}
      <section id="tentang" className="w-full bg-white py-20 border-t border-[#F4D6DC] scroll-mt-20">
        <div className="max-w-[800px] mx-auto px-4 text-center">
          <h2 className="font-fredoka text-2xl md:text-3xl text-[#DB8291] mb-6 leading-relaxed">
            🎠 🎀  Kenalan Dulu Sama Peony, Yuk! 🌷
          </h2>
          <div className="text-[#8A3A44] leading-relaxed text-sm md:text-base space-y-4 font-medium">
            <p>𓈄˚˖ 💒 Since 2025 𓈒 𓈒 𝐏𝐞𝐨𝐧𝐲 𝐒𝐭𝐨𝐫𝐞 ʾʿ has been your little place ⁺𓂃 𓂂 for premium apps with warranty 🌸 ౿ 𓈒 𓈆 ₊ kami menyediakan berbagai pilihan aplikasi premium 🗒️⟢ yang nyaman dipakai untuk daily use maupun untuk dijual kembali  ˖ 𖠗 👛 💭</p>
            <p>𓐇݁ ..┆ⓘ admin responsive & helpful ( ! ) ⑅ kamu bisa langsung reach out 𓂅  ada kendala / pertanyaan .</p>
            <p>&lt; 🌸 👧🏻 &gt; thousands of customers have joined us and become our  PEONY and now… it’s your turn! 🥡 ⭐️ 💗</p>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section id="testimonials" className="w-full bg-gradient-to-r from-[#720002] via-[#9E1120] to-[#DB8291] py-20 shadow-inner">
        <div className="max-w-[1160px] mx-auto px-4">
           <h2 className="font-fredoka text-2xl md:text-3xl text-center text-[#F4D6DC] mb-4 max-w-3xl mx-auto leading-relaxed">
             &lt; 📢 &gt; WHAT OUR RESELLER SAYS ABOUT
          </h2>
          <div className="text-center text-white/90 text-sm md:text-base mb-12 max-w-2xl mx-auto space-y-3 font-medium">
            <p>✉️ ⊹ ࣪ ˖ nggak cuma soal menjual , tapi juga tentang 𝘁𝗿𝘂𝘀𝘁; 𝗰𝗼𝗺𝗳𝗼𝗿𝘁; 𝗮𝗻𝗱 𝗴𝗼𝗼𝗱 𝗲𝘅𝗽𝗲𝗿𝗶𝗲𝗻𝗰𝗲𝘀 𓂅݁ ₊ 🎠 🎀</p>
            <p>𐚱 ꔠ ⑅ every feedback means a lot 𓈄᳸  𖦆 and we’re always happy to hear from you! 💗 𓄼</p>
          </div>

           {testimonials.length > 0 ? (
             <>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {testimonials.slice(testimonialPage * 6, testimonialPage * 6 + 6).map((t) => (
                   <div key={t.id} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 relative border border-[#F4D6DC] shadow-md hover:-translate-y-1 transition-transform">
                     <div className="flex items-center justify-between mb-2 pr-8">
                       <div className="text-[10px] uppercase font-black text-[#DB8291]">{t.title}</div>
                       <div className="text-amber-400 text-xs" aria-label={`${t.rating} dari 5 bintang`}>{'★'.repeat(Math.min(5, Math.max(1, t.rating || 5)))}</div>
                     </div>
                     <p className="text-sm text-[#8A3A44] leading-relaxed mb-5 font-medium whitespace-pre-wrap">{t.body}</p>
                     <div className="flex items-end justify-between gap-3">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-[#DB8291] text-white flex items-center justify-center font-bold text-sm shadow-sm">{t.name.charAt(0).toUpperCase()}</div>
                         <div>
                           <div className="font-bold text-sm text-[#720002]">{t.name}</div>
                           <div className="text-[10px] text-[#9E6B72]">Reseller</div>
                         </div>
                       </div>
                       <time className="text-[10px] text-[#9E6B72]" dateTime={t.created_at}>{new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
                     </div>
                     <i className="fa-solid fa-quote-right absolute top-6 right-6 text-2xl text-[#F4D6DC]"></i>
                   </div>
                 ))}
               </div>
               {testimonials.length > 6 && (
                 <div className="flex justify-center items-center gap-3 mt-7">
                   <button type="button" disabled={testimonialPage === 0} onClick={() => setTestimonialPage(page => Math.max(0, page - 1))} className="px-4 py-2 rounded-full bg-white/20 text-white text-xs font-bold disabled:opacity-40">← Sebelumnya</button>
                   <span className="text-white/80 text-xs font-bold">{testimonialPage + 1} / {Math.ceil(testimonials.length / 6)}</span>
                   <button type="button" disabled={(testimonialPage + 1) * 6 >= testimonials.length} onClick={() => setTestimonialPage(page => Math.min(Math.ceil(testimonials.length / 6) - 1, page + 1))} className="px-4 py-2 rounded-full bg-white/20 text-white text-xs font-bold disabled:opacity-40">Berikutnya →</button>
                 </div>
               )}
             </>
           ) : (
             <p className="text-center text-white/80 text-sm">Belum ada testimoni yang ditampilkan.</p>
           )}

           <div className="max-w-2xl mx-auto mt-12 bg-white/95 rounded-2xl p-5 md:p-6 border border-[#F4D6DC] shadow-md">
             <h3 className="font-fredoka text-xl text-[#720002] text-center">Bagikan Pengalamanmu 🌸</h3>
             {user ? (
               <form onSubmit={submitTestimonial} className="mt-4 space-y-3">
                 <div>
                   <label className="block text-xs font-bold text-[#9E6B72] mb-1">Nama</label>
                   <input value={user.nama} readOnly className="w-full rounded-xl border border-[#F4D6DC] bg-[#FBEEF1] px-3 py-2.5 text-sm font-bold text-[#720002] outline-none" />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   <div>
                     <label className="block text-xs font-bold text-[#9E6B72] mb-1">Kesan singkat</label>
                     <select value={testimonialTitle} onChange={e => setTestimonialTitle(e.target.value)} className="w-full rounded-xl border border-[#F4D6DC] bg-white px-3 py-2.5 text-sm font-bold text-[#720002] outline-none">
                       {testimonialTitles.map(title => <option key={title} value={title}>{title}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-[#9E6B72] mb-1">Rating</label>
                     <select value={testimonialRating} onChange={e => setTestimonialRating(Number(e.target.value))} className="w-full rounded-xl border border-[#F4D6DC] bg-white px-3 py-2.5 text-sm font-bold text-[#720002] outline-none">
                       <option value="5">★★★★★ Sangat puas</option><option value="4">★★★★ Puas</option><option value="3">★★★ Cukup</option>
                     </select>
                   </div>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-[#9E6B72] mb-1">Testimoni</label>
                   <textarea value={testimonialText} onChange={e => setTestimonialText(e.target.value)} maxLength={500} rows={4} placeholder="Tulis pengalaman positifmu di Peony Store..." required className="w-full rounded-xl border border-[#F4D6DC] bg-white px-3 py-2.5 text-sm text-[#720002] outline-none focus:border-[#DB8291] resize-none" />
                 </div>
                 <button type="submit" disabled={testimonialSubmitting || !testimonialText.trim()} className="w-full rounded-xl bg-[#720002] text-white py-3 text-xs font-extrabold disabled:opacity-50">{testimonialSubmitting ? 'Mengirim...' : 'Kirim Testimoni'}</button>
                 {testimonialMessage && <p className="text-center text-xs font-bold text-[#720002]">{testimonialMessage}</p>}
               </form>
             ) : (
               <p className="text-center text-xs text-[#9E6B72] font-bold mt-3">Silakan login terlebih dahulu untuk mengirim testimoni.</p>
             )}
           </div>
         </div>
      </section>


      {/* ===== BOTTOM CTA ===== */}
      <section className="w-full bg-white pt-20 pb-0 md:pb-4">
        <div className="max-w-[900px] mx-auto px-4">
           <div className="bg-gradient-to-r from-[#720002] via-[#9E1120] to-[#DB8291] rounded-3xl p-10 md:p-12 text-center shadow-xl">
             <h2 className="font-fredoka text-xl md:text-2xl text-[#F4D6DC] mb-4">
                — ♡ 𖦹  ⊹ ꒰ HUBUNGI KAMI & INFORMASI LEBIH LANJUT ꒱ 📢 🏩
             </h2>
             <p className="text-white/90 text-sm md:text-base font-medium">
               ꪶ  𓇼 . . 🌸 masih ada yang ingin ditanyakan / butuh bantuan ( ? ) 𓈈 we’re always ready to help you! 🎀
             </p>
             <div className="flex justify-center gap-4 mt-8">
               <a href="mailto:tokopeonyrain@gmail.com" className="bg-white text-[#720002] font-extrabold text-sm px-8 py-3.5 rounded-full hover:bg-[#FBEEF1] transition-colors shadow-md">
                 Email Kami
               </a>
               <a href="https://wa.me/6287751126614" target="_blank" rel="noreferrer" className="bg-white/15 border-2 border-white/40 text-white font-bold text-sm px-8 py-3.5 rounded-full hover:bg-white/25 transition-colors">
                 WhatsApp
               </a>
             </div>
           </div>
        </div>
      </section>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-[#9E6B72] w-full pt-32">
        <div className="text-4xl animate-bounce mb-2 text-[#DB8291]"><i className="fa-solid fa-store"></i></div>
        <p className="font-fredoka text-lg text-[#720002]">Memuat Peony Store...</p>
      </div>
    }>
      <HomeInner />
    </Suspense>
  )
}
