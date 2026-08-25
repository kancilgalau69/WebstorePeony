"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { CartProvider, useCart } from "@/components/CartProvider";
import { StoreProvider, useStore, StoreInfo } from "@/components/StoreProvider";

function StoreHeader() {
  const { store } = useStore();
  const { slug } = useParams();
  const { totalItems } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const themeColor = store?.warna_tema || "#6c5ce7";

  return (
    <>
      <header className="sticky top-0 z-40 glass border-b border-gray-200/60 shadow-sm">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo & Store Name */}
            <Link href={`/${slug}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity flex-shrink-0">
              {store?.logo_url ? (
                <img src={store.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover border border-gray-200" />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                  style={{ backgroundColor: themeColor }}
                >
                  {store?.nama_toko?.charAt(0)?.toUpperCase() || "T"}
                </div>
              )}
              <div className="flex flex-col leading-none">
                <span className="text-[10px] tracking-widest font-bold uppercase" style={{ color: themeColor }}>
                  {store?.nama_toko?.split(' ')[0] || "Store"}
                </span>
                <span className="text-lg font-extrabold text-gray-900 -mt-0.5">
                  {store?.nama_toko?.split(' ').slice(1).join(' ') || "Digital"}
                </span>
              </div>
            </Link>

            {/* Center - Search bar (desktop) */}
            <div className="hidden md:flex flex-1 max-w-md mx-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    window.location.href = `/${slug}?search=${encodeURIComponent(searchQuery)}`;
                  }
                }}
                className="relative w-full"
              >
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari produk digital..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-100 border border-transparent focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-gray-100 outline-none transition-all text-sm"
                />
              </form>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* Search Button - mobile */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="md:hidden p-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-all"
                title="Cari Produk"
              >
                <i className="fa-solid fa-magnifying-glass text-lg"></i>
              </button>

              {/* Cart Button */}
              <Link
                href={`/${slug}/cart`}
                className="relative p-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-all"
                title="Keranjang"
              >
                <i className="fa-solid fa-cart-shopping text-lg"></i>
                {totalItems > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] flex items-center justify-center font-bold shadow-sm"
                    style={{ backgroundColor: themeColor }}
                  >
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </Link>

              {/* WhatsApp Button - desktop */}
              {store?.whatsapp && (
                <a
                  href={`https://wa.me/${store.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: themeColor }}
                  title="Hubungi via WhatsApp"
                >
                  <i className="fa-brands fa-whatsapp"></i>
                  <span>Hubungi</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {searchOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 animate-fadeIn">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  window.location.href = `/${slug}?search=${encodeURIComponent(searchQuery)}`;
                  setSearchOpen(false);
                }
              }}
              className="relative"
            >
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk..."
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-300 outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </form>
          </div>
        )}
      </header>
    </>
  );
}

function BottomNav() {
  const { slug } = useParams();
  const pathname = usePathname();
  const { totalItems } = useCart();
  const { store } = useStore();
  const themeColor = store?.warna_tema || "#6c5ce7";

  const navItems = [
    { href: `/${slug}`, icon: "fa-house", label: "Beranda", exact: true },
    { href: `/${slug}/cart`, icon: "fa-cart-shopping", label: "Keranjang", badge: totalItems },
    { href: `/${slug}/orders`, icon: "fa-receipt", label: "Pesanan" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-gray-200/60 sm:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-1.5 transition-all relative"
            >
              {/* Active indicator */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ backgroundColor: themeColor }} />
              )}
              <div className="relative">
                <i
                  className={`fa-solid ${item.icon} text-xl`}
                  style={{ color: active ? themeColor : "#9CA3AF" }}
                ></i>
                {item.badge ? (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full text-white text-[9px] flex items-center justify-center font-bold shadow-sm"
                    style={{ backgroundColor: themeColor }}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span
                className="text-[10px] mt-1 font-medium"
                style={{ color: active ? themeColor : "#9CA3AF" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchStore() {
      try {
        const res = await fetch(`/api/store/${slug}`, { cache: "no-store" });
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setStore(data.store);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchStore();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 text-sm">Memuat toko...</p>
        </div>
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-5">
            <i className="fa-solid fa-store-slash text-gray-400 text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Toko Tidak Ditemukan</h2>
          <p className="text-sm text-gray-500 mb-6">Toko yang Anda cari tidak ada atau sudah tidak aktif.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors"
          >
            <i className="fa-solid fa-arrow-left text-xs"></i>
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  return (
    <StoreProvider store={store}>
      <CartProvider storeSlug={slug as string}>
        <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
          <StoreHeader />
          <main className="flex-1 pb-20 sm:pb-0">{children}</main>
          <footer className="bg-gray-900 text-white border-t border-white/5">
            <div className="container mx-auto px-4 max-w-6xl">
              {/* Main Footer */}
              <div className="py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Store Info */}
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    {store.logo_url ? (
                      <img src={store.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: store.warna_tema || '#6c5ce7' }}
                      >
                        {store.nama_toko?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-sm">{store.nama_toko}</h3>
                      <p className="text-[10px] text-white/40">Digital Store</p>
                    </div>
                  </div>
                  {store.deskripsi && (
                    <p className="text-xs text-white/50 leading-relaxed max-w-sm">
                      {store.deskripsi}
                    </p>
                  )}
                </div>

                {/* Quick Links */}
                <div>
                  <h4 className="font-bold text-sm mb-3">Menu</h4>
                  <ul className="space-y-2 text-xs">
                    <li>
                      <Link href={`/${slug}`} className="text-white/50 hover:text-white transition-colors">
                        <i className="fa-solid fa-house mr-2 w-4 text-center"></i>Beranda
                      </Link>
                    </li>
                    <li>
                      <Link href={`/${slug}/cart`} className="text-white/50 hover:text-white transition-colors">
                        <i className="fa-solid fa-cart-shopping mr-2 w-4 text-center"></i>Keranjang
                      </Link>
                    </li>
                    <li>
                      <Link href={`/${slug}/orders`} className="text-white/50 hover:text-white transition-colors">
                        <i className="fa-solid fa-receipt mr-2 w-4 text-center"></i>Cek Pesanan
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Contact Info */}
                <div>
                  <h4 className="font-bold text-sm mb-3">Hubungi</h4>
                  <ul className="space-y-2 text-xs">
                    {store.whatsapp && (
                      <li>
                        <a
                          href={`https://wa.me/${store.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                        >
                          <i className="fa-brands fa-whatsapp text-green-400 w-4 text-center"></i>
                          <span>{store.whatsapp}</span>
                        </a>
                      </li>
                    )}
                    {store.instagram && (
                      <li>
                        <a
                          href={`https://instagram.com/${store.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                        >
                          <i className="fa-brands fa-instagram text-pink-400 w-4 text-center"></i>
                          <span>@{store.instagram}</span>
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Bottom Footer */}
              <div className="py-4 border-t border-white/5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-white/30">
                  <p>&copy; {new Date().getFullYear()} {store.nama_toko}. All rights reserved.</p>
                  <p className="flex items-center gap-1">
                    Powered by <span className="text-white/50 font-semibold">Rain Store</span>
                  </p>
                </div>
              </div>
            </div>
          </footer>
          <BottomNav />
        </div>
      </CartProvider>
    </StoreProvider>
  );
}
