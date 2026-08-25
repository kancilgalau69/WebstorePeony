'use client'

import Link from 'next/link'
import { useCart } from './CartProvider'
import { useAuth } from './AuthProvider'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Database } from '@/lib/database.types'
import { resolveWebPrice } from '@/lib/pricing'

type Product = Database['public']['Tables']['products']['Row']

export default function Header() {
  const { itemCount } = useCart()
  const { user } = useAuth()
  const pathname = usePathname()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close search when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search products
  useEffect(() => {
    async function searchProducts() {
      if (searchQuery.trim().length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const res = await fetch(`/api/catalog-products?aktifOnly=true&limit=8&q=${encodeURIComponent(searchQuery)}`, {
          cache: 'no-store',
        })
        const json = await res.json()
        if (res.ok) {
          setSearchResults((json?.data || []) as Product[])
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  const handleSearchClick = () => {
    setIsSearchOpen(!isSearchOpen)
    if (!isSearchOpen) {
      setTimeout(() => document.getElementById('search-input')?.focus(), 100)
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return 'Hubungi Admin'
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price)
  }

  return (
    <header className="w-full">
      {/* ── Top Hero Header (peonyrain.store style) ── */}
      <div className="peony-header w-full grid grid-cols-1 md:grid-cols-[1fr_auto] items-stretch">
        <div className="px-6 py-8 md:px-12 md:py-10 flex flex-col justify-center gap-2 z-10">
          <span className="font-jetbrains text-[11px] tracking-[3px] text-white/90 uppercase font-semibold">
            ✦ TRUSTED DIGITAL PRODUCTS STORE
          </span>
          
          <div className="flex items-center gap-4 my-1">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/25 border-2 border-white/50 shadow-lg flex items-center justify-center text-3xl shrink-0 backdrop-blur-sm">
              🌸
            </div>
            <div className="flex flex-col leading-tight">
              <h1 className="font-fredoka text-3xl md:text-5xl text-white drop-shadow-md">
                Rain <em className="not-italic text-[#D0DDC4]">Store</em>
              </h1>
              <p className="text-xs md:text-sm text-white/95 font-jakarta font-medium mt-1 max-w-xl line-clamp-2">
                ⊹ &nbsp;♡ྀི &nbsp;<b>Store</b>⠀𓉳 &nbsp;❤️︎ &nbsp;⊹ ⎯⎯⎯ &nbsp;🎀🪞 Laman terpercaya dengan produk digital berkualitas premium 🕯️🌸 Menyajikan pelayanan bintang lima ✿
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-2 flex-wrap">
            <div className="flex flex-col">
              <span className="font-fredoka text-lg md:text-xl text-[#D0DDC4] drop-shadow-sm">12+</span>
              <span className="text-[10px] text-white/80 uppercase font-bold tracking-wider">Produk Ready</span>
            </div>
            <div className="flex flex-col">
              <span className="font-fredoka text-lg md:text-xl text-[#D0DDC4] drop-shadow-sm">100%</span>
              <span className="text-[10px] text-white/80 uppercase font-bold tracking-wider">Terpercaya</span>
            </div>
            <div className="flex flex-col">
              <span className="font-fredoka text-lg md:text-xl text-[#D0DDC4] drop-shadow-sm">Fast</span>
              <span className="text-[10px] text-white/80 uppercase font-bold tracking-wider">Response</span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex w-36 bg-white/20 items-center justify-center border-l border-white/20 backdrop-blur-md">
          <span className="font-jetbrains text-xs tracking-[3px] text-white/80 uppercase font-semibold [writing-mode:vertical-rl] rotate-180">
            Rain Store · Digital Products · 2026
          </span>
        </div>
      </div>

      {/* ── Sticky Glassmorphism Navigation Bar ── */}
      <nav className="sticky top-0 z-40 glass-peony shadow-md px-4 md:px-8">
        <div className="max-w-[1160px] mx-auto flex items-center justify-between h-14 md:h-16 gap-2">
          
          {/* Left Nav Tabs */}
          <div className="flex items-center gap-1 md:gap-2 overflow-x-auto scrollbar-none py-1">
            <Link
              href="/"
              className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                pathname === '/'
                  ? 'text-[#CB96BA] border-b-2 border-[#CB96BA]'
                  : 'text-[#8E7188] hover:text-[#CB96BA]'
              }`}
            >
              <i className="fa-solid fa-store text-xs"></i> Shop
            </Link>

            <Link
              href="/favorites"
              className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                pathname === '/favorites'
                  ? 'text-[#CB96BA] border-b-2 border-[#CB96BA]'
                  : 'text-[#8E7188] hover:text-[#CB96BA]'
              }`}
            >
              <i className="fa-solid fa-heart text-xs"></i> Favorit
            </Link>

            <Link
              href="/orders"
              className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                pathname === '/orders'
                  ? 'text-[#CB96BA] border-b-2 border-[#CB96BA]'
                  : 'text-[#8E7188] hover:text-[#CB96BA]'
              }`}
            >
              <i className="fa-solid fa-receipt text-xs"></i> Riwayat
            </Link>

            {process.env.NEXT_PUBLIC_BLOG_URL && (
              <a
                href={process.env.NEXT_PUBLIC_BLOG_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl text-xs md:text-sm font-extrabold text-[#8E7188] hover:text-[#CB96BA] transition-all flex items-center gap-1.5 whitespace-nowrap"
              >
                <i className="fa-solid fa-newspaper text-xs"></i> Blog
              </a>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 shrink-0" ref={searchRef}>
            {/* Search (mobile toggle) */}
            <button
              onClick={handleSearchClick}
              className="md:hidden p-2 rounded-xl text-[#8E7188] hover:text-[#CB96BA] transition-all"
              aria-label="Cari Produk"
            >
              <i className="fa-solid fa-magnifying-glass text-base"></i>
            </button>

            {/* User Profile / Login */}
            {user ? (
              <Link
                href="/profile"
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  pathname === '/profile'
                    ? 'text-[#CB96BA] bg-[#F7F2F6]'
                    : 'text-[#8E7188] hover:text-[#CB96BA] hover:bg-[#F7F2F6]'
                }`}
              >
                <span className="w-6 h-6 bg-gradient-to-br from-[#CB96BA] to-[#B0B3D6] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                  {user.nama.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[80px] truncate">{user.nama.split(' ')[0]}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#CB96BA] bg-[#F7F2F6] hover:bg-[#F0E2EB] transition-all"
              >
                <i className="fa-solid fa-right-to-bracket text-xs"></i> Masuk
              </Link>
            )}

            {/* Cart Button with Pink Counter Badge */}
            <Link
              href="/cart"
              className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-[#F0E2EB] bg-white text-[#3E2D3B] font-extrabold text-xs shadow-sm hover:border-[#CB96BA] transition-all"
            >
              <i className="fa-solid fa-cart-shopping text-[#CB96BA]"></i>
              <span className="hidden sm:inline">Keranjang</span>
              <span className="nav-badge bg-[#CB96BA] text-white rounded-full px-2 py-0.5 text-[10px] font-black">
                {itemCount}
              </span>
            </Link>
          </div>
        </div>

        {/* Search Input Bar Dropdown */}
        {isSearchOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-[#F0E2EB] shadow-2xl z-50 animate-fadeIn p-4">
            <div className="max-w-[600px] mx-auto relative">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-[#8E7188] text-sm"></i>
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari aplikasi premium..."
                className="w-full pl-11 pr-10 py-3 rounded-2xl bg-[#F7F2F6] border-2 border-[#F0E2EB] focus:border-[#CB96BA] outline-none text-sm font-bold text-[#3E2D3B]"
                autoFocus
              />
              <button
                onClick={() => { setIsSearchOpen(false); setSearchQuery(''); setSearchResults([]) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E7188] hover:text-[#3E2D3B]"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Results Dropdown */}
            {searchQuery.trim().length >= 2 && (
              <div className="max-w-[600px] mx-auto mt-2 bg-white rounded-2xl border border-[#F0E2EB] max-h-72 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-[#8E7188]">Mencari...</div>
                ) : searchResults.length > 0 ? (
                  <div className="divide-y divide-[#F0E2EB]">
                    {searchResults.map((product) => (
                      <Link
                        key={product.id}
                        href={`/?search=${encodeURIComponent(searchQuery)}#products`}
                        onClick={() => {
                          setIsSearchOpen(false)
                          setTimeout(() => {
                            const productsSection = document.getElementById('products')
                            if (productsSection) {
                              productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }
                          }, 100)
                        }}
                        className="flex items-center justify-between p-3 hover:bg-[#F7F2F6] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#F0E2EB] flex items-center justify-center text-[#CB96BA]">
                            <i className="fa-solid fa-box-archive text-xs"></i>
                          </div>
                          <div>
                            <h4 className="font-fredoka text-sm text-[#3E2D3B]">{product.nama}</h4>
                            <span className="text-xs font-bold text-[#CB96BA]">
                              {formatPrice(resolveWebPrice(product as any))}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          product.stok > 0 ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FFE4E6] text-[#BE123C]'
                        }`}>
                          {product.stok > 0 ? `Stok ${product.stok}` : 'Habis'}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-[#8E7188]">Produk tidak ditemukan</div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
