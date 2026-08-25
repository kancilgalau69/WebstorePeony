'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import { Database } from '@/lib/database.types'
import { useCart } from './CartProvider'
import { resolveWebPrice } from '@/lib/pricing'
import { formatCategoryName } from '@/lib/categories'

type Product = Database['public']['Tables']['products']['Row']

interface ProductCardProps {
  product: Product
  variant?: 'default' | 'compact' | 'horizontal'
  showBadge?: 'discount' | 'hot' | 'new' | 'best' | null
}

export default function ProductCard({ product, variant = 'default', showBadge = null }: ProductCardProps) {
  const { addToCart } = useCart()
  const [imgError, setImgError] = useState(false)
  const Swal = typeof window !== 'undefined' ? (window as any).Swal : null

  const price = resolveWebPrice(product as any)
  const oldPrice = (product as any).harga_lama
  const formattedCategory = formatCategoryName(product.kategori)

  const discountPercent = useMemo(() => {
    if (oldPrice && oldPrice > price) {
      return Math.round(((oldPrice - price) / oldPrice) * 100)
    }
    return 0
  }, [price, oldPrice])

  const soldCount = useMemo(() => {
    let hash = 0
    const id = product.id || ''
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash % 200) + 50
  }, [product.id])

  const rating = useMemo(() => {
    let hash = 0
    const id = (product.id || '') + 'rating'
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i)
      hash |= 0
    }
    return (4.3 + (Math.abs(hash) % 7) * 0.1).toFixed(1)
  }, [product.id])

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(p)
  }

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (product.stok === 0) {
      Swal?.fire({
        icon: 'error',
        title: 'Stok habis',
        text: 'Produk sudah tidak tersedia.',
        confirmButtonColor: '#CB96BA',
        background: '#ffffff',
        color: '#3E2D3B',
        customClass: {
          popup: 'rounded-2xl border border-[#F0E2EB] shadow-xl',
          title: 'text-[#3E2D3B] font-bold font-fredoka',
          htmlContainer: 'text-[#8E7188]',
          confirmButton: 'rounded-xl px-5 py-2.5 font-bold bg-[#CB96BA] text-white shadow-md',
        },
        buttonsStyling: false,
      })
      return
    }

    addToCart(product, 1)

    Swal?.fire({
      icon: 'success',
      title: 'Ditambahkan!',
      text: `${product.nama}`,
      timer: 1500,
      showConfirmButton: false,
      background: '#ffffff',
      color: '#3E2D3B',
      customClass: {
        popup: 'rounded-2xl border border-[#F0E2EB] shadow-xl',
        title: 'text-[#3E2D3B] font-bold font-fredoka',
        htmlContainer: 'text-[#8E7188]',
      },
    })
  }

  // Horizontal variant (for featured horizontal slider)
  if (variant === 'horizontal') {
    return (
      <Link href={`/product/${product.id}`}>
        <div className="peony-card flex-row items-center gap-4 text-left p-4 h-full">
          {/* Icon Box */}
          <div className="w-20 h-20 rounded-2xl bg-[#F7F2F6] border-2 border-[#F0E2EB] p-2 flex items-center justify-center shrink-0">
            {product.ikon && !imgError ? (
              <Image
                src={product.ikon}
                alt={product.nama}
                width={80}
                height={80}
                className="object-contain max-h-full"
                onError={() => setImgError(true)}
                unoptimized
              />
            ) : (
              <i className="fa-solid fa-box-archive text-2xl text-[#CB96BA]"></i>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-extrabold text-[#CB96BA] bg-[#F7F2F6] px-2.5 py-0.5 rounded-full inline-block mb-1">
              {formattedCategory}
            </span>
            <h3 className="font-fredoka text-base text-[#3E2D3B] truncate">{product.nama}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-extrabold text-sm text-[#CB96BA]">{formatPrice(price)}</span>
              {oldPrice && oldPrice > price && (
                <span className="text-xs text-[#8E7188] line-through">{formatPrice(oldPrice)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                product.stok > 0 ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FFE4E6] text-[#BE123C]'
              }`}>
                {product.stok > 0 ? `Ready (${product.stok})` : 'Habis'}
              </span>
              <span className="text-[10px] text-[#8E7188] font-bold">★ {rating} ({soldCount})</span>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  // Default peonyrain.store Card Style
  return (
    <Link href={`/product/${product.id}`}>
      <div className="peony-card relative flex flex-col items-center text-center p-5 h-full group">
        {/* Top Badges */}
        <div className="w-full flex items-center justify-between gap-1 absolute top-3.5 px-3.5 z-10">
          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-[#F7F2F6] text-[#CB96BA] border border-[#F0E2EB] shadow-2xs">
            {formattedCategory}
          </span>
          {discountPercent > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#D9777F] text-white">
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Product Icon Frame */}
        <div className="w-20 h-20 mt-6 mb-3 rounded-2xl bg-[#F7F2F6] border-2 border-[#F0E2EB] p-2.5 flex items-center justify-center shadow-xs transition-transform duration-300 group-hover:scale-105">
          {product.ikon && !imgError ? (
            <Image
              src={product.ikon}
              alt={product.nama}
              width={70}
              height={70}
              className="object-contain max-h-full rounded-xl"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <i className="fa-solid fa-box-archive text-3xl text-[#CB96BA]"></i>
          )}
        </div>

        {/* Title */}
        <h3 className="font-fredoka text-lg text-[#3E2D3B] mb-1 line-clamp-2 leading-tight">
          {product.nama}
        </h3>

        {/* Price Wrap */}
        <div className="flex items-center justify-center gap-1.5 my-1 flex-wrap">
          <span className="font-extrabold text-base text-[#CB96BA]">{formatPrice(price)}</span>
          {discountPercent > 0 && oldPrice && (
            <span className="text-xs text-[#8E7188] line-through">{formatPrice(oldPrice)}</span>
          )}
        </div>

        {/* Stock Badge */}
        <div className="my-1">
          <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${
            product.stok > 0 ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FFE4E6] text-[#BE123C]'
          }`}>
            {product.stok > 0 ? `Ready (${product.stok})` : 'Stok Habis'}
          </span>
        </div>

        {/* Buy Button */}
        <button
          onClick={handleAddToCart}
          disabled={product.stok === 0}
          className={`btn-card-buy mt-3 ${product.stok === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <i className="fa-solid fa-cart-plus text-xs"></i>
          {product.stok === 0 ? 'Stok Habis' : 'Beli Sekarang ✦'}
        </button>
      </div>
    </Link>
  )
}
