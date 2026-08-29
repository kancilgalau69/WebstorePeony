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
    <header className="w-full pt-4 md:pt-6 px-4 z-50 fixed top-0 left-0 right-0">
      {/* ── Floating Pill Navigation Bar ── */}
      <nav className="max-w-[900px] mx-auto bg-white/90 backdrop-blur-md border border-[#F4D6DC] shadow-sm rounded-full px-4 md:px-6 py-2.5 flex items-center justify-between">
        {/* Brand logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-fredoka text-xl text-[#720002]">
            Peony<span className="text-[#DB8291]">Store</span>
          </span>
        </Link>

        {/* Center Nav Links (Hidden on small mobile) */}
        <div className="hidden md:flex items-center gap-2 lg:gap-6">
          <Link
            href="/"
            className={`text-sm font-bold transition-all px-3 py-1.5 rounded-full ${
              pathname === '/' ? 'text-[#720002] bg-[#FBEEF1]' : 'text-[#9E6B72] hover:text-[#DB8291] hover:bg-[#FBEEF1]'
            }`}
          >
            Beranda
          </Link>
          <a
            href="/#products"
            className={`text-sm font-bold transition-all px-3 py-1.5 rounded-full text-[#9E6B72] hover:text-[#DB8291] hover:bg-[#FBEEF1]`}
          >
            Produk
          </a>
          <a
            href="/#tentang"
            className={`text-sm font-bold transition-all px-3 py-1.5 rounded-full text-[#9E6B72] hover:text-[#DB8291] hover:bg-[#FBEEF1]`}
          >
            Tentang
          </a>
          <Link
            href="/orders"
            className={`text-sm font-bold transition-all px-3 py-1.5 rounded-full ${
              pathname === '/orders' ? 'text-[#720002] bg-[#FBEEF1]' : 'text-[#9E6B72] hover:text-[#DB8291] hover:bg-[#FBEEF1]'
            }`}
          >
            Riwayat
          </Link>
          <Link
            href="/deposit"
            className={`text-sm font-bold transition-all px-3 py-1.5 rounded-full ${
              pathname === '/deposit' ? 'text-[#720002] bg-[#FBEEF1]' : 'text-[#9E6B72] hover:text-[#DB8291] hover:bg-[#FBEEF1]'
            }`}
          >
            Saldo
          </Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0" ref={searchRef}>
          <button
            onClick={handleSearchClick}
            className="p-2 rounded-full text-[#9E6B72] hover:text-[#DB8291] transition-all"
            aria-label="Cari Produk"
          >
            <i className="fa-solid fa-magnifying-glass text-[15px]"></i>
          </button>
          
          <Link
            href="/cart"
            className="relative p-2 rounded-full text-[#9E6B72] hover:text-[#DB8291] transition-all mr-1"
          >
            <i className="fa-solid fa-cart-shopping text-[15px]"></i>
            {itemCount > 0 && (
              <span className="absolute top-0 right-0 bg-[#DB8291] text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black transform translate-x-1/4 -translate-y-1/4 border-2 border-white">
                {itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <Link
              href="/profile"
              className="strawberry-gradient text-white px-5 py-2 rounded-full text-sm font-bold shadow-md shadow-[#DB8291]/30 hover:-translate-y-0.5 transition-transform"
            >
              Profil
            </Link>
          ) : (
            <Link
              href="/login"
              className="strawberry-gradient text-white px-5 py-2 rounded-full text-sm font-bold shadow-md shadow-[#DB8291]/30 hover:-translate-y-0.5 transition-transform"
            >
              Masuk
            </Link>
          )}
        </div>
      </nav>

        {/* Search Input Bar Dropdown */}
        {isSearchOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-[#F4D6DC] shadow-2xl z-50 animate-fadeIn p-4">
            <div className="max-w-[600px] mx-auto relative">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-[#9E6B72] text-sm"></i>
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari aplikasi premium..."
                className="w-full pl-11 pr-10 py-3 rounded-2xl bg-[#FBEEF1] border-2 border-[#F4D6DC] focus:border-[#DB8291] outline-none text-sm font-bold text-[#720002]"
                autoFocus
              />
              <button
                onClick={() => { setIsSearchOpen(false); setSearchQuery(''); setSearchResults([]) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9E6B72] hover:text-[#720002]"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Results Dropdown */}
            {searchQuery.trim().length >= 2 && (
              <div className="max-w-[600px] mx-auto mt-2 bg-white rounded-2xl border border-[#F4D6DC] max-h-72 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-[#9E6B72]">Mencari...</div>
                ) : searchResults.length > 0 ? (
                  <div className="divide-y divide-[#F4D6DC]">
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
                        className="flex items-center justify-between p-3 hover:bg-[#FBEEF1] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#F4D6DC] flex items-center justify-center text-[#DB8291]">
                            <i className="fa-solid fa-box-archive text-xs"></i>
                          </div>
                          <div>
                            <h4 className="font-fredoka text-sm text-[#720002]">{product.nama}</h4>
                            <span className="text-xs font-bold text-[#DB8291]">
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
                  <div className="p-4 text-center text-xs text-[#9E6B72]">Produk tidak ditemukan</div>
                )}
              </div>
            )}
          </div>
        )}
    </header>
  )
}
