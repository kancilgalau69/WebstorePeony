'use client'

import { useCart } from '@/components/CartProvider'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { resolveWebPrice } from '@/lib/pricing'

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const getItemPrice = (product: any) => resolveWebPrice(product)
  const normalizeEmail = (email: string) => String(email || '').trim().toLowerCase()
  const isValidEmail = (email: string) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizeEmail(email))
  const [customerName, setCustomerName] = useState(user?.nama || '')
  const [customerEmail, setCustomerEmail] = useState(user?.email || '')
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '')
  const [loading, setLoading] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string>('')
  const [captchaReady, setCaptchaReady] = useState(false)
  const captchaRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<number | null>(null)

  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string; title: string; discount_amount: number;
    reward_product?: { id: string; name: string; qty: number } | null;
    promo_type: string;
  } | null>(null)
  const [promoError, setPromoError] = useState('')

  // Payment preview (gateway + admin fee for Qiospay), shown before generating QRIS.
  const [paymentInfo, setPaymentInfo] = useState<{
    gateway: string; subtotal: number; promoDiscount: number;
    netTotal: number; adminFee: number; total: number;
  } | null>(null)

  // Wallet balance + payment method choice ('qris' | 'balance')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [payMethod, setPayMethod] = useState<'qris' | 'balance'>('qris')

  useEffect(() => {
    let cancelled = false
    fetch('/api/wallet', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setWalletBalance(Number(d.balance || 0)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
    setIsProcessingPayment(false)
    setLoading(false)
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

  // Guests are shown a "must have an account" info screen (rendered below);
  // they click Daftar/Masuk themselves — we do NOT auto-redirect.

  useEffect(() => {
    if (items.length === 0 && !isProcessingPayment) {
      const timer = setTimeout(() => {
        if (items.length === 0 && !isProcessingPayment) {
          router.push('/cart')
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [items, router, isProcessingPayment])

  // Fetch payment preview (gateway + admin fee) so the customer sees the exact
  // total before the QRIS is generated. Re-runs when cart or promo changes.
  useEffect(() => {
    if (items.length === 0) {
      setPaymentInfo(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const fetchInfo = async () => {
      try {
        const res = await fetch('/api/payment-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({ product: { id: i.product.id }, quantity: i.quantity })),
            ...(appliedPromo ? { promoCode: appliedPromo.code } : {}),
          }),
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setPaymentInfo(data)
      } catch {
        // Non-blocking; summary falls back to client-side total.
      }
    }
    fetchInfo()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [items, appliedPromo])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase()
    if (!code) { setPromoError('Masukkan kode promo'); return }
    setPromoLoading(true); setPromoError(''); setAppliedPromo(null)
    try {
      const cartItems = items.map(i => ({ product_id: i.product.id, quantity: i.quantity }))
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, cart_total: total, cart_items: cartItems }),
      })
      const json = await res.json()
      if (json.valid) {
        setAppliedPromo({
          code: json.promo.code,
          title: json.promo.title,
          discount_amount: json.discount_amount || 0,
          reward_product: json.reward_product || null,
          promo_type: json.promo.promo_type,
        })
        setPromoError('')
      } else {
        setPromoError(json.error || 'Kode promo tidak valid')
        setAppliedPromo(null)
      }
    } catch { setPromoError('Gagal memvalidasi promo') } finally { setPromoLoading(false) }
  }

  const removePromo = () => { setAppliedPromo(null); setPromoCode(''); setPromoError('') }

  const finalTotal = Math.max(0, total - (appliedPromo?.discount_amount || 0))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const normalizedCustomerName = String(customerName || '').trim()
    const normalizedCustomerEmail = normalizeEmail(customerEmail)
    const normalizedCustomerPhone = String(customerPhone || '').trim()

    if (!normalizedCustomerName || !normalizedCustomerEmail || !normalizedCustomerPhone) {
      alert('Mohon isi semua data!')
      return
    }

    if (!isValidEmail(normalizedCustomerEmail)) {
      alert('Email tidak valid. Gunakan email aktif agar salinan item bisa dikirim.')
      return
    }

    setLoading(true)
    setIsProcessingPayment(true)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items,
          customerName: normalizedCustomerName,
          customerEmail: normalizedCustomerEmail,
          customerPhone: normalizedCustomerPhone,
          captchaToken,
          ...(appliedPromo ? { promoCode: appliedPromo.code, promoDiscount: appliedPromo.discount_amount } : {}),
          // Reuse the previewed Qiospay admin fee so the charged total matches what was shown.
          ...(paymentInfo?.gateway === 'qiospay' && paymentInfo.adminFee ? { qiospayAdminFee: paymentInfo.adminFee } : {}),
          // Pay with wallet balance instead of QRIS.
          ...(payMethod === 'balance' ? { payMethod: 'balance' } : {}),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Session expired / not logged in -> send to register.
        if (response.status === 401 || data.requireAuth) {
          router.push('/register?redirect=/checkout')
          return
        }
        // Insufficient balance -> guide to deposit.
        if (data.insufficientBalance) {
          resetCaptcha()
          alert('Saldo tidak cukup. Anda akan diarahkan ke halaman deposit.')
          router.push('/deposit')
          return
        }
        resetCaptcha()
        throw new Error(data.error || 'Gagal membuat transaksi')
      }

      // Paid with balance -> order already completed.
      if (data.paidWithBalance) {
        clearCart()
        await router.push(data.redirectUrl || `/order-success?orderId=${data.orderId}`)
        return
      }

      if (data.qrString || data.qrUrl) {
        clearCart()
        const params = new URLSearchParams({
          orderId: data.orderId || '',
          qrString: data.qrString || '',
          qrUrl: data.qrUrl || '',
          transactionId: data.transactionId || '',
        })
        if (data.amount) params.set('amount', String(data.amount))
        if (data.adminFee) params.set('adminFee', String(data.adminFee))
        if (data.subtotal) params.set('subtotal', String(data.subtotal))
        await router.push(`/order-pending?${params.toString()}`)
        return
      }

      const snap = (window as any).snap
      if (snap && data.snapToken) {
        snap.pay(data.snapToken, {
          onSuccess: function () {
            clearCart()
            router.push(`/order-success?orderId=${data.orderId}`)
          },
          onPending: function () {
            clearCart()
            router.push(`/order-pending?orderId=${data.orderId}`)
          },
          onError: function () {
            alert('Pembayaran gagal, silakan coba lagi')
            setLoading(false)
          },
          onClose: function () {
            setLoading(false)
            setIsProcessingPayment(false)
          },
        })
        return
      }
    } catch (error: any) {
      alert(error.message || 'Terjadi kesalahan, silakan coba lagi')
      setLoading(false)
      setIsProcessingPayment(false)
      resetCaptcha()
    }
  }

  // While auth is still resolving, show a spinner so we never flash the form
  // (or the guest screen) before we know if the user is logged in.
  if (authLoading) {
    return (
      <div className="py-20 text-center text-[#9E6B72]">
        <div className="text-4xl animate-bounce mb-2 text-[#DB8291]"><i className="fa-solid fa-store"></i></div>
        <p className="font-fredoka text-lg text-[#720002]">Memuat Checkout...</p>
      </div>
    )
  }

  // Guests must register/login before checkout (shown before the empty-cart guard
  // so a logged-out user always sees this, not a redirect).
  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 text-center animate-fadeIn">
        <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-8 shadow-xs space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FBEEF1] border-2 border-[#F4D6DC] flex items-center justify-center text-3xl text-[#DB8291]">
            <i className="fa-solid fa-user-lock"></i>
          </div>
          <h1 className="font-fredoka text-2xl text-[#720002]">Wajib Punya Akun</h1>
          <p className="text-xs text-[#9E6B72] font-bold">
            Untuk melakukan pembelian, Anda harus mendaftar &amp; login terlebih dahulu. Butuh token pendaftaran dari admin.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button onClick={() => router.push('/register?redirect=/checkout')} className="btn-card-buy w-full py-3 text-xs">
              Daftar Sekarang ✦
            </button>
            <button onClick={() => router.push('/login?redirect=/checkout')} className="w-full py-3 rounded-2xl border-2 border-[#F4D6DC] bg-white font-extrabold text-xs text-[#720002] hover:border-[#DB8291]">
              Sudah punya akun? Masuk
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Logged-in but empty cart -> nothing to checkout.
  if (items.length === 0 && !isProcessingPayment) {
    return null
  }

  return (
    <>
      <Script
        src="https://app.midtrans.com/snap/snap.js"
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        strategy="afterInteractive"
      />

      <Script
        src="https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off"
        strategy="afterInteractive"
        onLoad={() => {
          if (captchaRef.current && !(widgetIdRef.current !== null)) {
            renderCaptcha()
          }
        }}
      />

      <div className="max-w-[1160px] mx-auto px-4 space-y-6 animate-fadeIn py-4">
        <h1 className="font-fredoka text-3xl text-[#720002]">Checkout Pembayaran</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Customer Form Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-6 shadow-xs">
              <h2 className="font-fredoka text-xl text-[#720002] mb-4">Informasi Pembeli</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">
                    Nama Lengkap <span className="text-[#D9777F]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
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
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-[#720002] font-extrabold text-sm outline-none focus:border-[#DB8291]"
                    placeholder="contoh@email.com"
                    autoComplete="email"
                  />
                  <p className="mt-1.5 text-[11px] font-bold text-[#9E6B72] bg-[#FBEEF1] border border-[#F4D6DC] rounded-xl px-3 py-2">
                    🌸 Item digital &amp; bukti transaksi akan langsung dikirimkan ke email ini.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">
                    No. Telepon / WhatsApp <span className="text-[#D9777F]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[#F4D6DC] bg-[#FBEEF1] text-[#720002] font-extrabold text-sm outline-none focus:border-[#DB8291]"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>

                <div className="mt-6">
                  <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-2">
                    Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* QRIS */}
                    <button
                      type="button"
                      onClick={() => setPayMethod('qris')}
                      className={`text-left p-4 rounded-2xl border-2 transition ${
                        payMethod === 'qris' ? 'border-[#DB8291] bg-[#FBEEF1]' : 'border-[#F4D6DC] bg-white hover:border-[#E7A6B1]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-qrcode text-[#DB8291]"></i>
                        <span className="font-fredoka text-sm text-[#720002]">QRIS</span>
                        {payMethod === 'qris' && <i className="fa-solid fa-circle-check text-[#DB8291] ml-auto"></i>}
                      </div>
                      <p className="text-[11px] font-bold text-[#9E6B72] mt-1">Scan via bank / e-wallet</p>
                    </button>

                    {/* Saldo */}
                    <button
                      type="button"
                      onClick={() => setPayMethod('balance')}
                      className={`text-left p-4 rounded-2xl border-2 transition ${
                        payMethod === 'balance' ? 'border-[#DB8291] bg-[#FBEEF1]' : 'border-[#F4D6DC] bg-white hover:border-[#E7A6B1]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-wallet text-[#DB8291]"></i>
                        <span className="font-fredoka text-sm text-[#720002]">Saldo</span>
                        {payMethod === 'balance' && <i className="fa-solid fa-circle-check text-[#DB8291] ml-auto"></i>}
                      </div>
                      <p className="text-[11px] font-bold text-[#9E6B72] mt-1">
                        {walletBalance === null ? 'Memuat saldo...' : `Saldo: ${formatPrice(walletBalance)}`}
                      </p>
                    </button>
                  </div>

                  {payMethod === 'balance' && walletBalance !== null && walletBalance < finalTotal && (
                    <div className="mt-3 bg-[#FFE4E6] border border-[#C81E3A]/20 text-[#C81E3A] rounded-2xl p-3 text-xs font-bold flex items-center justify-between gap-2">
                      <span>Saldo tidak cukup ({formatPrice(walletBalance)}).</span>
                      <Link href="/deposit" className="underline shrink-0">Top up dulu</Link>
                    </div>
                  )}
                  {payMethod === 'balance' && (
                    <p className="text-[11px] font-bold text-[#2E7D5B] mt-2">
                      <i className="fa-solid fa-bolt"></i> Bayar pakai saldo = instan, tanpa biaya admin.
                    </p>
                  )}
                </div>

                {/* CAPTCHA */}
                <div className="mt-6">
                  <label className="block text-xs font-extrabold text-[#720002] uppercase tracking-wider mb-1.5">
                    Verifikasi Keamanan <span className="text-[#D9777F]">*</span>
                  </label>
                  <div ref={captchaRef} />
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    (!captchaToken && captchaReady) ||
                    (payMethod === 'balance' && walletBalance !== null && walletBalance < finalTotal)
                  }
                  className="btn-card-buy w-full py-3.5 text-xs mt-6"
                >
                  {loading
                    ? 'Memproses Transaksi...'
                    : !captchaToken && captchaReady
                    ? 'Selesaikan CAPTCHA dulu'
                    : payMethod === 'balance'
                    ? `Bayar Pakai Saldo ${formatPrice(finalTotal)} ✦`
                    : `Bayar Sekarang ${formatPrice(paymentInfo?.gateway === 'qiospay' ? (finalTotal + (paymentInfo.adminFee || 0)) : finalTotal)} ✦`}
                </button>
              </form>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-6 sticky top-20 shadow-xs space-y-4">
              <h2 className="font-fredoka text-xl text-[#720002]">Ringkasan Pesanan</h2>
              
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-xs font-bold text-[#9E6B72]">
                    <span className="truncate max-w-[180px]">
                      {item.product.nama} (x{item.quantity})
                    </span>
                    <span className="text-[#720002]">
                      {formatPrice(getItemPrice(item.product) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Promo Code Input */}
              <div className="border-t-2 border-[#F4D6DC] pt-4">
                {appliedPromo ? (
                  <div className="bg-[#DCFCE7] border border-[#15803D]/20 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold text-[#15803D]">
                        ✔ Kode Promo: {appliedPromo.code}
                      </p>
                      <p className="text-[10px] text-[#15803D] font-bold">Hemat {formatPrice(appliedPromo.discount_amount)}</p>
                    </div>
                    <button onClick={removePromo} className="text-xs font-extrabold text-[#D9777F]">Hapus</button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-extrabold text-[#720002] uppercase mb-1">Kode Promo</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError('') }}
                        placeholder="KODE PROMO"
                        className="flex-1 px-3 py-2 border-2 border-[#F4D6DC] rounded-xl text-xs font-extrabold outline-none uppercase text-[#720002]"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={promoLoading || !promoCode.trim()}
                        className="px-4 py-2 bg-[#DB8291] text-white rounded-xl text-xs font-extrabold hover:bg-[#C56676] disabled:opacity-40"
                      >
                        {promoLoading ? '...' : 'Gunakan'}
                      </button>
                    </div>
                    {promoError && <p className="text-[10px] text-[#D9777F] font-bold mt-1">{promoError}</p>}
                  </div>
                )}
              </div>

              <div className="border-t-2 border-[#F4D6DC] pt-4 space-y-2">
                {/* Subtotal */}
                <div className="flex justify-between text-xs font-bold text-[#9E6B72]">
                  <span>Subtotal</span>
                  <span className="text-[#720002]">{formatPrice(finalTotal)}</span>
                </div>

                {/* Qiospay admin fee — only for QRIS payment, not when paying with saldo */}
                {payMethod !== 'balance' && paymentInfo?.gateway === 'qiospay' && paymentInfo.adminFee > 0 && (
                  <div className="flex justify-between text-xs font-bold text-[#9E6B72]">
                    <span className="flex items-center gap-1">
                      Biaya Admin
                      <span className="text-[10px] text-[#B8A0B2]" title="Kode unik untuk verifikasi pembayaran otomatis">
                        (kode unik)
                      </span>
                    </span>
                    <span className="text-[#720002]">{formatPrice(paymentInfo.adminFee)}</span>
                  </div>
                )}

                {payMethod === 'balance' && (
                  <div className="flex justify-between text-xs font-bold text-[#9E6B72]">
                    <span>Biaya Admin</span>
                    <span className="text-[#2E7D5B]">Gratis</span>
                  </div>
                )}

                <div className="flex justify-between font-fredoka text-xl pt-1 border-t border-[#F4D6DC]">
                  <span className="text-[#720002]">Total</span>
                  <span className="text-[#DB8291]">
                    {formatPrice(
                      payMethod !== 'balance' && paymentInfo?.gateway === 'qiospay'
                        ? finalTotal + (paymentInfo.adminFee || 0)
                        : finalTotal
                    )}
                  </span>
                </div>

                {payMethod !== 'balance' && paymentInfo?.gateway === 'qiospay' && paymentInfo.adminFee > 0 && (
                  <p className="text-[10px] font-bold text-[#9E6B72] bg-[#FBEEF1] border border-[#F4D6DC] rounded-xl px-3 py-2 mt-1">
                    ℹ️ Biaya admin {formatPrice(paymentInfo.adminFee)} adalah kode unik yang membantu sistem memverifikasi pembayaran Anda secara otomatis.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
