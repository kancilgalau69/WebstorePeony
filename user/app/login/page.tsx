'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { useAuth } from '@/components/AuthProvider'

export default function LoginPage() {
  const router = useRouter()
  const { user, login } = useAuth()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!identifier.trim()) {
      setError('Masukkan email atau nomor HP')
      return
    }

    if (!password) {
      setError('Masukkan password')
      return
    }

    setLoading(true)

    const result = await login(identifier.trim(), password, captchaToken)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        router.push('/profile')
      }, 1000)
    } else {
      setError(result.error || 'Login gagal')
      resetCaptcha()
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto py-12 animate-fadeIn text-center">
        <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-8 shadow-xs space-y-3">
          <div className="text-5xl text-[#CB96BA] mb-2">🌸</div>
          <h1 className="font-fredoka text-2xl text-[#3E2D3B]">Login Berhasil!</h1>
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
            <h1 className="font-fredoka text-3xl text-[#3E2D3B]">Masuk Akun</h1>
            <p className="text-xs text-[#8E7188] font-bold mt-1">
              Masuk untuk melihat riwayat pesanan Anda
            </p>
          </div>

          {error && (
            <div className="bg-[#FFE4E6] border border-[#BE123C]/20 rounded-2xl p-3 text-xs font-bold text-[#BE123C]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-[#3E2D3B] uppercase tracking-wider mb-1.5">
                Email atau Nomor HP <span className="text-[#D9777F]">*</span>
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#F0E2EB] bg-[#F7F2F6] text-[#3E2D3B] font-extrabold text-sm outline-none focus:border-[#CB96BA]"
                placeholder="contoh@email.com atau 08xxxxxxxx"
                autoComplete="username"
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
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E7188]"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
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
              disabled={loading || (!captchaToken && captchaReady)}
              className="btn-card-buy w-full py-3.5 text-xs mt-2"
            >
              {loading ? 'Masuk...' : !captchaToken && captchaReady ? 'Selesaikan CAPTCHA dulu' : 'Masuk Akun Sekarang ✦'}
            </button>
          </form>

          <div className="text-center text-xs font-bold text-[#8E7188] pt-2">
            Belum punya akun?{' '}
            <Link href="/register" className="text-[#CB96BA] font-extrabold hover:underline">
              Daftar sekarang
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
