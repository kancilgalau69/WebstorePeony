'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { useAuth } from '@/components/AuthProvider'

function RegisterInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/profile'
  const { user, register } = useAuth()

  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
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
      router.push(redirectTo)
    }
  }, [user, router, redirectTo])

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

    if (!nama.trim() || !email.trim() || !phone.trim() || !token.trim() || !password || !confirmPassword) {
      setError('Mohon isi semua data termasuk token pendaftaran!')
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
      token: token.trim(),
      password,
      confirmPassword,
      captchaToken,
    })

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        router.push(redirectTo)
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
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-8 shadow-xs space-y-3">
          <div className="text-5xl text-[#DB8291] mb-2">🌸</div>
          <h1 className="font-fredoka text-2xl text-[#720002]">Registrasi Berhasil!</h1>
          <p className="text-xs text-[#9E6B72] font-bold">Mengalihkan ke profil Anda...</p>
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
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-6 md:p-8 shadow-xs space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#FBEEF1] border-2 border-[#F4D6DC] rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">
              🌸
            </div>
            <h1 className="font-fredoka text-3xl text-[#720002]">Daftar Akun Baru</h1>
            <p className="text-xs text-[#9E6B72] font-bold mt-1">
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
            {/* Registration token (admin-issued) */}
            <div>
              <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">
                Token Pendaftaran <span className="text-[#D9777F]">*</span>
              </label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#DB8291] bg-white text-[#720002] font-mono font-extrabold text-sm tracking-wider outline-none focus:border-[#720002] uppercase"
                placeholder="RAIN-XXXX-XXXX"
              />
              <p className="mt-1.5 text-[11px] font-bold text-[#9E6B72] bg-[#FBEEF1] border border-[#F4D6DC] rounded-xl px-3 py-2">
                🔑 Token diberikan oleh admin. Hubungi admin untuk mendapatkan token pendaftaran.
              </p>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">
                Nama Lengkap <span className="text-[#D9777F]">*</span>
              </label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-[#720002] font-extrabold text-sm outline-none focus:border-[#DB8291]"
                placeholder="Nama lengkap Anda"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">
                Email Aktif <span className="text-[#D9777F]">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-[#720002] font-extrabold text-sm outline-none focus:border-[#DB8291]"
                placeholder="contoh@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">
                Nomor HP / WhatsApp <span className="text-[#D9777F]">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-[#720002] font-extrabold text-sm outline-none focus:border-[#DB8291]"
                placeholder="08xxxxxxxxxx"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">
                Password <span className="text-[#D9777F]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-[#720002] font-extrabold text-sm outline-none focus:border-[#DB8291]"
                  placeholder="Buat password yang kuat"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9E6B72]"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-2 bg-[#FBEEF1] border border-[#F4D6DC] rounded-2xl p-3 text-[11px] font-bold text-[#9E6B72] space-y-1">
                  {getPasswordChecks().map((check, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className={check.valid ? 'text-[#15803D]' : 'text-[#D9777F]'}>
                        {check.valid ? '✓' : '✗'}
                      </span>
                      <span className={check.valid ? 'text-[#15803D]' : 'text-[#9E6B72]'}>{check.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">
                Konfirmasi Password <span className="text-[#D9777F]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-[#720002] font-extrabold text-sm outline-none focus:border-[#DB8291]"
                  placeholder="Ulangi password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9E6B72]"
                >
                  <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">
                Verifikasi Keamanan <span className="text-[#D9777F]">*</span>
              </label>
              <div ref={captchaRef} />
            </div>

            <button
              type="submit"
              disabled={loading || (!captchaToken && captchaReady) || !isPasswordStrong() || !passwordsMatch || !token.trim()}
              className="btn-card-buy w-full py-3.5 text-xs mt-2"
            >
              {loading ? 'Mendaftarkan...' : !captchaToken && captchaReady ? 'Selesaikan CAPTCHA dulu' : 'Daftar Sekarang ✦'}
            </button>
          </form>

          <div className="text-center text-xs font-bold text-[#9E6B72] pt-2">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-[#DB8291] font-extrabold hover:underline">
              Masuk di sini
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-[#9E6B72]">
        <div className="text-4xl animate-bounce mb-2 text-[#DB8291]"><i className="fa-solid fa-store"></i></div>
        <p className="font-fredoka text-lg text-[#720002]">Memuat...</p>
      </div>
    }>
      <RegisterInner />
    </Suspense>
  )
}
