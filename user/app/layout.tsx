import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { AuthProvider } from "@/components/AuthProvider";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import AnnouncementPopup from "@/components/AnnouncementPopup";

export const metadata: Metadata = {
  title: "Rain Store - Belanja Mudah",
  description: "Toko online Rain Store dengan berbagai produk digital premium",
  manifest: "/manifest.webmanifest",
  themeColor: "#CB96BA",
  appleWebApp: {
    capable: true,
    title: "Rain Store",
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
        <meta name="theme-color" content="#CB96BA" />
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
      <body className="antialiased font-sans min-h-screen text-[#3E2D3B]">
        <AuthProvider>
          <CartProvider>
            <Header />
            
            {/* Ticker Marquee Bar */}
            <div className="header-ticker">
              <div className="ticker-track">
                {tickerItems.concat(tickerItems).map((item, idx) => (
                  <span key={idx} className="ticker-item font-bold">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <main className="min-h-screen max-w-[1160px] mx-auto px-4 py-6 pb-24 md:pb-12">
              {children}
            </main>

            <footer className="bg-[#3E2D3B] text-white py-8 border-t border-white/10 mt-12">
              <div className="max-w-[1160px] mx-auto px-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#CB96BA] to-[#B0B3D6] text-white flex items-center justify-center shadow-md">
                    <i className="fa-solid fa-bolt text-xs"></i>
                  </span>
                  <span className="font-fredoka text-xl text-[#F0E2EB]">Rain Store</span>
                </div>
                <p className="text-xs text-[#B0B3D6] max-w-md mx-auto mb-4">
                  Laman terpercaya dengan produk digital berkualitas premium &amp; pelayanan bintang lima.
                </p>
                <p className="text-xs text-white/40">
                  &copy; {new Date().getFullYear()} Rain Store. All rights reserved.
                </p>
                <p className="text-[10px] text-white/25 mt-1 flex items-center justify-center gap-1">
                  Made with <i className="fa-solid fa-heart text-[#CB96BA] text-[8px]"></i>
                </p>
              </div>
            </footer>
            
            <BottomNav />
            <AnnouncementPopup />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
