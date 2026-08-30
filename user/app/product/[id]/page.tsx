'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/components/CartProvider'
import { Database } from '@/lib/database.types'
import { resolveWebPrice } from '@/lib/pricing'
import { formatCategoryName } from '@/lib/categories'
import ProductCard from '@/components/ProductCard'

type Product = Database['public']['Tables']['products']['Row']

export default function ProductDetail() {
  const params = useParams()
  const router = useRouter()
  const { addToCart } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [imgError, setImgError] = useState(false)
  const getProductPrice = (p: Product) => resolveWebPrice(p as any)

  useEffect(() => {
    fetchProduct()
  }, [params.id])

  async function fetchProduct() {
    try {
      setLoading(true)
      const [productRes, allRes] = await Promise.all([
        fetch(`/api/catalog-products?id=${encodeURIComponent(String(params.id || ''))}&aktifOnly=false`, { cache: 'no-store' }),
        fetch('/api/catalog-products?aktifOnly=true', { cache: 'no-store' }),
      ])

      const productJson = await productRes.json()
      const allJson = await allRes.json()

      if (!productRes.ok) throw new Error(productJson?.error || 'Failed to fetch product')

      const first = Array.isArray(productJson?.data) ? productJson.data[0] : null
      setProduct(first || null)
      setAllProducts(Array.isArray(allJson?.data) ? allJson.data : [])
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const discountPercent = useMemo(() => {
    if (!product) return 0
    const oldPrice = (product as any).harga_lama
    const price = getProductPrice(product)
    if (oldPrice && oldPrice > price) {
      return Math.round(((oldPrice - price) / oldPrice) * 100)
    }
    return 0
  }, [product])

  const recommendations = useMemo(() => {
    if (!product || allProducts.length === 0) return []
    return allProducts
      .filter(p => p.id !== product.id && p.stok > 0)
      .filter(p => p.kategori === product.kategori || !product.kategori)
      .slice(0, 8)
      .concat(
        allProducts
          .filter(p => p.id !== product.id && p.stok > 0 && p.kategori !== product.kategori)
          .slice(0, 4)
      )
      .slice(0, 8)
  }, [product, allProducts])

  const handleAddToCart = () => {
    if (!product) return
    const Swal = typeof window !== 'undefined' ? (window as any).Swal : null

    addToCart(product, quantity)
    setQuantity(1)

    Swal?.fire({
      icon: 'success',
      title: 'Ditambahkan!',
      text: `${quantity}x ${product.nama}`,
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

  const handleBuyNow = () => {
    if (product) {
      addToCart(product, quantity)
      router.push('/cart')
    }
  }

  const handleShare = async () => {
    if (!product) return
    const url = window.location.origin + window.location.pathname
    const text = `${product.nama} - ${formatPrice(getProductPrice(product))}`

    if (navigator.share) {
      try {
        await navigator.share({ title: product.nama, text, url })
      } catch (err: any) {
        if (err.name !== 'AbortError') copyToClipboard(url)
      }
    } else {
      copyToClipboard(url)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    const Swal = typeof window !== 'undefined' ? (window as any).Swal : null
    Swal?.fire({
      icon: 'success',
      title: 'Link Disalin!',
      text: 'Link produk berhasil disalin ke clipboard',
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

  const rating = useMemo(() => {
    if (!product) return '4.8'
    let hash = 0
    const id = (product.id || '') + 'rating'
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i)
      hash |= 0
    }
    return (4.3 + (Math.abs(hash) % 7) * 0.1).toFixed(1)
  }, [product])

  const soldCount = useMemo(() => {
    if (!product) return 0
    let hash = 0
    const id = product.id || ''
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash % 200) + 50
  }, [product])

  if (loading) {
    return (
      <div className="py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-4 bg-gray-200 rounded w-48"></div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl h-96 border-2 border-[#F4D6DC]"></div>
            <div className="bg-white rounded-3xl p-6 border-2 border-[#F4D6DC] space-y-4">
              <div className="h-6 bg-gray-200 rounded w-24"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-10 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="py-16 text-center">
        <div className="bg-white rounded-3xl p-10 border-2 border-[#F4D6DC] max-w-md mx-auto shadow-sm">
          <div className="text-5xl text-[#DB8291] mb-3">🌸</div>
          <h1 className="font-fredoka text-2xl text-[#720002] mb-2">Produk Tidak Ditemukan</h1>
          <p className="text-[#9E6B72] text-xs mb-6">Produk mungkin sudah tidak tersedia atau link salah.</p>
          <button
            onClick={() => router.push('/')}
            className="btn-card-buy max-w-xs mx-auto"
          >
            Kembali ke Shop ✦
          </button>
        </div>
      </div>
    )
  }

  const price = getProductPrice(product)
  const oldPrice = (product as any).harga_lama
  const formattedCategory = formatCategoryName(product.kategori)

  return (
    <div className="max-w-[1160px] mx-auto px-4 space-y-6 animate-fadeIn py-2">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-bold text-[#9E6B72] overflow-x-auto scrollbar-none">
        <Link href="/" className="hover:text-[#DB8291] transition-colors whitespace-nowrap">
          <i className="fa-solid fa-house mr-1"></i> Shop
        </Link>
        {formattedCategory && (
          <>
            <i className="fa-solid fa-chevron-right text-[9px] text-[#E7A6B1]"></i>
            <Link href={`/?category=${formattedCategory}`} className="hover:text-[#DB8291] transition-colors whitespace-nowrap">
              {formattedCategory}
            </Link>
          </>
        )}
        <i className="fa-solid fa-chevron-right text-[9px] text-[#E7A6B1]"></i>
        <span className="text-[#720002] truncate">{product.nama}</span>
      </nav>

      {/* Product Detail Main Card */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Product Image Frame */}
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-8 flex items-center justify-center relative shadow-xs">
          <div className="w-full max-w-[280px] aspect-square rounded-2xl bg-[#FBEEF1] border-2 border-[#F4D6DC] p-4 flex items-center justify-center">
            {product.ikon && !imgError ? (
              <Image
                src={product.ikon}
                alt={product.nama}
                width={300}
                height={300}
                className="object-contain max-h-full rounded-xl"
                onError={() => setImgError(true)}
                unoptimized
              />
            ) : (
              <i className="fa-solid fa-box-archive text-8xl text-[#DB8291]"></i>
            )}
          </div>

          <div className="absolute top-4 left-4 flex flex-col gap-1.5">
            {discountPercent > 0 && (
              <span className="px-3 py-1 rounded-full bg-[#D9777F] text-white font-black text-xs shadow-xs">
                -{discountPercent}%
              </span>
            )}
            <span className={`px-3 py-1 rounded-full font-extrabold text-xs shadow-xs ${
              product.stok > 0 ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FFE4E6] text-[#BE123C]'
            }`}>
              {product.stok > 0 ? `Ready (${product.stok})` : 'Habis'}
            </span>
          </div>

          <button
            onClick={() => handleShare()}
            className="absolute top-4 right-4 w-10 h-10 rounded-2xl bg-[#FBEEF1] border border-[#F4D6DC] flex items-center justify-center text-[#9E6B72] hover:text-[#DB8291] transition-all"
            title="Bagikan produk"
          >
            <i className="fa-solid fa-share-nodes"></i>
          </button>
        </div>

        {/* Product Info */}
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-6 flex flex-col justify-between shadow-xs">
          <div>
            {formattedCategory && (
              <span className="inline-block px-3 py-1 rounded-full bg-[#FBEEF1] text-[#DB8291] font-extrabold text-xs mb-2">
                {formattedCategory}
              </span>
            )}

            <h1 className="font-fredoka text-2xl md:text-3xl text-[#720002] leading-tight mb-2">
              {product.nama}
            </h1>

            <div className="flex items-center gap-3 mb-4 text-xs font-bold text-[#9E6B72]">
              <span className="text-[#DB8291]">★ {rating}</span>
              <span>|</span>
              <span>{soldCount} Terjual</span>
            </div>

            {/* Price Frame */}
            <div className="bg-gradient-to-r from-[#FBEEF1] to-[#F4D6DC] rounded-2xl p-4 border border-[#F4D6DC] mb-4">
              {discountPercent > 0 && oldPrice && (
                <span className="text-xs text-[#9E6B72] line-through block mb-0.5">
                  {formatPrice(oldPrice)}
                </span>
              )}
              <span className="font-fredoka text-3xl text-[#DB8291]">
                {formatPrice(price)}
              </span>
            </div>

            {/* Description */}
            {product.deskripsi && (
              <div className="mb-5">
                <h3 className="font-extrabold text-xs text-[#720002] uppercase tracking-wider mb-2">
                  Deskripsi Produk
                </h3>
                <ul className="space-y-1.5 text-xs text-[#8A3A44]">
                  {product.deskripsi
                    .split(/\|\||,/)
                    .map(item => item.trim())
                    .filter(item => item.length > 0)
                    .map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-[#DB8291] font-bold">🌸</span>
                        <span>{item}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Quantity Selector */}
            {product.stok > 0 && (
              <div className="mb-5">
                <label className="block font-extrabold text-xs text-[#720002] uppercase tracking-wider mb-2">Jumlah</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 rounded-xl border-2 border-[#F4D6DC] text-[#720002] font-extrabold hover:border-[#DB8291] flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={product.stok}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(product.stok, parseInt(e.target.value) || 1)))}
                    className="w-16 h-9 text-center border-2 border-[#F4D6DC] rounded-xl font-extrabold text-sm outline-none text-[#720002]"
                  />
                  <button
                    onClick={() => setQuantity(Math.min(product.stok, quantity + 1))}
                    className="w-9 h-9 rounded-xl border-2 border-[#F4D6DC] text-[#720002] font-extrabold hover:border-[#DB8291] flex items-center justify-center"
                  >
                    +
                  </button>
                  <span className="text-xs text-[#9E6B72] font-extrabold">Stok maks: {product.stok}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="space-y-2 mt-4">
            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={product.stok === 0}
                className="flex-1 py-3 px-4 rounded-xl border-2 border-[#DB8291] text-[#DB8291] font-extrabold text-xs hover:bg-[#FBEEF1] transition-all flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-cart-plus"></i> + Keranjang
              </button>
              <button
                onClick={handleBuyNow}
                disabled={product.stok === 0}
                className="flex-1 btn-card-buy py-3 text-xs"
              >
                <i className="fa-solid fa-bolt"></i> Beli Sekarang ✦
              </button>
            </div>

            <button
              onClick={() => handleShare()}
              className="w-full py-2.5 px-4 rounded-xl border border-[#F4D6DC] bg-[#FBEEF1] text-[#9E6B72] font-extrabold text-xs hover:text-[#DB8291] transition-all flex items-center justify-center gap-1.5"
            >
              <i className="fa-solid fa-share-nodes"></i> Bagikan Produk
            </button>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section className="pt-6">
          <h2 className="font-fredoka text-2xl text-[#720002] mb-4">Rekomendasi Lainnya</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {recommendations.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
