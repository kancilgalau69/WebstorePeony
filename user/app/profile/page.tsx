'use client'

import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-[#9E6B72]">
        <div className="text-4xl animate-bounce mb-2">🌸</div>
        <p className="font-fredoka text-lg">Memuat Profil...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-8 animate-fadeIn">
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-8 shadow-xs text-center space-y-6">
          <div className="w-20 h-20 bg-[#FBEEF1] border-2 border-[#F4D6DC] rounded-3xl flex items-center justify-center mx-auto text-4xl">
            🌸
          </div>
          <div>
            <h1 className="font-fredoka text-2xl text-[#720002]">Akun Saya</h1>
            <p className="text-xs text-[#9E6B72] font-bold mt-1">
              Masuk atau daftar untuk mengakses fitur lengkap
            </p>
          </div>

          <div className="bg-[#FBEEF1] border-2 border-[#F4D6DC] rounded-2xl p-5 text-left text-xs font-bold text-[#9E6B72] space-y-2">
            <h3 className="font-fredoka text-sm text-[#720002]">Keuntungan Punya Akun 💖</h3>
            <p>🌸 Lihat seluruh riwayat pesanan dari database</p>
            <p>🌸 Akses pesanan dari perangkat mana saja</p>
            <p>🌸 Checkout lebih cepat dengan data tersimpan</p>
          </div>

          <div className="space-y-2">
            <Link href="/login" className="btn-card-buy w-full py-3 text-xs">
              Masuk Akun ✦
            </Link>
            <Link href="/register" className="block w-full py-2.5 rounded-xl border-2 border-[#F4D6DC] text-[#720002] font-extrabold text-xs">
              Daftar Akun Baru
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto py-8 animate-fadeIn">
      <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-8 shadow-xs space-y-6">
        {/* Profile Header */}
        <div className="text-center">
          <div className="w-20 h-20 bg-[#F4D6DC] text-[#DB8291] rounded-full flex items-center justify-center mx-auto mb-3 font-fredoka text-3xl shadow-xs border-2 border-white">
            {user.nama.charAt(0).toUpperCase()}
          </div>
          <h1 className="font-fredoka text-2xl text-[#720002]">{user.nama}</h1>
          <p className="text-xs text-[#9E6B72] font-bold mt-0.5">Member Peony Store</p>
        </div>

        {/* User Info */}
        <div className="bg-[#FBEEF1] border-2 border-[#F4D6DC] rounded-2xl p-4 space-y-2 text-xs font-bold text-[#9E6B72]">
          <div className="flex justify-between">
            <span>Email:</span>
            <span className="text-[#720002]">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span>No. Phone:</span>
            <span className="text-[#720002]">{user.phone}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <Link
            href="/orders"
            className="flex items-center justify-between p-4 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] font-fredoka text-base text-[#720002] hover:border-[#DB8291] transition-all"
          >
            <span className="flex items-center gap-2">
              <span>🧾</span> Riwayat Pesanan
            </span>
            <i className="fa-solid fa-chevron-right text-xs text-[#DB8291]"></i>
          </Link>

          <Link
            href="/"
            className="flex items-center justify-between p-4 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] font-fredoka text-base text-[#720002] hover:border-[#DB8291] transition-all"
          >
            <span className="flex items-center gap-2">
              <span>🛍️</span> Katalog Produk
            </span>
            <i className="fa-solid fa-chevron-right text-xs text-[#DB8291]"></i>
          </Link>
        </div>

        {/* WhatsApp Admin — Bukti Login & Bantuan */}
        <div className="rounded-2xl border-2 border-[#F4D6DC] bg-gradient-to-br from-[#FBEEF1] to-white p-5 space-y-4">
          <div className="text-center space-y-1">
            <p className="text-[11px] font-bold text-[#9E6B72] tracking-wide">❀ ⊹ ˚ ₊ ꒰ &nbsp;❤️︎ ..&nbsp; ꒱</p>
            <h3 className="font-fredoka text-base text-[#720002] leading-snug">
              Wajib Kirim SS LOGIN + SnK Akun ke WA ‼️
            </h3>
          </div>

          {/* WA khusus bukti login */}
          <div className="rounded-xl border-2 border-[#DB8291]/40 bg-white p-4 space-y-2">
            <p className="text-[11px] font-extrabold text-[#720002] uppercase tracking-wider flex items-center gap-1.5">
              <span>🌸</span> WA Bukti Login + Akun
            </p>
            <p className="text-[11px] font-bold text-[#9E6B72] leading-relaxed">
              Kirim <span className="text-[#720002]">SS LOGIN</span> + <span className="text-[#720002]">INFO AKUN</span> setiap
              selesai order. Untuk apk <span className="text-[#720002]">Dramabox, Shortmax, Flickreels</span> wajib pakai
              form (cek Gc form login).
            </p>
            <a
              href="https://wa.me/6283879345539?text=Halo%20Admin,%20saya%20mau%20kirim%20SS%20LOGIN%20%2B%20SnK%20akun%20(bukti%20login)"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-card-buy w-full text-xs py-2.5 flex items-center justify-center gap-1.5"
            >
              <i className="fa-brands fa-whatsapp text-sm"></i> Kirim Proof + Akun
            </a>
            <p className="text-[10px] font-bold text-[#9E6B72] text-center">Khusus send proof + akun</p>
          </div>

          {/* WA Utama RAIN untuk problem/garansi */}
          <div className="rounded-xl border-2 border-[#F4D6DC] bg-white p-4 space-y-2">
            <p className="text-[11px] font-extrabold text-[#720002] uppercase tracking-wider flex items-center gap-1.5">
              <span>💬</span> WA Utama RAIN
            </p>
            <p className="text-[11px] font-bold text-[#9E6B72] leading-relaxed">
              Ada problem saat order atau mau klaim garansi? Hubungi WA Utama RAIN di bawah ini.
            </p>
            <a
              href="https://wa.me/6287751126614?text=Halo%20Admin%20RAIN,%20saya%20butuh%20bantuan%20order/garansi"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-xs py-2.5 rounded-xl border-2 border-[#DB8291] text-[#720002] font-extrabold flex items-center justify-center gap-1.5 hover:bg-[#FBEEF1] transition-all"
            >
              <i className="fa-brands fa-whatsapp text-sm"></i> Chat WA Utama RAIN
            </a>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-2xl bg-[#FFE4E6] text-[#BE123C] font-extrabold text-xs border-2 border-[#FFE4E6]"
        >
          Keluar Akun
        </button>
      </div>
    </div>
  )
}
