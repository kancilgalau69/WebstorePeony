'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'

type ProfileData = {
  id: string
  nama: string
  email: string
  phone: string
  avatar_url: string | null
}

export default function ProfilePage() {
  const { user, loading, logout, refreshUser } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ nama: '', phone: '', avatar_url: '' })
  const proofWhatsappText = encodeURIComponent(`❤️︎⠀ ݂   ۫    🌸🦢  𝐅𝐨𝐫𝐦𝐚𝐭 𝐨𝐫𝐝𝐞𝐫⠀𓉳 𑁍  ۫   ݂⠀⁞ ⠀⁺ ⊹ \n\n⠀✿⠀.  ⊹⠀꒱   device :\n⠀✿⠀.  ⊹⠀꒱   lokasi :\n\n𓈒  ۫    ♡ ˖ ⊹   𝑵𝒐𝒕𝒆𝒔⠀𝜗ৎ  mohon diisi dengan lengkap dan detail agar pesanan diproses ๑  ֹ  ₊  𓉳  𓌔𓌔 ❤️`)

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Gagal memuat profil')
        if (cancelled) return
        const nextProfile = json.user as ProfileData
        setProfile(nextProfile)
        setForm({ nama: nextProfile.nama || '', phone: nextProfile.phone || '', avatar_url: nextProfile.avatar_url || '' })
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Gagal memuat profil')
      }
    }
    fetchProfile()
    return () => { cancelled = true }
  }, [user])

  const startEdit = () => {
    const current = profile || (user ? { ...user, avatar_url: null } : null)
    if (!current) return
    setForm({ nama: current.nama || '', phone: current.phone || '', avatar_url: current.avatar_url || '' })
    setMessage('')
    setEditing(true)
  }

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: form.nama, phone: form.phone, avatar_url: form.avatar_url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan profil')
      setProfile(json.user)
      setForm({ nama: json.user.nama || '', phone: json.user.phone || '', avatar_url: json.user.avatar_url || '' })
      await refreshUser()
      setEditing(false)
      setMessage('Profil berhasil diperbarui.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal menyimpan profil')
    } finally {
      setSaving(false)
    }
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

  const displayProfile = profile || { id: user.id, nama: user.nama, email: user.email, phone: user.phone, avatar_url: null }

  return (
    <div className="max-w-md mx-auto py-8 animate-fadeIn">
      <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-8 shadow-xs space-y-6">
        {/* Profile Header */}
        <div className="text-center">
          <div className="w-24 h-24 bg-[#F4D6DC] text-[#DB8291] rounded-full flex items-center justify-center mx-auto mb-3 font-fredoka text-3xl shadow-xs border-2 border-white overflow-hidden">
            {displayProfile.avatar_url ? (
              <img src={displayProfile.avatar_url} alt={displayProfile.nama} className="w-full h-full object-cover" />
            ) : (
              displayProfile.nama.charAt(0).toUpperCase()
            )}
          </div>
          <h1 className="font-fredoka text-2xl text-[#720002]">{displayProfile.nama}</h1>
          <p className="text-xs text-[#9E6B72] font-bold mt-0.5">Member Peony Store</p>
          <button
            onClick={startEdit}
            className="mt-3 px-4 py-2 rounded-full bg-[#FBEEF1] border-2 border-[#F4D6DC] text-[#720002] font-extrabold text-xs hover:border-[#DB8291] transition-all"
          >
            Edit Profil
          </button>
        </div>

        {message && (
          <div className="bg-[#FBEEF1] border-2 border-[#F4D6DC] rounded-xl p-3 text-xs font-bold text-[#720002] text-center">
            {message}
          </div>
        )}

        {editing && (
          <form onSubmit={saveProfile} className="bg-white border-2 border-[#F4D6DC] rounded-2xl p-4 space-y-3">
            <h2 className="font-fredoka text-lg text-[#720002]">Edit Data Profil</h2>
            <div>
              <label className="block text-xs font-extrabold text-[#9E6B72] mb-1">Nama</label>
              <input
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-[#F4D6DC] text-sm font-bold text-[#720002] outline-none focus:border-[#DB8291]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-[#9E6B72] mb-1">Email</label>
              <input
                value={displayProfile.email}
                readOnly
                className="w-full px-3 py-2.5 rounded-xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-sm font-bold text-[#9E6B72] outline-none"
              />
              <p className="text-[10px] font-bold text-[#9E6B72] mt-1">Email tidak bisa diubah dari halaman ini.</p>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-[#9E6B72] mb-1">No. Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-[#F4D6DC] text-sm font-bold text-[#720002] outline-none focus:border-[#DB8291]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-[#9E6B72] mb-1">Link Foto Profil</label>
              <input
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2.5 rounded-xl border-2 border-[#F4D6DC] text-sm font-bold text-[#720002] outline-none focus:border-[#DB8291]"
              />
              <p className="text-[10px] font-bold text-[#9E6B72] mt-1">Masukkan link gambar langsung (http/https). Kosongkan untuk hapus foto.</p>
            </div>
            {form.avatar_url.trim() && (
              <div className="flex items-center gap-3 bg-[#FBEEF1] rounded-xl p-3 border border-[#F4D6DC]">
                <img src={form.avatar_url} alt="Preview foto profil" className="w-12 h-12 rounded-full object-cover bg-white" />
                <span className="text-xs font-bold text-[#9E6B72]">Preview foto profil</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button type="button" onClick={() => setEditing(false)} className="py-2.5 rounded-xl border-2 border-[#F4D6DC] text-[#720002] font-extrabold text-xs">Batal</button>
              <button type="submit" disabled={saving} className="py-2.5 rounded-xl strawberry-gradient text-white font-extrabold text-xs disabled:opacity-60">
                {saving ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </div>
          </form>
        )}

        {/* User Info */}
        <div className="bg-[#FBEEF1] border-2 border-[#F4D6DC] rounded-2xl p-4 space-y-2 text-xs font-bold text-[#9E6B72]">
          <div className="flex justify-between">
            <span>Email:</span>
                <span className="text-[#720002]">{displayProfile.email}</span>
          </div>
          <div className="flex justify-between">
            <span>No. Phone:</span>
                <span className="text-[#720002]">{displayProfile.phone}</span>
          </div>
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
              href={`https://wa.me/6283879345539?text=${proofWhatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-card-buy w-full text-xs py-2.5 flex items-center justify-center gap-1.5"
            >
              <i className="fa-brands fa-whatsapp text-sm"></i> Kirim Proof + Akun
            </a>
            <p className="text-[10px] font-bold text-[#9E6B72] text-center">Khusus send proof + akun</p>
          </div>
          {/* Form khusus Canva */}
          <div className="rounded-xl border-2 border-[#DB8291]/40 bg-white p-4 space-y-2">
            <p className="text-[11px] font-extrabold text-[#720002] uppercase tracking-wider flex items-center gap-1.5">
              <span>🎨</span> Form Proof Canva
            </p>
            <p className="text-[11px] font-bold text-[#9E6B72] leading-relaxed">
              Khusus untuk pesanan <span className="text-[#720002]">Canva</span>, silakan isi form di bawah ini.
            </p>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSdjZmf4CCI7ycDcxu9s9ObDBRcOXCfZ1U56mZjCtaPIjMj-Og/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-card-buy w-full text-xs py-2.5 flex items-center justify-center gap-1.5"
            >
              <i className="fa-solid fa-list-check text-sm"></i> Kirim Form Canva
            </a>
            <p className="text-[10px] font-bold text-[#9E6B72] text-center">Wajib untuk produk Canva</p>
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
