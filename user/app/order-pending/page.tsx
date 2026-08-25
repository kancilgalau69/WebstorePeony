"use client";
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

function OrderPendingInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')
  const qrString = searchParams.get('qrString')
  const qrUrl = searchParams.get('qrUrl')
  const transactionId = searchParams.get('transactionId')
  const [checking, setChecking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [timeLeft, setTimeLeft] = useState(15 * 60)
  const [expiryTs, setExpiryTs] = useState<number | null>(null)

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

    if (qrString) {
      const encodedQr = encodeURIComponent(qrString)
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedQr}`
      setQrCodeUrl(qrImageUrl)

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

    const checkStatus = async () => {
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
          if (orderId) {
            await waitForOrderReady(orderId)
          }
          router.push(`/order-success?orderId=${orderId}`)
        } else if (data.status === 'cancel' || data.status === 'deny' || data.status === 'expire') {
          router.push(`/order-failed?orderId=${orderId}&reason=${data.status}`)
        }
      } catch (error) {
        console.error('Auto-check error:', error)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 10000)

    return () => clearInterval(interval)
  }, [orderId, transactionId, router])

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
        alert('✅ Pembayaran berhasil! Pesanan Anda akan segera diproses.')
        if (orderId) {
          await waitForOrderReady(orderId)
        }
        router.push(`/order-success?orderId=${orderId}`)
      } else if (data.status === 'cancel' || data.status === 'deny' || data.status === 'expire') {
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
      {qrCodeUrl && qrString ? (
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
