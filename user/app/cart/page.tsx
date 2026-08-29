'use client'

import { useCart } from '@/components/CartProvider'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { resolveWebPrice } from '@/lib/pricing'

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, total } = useCart()
  const router = useRouter()
  const getItemPrice = (product: any) => resolveWebPrice(product)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  if (items.length === 0) {
    return (
      <div className="py-12 animate-fadeIn text-center">
        <div className="max-w-md mx-auto bg-white rounded-3xl border-2 border-[#F4D6DC] p-8 shadow-xs">
          <div className="text-5xl text-[#DB8291] mb-3">🌸</div>
          <h2 className="font-fredoka text-2xl text-[#720002] mb-2">Keranjang Kosong</h2>
          <p className="text-xs text-[#9E6B72] mb-6">
            Belum ada produk aplikasi premium di keranjang Anda.
          </p>
          <Link
            href="/"
            className="btn-card-buy max-w-xs mx-auto text-xs"
          >
            Mulai Belanja ✦
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1160px] mx-auto px-4 space-y-6 animate-fadeIn py-4">
      <div className="flex items-center justify-between">
        <h1 className="font-fredoka text-3xl text-[#720002]">Keranjang Belanja</h1>
        <span className="text-xs font-extrabold text-[#E7A6B1]">{items.length} Item</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={item.product.id}
              className="bg-white rounded-2xl border-2 border-[#F4D6DC] p-4 flex flex-col sm:flex-row gap-4 shadow-xs"
            >
              {/* Product Icon */}
              <div className="w-20 h-20 rounded-2xl bg-[#FBEEF1] border-2 border-[#F4D6DC] p-2 flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                {item.product.ikon ? (
                  <Image
                    src={item.product.ikon}
                    alt={item.product.nama}
                    width={80}
                    height={80}
                    className="object-contain max-h-full rounded-xl"
                    unoptimized
                  />
                ) : (
                  <i className="fa-solid fa-box-archive text-3xl text-[#DB8291]"></i>
                )}
              </div>

              {/* Info & Quantity */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <Link
                    href={`/product/${item.product.id}`}
                    className="font-fredoka text-lg text-[#720002] hover:text-[#DB8291] transition-colors"
                  >
                    {item.product.nama}
                  </Link>
                  {item.product.kategori && (
                    <span className="text-[10px] font-extrabold text-[#DB8291] bg-[#FBEEF1] px-2 py-0.5 rounded-full inline-block mt-1">
                      {item.product.kategori}
                    </span>
                  )}
                  <p className="font-extrabold text-sm text-[#DB8291] mt-1">
                    {formatPrice(getItemPrice(item.product))}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-xl border-2 border-[#F4D6DC] text-[#720002] font-extrabold hover:border-[#DB8291] flex items-center justify-center text-xs"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-extrabold text-xs text-[#720002]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stok}
                      className="w-8 h-8 rounded-xl border-2 border-[#F4D6DC] text-[#720002] font-extrabold hover:border-[#DB8291] flex items-center justify-center text-xs disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-fredoka text-base text-[#720002]">
                      {formatPrice(getItemPrice(item.product) * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-[#D9777F] hover:text-red-700 text-xs font-extrabold"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary Box */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-6 sticky top-20 shadow-xs space-y-4">
            <h2 className="font-fredoka text-xl text-[#720002]">Ringkasan Belanja</h2>
            
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.product.id} className="flex justify-between text-xs font-bold text-[#9E6B72]">
                  <span className="truncate max-w-[180px]">{item.product.nama} (x{item.quantity})</span>
                  <span className="text-[#720002]">{formatPrice(getItemPrice(item.product) * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-[#F4D6DC] pt-4">
              <div className="flex justify-between font-fredoka text-xl">
                <span className="text-[#720002]">Total</span>
                <span className="text-[#DB8291]">{formatPrice(total)}</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/checkout')}
              className="btn-card-buy w-full text-xs py-3"
            >
              Lanjut Pembayaran ✦
            </button>

            <Link
              href="/"
              className="block text-center text-xs font-extrabold text-[#DB8291] hover:underline"
            >
              ← Lanjut Belanja
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
