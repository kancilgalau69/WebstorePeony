'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import ProductCard from '@/components/ProductCard'
import { useFavorites } from '@/components/FavoritesProvider'
import { Database } from '@/lib/database.types'

type Product = Database['public']['Tables']['products']['Row']

export default function FavoritesPage() {
  const { favorites, count } = useFavorites()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/catalog-products?aktifOnly=true', { cache: 'no-store' })
        const json = await res.json()
        if (!cancelled && res.ok) setProducts((json?.data || []) as Product[])
      } catch {}
      finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const favoriteProducts = useMemo(
    () => products.filter((p) => favorites.includes(p.id)),
    [products, favorites]
  )

  return (
    <div className="max-w-[1160px] mx-auto px-4 py-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title text-2xl md:text-3xl">Favorit Saya</h1>
          <p className="text-xs font-bold text-[#9E6B72] mt-1">
            {count > 0 ? `${count} produk tersimpan` : 'Produk yang Anda sukai akan tersimpan di sini'}
          </p>
        </div>
        <span className="w-11 h-11 rounded-2xl strawberry-gradient text-white flex items-center justify-center text-lg shadow">
          <i className="fa-solid fa-heart"></i>
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="peony-card h-64 animate-pulse">
              <div className="w-full aspect-square rounded-2xl bg-[#F4D6DC]/50" />
            </div>
          ))}
        </div>
      ) : favoriteProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {favoriteProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-3xl border-2 border-[#F4D6DC]">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FBEEF1] border-2 border-[#F4D6DC] flex items-center justify-center text-3xl text-[#DB8291] mb-3">
            <i className="fa-regular fa-heart"></i>
          </div>
          <h3 className="font-fredoka text-xl text-[#720002] mb-1">Belum Ada Favorit</h3>
          <p className="text-xs text-[#9E6B72] mb-4 max-w-xs mx-auto">
            Ketuk ikon hati pada produk untuk menyimpannya ke daftar favorit Anda.
          </p>
          <Link href="/#products" className="btn-card-buy inline-flex max-w-xs mx-auto px-6">
            Jelajahi Produk ✦
          </Link>
        </div>
      )}
    </div>
  )
}
