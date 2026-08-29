"use client";
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

function OrderFailedInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')
  const reason = searchParams.get('reason') || 'unknown'
  const [releasing, setReleasing] = useState(false)

  useEffect(() => {
    if (!orderId) {
      router.push('/')
    }
  }, [orderId, router])

  const handleReleaseStock = async () => {
    if (!orderId) return

    setReleasing(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        alert('✓ Stok produk telah dikembalikan. Anda bisa checkout ulang.')
        router.push('/cart')
      } else {
        alert('Gagal mengembalikan stok: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Terjadi kesalahan saat mengembalikan stok.')
    } finally {
      setReleasing(false)
    }
  }

  const getReasonText = () => {
    switch (reason.toLowerCase()) {
      case 'cancel':
        return 'Pembayaran Dibatalkan'
      case 'deny':
        return 'Pembayaran Ditolak'
      case 'expire':
        return 'Pembayaran Kadaluwarsa'
      default:
        return 'Pembayaran Gagal'
    }
  }

  const getReasonDescription = () => {
    switch (reason.toLowerCase()) {
      case 'cancel':
        return 'Pembayaran Anda telah dibatalkan. Jika ini tidak disengaja, silakan coba checkout ulang.'
      case 'deny':
        return 'Pembayaran Anda ditolak oleh sistem pembayaran. Silakan periksa saldo atau coba metode pembayaran lain.'
      case 'expire':
        return 'Waktu pembayaran telah habis. QR Code QRIS berlaku selama 15 menit.'
      default:
        return 'Terjadi masalah dengan pembayaran Anda. Silakan coba lagi.'
    }
  }

  return (
    <div className="max-w-md mx-auto py-8 animate-fadeIn">
      <div className="bg-white rounded-3xl border-2 border-[#F4D6DC] p-8 shadow-xs text-center space-y-4">
        <div className="text-5xl text-[#BE123C] mb-1">❌</div>

        <h1 className="font-fredoka text-2xl text-[#BE123C]">
          {getReasonText()}
        </h1>

        <p className="text-xs text-[#9E6B72] font-bold">
          {getReasonDescription()}
        </p>

        {orderId && (
          <div className="bg-[#FBEEF1] rounded-2xl p-3 text-xs font-bold text-[#9E6B72]">
            <span>Order ID: </span>
            <span className="font-mono text-[#720002]">{orderId}</span>
          </div>
        )}

        <div className="bg-[#FFE4E6] border border-[#BE123C]/20 rounded-2xl p-4 text-xs font-bold text-[#BE123C] text-left space-y-1">
          <p className="font-extrabold">Penting!</p>
          <p>Stok masih tersimpan sementara. Klik tombol di bawah untuk mengembalikan stok &amp; checkout ulang.</p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={handleReleaseStock}
            disabled={releasing}
            className="btn-card-buy w-full py-3 text-xs"
          >
            {releasing ? 'Memproses...' : 'Kembalikan Stok & Coba Lagi ✦'}
          </button>

          <Link
            href="/cart"
            className="block w-full py-2.5 rounded-xl border-2 border-[#F4D6DC] text-[#720002] font-extrabold text-xs"
          >
            Lihat Keranjang
          </Link>
          <Link
            href="/"
            className="block text-center text-xs font-extrabold text-[#DB8291] pt-1 hover:underline"
          >
            ← Kembali ke Shop
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function OrderFailedPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-[#9E6B72]">
        <div className="text-4xl animate-bounce mb-2">🌸</div>
        <p className="font-fredoka text-lg">Memuat Status...</p>
      </div>
    }>
      <OrderFailedInner />
    </Suspense>
  )
}
