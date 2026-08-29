'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import { Database } from '@/lib/database.types'
import { useCart } from './CartProvider'
import { useFavorites } from './FavoritesProvider'
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
  const { isFavorite, toggleFavorite } = useFavorites()
  const [imgError, setImgError] = useState(false)
  const fav = isFavorite(product.id)

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleFavorite(product.id)
  }
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
        confirmButtonColor: '#DB8291',
        background: '#ffffff',
        color: '#720002',
        customClass: {
          popup: 'rounded-2xl border border-[#F4D6DC] shadow-xl',
          title: 'text-[#720002] font-bold font-fredoka',
          htmlContainer: 'text-[#9E6B72]',
          confirmButton: 'rounded-xl px-5 py-2.5 font-bold bg-[#DB8291] text-white shadow-md',
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
      color: '#720002',
      customClass: {
        popup: 'rounded-2xl border border-[#F4D6DC] shadow-xl',
        title: 'text-[#720002] font-bold font-fredoka',
        htmlContainer: 'text-[#9E6B72]',
      },
    })
  }

  // Horizontal variant (for featured horizontal slider)
  if (variant === 'horizontal') {
    return (
      <Link href={`/product/${product.id}`}>
        <div className="peony-card flex-row items-center gap-4 text-left p-4 h-full">
          {/* Icon Box */}
          <div className="w-20 h-20 rounded-2xl bg-[#FBEEF1] border-2 border-[#F4D6DC] p-2 flex items-center justify-center shrink-0">
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
              <i className="fa-solid fa-box-archive text-2xl text-[#DB8291]"></i>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-extrabold text-[#DB8291] bg-[#FBEEF1] px-2.5 py-0.5 rounded-full inline-block mb-1">
              {formattedCategory}
            </span>
            <h3 className="font-fredoka text-base text-[#720002] truncate">{product.nama}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-extrabold text-sm text-[#DB8291]">{formatPrice(price)}</span>
              {oldPrice && oldPrice > price && (
                <span className="text-xs text-[#9E6B72] line-through">{formatPrice(oldPrice)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                product.stok > 0 ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FFE4E6] text-[#BE123C]'
              }`}>
                {product.stok > 0 ? `Ready (${product.stok})` : 'Habis'}
              </span>
              <span className="text-[10px] text-[#9E6B72] font-bold">★ {rating} ({soldCount})</span>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  // Default marketplace card style
  return (
    <Link href={`/product/${product.id}`}>
      <div className="peony-card !p-0 overflow-hidden flex flex-col items-stretch text-left h-full group">
        {/* Media / thumbnail area */}
        <div className="relative w-full aspect-square bg-gradient-to-br from-[#FBEEF1] to-[#F4D6DC] flex items-center justify-center overflow-hidden">
          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-white/90 text-[#DB8291] border border-[#F4D6DC] shadow-sm backdrop-blur-sm">
              {formattedCategory}
            </span>
            {discountPercent > 0 && (
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-[#C81E3A] text-white shadow-sm">
                -{discountPercent}%
              </span>
            )}
          </div>

          {product.ikon && !imgError ? (
            <Image
              src={product.ikon}
              alt={product.nama}
              width={200}
              height={200}
              className="object-contain w-3/4 h-3/4 rounded-xl transition-transform duration-500 group-hover:scale-110"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <i className="fa-solid fa-box-archive text-5xl text-[#DB8291]/60"></i>
          )}

          {product.stok === 0 && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
              <span className="px-3 py-1.5 rounded-full bg-[#720002] text-white text-xs font-extrabold">Stok Habis</span>
            </div>
          )}

          {/* Favorite toggle */}
          <button
            onClick={handleToggleFavorite}
            aria-label={fav ? 'Hapus dari favorit' : 'Tambah ke favorit'}
            className="absolute bottom-2.5 right-2.5 z-20 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-[#F4D6DC] shadow-sm flex items-center justify-center hover:scale-110 transition-transform"
          >
            <i className={`${fav ? 'fa-solid text-[#DB8291]' : 'fa-regular text-[#9E6B72]'} fa-heart text-sm`}></i>
          </button>
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1 p-3.5">
          <h3 className="font-bold text-sm text-[#720002] line-clamp-2 leading-snug min-h-[2.4em]">
            {product.nama}
          </h3>

          {/* Rating + sold */}
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#9E6B72] font-bold">
            <span className="text-[#F5A623]"><i className="fa-solid fa-star"></i></span>
            <span className="text-[#720002]">{rating}</span>
            <span className="text-[#E7A6B1]">•</span>
            <span>{soldCount} terjual</span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-1.5 mt-2 flex-wrap">
            <span className="font-fredoka text-lg text-[#DB8291]">{formatPrice(price)}</span>
            {discountPercent > 0 && oldPrice && (
              <span className="text-[11px] text-[#9E6B72] line-through">{formatPrice(oldPrice)}</span>
            )}
          </div>

          {/* Stock hint */}
          <div className="mt-1.5">
            <span className={`text-[10px] font-extrabold ${product.stok > 0 ? 'text-[#2E7D5B]' : 'text-[#C81E3A]'}`}>
              {product.stok > 0 ? `${product.stok} stok tersedia` : 'Tidak tersedia'}
            </span>
          </div>

          {/* Buy Button */}
          <button
            onClick={handleAddToCart}
            disabled={product.stok === 0}
            className={`btn-card-buy mt-3 ${product.stok === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <i className="fa-solid fa-cart-plus text-xs"></i>
            {product.stok === 0 ? 'Habis' : 'Beli'}
          </button>
        </div>
      </div>
    </Link>
  )
}
