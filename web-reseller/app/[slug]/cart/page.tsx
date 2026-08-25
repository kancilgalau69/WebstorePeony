"use client";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { useStore } from "@/components/StoreProvider";
import Link from "next/link";

export default function CartPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart();
  const { store } = useStore();

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-50 rounded-full flex items-center justify-center">
            <i className="fa-solid fa-cart-shopping text-4xl text-gray-300"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Keranjang Kosong</h2>
          <p className="text-gray-500 mb-8">Belum ada produk di keranjang Anda</p>
          <Link
            href={`/${slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <i className="fa-solid fa-store"></i>
            Belanja Sekarang
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Keranjang Belanja</h1>
        <p className="text-gray-600">{totalItems} item dalam keranjang</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {items.map((item, index) => (
              <div key={item.id}>
                <div className="p-6 flex items-start gap-4">
                  {/* Product Image */}
                  <div className="w-20 h-20 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                    {item.ikon ? (
                      <img 
                        src={item.ikon} 
                        alt={item.nama} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="fa-solid fa-box text-2xl text-gray-300"></i>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">{item.nama}</h3>
                    <p className="text-sm text-gray-500 mb-3">Kode: {item.kode}</p>
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-bold text-blue-600">
                        Rp {item.harga.toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex flex-col items-end gap-3">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Hapus item"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 text-gray-600 transition-colors"
                        disabled={item.quantity <= 1}
                      >
                        <i className="fa-solid fa-minus text-sm"></i>
                      </button>
                      <span className="w-12 text-center font-semibold text-gray-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 text-gray-600 transition-colors"
                      >
                        <i className="fa-solid fa-plus text-sm"></i>
                      </button>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      Rp {(item.harga * item.quantity).toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>
                {index < items.length - 1 && <div className="border-t border-gray-100"></div>}
              </div>
            ))}
          </div>

          {/* Clear Cart Button */}
          <button 
            onClick={clearCart} 
            className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-2"
          >
            <i className="fa-solid fa-trash"></i>
            Kosongkan Keranjang
          </button>

          {/* Continue Shopping */}
          <Link
            href={`/${slug}`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <i className="fa-solid fa-arrow-left"></i>
            Lanjut Belanja
          </Link>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-24">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Ringkasan Pesanan</h3>
            
            {/* Items Summary */}
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate mr-2">
                    {item.nama} <span className="text-gray-400">x{item.quantity}</span>
                  </span>
                  <span className="font-medium text-gray-900 whitespace-nowrap">
                    Rp {(item.harga * item.quantity).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">
                  Rp {totalPrice.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-600">Biaya Admin</span>
                <span className="font-medium text-green-600">Gratis</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-blue-600">
                  Rp {totalPrice.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={() => router.push(`/${slug}/checkout`)}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-lock"></i>
              Lanjut ke Checkout
            </button>

            {/* Security Info */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2 text-xs text-blue-900">
                <i className="fa-solid fa-shield-halved text-blue-600 mt-0.5"></i>
                <span>Pembayaran aman via QRIS. Produk dikirim otomatis setelah pembayaran berhasil.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
