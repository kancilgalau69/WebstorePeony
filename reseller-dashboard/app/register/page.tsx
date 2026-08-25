'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type RegisteredData = {
  nama_reseller: string
  nama_toko: string
  slug: string
  email: string
}

const FALLBACK_ADMIN_WHATSAPP = '6282340915319'
const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || 'a10e1ef4-a23c-4ba2-8562-38dec686e79e'

export default function RegisterPage() {
  const [form, setForm] = useState({
    nama_reseller: '',
    nama_toko: '',
    slug: '',
    email: '',
    phone: '',
    whatsapp: '',
    password: '',
    confirmPassword: '',
    deskripsi: '',
  })
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [adminWhatsapp, setAdminWhatsapp] = useState(FALLBACK_ADMIN_WHATSAPP)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [registeredData, setRegisteredData] = useState<RegisteredData | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReady, setCaptchaReady] = useState(false)
  const captchaRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<number | null>(null)

  const adminContactUrl = `https://wa.me/${adminWhatsapp}?text=${encodeURIComponent(
    registeredData
      ? `Halo admin, saya sudah mendaftar sebagai reseller PBS dengan nama ${registeredData.nama_reseller}, toko ${registeredData.nama_toko}, email ${registeredData.email}. Mohon bantu aktivasi akun saya.`
      : 'Halo admin, saya ingin bertanya tentang pendaftaran reseller PBS.',
  )}`
  const webResellerUrl = process.env.NEXT_PUBLIC_RESELLER_WEB_URL || 'http://localhost:3003'

  const renderCaptcha = () => {
    const hc = (window as any).hcaptcha
    if (!hc || !captchaRef.current) return
    if (!HCAPTCHA_SITE_KEY) {
      setError('Konfigurasi hCaptcha belum lengkap. NEXT_PUBLIC_HCAPTCHA_SITE_KEY belum diset.')
      return
    }

    if (widgetIdRef.current !== null) {
      try { hc.remove(widgetIdRef.current) } catch {}
      widgetIdRef.current = null
    }
    captchaRef.current.innerHTML = ''

    try {
      widgetIdRef.current = hc.render(captchaRef.current, {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: (token: string) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      })
      setCaptchaReady(true)
    } catch (err) {
      console.warn('hCaptcha render error:', err)
    }
  }

  const resetCaptcha = () => {
    setCaptchaToken('')
    const hc = (window as any).hcaptcha
    if (hc && widgetIdRef.current !== null) {
      try { hc.reset(widgetIdRef.current) } catch {}
    }
  }

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/auth/register', { cache: 'no-store' })
        const data = await res.json()
        setRegistrationEnabled(data.enabled !== false)
        setAdminWhatsapp(data.adminWhatsapp || FALLBACK_ADMIN_WHATSAPP)
      } catch {
        setRegistrationEnabled(true)
      } finally {
        setSettingsLoaded(true)
      }
    }

    fetchSettings()
  }, [])

  useEffect(() => {
    setCaptchaToken('')
    setCaptchaReady(false)
    widgetIdRef.current = null

    const callbackName = '__pbsResellerHCaptchaOnLoad'
    const onCaptchaLoad = () => {
      ;(window as any).__pbsResellerHCaptchaLoaded = true
      renderCaptcha()
    }

    ;(window as any)[callbackName] = onCaptchaLoad

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-pbs-reseller-hcaptcha="true"]')
    if ((window as any).__pbsResellerHCaptchaLoaded && (window as any).hcaptcha) {
      renderCaptcha()
    } else if (!existingScript) {
      const script = document.createElement('script')
      script.src = `https://js.hcaptcha.com/1/api.js?render=explicit&onload=${callbackName}&recaptchacompat=off`
      script.async = true
      script.defer = true
      script.dataset.pbsResellerHcaptcha = 'true'
      document.head.appendChild(script)
    }

    return () => {
      const hc = (window as any).hcaptcha
      if (hc && widgetIdRef.current !== null) {
        try { hc.remove(widgetIdRef.current) } catch {}
      }
      widgetIdRef.current = null
      if ((window as any)[callbackName] === onCaptchaLoad) {
        ;(window as any)[callbackName] = () => {}
      }
    }
  }, [])

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSlugChange = (value: string) => {
    updateForm('slug', value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  const passwordsMatch = form.password === form.confirmPassword && form.confirmPassword.length > 0
  const passwordValid = form.password.length >= 8 && form.password.length <= 64

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!passwordValid) {
      setError('Password minimal 8 karakter dan maksimal 64 karakter')
      return
    }

    if (!passwordsMatch) {
      setError('Konfirmasi password tidak cocok')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, captchaToken }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Gagal mendaftar. Silakan cek kembali inputan Anda.')
        resetCaptcha()
        return
      }

      setRegisteredData({
        nama_reseller: data.reseller?.nama_reseller || form.nama_reseller,
        nama_toko: data.reseller?.nama_toko || form.nama_toko,
        slug: data.reseller?.slug || form.slug,
        email: data.reseller?.email || form.email,
      })
      setAdminWhatsapp(data.adminWhatsapp || adminWhatsapp)
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi nanti.')
      resetCaptcha()
    } finally {
      setLoading(false)
    }
  }

  if (registeredData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1229] via-[#13183a] to-[#0f1229] px-4 py-10">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600">
            <i className="fa-solid fa-circle-check text-3xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#141a33]">Pendaftaran Berhasil</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Akun reseller untuk toko <strong>{registeredData.nama_toko}</strong> sudah masuk ke sistem. Status akun masih nonaktif dan harus diaktifkan manual oleh admin pusat sebelum bisa login.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-left text-sm space-y-2">
            <div className="flex justify-between gap-4"><span className="text-gray-500">Nama reseller</span><strong className="text-gray-900 text-right">{registeredData.nama_reseller}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">Nama toko</span><strong className="text-gray-900 text-right">{registeredData.nama_toko}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">Slug</span><strong className="text-[#5c63f2] text-right">/{registeredData.slug}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-gray-500">Email</span><strong className="text-gray-900 text-right">{registeredData.email}</strong></div>
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm flex gap-3 text-left">
            <i className="fa-solid fa-clock mt-0.5"></i>
            <span>Silakan tunggu aktivasi dari admin pusat. Anda dapat menghubungi admin untuk mempercepat proses pengecekan akun.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={adminContactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2"
            >
              <i className="fa-brands fa-whatsapp"></i>
              Hubungi Admin
            </a>
            <Link
              href="/login?registered=pending"
              className="py-3 bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white font-semibold rounded-xl hover:shadow-lg transition flex items-center justify-center gap-2"
            >
              Ke Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (settingsLoaded && !registrationEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1229] via-[#13183a] to-[#0f1229] px-4 py-10">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 text-amber-600">
            <i className="fa-solid fa-lock text-3xl"></i>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[#141a33]">Pendaftaran Sedang Ditutup</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Pendaftaran reseller mandiri saat ini belum dibuka. Silakan hubungi admin pusat untuk informasi aktivasi atau kunjungi landing page reseller untuk melihat detail program.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={adminContactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2"
            >
              <i className="fa-brands fa-whatsapp"></i>
              Hubungi Admin
            </a>
            <a
              href={webResellerUrl}
              className="py-3 bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white font-semibold rounded-xl hover:shadow-lg transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-circle-info"></i>
              Info Reseller
            </a>
          </div>

          <Link href="/login" className="inline-flex text-sm text-gray-500 hover:text-[#5c63f2] transition">
            Sudah punya akun? Masuk ke dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1229] via-[#13183a] to-[#0f1229] px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5c63f2] to-[#7b5cf7] mb-4">
              <i className="fa-solid fa-store text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-white">Daftar Reseller</h1>
            <p className="text-white/60 mt-1">PBS Digital Store</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-[#141a33]">Buat Akun Reseller</h2>
              <p className="text-sm text-gray-500 mt-1">Akun akan aktif setelah disetujui admin pusat</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation"></i>
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Reseller *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><i className="fa-solid fa-user"></i></span>
                  <input
                    type="text"
                    value={form.nama_reseller}
                    onChange={(e) => updateForm('nama_reseller', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none transition text-gray-800"
                    placeholder="Nama pemilik/reseller"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Toko *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><i className="fa-solid fa-store"></i></span>
                  <input
                    type="text"
                    value={form.nama_toko}
                    onChange={(e) => updateForm('nama_toko', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none transition text-gray-800"
                    placeholder="Nama toko reseller"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug URL *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">/</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none transition text-gray-800"
                    placeholder="nama-toko"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><i className="fa-solid fa-envelope"></i></span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none transition text-gray-800"
                    placeholder="email@contoh.com"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">No. Telepon</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none transition text-gray-800"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp</label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => updateForm('whatsapp', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none transition text-gray-800"
                  placeholder="628xxxxxxxxxx"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><i className="fa-solid fa-lock"></i></span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => updateForm('password', e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none transition text-gray-800"
                    placeholder="Min. 8 karakter"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {form.password.length > 0 && (
                  <p className={`text-xs mt-1 ${passwordValid ? 'text-emerald-600' : 'text-red-500'}`}>{passwordValid ? 'Password valid' : 'Minimal 8 karakter'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Konfirmasi Password *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><i className="fa-solid fa-lock"></i></span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => updateForm('confirmPassword', e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none transition text-gray-800"
                    placeholder="Ulangi password"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {form.confirmPassword.length > 0 && (
                  <p className={`text-xs mt-1 ${passwordsMatch ? 'text-emerald-600' : 'text-red-500'}`}>{passwordsMatch ? 'Password cocok' : 'Password tidak cocok'}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Deskripsi Toko</label>
              <textarea
                value={form.deskripsi}
                onChange={(e) => updateForm('deskripsi', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none transition text-gray-800 resize-none"
                placeholder="Deskripsi singkat toko (opsional)"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Verifikasi Keamanan *</label>
              <div ref={captchaRef} className="flex justify-center sm:justify-start" />
            </div>

            <button
              type="submit"
              disabled={loading || (!captchaToken && captchaReady) || !passwordValid || !passwordsMatch}
              className="w-full py-3 bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white font-semibold rounded-xl shadow-lg shadow-[#5c63f2]/25 hover:shadow-[#5c63f2]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2"><i className="fa-solid fa-spinner fa-spin"></i>Mendaftarkan...</span>
              ) : !captchaToken && captchaReady ? (
                'Selesaikan CAPTCHA dulu'
              ) : (
                'Daftar Reseller'
              )}
            </button>

            <div className="text-center pt-2 border-t border-gray-100 text-sm text-gray-500">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-[#5c63f2] font-semibold hover:underline">Masuk ke Dashboard</Link>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
