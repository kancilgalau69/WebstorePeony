"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { useStore } from "@/components/StoreProvider";

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

// Category icon mapping
const categoryIcons: Record<string, { icon: string; color: string }> = {
  'Streaming': { icon: 'fa-tv', color: 'text-red-500' },
  'Music': { icon: 'fa-music', color: 'text-green-500' },
  'Musik': { icon: 'fa-music', color: 'text-green-500' },
  'Design': { icon: 'fa-palette', color: 'text-pink-500' },
  'Desain': { icon: 'fa-palette', color: 'text-pink-500' },
  'Productivity': { icon: 'fa-briefcase', color: 'text-blue-500' },
  'Produktivitas': { icon: 'fa-briefcase', color: 'text-blue-500' },
  'VPN': { icon: 'fa-shield-halved', color: 'text-purple-500' },
  'Storage': { icon: 'fa-cloud', color: 'text-cyan-500' },
  'Penyimpanan': { icon: 'fa-cloud', color: 'text-cyan-500' },
  'Gaming': { icon: 'fa-gamepad', color: 'text-indigo-500' },
  'Video': { icon: 'fa-video', color: 'text-orange-500' },
  'Editing': { icon: 'fa-scissors', color: 'text-amber-500' },
  'Education': { icon: 'fa-graduation-cap', color: 'text-teal-500' },
  'Pendidikan': { icon: 'fa-graduation-cap', color: 'text-teal-500' },
  'AI': { icon: 'fa-robot', color: 'text-violet-500' },
  'default': { icon: 'fa-cube', color: 'text-gray-500' },
};

function getCategoryStyle(category: string) {
  return categoryIcons[category] || categoryIcons['default'];
}

export default function StorePage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const { store } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const themeColor = store?.warna_tema || "#6c5ce7";

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(() => fetchProducts(true), 30000);
    return () => clearInterval(interval);
  }, [slug]);

  async function fetchProducts(silent = false) {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/store/${slug}/products`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        const sortedProducts = (json.products || []).sort((a: Product, b: Product) =>
          a.nama.localeCompare(b.nama, "id")
        );
        setProducts(sortedProducts);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const categories = Array.from(new Set(products.map((p) => p.kategori).filter(Boolean)));

  let filteredProducts = products;
  if (searchQuery) {
    filteredProducts = products.filter(
      (p) =>
        p.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.kategori?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  } else if (selectedCategory !== "all") {
    filteredProducts = products.filter((p) => p.kategori === selectedCategory);
  }

  // Derived product sections
  const topProducts = useMemo(() => {
    return [...products]
      .filter(p => p.stok > 0)
      .sort((a, b) => b.stok - a.stok)
      .slice(0, 8);
  }, [products]);

  const bestSellerProducts = useMemo(() => {
    return [...products]
      .filter(p => p.stok > 0)
      .sort((a, b) => {
        const hashA = a.id.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
        const hashB = b.id.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
        return Math.abs(hashB) - Math.abs(hashA);
      })
      .slice(0, 8);
  }, [products]);

  const newProducts = useMemo(() => {
    return [...products]
      .filter(p => p.stok > 0)
      .reverse()
      .slice(0, 8);
  }, [products]);

  // Auto-scroll to products when search is active
  useEffect(() => {
    if (searchQuery) {
      setTimeout(() => {
        const el = document.getElementById('products');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [searchQuery]);

  return (
    <div className="min-h-screen animate-fadeIn">
      {/* ===== HERO BANNER ===== */}
      <section className="relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd, ${themeColor}bb)` }}>
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3"></div>
        </div>

        <div className="container mx-auto max-w-6xl px-4 relative z-10">
          <div className="py-8 md:py-12 flex flex-col md:flex-row items-center gap-6">
            {/* Store info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start mb-4">
                {store?.logo_url ? (
                  <img src={store.logo_url} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black">
                    {store?.nama_toko?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                      <i className="fa-solid fa-circle-check text-green-300"></i>
                      Verified Store
                    </span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold">{store?.nama_toko}</h1>
                </div>
              </div>

              {store?.deskripsi && (
                <p className="text-white/80 text-sm max-w-lg mb-5">{store.deskripsi}</p>
              )}

              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <a
                  href="#products"
                  className="px-5 py-2.5 rounded-xl bg-white font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  style={{ color: themeColor }}
                >
                  <i className="fa-solid fa-bag-shopping mr-2"></i>
                  Belanja Sekarang
                </a>
                {store?.whatsapp && (
                  <a
                    href={`https://wa.me/${store.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl border-2 border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-all"
                  >
                    <i className="fa-brands fa-whatsapp mr-2"></i>
                    Chat Admin
                  </a>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex-shrink-0">
              <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto md:mx-0">
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3 text-center">
                  <div className="text-xl md:text-2xl font-extrabold">{products.length}</div>
                  <div className="text-[10px] text-white/70 mt-0.5">Produk</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3 text-center">
                  <div className="text-xl md:text-2xl font-extrabold">{products.filter(p => p.stok > 0).length}</div>
                  <div className="text-[10px] text-white/70 mt-0.5">Tersedia</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3 text-center">
                  <div className="text-xl md:text-2xl font-extrabold flex items-center justify-center gap-1">
                    4.9 <i className="fa-solid fa-star text-yellow-400 text-xs"></i>
                  </div>
                  <div className="text-[10px] text-white/70 mt-0.5">Rating</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PROMO TICKER ===== */}
      <div className="py-2 overflow-hidden border-b border-gray-200" style={{ backgroundColor: `${themeColor}08` }}>
        <div className="animate-marquee whitespace-nowrap flex items-center gap-8 text-sm font-medium" style={{ color: themeColor }}>
          <span><i className="fa-solid fa-bolt text-yellow-500 mr-1"></i> Proses instan setelah pembayaran</span>
          <span><i className="fa-solid fa-shield-halved text-green-500 mr-1"></i> Garansi masa pakai</span>
          <span><i className="fa-solid fa-headset text-blue-500 mr-1"></i> Support admin responsif</span>
          <span><i className="fa-solid fa-truck-fast mr-1"></i> Pengiriman otomatis</span>
          <span><i className="fa-solid fa-bolt text-yellow-500 mr-1"></i> Proses instan setelah pembayaran</span>
          <span><i className="fa-solid fa-shield-halved text-green-500 mr-1"></i> Garansi masa pakai</span>
          <span><i className="fa-solid fa-headset text-blue-500 mr-1"></i> Support admin responsif</span>
          <span><i className="fa-solid fa-truck-fast mr-1"></i> Pengiriman otomatis</span>
        </div>
      </div>

      {/* ===== CATEGORY SECTION ===== */}
      {!loading && categories.length > 0 && !searchQuery && (
        <section className="py-5 bg-white">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Kategori</h2>
            </div>
            <div ref={categoryScrollRef} className="flex gap-2.5 overflow-x-auto scroll-container pb-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-2xl border transition-all min-w-[70px] ${
                  selectedCategory === 'all'
                    ? 'text-white border-transparent shadow-lg'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
                style={selectedCategory === 'all' ? { backgroundColor: themeColor } : undefined}
              >
                <i className={`fa-solid fa-grid-2 text-base ${selectedCategory === 'all' ? '' : ''}`} style={selectedCategory !== 'all' ? { color: themeColor } : undefined}></i>
                <span className="text-[10px] font-semibold">Semua</span>
              </button>
              {categories.map(cat => {
                const style = getCategoryStyle(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-2xl border transition-all min-w-[70px] ${
                      selectedCategory === cat
                        ? 'text-white border-transparent shadow-lg'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                    style={selectedCategory === cat ? { backgroundColor: themeColor } : undefined}
                  >
                    <i className={`fa-solid ${style.icon} text-base ${selectedCategory === cat ? '' : style.color}`}></i>
                    <span className="text-[10px] font-semibold whitespace-nowrap">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== PRODUK TERATAS ===== */}
      {!loading && topProducts.length > 0 && !searchQuery && selectedCategory === 'all' && (
        <section className="py-5 bg-white">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-crown text-amber-500"></i>
                <h2 className="text-base font-bold text-gray-900">Produk Teratas</h2>
              </div>
              <a href="#products" className="text-xs font-semibold hover:opacity-80 transition-opacity" style={{ color: themeColor }}>
                Lihat Semua <i className="fa-solid fa-chevron-right text-[10px] ml-1"></i>
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {topProducts.slice(0, 4).map(product => (
                <ProductCard key={product.id} product={product} storeSlug={slug as string} showBadge="best" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== PRODUK TERLARIS ===== */}
      {!loading && bestSellerProducts.length > 0 && !searchQuery && selectedCategory === 'all' && (
        <section className="py-5 bg-gray-50">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-fire text-orange-500"></i>
                <h2 className="text-base font-bold text-gray-900">Terlaris</h2>
              </div>
              <a href="#products" className="text-xs font-semibold hover:opacity-80 transition-opacity" style={{ color: themeColor }}>
                Lihat Semua <i className="fa-solid fa-chevron-right text-[10px] ml-1"></i>
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {bestSellerProducts.slice(0, 4).map(product => (
                <ProductCard key={product.id} product={product} storeSlug={slug as string} showBadge="hot" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== PRODUK TERBARU ===== */}
      {!loading && newProducts.length > 0 && !searchQuery && selectedCategory === 'all' && (
        <section className="py-5 bg-white">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-sparkles text-emerald-500"></i>
                <h2 className="text-base font-bold text-gray-900">Produk Terbaru</h2>
              </div>
              <a href="#products" className="text-xs font-semibold hover:opacity-80 transition-opacity" style={{ color: themeColor }}>
                Lihat Semua <i className="fa-solid fa-chevron-right text-[10px] ml-1"></i>
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {newProducts.slice(0, 4).map(product => (
                <ProductCard key={product.id} product={product} storeSlug={slug as string} showBadge="new" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== HOW IT WORKS ===== */}
      {!searchQuery && (
        <section className="py-8 bg-gray-50">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-5">
              <h2 className="text-lg font-bold text-gray-900">Cara Belanja</h2>
              <p className="text-xs text-gray-500 mt-1">4 langkah mudah</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { title: 'Pilih Produk', desc: 'Pilih paket yang diinginkan.', icon: 'fa-magnifying-glass', color: 'text-blue-500', bg: 'bg-blue-50' },
                { title: 'Tambah Keranjang', desc: 'Klik tambah untuk mengunci stok.', icon: 'fa-cart-plus', color: 'text-purple-500', bg: 'bg-purple-50' },
                { title: 'Bayar via QRIS', desc: 'Pembayaran aman via QRIS.', icon: 'fa-qrcode', color: 'text-emerald-500', bg: 'bg-emerald-50' },
                { title: 'Akun Dikirim', desc: 'Item dikirim otomatis.', icon: 'fa-rocket', color: 'text-orange-500', bg: 'bg-orange-50' },
              ].map((step, idx) => (
                <div key={step.title} className="flex flex-col items-center text-center gap-2 rounded-2xl bg-white shadow-card border border-gray-100 px-3 py-4 card-hover">
                  <div className={`w-10 h-10 rounded-xl ${step.bg} ${step.color} flex items-center justify-center text-lg`}>
                    <i className={`fa-solid ${step.icon}`}></i>
                  </div>
                  <div className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: themeColor }}>
                    {idx + 1}
                  </div>
                  <h3 className="font-bold text-xs text-gray-900">{step.title}</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== ALL PRODUCTS ===== */}
      <section id="products" className="py-6 bg-white">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {searchQuery ? `Hasil: "${searchQuery}"` : selectedCategory !== 'all' ? selectedCategory : 'Semua Produk'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {filteredProducts.length} produk {searchQuery ? 'ditemukan' : 'tersedia'}
              </p>
            </div>
            {searchQuery && (
              <a href={`/${slug}`} className="text-xs font-semibold" style={{ color: themeColor }}>
                <i className="fa-solid fa-arrow-left mr-1"></i>Reset
              </a>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-2xl border border-gray-100 bg-white shadow-card">
                  <div className="w-full h-32 bg-gray-100 rounded-t-2xl"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-100 rounded"></div>
                    <div className="h-5 bg-gray-100 rounded w-1/2 mt-2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} storeSlug={slug as string} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-16 text-center">
              <div className="text-5xl text-gray-300 mb-4">
                <i className="fa-solid fa-box-open"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Tidak Ada Produk</h3>
              <p className="text-sm text-gray-500 mb-4">
                {searchQuery ? "Coba kata kunci lain" : "Belum ada produk di kategori ini"}
              </p>
              {(selectedCategory !== 'all' || searchQuery) && (
                <a
                  href={`/${slug}`}
                  onClick={() => setSelectedCategory('all')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-semibold text-sm shadow-md transition-all"
                  style={{ backgroundColor: themeColor }}
                >
                  Lihat Semua Produk
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ===== BENEFITS ===== */}
      {!searchQuery && (
        <section className="py-8 bg-gray-50">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Kenapa Belanja di Sini?</h2>
              <p className="text-xs text-gray-500 mt-1">Keunggulan yang membuat pelanggan kembali</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: 'fa-bolt', title: 'Proses Instan', text: 'Dikirim otomatis setelah bayar.', bg: 'bg-blue-50', color: 'text-blue-500' },
                { icon: 'fa-shield-halved', title: '100% Aman', text: 'Transaksi terpercaya.', bg: 'bg-emerald-50', color: 'text-emerald-500' },
                { icon: 'fa-headset', title: 'Support 24/7', text: 'Admin siap bantu kapan saja.', bg: 'bg-amber-50', color: 'text-amber-500' },
                { icon: 'fa-certificate', title: 'Bergaransi', text: 'Garansi masa pakai produk.', bg: 'bg-purple-50', color: 'text-purple-500' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl p-4 bg-white border border-gray-100 shadow-card card-hover">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center mb-3`}>
                    <i className={`fa-solid ${item.icon} text-base`}></i>
                  </div>
                  <h3 className="font-bold text-sm text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== TESTIMONIALS ===== */}
      {!loading && products.length > 0 && !searchQuery && (
        <section className="py-8 bg-white">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Kata Pelanggan</h2>
              <p className="text-xs text-gray-500 mt-1">Testimoni nyata dari pengguna</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { name: 'Ahmad R.', product: 'Netflix Premium', text: 'Pelayanan sangat cepat dan responsif. Produk langsung masuk setelah pembayaran.', avatar: 'A' },
                { name: 'Siti N.', product: 'Spotify Premium', text: 'Harga terjangkau dan produk original. Sudah langganan di sini sejak lama.', avatar: 'S' },
                { name: 'Budi S.', product: 'YouTube Premium', text: 'Transaksi mudah dan aman. CS ramah dan fast response. Recommended!', avatar: 'B' },
              ].map((item) => (
                <div key={item.name} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 card-hover">
                  <div className="flex items-center gap-1 text-yellow-400 mb-3">
                    {[1,2,3,4,5].map(n => <i key={n} className="fa-solid fa-star text-xs"></i>)}
                  </div>
                  <p className="text-xs text-gray-700 mb-4 leading-relaxed">"{item.text}"</p>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: themeColor }}
                    >
                      {item.avatar}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{item.name}</p>
                      <p className="text-[10px] text-gray-500">{item.product}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      {!searchQuery && (
        <section className="py-8 bg-gray-50">
          <div className="container mx-auto max-w-6xl px-4">
            <div
              className="relative overflow-hidden rounded-2xl p-6 md:p-10 text-center text-white"
              style={{ backgroundColor: themeColor }}
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-1/2 translate-y-1/2"></div>
              </div>
              <div className="relative">
                <h2 className="text-xl md:text-2xl font-extrabold mb-2">Siap Berbelanja?</h2>
                <p className="text-sm text-white/80 max-w-md mx-auto mb-5">
                  Dapatkan produk digital premium dengan harga terbaik dan layanan terpercaya.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {store?.whatsapp && (
                    <a
                      href={`https://wa.me/${store.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all"
                      style={{ color: themeColor }}
                    >
                      <i className="fa-brands fa-whatsapp text-lg"></i>
                      Chat Admin
                    </a>
                  )}
                  <a
                    href="#products"
                    className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-white/30 rounded-xl text-sm font-bold text-white hover:bg-white/10 transition-all"
                  >
                    <i className="fa-solid fa-bag-shopping"></i>
                    Lihat Produk
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
