"use client";
import React, { useState, useEffect } from "react";
import { 
  MessageCircle, 
  Store, 
  Banknote, 
  Settings, 
  Zap, 
  TrendingUp, 
  Wallet, 
  Film, 
  Music, 
  Play, 
  Wand2, 
  Palette, 
  Briefcase, 
  Shield, 
  MoreHorizontal, 
  ChevronDown,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

const DEFAULT_DASHBOARD_URL = "http://localhost:3002";

function normalizeDashboardUrl(value: string | undefined) {
  const url = (value || DEFAULT_DASHBOARD_URL).trim().replace(/\/+$/, "");

  if (/^https?:\/\//i.test(url)) return url;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)) return `http://${url}`;

  return `https://${url}`;
}

export default function LandingPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  const dashboardUrl = normalizeDashboardUrl(process.env.NEXT_PUBLIC_RESELLER_DASHBOARD_URL);
  const registerUrl = `${dashboardUrl}/register`;
  const loginUrl = `${dashboardUrl}/login`;
  const adminWhatsappUrl = "https://wa.me/6282340915319?text=Halo%2C%20saya%20ingin%20bertanya%20tentang%20pendaftaran%20reseller";
  const primaryRegisterUrl = registrationEnabled ? registerUrl : adminWhatsappUrl;
  const primaryRegisterLabel = registrationEnabled ? "Daftar Sekarang" : "Hubungi Admin";

  // Handle scroll for navbar and trigger initial animations
  useEffect(() => {
    setIsVisible(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/reseller-registration", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (mounted) setRegistrationEnabled(data.enabled !== false);
      })
      .catch(() => {
        if (mounted) setRegistrationEnabled(true);
      });
    return () => { mounted = false; };
  }, []);

  const faqs = [
    {
      q: "Bagaimana cara mendaftar menjadi reseller?",
      a: "Klik tombol Daftar Reseller, isi data toko dan data reseller, lalu tunggu aktivasi manual dari admin pusat sebelum akun bisa digunakan untuk login.",
    },
    {
      q: "Berapa modal awal yang dibutuhkan?",
      a: "Tidak ada modal awal. Anda hanya perlu mendaftar dan mengatur margin keuntungan sendiri. Pembayaran dari customer langsung masuk ke sistem, dan komisi Anda otomatis terhitung.",
    },
    {
      q: "Apakah saya perlu stok produk sendiri?",
      a: "Tidak. Semua stok dikelola oleh pusat. Anda cukup fokus promosi dan melayani customer. Pengiriman produk digital dilakukan otomatis oleh sistem.",
    },
    {
      q: "Bagaimana cara menarik komisi?",
      a: "Melalui dashboard reseller, Anda bisa ajukan penarikan saldo kapan saja. Transfer dilakukan ke rekening bank atau e-wallet pilihan Anda dalam 1x24 jam kerja.",
    },
    {
      q: "Apakah ada target penjualan minimum?",
      a: "Tidak ada target minimum. Anda bebas berjualan sesuai kemampuan tanpa tekanan. Semakin banyak penjualan, semakin besar komisi yang Anda dapatkan.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden">
      {/* Custom Animations injected via Style tag for self-contained component */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }
        .stagger-1 { animation-delay: 0.1s; }
        .stagger-2 { animation-delay: 0.2s; }
        .stagger-3 { animation-delay: 0.3s; }
        .stagger-4 { animation-delay: 0.4s; }
        
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
      `}} />

      {/* Navigation */}
      <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-lg">P</span>
            </div>
            <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">Putra BTT Store</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={primaryRegisterUrl}
              target={registrationEnabled ? undefined : "_blank"}
              rel={registrationEnabled ? undefined : "noopener noreferrer"}
              className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {registrationEnabled ? "Daftar Reseller" : "Hubungi Admin"}
            </a>
            <a
              href={loginUrl}
              className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Login Dashboard
            </a>
            <a
              href="https://wa.me/6282340915319"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <MessageCircle size={18} />
              Hubungi Kami
            </a>
            
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-violet-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className={`opacity-0 ${isVisible ? 'animate-fade-in-up' : ''}`}>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50/80 backdrop-blur-sm border border-indigo-100 rounded-full text-indigo-700 text-sm font-semibold mb-6 shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                </span>
                {registrationEnabled ? "Pendaftaran Reseller Dibuka" : "Pendaftaran Sementara Ditutup"}
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight text-slate-900 mb-6">
                Mulai Bisnis Reseller Produk Digital,<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-300% animate-gradient">
                  Tanpa Ribet Stok.
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed mb-8 max-w-lg">
                Bergabung sebagai reseller Putra BTT Store. Dapatkan toko online sendiri, atur harga sesuka hati, dan terima komisi otomatis tanpa modal produk.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={primaryRegisterUrl}
                  target={registrationEnabled ? undefined : "_blank"}
                  rel={registrationEnabled ? undefined : "noopener noreferrer"}
                  className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all overflow-hidden shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-1"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {primaryRegisterLabel}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                </a>
                <a
                  href="#keuntungan"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/50 backdrop-blur-sm border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-white hover:border-indigo-200 hover:text-indigo-600 transition-all hover:-translate-y-1 shadow-sm"
                >
                  Pelajari Lebih Lanjut
                </a>
              </div>
            </div>

            {/* Right Side 3D/Floating Element Mockup */}
            <div className={`hidden lg:block relative w-full h-[500px] opacity-0 ${isVisible ? 'animate-fade-in-up stagger-2' : ''}`}>
              <div className="absolute inset-0 flex items-center justify-center animate-float">
                <div className="relative w-80 h-[450px] bg-white rounded-3xl shadow-2xl border-8 border-slate-900 overflow-hidden z-20 transform rotate-[-5deg] hover:rotate-0 transition-transform duration-500">
                   {/* Mockup Screen */}
                   <div className="w-full h-full bg-slate-50 p-4 flex flex-col gap-4">
                     <div className="w-full h-32 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl p-4 flex flex-col justify-end">
                       <p className="text-white/80 text-xs font-medium">Total Saldo</p>
                       <p className="text-white text-2xl font-bold">Rp 4.550.000</p>
                     </div>
                     <div className="space-y-3">
                       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaksi Terbaru</div>
                       {[1,2,3,4].map((i) => (
                         <div key={i} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                               <CheckCircle2 size={16} />
                             </div>
                             <div>
                               <p className="text-xs font-bold text-slate-800">Netflix 1 Bulan</p>
                               <p className="text-[10px] text-slate-400">Sukses</p>
                             </div>
                           </div>
                           <p className="text-xs font-bold text-green-600">+Rp 35.000</p>
                         </div>
                       ))}
                     </div>
                   </div>
                </div>
                {/* Floating Elements Around */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-white rounded-2xl shadow-xl border border-indigo-50 flex items-center justify-center text-indigo-600 z-30 animate-bounce" style={{animationDuration: '3s'}}>
                  <TrendingUp size={40} />
                </div>
                <div className="absolute bottom-10 -left-10 w-20 h-20 bg-white rounded-2xl shadow-xl border border-pink-50 flex items-center justify-center text-pink-500 z-30 animate-bounce" style={{animationDuration: '4s', animationDelay: '1s'}}>
                  <Store size={32} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="relative z-20 -mt-10 px-4">
        <div className={`max-w-5xl mx-auto glass-card rounded-2xl shadow-xl p-8 opacity-0 ${isVisible ? 'animate-fade-in-up stagger-3' : ''}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-slate-200/50">
            {[
              { value: "30+", label: "Produk Digital", color: "text-indigo-600" },
              { value: "10K+", label: "Transaksi Sukses", color: "text-emerald-500" },
              { value: "24/7", label: "Sistem Otomatis", color: "text-violet-500" },
              { value: "Instant", label: "Pengiriman Item", color: "text-pink-500" }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center px-4 hover:scale-110 transition-transform duration-300">
                <div className={`text-4xl font-extrabold ${stat.color} mb-1 drop-shadow-sm`}>{stat.value}</div>
                <div className="text-sm font-medium text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Keuntungan Section */}
      <section id="keuntungan" className="py-24 relative">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              Kenapa Jadi Reseller Kami?
            </h2>
            <p className="text-lg text-slate-600">
              Semua infrastruktur bisnis digital sudah kami siapkan. Anda hanya tinggal fokus berjualan dan mencetak profit.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Store, title: "Toko Online Sendiri", desc: "Dapatkan link toko web dengan nama dan branding Anda sendiri. Pelanggan membeli langsung dari toko Anda.", bg: "bg-blue-100", text: "text-blue-600", border: "hover:border-blue-300" },
              { icon: Banknote, title: "Tanpa Modal Awal", desc: "Tidak perlu beli stok produk di awal. Produk disediakan pusat, Anda fokus ke penjualan dan promosi.", bg: "bg-emerald-100", text: "text-emerald-600", border: "hover:border-emerald-300" },
              { icon: Settings, title: "Atur Harga Sendiri", desc: "Tentukan margin keuntungan sesuka hati. Semakin tinggi margin, semakin besar pendapatan pasif Anda.", bg: "bg-violet-100", text: "text-violet-600", border: "hover:border-violet-300" },
              { icon: Zap, title: "Pengiriman Otomatis", desc: "Setelah customer bayar, produk digital langsung terkirim otomatis detik itu juga via sistem kami.", bg: "bg-amber-100", text: "text-amber-600", border: "hover:border-amber-300" },
              { icon: TrendingUp, title: "Dashboard Analitik", desc: "Pantau omset harian, komisi berjalan, dan kelola produk dari dashboard reseller yang sangat intuitif.", bg: "bg-rose-100", text: "text-rose-600", border: "hover:border-rose-300" },
              { icon: Wallet, title: "Withdraw Kapan Saja", desc: "Tarik komisi penghasilan ke rekening bank atau e-wallet (DANA, OVO, dll) kapan saja tanpa minimum besar.", bg: "bg-cyan-100", text: "text-cyan-600", border: "hover:border-cyan-300" },
            ].map((item, i) => (
              <div
                key={i}
                className={`group relative p-8 bg-white border-2 border-transparent rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 ${item.border}`}
              >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-slate-50 to-transparent rounded-tr-2xl -z-10 transition-colors group-hover:from-${item.bg.replace('bg-', '')}`}></div>
                <div className={`w-14 h-14 rounded-xl ${item.bg} ${item.text} flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                  <item.icon size={28} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Biaya Pendaftaran */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700"></div>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-white/90 text-xs font-semibold uppercase tracking-wider mb-5">
              Investasi Sekali Seumur Hidup
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-3">
              Mulai Bisnis Digital Anda
            </h2>
            <p className="text-blue-100 text-lg">
              {registrationEnabled ? "Pendaftaran reseller sedang dibuka gratis" : "Hanya dengan biaya pendaftaran"}
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* Price header */}
              <div className="text-center py-10 px-6 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
                <div className="inline-flex items-center gap-2 mb-3">
                  <span className="text-lg text-gray-400 line-through font-medium">Rp 99.000</span>
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${registrationEnabled ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                    {registrationEnabled ? "DIBUKA GRATIS" : "HEMAT 50%"}
                  </span>
                </div>
                {registrationEnabled ? (
                  <div className="text-7xl md:text-8xl font-black text-emerald-600 leading-none">
                    GRATIS
                  </div>
                ) : (
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl font-bold text-gray-600">Rp</span>
                    <span className="text-7xl md:text-8xl font-black text-gray-900 leading-none">49</span>
                    <span className="text-3xl font-bold text-gray-600">.000</span>
                  </div>
                )}
                <p className="text-gray-500 text-sm mt-3 font-medium">
                  {registrationEnabled ? (
                    <>Pendaftaran sedang dibuka gratis oleh admin &bull; Akses selamanya &bull; Tanpa biaya bulanan</>
                  ) : (
                    <>Sekali bayar &bull; Akses selamanya &bull; Tanpa biaya bulanan</>
                  )}
                </p>
              </div>

              {/* Benefits */}
              <div className="p-8 md:p-10">
                <h3 className="font-bold text-gray-900 text-center mb-6">Semua ini langsung Anda dapatkan:</h3>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                  {[
                    { text: "Toko online dengan nama & branding sendiri", highlight: true },
                    { text: "Dashboard reseller lengkap untuk kelola bisnis", highlight: true },
                    { text: "Akses 30+ produk digital premium", highlight: false },
                    { text: "Sistem pembayaran QRIS otomatis 24/7", highlight: false },
                    { text: "Pengiriman item digital instan ke pembeli", highlight: false },
                    { text: "Bebas tentukan harga & margin keuntungan", highlight: true },
                    { text: "Withdraw komisi ke rekening kapan saja", highlight: true },
                    { text: "Support prioritas admin via WhatsApp", highlight: false },
                    { text: "Update produk baru secara berkala", highlight: false },
                    { text: "Tanpa target penjualan minimum", highlight: false },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        item.highlight ? "bg-blue-600" : "bg-emerald-500"
                      }`}>
                        <i className="fa-solid fa-check text-white text-[9px]"></i>
                      </div>
                      <span className={`text-sm ${item.highlight ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-10 text-center">
                  <a
                    href={primaryRegisterUrl}
                    target={registrationEnabled ? undefined : "_blank"}
                    rel={registrationEnabled ? undefined : "noopener noreferrer"}
                    className="inline-flex items-center gap-3 px-10 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 hover:shadow-blue-600/40 hover:scale-[1.02] text-base"
                  >
                    <i className={`${registrationEnabled ? "fa-solid fa-user-plus" : "fa-brands fa-whatsapp"} text-xl`}></i>
                    {primaryRegisterLabel}
                  </a>
                  <div className="flex items-center justify-center gap-4 mt-5 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><i className="fa-solid fa-shield-halved text-emerald-500"></i> Pembayaran aman</span>
                    <span className="flex items-center gap-1"><i className="fa-solid fa-user-shield text-amber-500"></i> Aktivasi admin</span>
                    <span className="flex items-center gap-1"><i className="fa-solid fa-infinity text-blue-500"></i> Akses lifetime</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cara Kerja Section */}
      <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              Mulai Dalam 3 Langkah Sederhana
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-lg">
              Jalur cepat menuju penghasilan tambahan tanpa ribet urus teknis.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting Line for Desktop */}
            <div className="hidden md:block absolute top-1/2 left-10 right-10 h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 -translate-y-1/2 opacity-30"></div>

            {[
              { step: "01", title: "Daftar & Verifikasi", desc: "Isi formulir pendaftaran, lalu tunggu akun Anda diaktifkan manual oleh admin pusat.", color: "from-indigo-400 to-indigo-600" },
              { step: "02", title: "Atur Toko & Margin", desc: "Pilih produk yang ingin dijual, atur nama toko, dan tentukan harga jual sesuai keinginan.", color: "from-violet-400 to-violet-600" },
              { step: "03", title: "Promosi & Profit", desc: "Sebarkan link toko Anda. Tiap transaksi otomatis masuk, komisi langsung cair ke saldo Anda.", color: "from-pink-400 to-pink-600" },
            ].map((item, i) => (
              <div key={i} className="relative bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl border border-slate-700 hover:border-slate-500 transition-all duration-300 hover:-translate-y-2 group">
                <div className={`absolute -top-6 left-8 w-12 h-12 rounded-full bg-gradient-to-r ${item.color} flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-black/50 group-hover:scale-110 transition-transform`}>
                  {item.step}
                </div>
                <h3 className="font-bold text-xl mt-4 mb-3">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Produk Section (Marquee / Grid) */}
      <section className="py-24 bg-white relative">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              Produk Terlaris Siap Jual
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto text-lg">
              Kami menyediakan puluhan layanan premium dengan permintaan pasar yang sangat tinggi.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {[
              { name: "Netflix Premium", icon: Film, color: "text-red-500", bg: "bg-red-50", hover: "hover:bg-red-500 hover:text-white hover:border-red-500" },
              { name: "Spotify Premium", icon: Music, color: "text-green-500", bg: "bg-green-50", hover: "hover:bg-green-500 hover:text-white hover:border-green-500" },
              { name: "YouTube Premium", icon: Play, color: "text-rose-500", bg: "bg-rose-50", hover: "hover:bg-rose-500 hover:text-white hover:border-rose-500" },
              { name: "Disney+ Hotstar", icon: Wand2, color: "text-blue-500", bg: "bg-blue-50", hover: "hover:bg-blue-500 hover:text-white hover:border-blue-500" },
              { name: "Canva Pro", icon: Palette, color: "text-violet-500", bg: "bg-violet-50", hover: "hover:bg-violet-500 hover:text-white hover:border-violet-500" },
              { name: "Microsoft 365", icon: Briefcase, color: "text-orange-500", bg: "bg-orange-50", hover: "hover:bg-orange-500 hover:text-white hover:border-orange-500" },
              { name: "VPN Premium", icon: Shield, color: "text-cyan-500", bg: "bg-cyan-50", hover: "hover:bg-cyan-500 hover:text-white hover:border-cyan-500" },
              { name: "Dan Lainnya...", icon: MoreHorizontal, color: "text-slate-500", bg: "bg-slate-100", hover: "hover:bg-slate-800 hover:text-white hover:border-slate-800" },
            ].map((item, i) => (
              <div
                key={i}
                className={`group flex items-center gap-4 p-5 bg-white border-2 border-slate-100 rounded-2xl transition-all duration-300 cursor-pointer ${item.hover} shadow-sm hover:shadow-md`}
              >
                <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors`}>
                  <item.icon className={`${item.color} group-hover:text-white transition-colors`} size={24} />
                </div>
                <span className="font-semibold text-slate-800 group-hover:text-white transition-colors">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-slate-50 relative">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 mb-4">
              <MessageCircle size={24} />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">
              Pertanyaan Umum
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div 
                key={i} 
                className={`border-2 rounded-2xl overflow-hidden transition-all duration-300 ${faqOpen === i ? 'border-indigo-500 shadow-md bg-white' : 'border-slate-200 bg-white hover:border-indigo-200'}`}
              >
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className={`font-bold text-lg pr-4 transition-colors ${faqOpen === i ? 'text-indigo-600' : 'text-slate-800'}`}>
                    {faq.q}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${faqOpen === i ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    <ChevronDown size={20} className={`transition-transform duration-300 ${faqOpen === i ? "rotate-180" : ""}`} />
                  </div>
                </button>
                <div 
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${faqOpen === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="p-6 pt-0 border-t border-slate-100 mt-2">
                    <p className="text-slate-600 leading-relaxed text-lg">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600"></div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black opacity-10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
        
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
            Siap Mulai Bisnis Digital Anda?
          </h2>
          <p className="text-indigo-100 mb-10 text-xl max-w-2xl mx-auto leading-relaxed">
            Gabung bersama reseller lainnya dan mulai hasilkan pendapatan tambahan dari berjualan produk digital premium hari ini.
          </p>
          <a
            href={primaryRegisterUrl}
            target={registrationEnabled ? undefined : "_blank"}
            rel={registrationEnabled ? undefined : "noopener noreferrer"}
            className="group inline-flex items-center gap-3 px-8 py-5 bg-white text-indigo-600 font-bold text-lg rounded-full hover:bg-slate-50 transition-all duration-300 hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.3)]"
          >
            <MessageCircle className="text-green-500" size={24} />
            {registrationEnabled ? "Daftar Reseller Sekarang" : "Hubungi Admin"}
            <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform text-indigo-400" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <span className="text-white font-black text-lg">P</span>
                </div>
                <span className="font-bold text-2xl text-white">Putra BTT Store</span>
              </div>
              <p className="text-slate-400 leading-relaxed max-w-sm mb-6 text-sm">
                Platform reseller produk digital terpercaya nomor 1. Jual berbagai produk berlangganan premium tanpa modal dengan sistem serba otomatis.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-bold text-white mb-5 uppercase tracking-wider text-sm">Menu Cepat</h4>
              <ul className="space-y-3 text-sm font-medium">
                <li><a href="#keuntungan" className="hover:text-indigo-400 transition-colors inline-flex items-center gap-2"><ArrowRight size={14}/> Keuntungan</a></li>
                <li><a href={primaryRegisterUrl} target={registrationEnabled ? undefined : "_blank"} rel={registrationEnabled ? undefined : "noopener noreferrer"} className="hover:text-indigo-400 transition-colors inline-flex items-center gap-2"><ArrowRight size={14}/> {registrationEnabled ? "Daftar Reseller" : "Hubungi Admin"}</a></li>
                <li><a href={loginUrl} className="hover:text-indigo-400 transition-colors inline-flex items-center gap-2"><ArrowRight size={14}/> Login Dashboard</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-white mb-5 uppercase tracking-wider text-sm">Hubungi Kami</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <MessageCircle size={18} className="text-green-500 mt-0.5" />
                  <span className="text-slate-300">+62 823 4091 5319</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-4 h-4 mt-1 rounded-full bg-slate-800 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div></div>
                  <span className="text-slate-300">Setiap Hari<br/><span className="text-slate-500">09:00 - 22:00 WIB</span></span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm">
              &copy; {new Date().getFullYear()} <span className="text-white font-medium">Putra BTT Store</span>. All rights reserved.
            </p>
            <div className="flex gap-4">
               <a href="https://wa.me/6282340915319" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-green-600 hover:border-green-600 transition-all" aria-label="WhatsApp">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
               </a>
               <a href="https://instagram.com/putrabttstore" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-pink-600 hover:border-pink-600 transition-all" aria-label="Instagram">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
               </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
