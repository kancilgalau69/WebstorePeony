"use client";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useCart } from "./CartProvider";
import { useStore } from "./StoreProvider";

interface Product {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  harga_jual: number;
  stok: number;
  ikon: string;
  deskripsi: string;
}

interface ProductCardProps {
  product: Product;
  storeSlug: string;
  showBadge?: 'hot' | 'new' | 'best' | null;
}

export default function ProductCard({ product, storeSlug, showBadge = null }: ProductCardProps) {
  const { addItem } = useCart();
  const { store } = useStore();
  const [added, setAdded] = useState(false);
  const inStock = product.stok > 0;
  const themeColor = store?.warna_tema || "#6c5ce7";

  // Generate pseudo-random sold count based on product id
  const soldCount = useMemo(() => {
    let hash = 0;
    const id = product.id || '';
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 200) + 50;
  }, [product.id]);

  // Generate pseudo-random rating
  const rating = useMemo(() => {
    let hash = 0;
    const id = (product.id || '') + 'rating';
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash |= 0;
    }
    return (4.3 + (Math.abs(hash) % 7) * 0.1).toFixed(1);
  }, [product.id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return;
    addItem({
      id: product.id,
      kode: product.kode,
      nama: product.nama,
      harga: product.harga_jual,
      ikon: product.ikon,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const badgeConfig: Record<string, { label: string; bg: string; icon: string }> = {
    hot: { label: 'Terlaris', bg: 'bg-orange-500', icon: 'fa-fire' },
    new: { label: 'Baru', bg: 'bg-emerald-500', icon: 'fa-sparkles' },
    best: { label: 'Terbaik', bg: 'bg-purple-500', icon: 'fa-crown' },
  };

  return (
    <Link
      href={`/${storeSlug}/product/${product.id}`}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col group relative product-card"
    >
      {/* Added toast */}
      {added && (
        <div className="absolute top-2 left-2 right-2 z-20 bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-fadeIn">
          <i className="fa-solid fa-check-circle"></i>
          Ditambahkan ke keranjang!
        </div>
      )}

      {/* Image/Icon */}
      <div className="relative w-full h-36 sm:h-44 bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center overflow-hidden p-4">
        {product.ikon ? (
          <img
            src={product.ikon}
            alt={product.nama}
            className="max-h-full max-w-full object-contain product-img transition-transform duration-500"
          />
        ) : (
          <div className="text-gray-200">
            <i className="fa-solid fa-box-archive text-5xl"></i>
          </div>
        )}

        {/* Stock overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <span className="bg-white text-gray-800 px-3 py-1.5 rounded-lg font-bold text-xs shadow-lg">Stok Habis</span>
          </div>
        )}

        {/* Low stock */}
        {inStock && product.stok <= 5 && (
          <div className="absolute bottom-1.5 left-1.5 bg-orange-500 text-white px-1.5 py-0.5 rounded-md text-[9px] font-bold z-10">
            <i className="fa-solid fa-clock mr-0.5"></i>
            Sisa {product.stok}
          </div>
        )}

        {/* Quick add button - hover */}
        <button
          onClick={handleAddToCart}
          disabled={!inStock}
          className={`absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-300 z-10 ${
            !inStock
              ? 'hidden'
              : 'text-white shadow-lg opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95'
          }`}
          style={{ backgroundColor: themeColor }}
        >
          <i className="fa-solid fa-cart-plus text-xs sm:text-sm"></i>
        </button>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col">
        {/* Badge & Category */}
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {showBadge && badgeConfig[showBadge] && (
            <span className={`inline-flex items-center ${badgeConfig[showBadge].bg} text-white px-2 py-0.5 rounded-md text-[10px] font-bold leading-tight`}>
              <i className={`fa-solid ${badgeConfig[showBadge].icon} mr-1`}></i>
              {badgeConfig[showBadge].label}
            </span>
          )}
          {product.kategori && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {product.kategori}
            </span>
          )}
        </div>

        {/* Product Name */}
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 leading-snug mb-1.5 group-hover:text-purple-600 transition-colors">
          {product.nama}
        </h3>

        {/* Rating & Sold */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex items-center gap-0.5 text-yellow-500">
            <i className="fa-solid fa-star text-[10px]"></i>
            <span className="text-[11px] font-semibold text-gray-700">{rating}</span>
          </div>
          <span className="text-gray-300 text-[10px]">|</span>
          <span className="text-[11px] text-gray-500">{soldCount} terjual</span>
        </div>

        {/* Price & Stock */}
        <div className="mt-auto">
          <div className="flex items-end justify-between mb-2.5">
            <span className="text-base sm:text-lg font-extrabold" style={{ color: themeColor }}>
              {formatPrice(product.harga_jual)}
            </span>
            {inStock && product.stok > 5 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                Stok {product.stok}
              </span>
            )}
          </div>

          {/* Add to Cart Button - mobile */}
          <button
            onClick={handleAddToCart}
            disabled={!inStock}
            className={`w-full py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all sm:hidden ${
              added
                ? "bg-emerald-500 text-white"
                : inStock
                  ? "text-white active:scale-95"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
            style={inStock && !added ? { backgroundColor: themeColor } : undefined}
          >
            {added ? (
              <><i className="fa-solid fa-check mr-1"></i>Ditambahkan</>
            ) : inStock ? (
              <><i className="fa-solid fa-cart-plus mr-1"></i>Tambah</>
            ) : (
              "Stok Habis"
            )}
          </button>

          {/* Add to Cart Button - desktop */}
          <button
            onClick={handleAddToCart}
            disabled={!inStock}
            className={`hidden sm:block w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
              added
                ? "bg-emerald-500 text-white"
                : inStock
                  ? "text-white hover:opacity-90 active:scale-95"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
            style={inStock && !added ? { backgroundColor: themeColor } : undefined}
          >
            {added ? (
              <><i className="fa-solid fa-check mr-1.5"></i>Ditambahkan</>
            ) : inStock ? (
              <><i className="fa-solid fa-cart-plus mr-1.5"></i>Tambah ke Keranjang</>
            ) : (
              "Stok Habis"
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}
