import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { FavoritesProvider } from "@/components/FavoritesProvider";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import AnnouncementPopup from "@/components/AnnouncementPopup";

export const metadata: Metadata = {
  title: "Peony Store - Marketplace Produk Digital Premium",
  description: "Peony Store — marketplace produk digital premium: akun streaming, tools desain & langganan produktivitas. Proses instan, aman, bergaransi.",
  manifest: "/manifest.webmanifest",
  themeColor: "#720002",
  appleWebApp: {
    capable: true,
    title: "Peony Store",
    statusBarStyle: "black-translucent",
  },
};

const tickerItems = [
  "Netflix Premium", "Disney+ Hotstar", "Spotify Premium", "Canva Pro", 
  "YouTube Premium", "CapCut Pro", "Vidio Premier", "VIU Premium", 
  "iQIYI VIP", "Shortmax", "ReelShort", "DramaBox", "Fast Response ✦"
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#720002" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <script
          src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js"
          crossOrigin="anonymous"
          defer
        ></script>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: "if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js'); }); }",
          }}
        />
      </head>
      <body className="antialiased font-sans min-h-screen text-[#720002]">
        <AuthProvider>
          <CartProvider>
            <FavoritesProvider>
            <Header />
            
            <main className="min-h-screen w-full pb-24 md:pb-12 pt-24 md:pt-32">
              {children}
            </main>

            <footer className="bg-[#720002] text-white pt-10 pb-24 md:pb-10 border-t border-white/10 mt-12">
              <div className="max-w-[1160px] mx-auto px-6">
                <div className="grid md:grid-cols-[1.5fr_1fr_1fr] gap-8 mb-8">
                  {/* Brand */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="h-9 w-9 rounded-xl strawberry-gradient text-white flex items-center justify-center shadow-md">
                        <i className="fa-solid fa-store text-sm"></i>
                      </span>
                      <span className="font-fredoka text-xl text-[#F4D6DC]">Peony Store</span>
                    </div>
                    <p className="text-xs text-[#E7A6B1] max-w-sm leading-relaxed">
                      Marketplace produk digital premium — akun streaming, tools desain, dan langganan produktivitas. Proses instan, aman, dan bergaransi.
                    </p>
                    <div className="flex gap-2 mt-4">
                      {['fa-whatsapp','fa-instagram','fa-telegram'].map(ic => (
                        <span key={ic} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-[#F4D6DC]">
                          <i className={`fa-brands ${ic}`}></i>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Links */}
                  <div>
                    <h4 className="font-bold text-sm text-white mb-3">Navigasi</h4>
                    <ul className="space-y-2 text-xs text-[#E7A6B1]">
                      <li><a href="/" className="hover:text-white transition-colors">Beranda</a></li>
                      <li><a href="/#products" className="hover:text-white transition-colors">Semua Produk</a></li>
                      <li><a href="/orders" className="hover:text-white transition-colors">Lacak Pesanan</a></li>
                      <li><a href="/cart" className="hover:text-white transition-colors">Keranjang</a></li>
                    </ul>
                  </div>

                  {/* Trust */}
                  <div>
                    <h4 className="font-bold text-sm text-white mb-3">Kenapa Kami</h4>
                    <ul className="space-y-2 text-xs text-[#E7A6B1]">
                      <li className="flex items-center gap-2"><i className="fa-solid fa-bolt text-[#F4D6DC]"></i> Pengiriman Instan</li>
                      <li className="flex items-center gap-2"><i className="fa-solid fa-shield-halved text-[#F4D6DC]"></i> Transaksi Aman</li>
                      <li className="flex items-center gap-2"><i className="fa-solid fa-qrcode text-[#F4D6DC]"></i> Bayar via QRIS</li>
                      <li className="flex items-center gap-2"><i className="fa-solid fa-headset text-[#F4D6DC]"></i> Support 24/7</li>
                    </ul>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-5 flex flex-col md:flex-row items-center justify-between gap-2 text-center">
                  <p className="text-xs text-white/40">
                    &copy; {new Date().getFullYear()} Peony Store. All rights reserved.
                  </p>
                  <p className="text-[10px] text-white/30 flex items-center gap-1">
                    Dibuat dengan <i className="fa-solid fa-heart text-[#DB8291] text-[8px]"></i> untuk pelanggan setia
                  </p>
                </div>
              </div>
            </footer>
            
            <BottomNav />
            <AnnouncementPopup />
            </FavoritesProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
