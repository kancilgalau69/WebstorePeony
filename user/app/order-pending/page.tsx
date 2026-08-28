"use client";
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

function OrderPendingInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')
  const qrString = searchParams.get('qrString')
  const qrUrl = searchParams.get('qrUrl')
  const transactionId = searchParams.get('transactionId')
  const amount = searchParams.get('amount')
  const adminFee = searchParams.get('adminFee')
  const subtotal = searchParams.get('subtotal')

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
  const [checking, setChecking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [timeLeft, setTimeLeft] = useState(15 * 60)
  const [expiryTs, setExpiryTs] = useState<number | null>(null)
  // Guards so background polling and expiry never race into duplicate redirects
  // or overlapping status requests.
  const redirectingRef = useRef(false)
  const pollInFlightRef = useRef(false)

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const waitForOrderReady = async (targetOrderId: string, maxAttempts = 3) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const resp = await fetch(`/api/orders/${targetOrderId}`)
        const data = await resp.json()
        if (resp.ok) {
          const hasItems = Array.isArray(data?.items)
            ? data.items.some((it: any) => String(it?.item_data || '').trim().length > 0)
            : false

          if (String(data?.status || '').toLowerCase() === 'completed' && (data?.itemsReady || hasItems)) {
            return true
          }
        }
      } catch (err) {
        console.warn('[Order Pending] waitForOrderReady error:', err)
      }

      if (attempt < maxAttempts) {
        await sleep(1200)
      }
    }
    return false
  }

  useEffect(() => {
    if (!orderId) {
      router.push('/')
    }

    if (qrString || qrUrl) {
      if (qrString) {
        const encodedQr = encodeURIComponent(qrString)
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedQr}`
        setQrCodeUrl(qrImageUrl)
      } else if (qrUrl) {
        setQrCodeUrl(qrUrl)
      }

      const expiryKey = `qris_expiry_${orderId}`
      const existing = expiryKey ? localStorage.getItem(expiryKey) : null
      let expiry = existing ? Number(existing) : NaN

      if (!expiry || Number.isNaN(expiry)) {
        expiry = Date.now() + 15 * 60 * 1000
        if (expiryKey) {
          localStorage.setItem(expiryKey, String(expiry))
        }
      }

      setExpiryTs(expiry)
    }
  }, [orderId, qrString, router])

  useEffect(() => {
    if (!qrCodeUrl || !expiryTs) return

    const updateTime = () => {
      const diffMs = expiryTs - Date.now()
      const diffSec = Math.max(0, Math.floor(diffMs / 1000))
      setTimeLeft(diffSec)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [qrCodeUrl, expiryTs])

  useEffect(() => {
    if (!orderId && !transactionId) return

    const goToSuccess = async () => {
      if (redirectingRef.current) return
      redirectingRef.current = true
      if (orderId) {
        await waitForOrderReady(orderId)
      }
      router.push(`/order-success?orderId=${orderId}`)
    }

    const goToFailed = (reason: string) => {
      if (redirectingRef.current) return
      redirectingRef.current = true
      router.push(`/order-failed?orderId=${orderId}&reason=${reason}`)
    }

    const checkStatus = async () => {
      // Skip if a previous poll is still running or we're already leaving.
      if (pollInFlightRef.current || redirectingRef.current) return
      pollInFlightRef.current = true
      try {
        const response = await fetch('/api/payment-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_id: orderId,
            transaction_id: transactionId,
          }),
        })

        const data = await response.json()

        if (data.status === 'settlement' || data.status === 'capture') {
          await goToSuccess()
        } else if (data.status === 'cancel' || data.status === 'deny' || data.status === 'expire') {
          goToFailed(data.status)
        }
      } catch (error) {
        console.error('Auto-check error:', error)
      } finally {
        pollInFlightRef.current = false
      }
    }

    checkStatus()
    const interval = setInterval(() => {
      // Stop polling once the QR has expired; send the buyer to the failed page.
      if (expiryTs && Date.now() >= expiryTs) {
        clearInterval(interval)
        goToFailed('expire')
        return
      }
      checkStatus()
    }, 5000)

    return () => clearInterval(interval)
  }, [orderId, transactionId, router, expiryTs])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const downloadQRCode = async () => {
    const sourceUrl = qrUrl || qrCodeUrl
    if (!sourceUrl) return

    const triggerDownload = (blob: Blob) => {
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `QRIS-${orderId || 'payment'}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    }

    try {
      const res = await fetch(sourceUrl, { mode: 'cors' })
      if (res.ok) {
        const blob = await res.blob()
        triggerDownload(blob)
        return
      }
    } catch {}

    const link = document.createElement('a')
    link.href = sourceUrl
    link.download = `QRIS-${orderId || 'payment'}.png`
    link.target = '_self'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCancelOrder = async () => {
    if (!orderId) return

    const confirmed = confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')
    if (!confirmed) return

    setCancelling(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        alert('✓ Pesanan dibatalkan dan stok telah dikembalikan.')
        router.push('/cart')
      } else {
        alert('Gagal membatalkan pesanan: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Terjadi kesalahan saat membatalkan pesanan.')
    } finally {
      setCancelling(false)
    }
  }

  const checkPaymentStatus = async () => {
    if (!orderId && !transactionId) return
    
    setChecking(true)
    try {
      const response = await fetch('/api/payment-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          order_id: orderId,
          transaction_id: transactionId 
        }),
      })

      const data = await response.json()

      if (data.status === 'settlement' || data.status === 'capture') {
        if (redirectingRef.current) return
        redirectingRef.current = true
        alert('✅ Pembayaran berhasil! Pesanan Anda akan segera diproses.')
        if (orderId) {
          await waitForOrderReady(orderId)
        }
        router.push(`/order-success?orderId=${orderId}`)
      } else if (data.status === 'cancel' || data.status === 'deny' || data.status === 'expire') {
        if (redirectingRef.current) return
        redirectingRef.current = true
        router.push(`/order-failed?orderId=${orderId}&reason=${data.status}`)
      } else if (data.status === 'pending') {
        alert('⏳ Pembayaran masih pending. Mohon tunggu atau coba lagi.')
      } else {
        alert('Status pembayaran: ' + (data.statusMessage || data.status))
      }
    } catch (error) {
      alert('Gagal memeriksa status pembayaran. Mohon coba lagi.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 animate-fadeIn">
      {qrCodeUrl ? (
        <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-6 md:p-8 shadow-xs text-center space-y-6">
          <h1 className="font-fredoka text-2xl md:text-3xl text-[#3E2D3B]">
            Pembayaran QRIS 🌸
          </h1>
          
          {/* Countdown */}
          <div className="bg-[#F7F2F6] border-2 border-[#F0E2EB] rounded-2xl p-4 text-center">
            <p className="text-xs font-extrabold text-[#8E7188] uppercase tracking-wider mb-1">
              Waktu Tersisa Pembayaran
            </p>
            <p className="font-fredoka text-4xl text-[#CB96BA]">
              {formatTime(timeLeft)}
            </p>
            <p className="text-[11px] text-[#8E7188] font-bold mt-1">
              QR Code berlaku 15 menit
            </p>
          </div>

          {/* QR Code Container */}
          <div className="bg-[#F7F2F6] border-2 border-[#F0E2EB] rounded-2xl p-6 inline-block mx-auto">
            <p className="text-xs font-extrabold text-[#3E2D3B] mb-3">Scan QR Code dengan GoPay, OVO, Dana, ShopeePay, BCA, dll.</p>
            <img 
              src={qrCodeUrl} 
              alt="QRIS QR Code" 
              className="w-64 h-64 mx-auto border-4 border-white rounded-2xl shadow-sm"
            />
          </div>

          {/* Total Payment */}
          {amount && (
            <div className="bg-[#FBF3F8] border-2 border-[#F0E2EB] rounded-2xl p-4 space-y-1.5">
              {subtotal && adminFee && Number(adminFee) > 0 && (
                <>
                  <div className="flex justify-between text-xs font-bold text-[#8E7188]">
                    <span>Subtotal</span>
                    <span className="text-[#3E2D3B]">{formatPrice(Number(subtotal))}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-[#8E7188]">
                    <span>Biaya Admin (kode unik)</span>
                    <span className="text-[#3E2D3B]">{formatPrice(Number(adminFee))}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-[#F0E2EB]">
                <span className="text-xs font-extrabold text-[#3E2D3B] uppercase tracking-wider">Total Pembayaran</span>
                <span className="font-fredoka text-2xl text-[#CB96BA]">{formatPrice(Number(amount))}</span>
              </div>
              {adminFee && Number(adminFee) > 0 && (
                <p className="text-[10px] text-[#8E7188] font-bold pt-1">
                  ⚠️ Bayar tepat sesuai nominal di atas (termasuk kode unik) agar pembayaran terverifikasi otomatis.
                </p>
              )}
            </div>
          )}

          {/* Order ID Info */}
          <div className="bg-[#F7F2F6] rounded-2xl p-3 text-xs font-bold text-[#8E7188] space-y-1">
            <div className="flex justify-between">
              <span>Order ID:</span>
              <span className="font-mono text-[#3E2D3B]">{orderId}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={checkPaymentStatus}
              disabled={checking}
              className="btn-card-buy w-full py-3 text-xs"
            >
              {checking ? 'Memeriksa Status...' : '✓ Sudah Bayar? Cek Status Pembayaran ✦'}
            </button>

            <div className="flex gap-2">
              <button
                onClick={downloadQRCode}
                className="flex-1 py-2.5 px-4 rounded-xl border-2 border-[#F0E2EB] bg-white font-extrabold text-xs text-[#3E2D3B] hover:border-[#CB96BA]"
              >
                <i className="fa-solid fa-download"></i> Download QRIS
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 py-2.5 px-4 rounded-xl border-2 border-[#FFE4E6] bg-[#FFE4E6] font-extrabold text-xs text-[#BE123C]"
              >
                <i className="fa-solid fa-ban"></i> Batalkan
              </button>
            </div>
            
            <Link
              href="/"
              className="block text-center text-xs font-extrabold text-[#CB96BA] pt-2 hover:underline"
            >
              ← Kembali ke Shop
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-8 shadow-xs text-center space-y-4 max-w-md mx-auto">
          <div className="text-5xl text-[#CB96BA] mb-2">⏳</div>
          <h1 className="font-fredoka text-2xl text-[#3E2D3B]">Menunggu Pembayaran</h1>
          <p className="text-xs text-[#8E7188]">
            Pesanan Anda ({orderId}) sedang menunggu pembayaran.
          </p>
          <button
            onClick={checkPaymentStatus}
            disabled={checking}
            className="btn-card-buy w-full py-3 text-xs"
          >
            {checking ? 'Memeriksa...' : 'Cek Status Pembayaran ✦'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function OrderPendingPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-[#8E7188]">
        <div className="text-4xl animate-bounce mb-2">🌸</div>
        <p className="font-fredoka text-lg">Memuat Status Pesanan...</p>
      </div>
    }>
      <OrderPendingInner />
    </Suspense>
  )
}
