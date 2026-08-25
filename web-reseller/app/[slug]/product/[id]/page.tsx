"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { useStore } from "@/components/StoreProvider";
import Link from "next/link";

interface Product {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  harga_jual: number;
  harga_lama: number | null;
  stok: number;
  ikon: string;
  deskripsi: string;
}

// Professional product icons (same as ProductCard)
const getProductIcon = (kategori: string, nama: string) => {
  const lowerNama = nama.toLowerCase();
  const lowerKategori = kategori?.toLowerCase() || '';
  
  if (lowerNama.includes('netflix')) return 'fa-solid fa-film';
  if (lowerNama.includes('spotify')) return 'fa-solid fa-music';
  if (lowerNama.includes('youtube')) return 'fa-brands fa-youtube';
  if (lowerNama.includes('disney')) return 'fa-solid fa-wand-magic-sparkles';
  if (lowerNama.includes('prime') || lowerNama.includes('amazon')) return 'fa-brands fa-amazon';
  if (lowerNama.includes('steam')) return 'fa-brands fa-steam';
  if (lowerNama.includes('xbox')) return 'fa-brands fa-xbox';
  if (lowerNama.includes('playstation') || lowerNama.includes('ps plus')) return 'fa-brands fa-playstation';
  if (lowerNama.includes('mobile legend') || lowerNama.includes('mlbb')) return 'fa-solid fa-gamepad';
  if (lowerNama.includes('pubg')) return 'fa-solid fa-gun';
  if (lowerNama.includes('free fire')) return 'fa-solid fa-fire';
  if (lowerKategori.includes('game') || lowerKategori.includes('gaming')) return 'fa-solid fa-gamepad';
  if (lowerNama.includes('vpn')) return 'fa-solid fa-shield-halved';
  if (lowerNama.includes('antivirus')) return 'fa-solid fa-shield-virus';
  if (lowerNama.includes('instagram')) return 'fa-brands fa-instagram';
  if (lowerNama.includes('facebook')) return 'fa-brands fa-facebook';
  if (lowerNama.includes('twitter') || lowerNama.includes('x premium')) return 'fa-brands fa-twitter';
  if (lowerNama.includes('tiktok')) return 'fa-brands fa-tiktok';
  if (lowerNama.includes('office') || lowerNama.includes('microsoft 365')) return 'fa-solid fa-briefcase';
  if (lowerNama.includes('canva')) return 'fa-solid fa-palette';
  if (lowerNama.includes('adobe')) return 'fa-solid fa-pen-nib';
  if (lowerNama.includes('grammarly')) return 'fa-solid fa-spell-check';
  if (lowerNama.includes('google drive') || lowerNama.includes('gdrive')) return 'fa-brands fa-google-drive';
  if (lowerNama.includes('dropbox')) return 'fa-brands fa-dropbox';
  if (lowerNama.includes('onedrive')) return 'fa-brands fa-microsoft';
  if (lowerNama.includes('coursera') || lowerNama.includes('udemy')) return 'fa-solid fa-graduation-cap';
  if (lowerKategori.includes('streaming')) return 'fa-solid fa-tv';
  if (lowerKategori.includes('musik')) return 'fa-solid fa-music';
  if (lowerKategori.includes('vpn')) return 'fa-solid fa-shield';
  if (lowerKategori.includes('sosial')) return 'fa-solid fa-users';
  if (lowerKategori.includes('produktivitas')) return 'fa-solid fa-laptop';
  
  return 'fa-solid fa-box';
};

export default function ProductDetailPage() {
  const { slug, id } = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const { store } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const themeColor = store?.warna_tema || "#3B82F6";

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/store/${slug}/products`, { cache: "no-store" });
        const json = await res.json();
        const found = (json.products || []).find((p: Product) => p.id === id);
        setProduct(found || null);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [slug, id]);

  function handleAdd() {
    if (!product || product.stok <= 0) return;
    addItem(
      {
        id: product.id,
        kode: product.kode,
        nama: product.nama,
        harga: product.harga_jual,
        ikon: product.ikon,
      },
      quantity
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuyNow() {
    if (!product || product.stok <= 0) return;
    addItem(
      {
        id: product.id,
        kode: product.kode,
        nama: product.nama,
        harga: product.harga_jual,
        ikon: product.ikon,
      },
      quantity
    );
    router.push(`/${slug}/cart`);
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 max-w-6xl py-8">
        <div className="bg-white rounded-lg border border-gray-200 p-8 animate-pulse h-96"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 max-w-6xl py-16 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-6">
          <i className="fa-solid fa-box-open text-gray-400 text-3xl"></i>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Produk Tidak Ditemukan</h2>
        <Link href={`/${slug}`} className="text-blue-600 hover:text-blue-700 font-medium">
          Kembali ke Toko
        </Link>
      </div>
    );
  }

  const inStock = product.stok > 0;
  const iconClass = getProductIcon(product.kategori, product.nama);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Added to cart toast */}
      {added && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-fadeIn">
          <i className="fa-solid fa-check-circle"></i>
          {product?.nama} ditambahkan ke keranjang!
        </div>
      )}
      <div className="container mx-auto px-4 max-w-6xl py-8 animate-fadeIn">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link href={`/${slug}`} className="hover:text-blue-600 transition-colors">
            <i className="fa-solid fa-home mr-1"></i>
            Beranda
          </Link>
          <i className="fa-solid fa-chevron-right text-xs text-gray-400"></i>
          <Link href={`/${slug}`} className="hover:text-blue-600 transition-colors">
            {product.kategori}
          </Link>
          <i className="fa-solid fa-chevron-right text-xs text-gray-400"></i>
          <span className="text-gray-900 font-medium truncate">{product.nama}</span>
        </nav>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Image/Icon */}
            <div className="w-full h-80 md:h-full bg-gray-50 flex items-center justify-center border-r border-gray-200 p-6">
              {product.ikon ? (
                <img
                  src={product.ikon}
                  alt={product.nama}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <i className={`${iconClass} text-5xl text-gray-300`}></i>
              )}
            </div>

            {/* Details */}
            <div className="p-6 md:p-8 flex flex-col">
              {/* Category Badge */}
              <div className="mb-3">
                <span className="inline-block text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  {product.kategori}
                </span>
              </div>

              {/* Product Name */}
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-tight">
                {product.nama}
              </h1>

              {/* Product Code */}
              <div className="text-sm text-gray-500 mb-4">
                Kode Produk: <span className="font-mono font-medium text-gray-700">{product.kode}</span>
              </div>

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                {product.harga_lama && product.harga_lama > product.harga_jual && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-400 line-through">
                      Rp {product.harga_lama.toLocaleString("id-ID")}
                    </span>
                    <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                      HEMAT {Math.round(((product.harga_lama - product.harga_jual) / product.harga_lama) * 100)}%
                    </span>
                  </div>
                )}
                <div className="text-3xl md:text-4xl font-bold text-gray-900">
                  Rp {product.harga_jual.toLocaleString("id-ID")}
                </div>
              </div>

              {/* Stock Status */}
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Status Stok:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      inStock ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {inStock ? (
                      <>
                        <i className="fa-solid fa-circle-check mr-1"></i>
                        Tersedia ({product.stok} unit)
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-circle-xmark mr-1"></i>
                        Stok Habis
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Description */}
              {product.deskripsi && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Deskripsi Produk</h3>
                  <ul className="space-y-1.5">
                    {String(product.deskripsi)
                      .split(/\|\||\\n|\r?\n/)
                      .map(line => line.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <i className="fa-solid fa-check text-emerald-500 text-xs mt-1 flex-shrink-0"></i>
                          <span>{line}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Quantity & Actions */}
              <div className="mt-auto space-y-4">
                {inStock && (
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">Jumlah:</span>
                    <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                      >
                        <i className="fa-solid fa-minus text-sm"></i>
                      </button>
                      <span className="w-14 text-center font-bold text-gray-900">{quantity}</span>
                      <button
                        onClick={() => setQuantity((q) => Math.min(product.stok, q + 1))}
                        className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                      >
                        <i className="fa-solid fa-plus text-sm"></i>
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleAdd}
                    disabled={!inStock}
                    className={`flex-1 py-3.5 rounded-lg font-semibold transition-all ${
                      !inStock 
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                        : "bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    {added ? (
                      <span>
                        <i className="fa-solid fa-check mr-2"></i>Ditambahkan!
                      </span>
                    ) : (
                      <span>
                        <i className="fa-solid fa-cart-plus mr-2"></i>Tambah ke Keranjang
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={!inStock}
                    className={`flex-1 py-3.5 rounded-lg font-semibold transition-all ${
                      !inStock 
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    <i className="fa-solid fa-bolt mr-2"></i>Beli Sekarang
                  </button>
                </div>

                {/* Total Price */}
                {inStock && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Harga:</span>
                      <span className="text-2xl font-bold text-gray-900">
                        Rp {(product.harga_jual * quantity).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <i className="fa-solid fa-bolt text-blue-600"></i>
                    <span>Proses Instan</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <i className="fa-solid fa-shield-halved text-blue-600"></i>
                    <span>Bergaransi</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <i className="fa-solid fa-headset text-blue-600"></i>
                    <span>Support 24/7</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <i className="fa-solid fa-lock text-blue-600"></i>
                    <span>Aman Terpercaya</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
