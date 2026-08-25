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
      <div className="py-12 text-center text-[#8E7188]">
        <div className="text-4xl animate-bounce mb-2">🌸</div>
        <p className="font-fredoka text-lg">Memuat Profil...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-8 animate-fadeIn">
        <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-8 shadow-xs text-center space-y-6">
          <div className="w-20 h-20 bg-[#F7F2F6] border-2 border-[#F0E2EB] rounded-3xl flex items-center justify-center mx-auto text-4xl">
            🌸
          </div>
          <div>
            <h1 className="font-fredoka text-2xl text-[#3E2D3B]">Akun Saya</h1>
            <p className="text-xs text-[#8E7188] font-bold mt-1">
              Masuk atau daftar untuk mengakses fitur lengkap
            </p>
          </div>

          <div className="bg-[#F7F2F6] border-2 border-[#F0E2EB] rounded-2xl p-5 text-left text-xs font-bold text-[#8E7188] space-y-2">
            <h3 className="font-fredoka text-sm text-[#3E2D3B]">Keuntungan Punya Akun 💖</h3>
            <p>🌸 Lihat seluruh riwayat pesanan dari database</p>
            <p>🌸 Akses pesanan dari perangkat mana saja</p>
            <p>🌸 Dapatkan komisi dengan program Affiliate</p>
          </div>

          <div className="space-y-2">
            <Link href="/login" className="btn-card-buy w-full py-3 text-xs">
              Masuk Akun ✦
            </Link>
            <Link href="/register" className="block w-full py-2.5 rounded-xl border-2 border-[#F0E2EB] text-[#3E2D3B] font-extrabold text-xs">
              Daftar Akun Baru
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto py-8 animate-fadeIn">
      <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-8 shadow-xs space-y-6">
        {/* Profile Header */}
        <div className="text-center">
          <div className="w-20 h-20 bg-[#F0E2EB] text-[#CB96BA] rounded-full flex items-center justify-center mx-auto mb-3 font-fredoka text-3xl shadow-xs border-2 border-white">
            {user.nama.charAt(0).toUpperCase()}
          </div>
          <h1 className="font-fredoka text-2xl text-[#3E2D3B]">{user.nama}</h1>
          <p className="text-xs text-[#8E7188] font-bold mt-0.5">Member Rain Store</p>
        </div>

        {/* User Info */}
        <div className="bg-[#F7F2F6] border-2 border-[#F0E2EB] rounded-2xl p-4 space-y-2 text-xs font-bold text-[#8E7188]">
          <div className="flex justify-between">
            <span>Email:</span>
            <span className="text-[#3E2D3B]">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span>No. Phone:</span>
            <span className="text-[#3E2D3B]">{user.phone}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <Link
            href="/orders"
            className="flex items-center justify-between p-4 rounded-2xl border-2 border-[#F0E2EB] bg-[#F7F2F6] font-fredoka text-base text-[#3E2D3B] hover:border-[#CB96BA] transition-all"
          >
            <span className="flex items-center gap-2">
              <span>🧾</span> Riwayat Pesanan
            </span>
            <i className="fa-solid fa-chevron-right text-xs text-[#CB96BA]"></i>
          </Link>

          <Link
            href="/affiliate"
            className="flex items-center justify-between p-4 rounded-2xl border-2 border-[#F0E2EB] bg-[#F7F2F6] font-fredoka text-base text-[#3E2D3B] hover:border-[#CB96BA] transition-all"
          >
            <span className="flex items-center gap-2">
              <span>💖</span> Program Affiliate
            </span>
            <i className="fa-solid fa-chevron-right text-xs text-[#CB96BA]"></i>
          </Link>

          <Link
            href="/"
            className="flex items-center justify-between p-4 rounded-2xl border-2 border-[#F0E2EB] bg-[#F7F2F6] font-fredoka text-base text-[#3E2D3B] hover:border-[#CB96BA] transition-all"
          >
            <span className="flex items-center gap-2">
              <span>🛍️</span> Katalog Produk
            </span>
            <i className="fa-solid fa-chevron-right text-xs text-[#CB96BA]"></i>
          </Link>
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
