'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'

type Promo = {
  id: string
  code: string
  title: string
  description: string | null
  promo_type: string
  discount_percent: number
  discount_amount: number
  max_discount: number | null
  min_purchase: number
  eligible_for: string
  valid_until: string | null
  required_product_name: string | null
  reward_product_name: string | null
  required_qty: number
  reward_qty: number
}

function PromoCard({ promo }: { promo: Promo }) {
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    if (!promo.valid_until) return

    const updateCountdown = () => {
      const now = Date.now()
      const end = new Date(promo.valid_until!).getTime()
      const diff = end - now

      if (diff <= 0) {
        setCountdown('Berakhir')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (days > 0) {
        setCountdown(`${days}h ${hours}j ${minutes}m`)
      } else {
        setCountdown(`${hours}j ${minutes}m ${seconds}d`)
      }
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [promo.valid_until])

  const copyCode = () => {
    navigator.clipboard.writeText(promo.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const formatIDR = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`

  const getPromoLabel = () => {
    switch (promo.promo_type) {
      case 'percent':
        return `${promo.discount_percent}% OFF${promo.max_discount ? ` (max ${formatIDR(promo.max_discount)})` : ''}`
      case 'fixed':
        return `Hemat ${formatIDR(promo.discount_amount)}`
      case 'buy_x_get_y':
        return `Beli ${promo.required_qty}x → Gratis ${promo.reward_product_name || 'produk'}`
      case 'buy_x_get_x':
        return `Beli ${promo.required_qty} Gratis ${promo.reward_qty}`
      default:
        return 'Promo'
    }
  }

  const getIcon = () => {
    switch (promo.promo_type) {
      case 'percent': return 'fa-percent'
      case 'fixed': return 'fa-money-bill-wave'
      case 'buy_x_get_y': return 'fa-gift'
      case 'buy_x_get_x': return 'fa-gift'
      default: return 'fa-tag'
    }
  }

  return (
    <div className="flex-shrink-0 w-[300px] sm:w-[340px] bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <i className={`fa-solid ${getIcon()} text-sm`}></i>
          <span className="font-bold text-sm">{getPromoLabel()}</span>
        </div>
      </div>

      {/* Countdown */}
      {promo.valid_until && countdown && (
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-4 py-2.5 flex items-center justify-center gap-2">
          <i className="fa-solid fa-clock text-white/90 text-xs"></i>
          <span className="text-white font-bold text-sm tracking-wide">{countdown}</span>
        </div>
      )}

      <div className="p-4">
        <h3 className="font-bold text-sm text-gray-900 mb-1">{promo.title}</h3>
        {promo.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{promo.description}</p>}
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 mb-3">
          {promo.min_purchase > 0 && <span className="bg-gray-100 px-2 py-0.5 rounded-full">Min. {formatIDR(promo.min_purchase)}</span>}
          <span className="bg-gray-100 px-2 py-0.5 rounded-full">{promo.eligible_for === 'all' ? 'Semua user' : 'Member only'}</span>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-primary-50 border border-primary-100 rounded-lg font-mono text-sm font-bold text-primary-700 text-center tracking-wider">
            {promo.code}
          </code>
          <button
            onClick={copyCode}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              copied ? 'bg-emerald-500 text-white' : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
          >
            {copied ? '✓' : 'Salin'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PromoSection() {
  const { user } = useAuth()
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/promo', { cache: 'no-store' })
      .then(r => {
        if (!r.ok) { console.error('[PromoSection] API error:', r.status); return null }
        return r.json()
      })
      .then(data => {
        if (data?.promos) {
          console.log('[PromoSection] Loaded', data.promos.length, 'promos')
          setPromos(data.promos)
        } else {
          console.log('[PromoSection] No promos or error:', data)
        }
      })
      .catch(err => console.error('[PromoSection] Fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading || promos.length === 0) return null

  // Filter: show all public promos, but mark "member only" ones
  const visiblePromos = promos

  return (
    <section className="py-6 bg-gradient-to-r from-primary-50 to-indigo-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-ticket text-primary-500"></i>
            <h2 className="text-lg font-bold text-gray-900">Promo Aktif</h2>
          </div>
          <span className="text-xs text-gray-500">{visiblePromos.length} promo tersedia</span>
        </div>
        <div className="flex gap-3 sm:gap-4 overflow-x-auto scroll-container pb-2">
          {visiblePromos.map(p => (
            <PromoCard key={p.id} promo={p} />
          ))}
        </div>
        {!user && promos.some(p => p.eligible_for === 'registered_only') && (
          <p className="text-xs text-gray-500 mt-3 text-center">
            <i className="fa-solid fa-info-circle mr-1"></i>
            Beberapa promo hanya untuk member. <a href="/login" className="text-primary-600 font-semibold hover:underline">Login</a> atau <a href="/register" className="text-primary-600 font-semibold hover:underline">daftar</a> untuk menggunakan.
          </p>
        )}
      </div>
    </section>
  )
}
