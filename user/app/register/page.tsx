'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { useAuth } from '@/components/AuthProvider'

export default function RegisterPage() {
  const router = useRouter()
  const { user, register } = useAuth()

  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
  const [success, setSuccess] = useState(false)

  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReady, setCaptchaReady] = useState(false)
  const captchaRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (user) {
      router.push('/profile')
    }
  }, [user, router])

  const renderCaptcha = () => {
    const hc = (window as any).hcaptcha
    if (!hc || !captchaRef.current) return

    if (widgetIdRef.current !== null) {
      try { hc.remove(widgetIdRef.current) } catch {}
      widgetIdRef.current = null
    }
    captchaRef.current.innerHTML = ''

    try {
      widgetIdRef.current = hc.render(captchaRef.current, {
        sitekey: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || '',
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
    setCaptchaToken('')
    setCaptchaReady(false)
    widgetIdRef.current = null

    let attempts = 0
    const tryRender = () => {
      if ((window as any).hcaptcha && captchaRef.current) {
        renderCaptcha()
        return
      }
      attempts++
      if (attempts < 30) setTimeout(tryRender, 200)
    }
    setTimeout(tryRender, 100)

    return () => { attempts = 999 }
  }, [])

  const getPasswordChecks = () => {
    return [
      { label: 'Minimal 8 karakter', valid: password.length >= 8 },
      { label: 'Huruf kecil (a-z)', valid: /[a-z]/.test(password) },
      { label: 'Huruf besar (A-Z)', valid: /[A-Z]/.test(password) },
      { label: 'Angka (0-9)', valid: /[0-9]/.test(password) },
      { label: 'Karakter spesial (!@#$%...)', valid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
    ]
  }

  const isPasswordStrong = () => getPasswordChecks().every(c => c.valid)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setPasswordErrors([])

    if (!nama.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setError('Mohon isi semua data!')
      return
    }

    if (!isPasswordStrong()) {
      setError('Password belum memenuhi semua persyaratan')
      return
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok')
      return
    }

    setLoading(true)

    const result = await register({
      nama: nama.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      confirmPassword,
      captchaToken,
    })

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        router.push('/profile')
      }, 1500)
    } else {
      setError(result.error || 'Registrasi gagal')
      if (result.passwordErrors) {
        setPasswordErrors(result.passwordErrors)
      }
      resetCaptcha()
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto py-12 animate-fadeIn text-center">
        <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-8 shadow-xs space-y-3">
          <div className="text-5xl text-[#CB96BA] mb-2">🌸</div>
          <h1 className="font-fredoka text-2xl text-[#3E2D3B]">Registrasi Berhasil!</h1>
          <p className="text-xs text-[#8E7188] font-bold">Mengalihkan ke profil Anda...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Script
        src="https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off"
        strategy="afterInteractive"
        onLoad={() => {
          if (captchaRef.current && widgetIdRef.current === null) {
            renderCaptcha()
          }
        }}
      />

      <div className="max-w-md mx-auto py-8 animate-fadeIn">
        <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-6 md:p-8 shadow-xs space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#F7F2F6] border-2 border-[#F0E2EB] rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">
              🌸
            </div>
            <h1 className="font-fredoka text-3xl text-[#3E2D3B]">Daftar Akun Baru</h1>
            <p className="text-xs text-[#8E7188] font-bold mt-1">
              Buat akun untuk mengelola transaksi &amp; riwayat pesanan
            </p>
          </div>

          {error && (
            <div className="bg-[#FFE4E6] border border-[#BE123C]/20 rounded-2xl p-3 text-xs font-bold text-[#BE123C]">
              <p>{error}</p>
              {passwordErrors.length > 0 && (
                <ul className="mt-1 text-[11px] list-disc list-inside">
                  {passwordErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-[#3E2D3B] uppercase tracking-wider mb-1.5">
                Nama Lengkap <span className="text-[#D9777F]">*</span>
              </label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#F0E2EB] bg-[#F7F2F6] text-[#3E2D3B] font-extrabold text-sm outline-none focus:border-[#CB96BA]"
                placeholder="Nama lengkap Anda"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#3E2D3B] uppercase tracking-wider mb-1.5">
                Email Aktif <span className="text-[#D9777F]">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#F0E2EB] bg-[#F7F2F6] text-[#3E2D3B] font-extrabold text-sm outline-none focus:border-[#CB96BA]"
                placeholder="contoh@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#3E2D3B] uppercase tracking-wider mb-1.5">
                Nomor HP / WhatsApp <span className="text-[#D9777F]">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#F0E2EB] bg-[#F7F2F6] text-[#3E2D3B] font-extrabold text-sm outline-none focus:border-[#CB96BA]"
                placeholder="08xxxxxxxxxx"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#3E2D3B] uppercase tracking-wider mb-1.5">
                Password <span className="text-[#D9777F]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-2xl border-2 border-[#F0E2EB] bg-[#F7F2F6] text-[#3E2D3B] font-extrabold text-sm outline-none focus:border-[#CB96BA]"
                  placeholder="Buat password yang kuat"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E7188]"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-2 bg-[#F7F2F6] border border-[#F0E2EB] rounded-2xl p-3 text-[11px] font-bold text-[#8E7188] space-y-1">
                  {getPasswordChecks().map((check, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className={check.valid ? 'text-[#15803D]' : 'text-[#D9777F]'}>
                        {check.valid ? '✓' : '✗'}
                      </span>
                      <span className={check.valid ? 'text-[#15803D]' : 'text-[#8E7188]'}>{check.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#3E2D3B] uppercase tracking-wider mb-1.5">
                Konfirmasi Password <span className="text-[#D9777F]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-2xl border-2 border-[#F0E2EB] bg-[#F7F2F6] text-[#3E2D3B] font-extrabold text-sm outline-none focus:border-[#CB96BA]"
                  placeholder="Ulangi password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E7188]"
                >
                  <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#3E2D3B] uppercase tracking-wider mb-1.5">
                Verifikasi Keamanan <span className="text-[#D9777F]">*</span>
              </label>
              <div ref={captchaRef} />
            </div>

            <button
              type="submit"
              disabled={loading || (!captchaToken && captchaReady) || !isPasswordStrong() || !passwordsMatch}
              className="btn-card-buy w-full py-3.5 text-xs mt-2"
            >
              {loading ? 'Mendaftarkan...' : !captchaToken && captchaReady ? 'Selesaikan CAPTCHA dulu' : 'Daftar Sekarang ✦'}
            </button>
          </form>

          <div className="text-center text-xs font-bold text-[#8E7188] pt-2">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-[#CB96BA] font-extrabold hover:underline">
              Masuk di sini
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
