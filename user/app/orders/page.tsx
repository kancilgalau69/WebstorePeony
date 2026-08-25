'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

interface OrderData {
  id: string
  orderId: string
  transactionId: string
  customerEmail: string
  customerName: string
  customerPhone: string
  total: number
  status: string
  transactionTime: string
  items: any[]
}

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const ORDERS_PER_PAGE = 10

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<OrderData[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [error, setError] = useState('')
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {}
    return false
  }

  const showCopyToast = (message: string) => {
    const toast = document.createElement('div')
    toast.textContent = message
    toast.className = 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#3E2D3B] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl'
    document.body.appendChild(toast)
    setTimeout(() => { toast.remove() }, 1500)
  }

  const splitNotes = (notes?: string) => {
    if (!notes) return []
    return String(notes).split(/\r?\n|\|\|/).map((n) => n.trim()).filter(Boolean)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try { return new Date(dateString).toLocaleString('id-ID') } catch { return dateString }
  }

  const buildOrderCopyText = (order: OrderData) => {
    let text = `=== RAIN STORE DETAIL PEMBELIAN ===\nOrder ID: ${order.orderId}\n\n`
    ;(order.items || []).forEach((item: any) => {
      text += `📦 ${item.product_name || item.name}\n`
      if (item.item_data) text += `${item.item_data}\n`
    })
    return text
  }

  const fetchOrders = async (page: number = 1) => {
    setLoadingOrders(true)
    setError('')
    try {
      const res = await fetch(`/api/auth/orders?page=${page}&limit=${ORDERS_PER_PAGE}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal memuat pesanan')

      setOrders(json.orders || [])
      setPagination(json.pagination || null)
      setCurrentPage(page)
    } catch (err: any) {
      setError(err.message || 'Gagal memuat riwayat pesanan')
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchOrders(1)
    }
  }, [user])

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase()
    if (['completed', 'settlement', 'success'].includes(s)) {
      return <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-extrabold">Selesai</span>
    }
    if (['pending', 'processing'].includes(s)) {
      return <span className="px-2.5 py-0.5 rounded-full bg-[#FEF08A] text-[#77A39A] text-[10px] font-extrabold">Pending</span>
    }
    return <span className="px-2.5 py-0.5 rounded-full bg-[#FFE4E6] text-[#BE123C] text-[10px] font-extrabold">Gagal</span>
  }

  const OrderCard = ({ order }: { order: OrderData }) => {
    const isExpanded = expandedOrders.has(order.orderId || order.id)
    const itemCount = (order.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)

    return (
      <div className="bg-white rounded-2xl border-2 border-[#F0E2EB] mb-3 overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => toggleOrder(order.orderId || order.id)}
          className="w-full text-left p-4 flex items-center gap-3 hover:bg-[#F7F2F6] transition-colors"
        >
          <i className={`fa-solid fa-chevron-right text-[#CB96BA] text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}></i>
          <div className="flex-1 min-w-0">
            <p className="font-fredoka text-base text-[#3E2D3B] truncate">{order.orderId}</p>
            <p className="text-[10px] text-[#8E7188] font-bold">{formatDate(order.transactionTime)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {getStatusBadge(order.status)}
            <span className="font-fredoka text-sm text-[#CB96BA]">{formatPrice(order.total)}</span>
          </div>
        </button>

        {isExpanded && (
          <div className="border-t-2 border-[#F0E2EB] p-4 bg-[#F7F2F6] space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-[#8E7188]">
              <span>{itemCount} Item Dipesan</span>
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  const ok = await copyToClipboard(buildOrderCopyText(order))
                  showCopyToast(ok ? 'Tersalin' : 'Gagal menyalin')
                }}
                className="px-2.5 py-1 rounded-full bg-white text-[#CB96BA] border border-[#F0E2EB] font-extrabold text-[10px]"
              >
                Copy Semua ✦
              </button>
            </div>

            {order.items && order.items.length > 0 && (
              <div className="space-y-2">
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-xl border-2 border-[#F0E2EB] p-3 text-xs space-y-1">
                    <p className="font-fredoka text-sm text-[#3E2D3B]">
                      {item.product_name || item.name} (x{item.quantity})
                    </p>
                    <p className="text-[#CB96BA] font-extrabold">{formatPrice(item.price)}</p>
                    {item.item_data && (
                      <div className="mt-2 bg-[#F7F2F6] p-2 rounded-lg font-mono text-[11px] text-[#3E2D3B] break-all border border-[#F0E2EB]">
                        {item.item_data}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="py-12 text-center text-[#8E7188]">
        <div className="text-4xl animate-bounce mb-2">🌸</div>
        <p className="font-fredoka text-lg">Memuat Riwayat...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-12 animate-fadeIn text-center">
        <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-8 shadow-xs space-y-4">
          <div className="text-5xl text-[#CB96BA] mb-2">🌸</div>
          <h2 className="font-fredoka text-2xl text-[#3E2D3B]">Login Diperlukan</h2>
          <p className="text-xs text-[#8E7188] font-bold">
            Masuk ke akun Anda untuk melihat seluruh riwayat pesanan yang pernah Anda beli.
          </p>
          <div className="space-y-2 pt-2">
            <Link href="/login" className="btn-card-buy w-full py-3 text-xs">
              Masuk Akun ✦
            </Link>
            <Link href="/register" className="block w-full py-2.5 rounded-xl border-2 border-[#F0E2EB] text-[#3E2D3B] font-extrabold text-xs">
              Daftar Akun Baru
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h1 className="font-fredoka text-3xl text-[#3E2D3B]">Riwayat Pembelian</h1>
        <button
          onClick={() => fetchOrders(currentPage)}
          disabled={loadingOrders}
          className="px-3.5 py-1.5 rounded-full bg-white text-[#CB96BA] border-2 border-[#F0E2EB] font-extrabold text-xs hover:border-[#CB96BA]"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border-2 border-[#F0E2EB] p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F0E2EB] text-[#CB96BA] flex items-center justify-center font-bold font-fredoka text-lg">
          {user.nama.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-fredoka text-base text-[#3E2D3B]">{user.nama}</p>
          <p className="text-xs text-[#8E7188] font-bold">{user.email}</p>
        </div>
      </div>

      {loadingOrders ? (
        <div className="py-12 text-center text-[#8E7188]">
          <div className="text-3xl animate-spin mb-2">🌸</div>
          <p className="font-fredoka text-sm">Memuat daftar pesanan...</p>
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id || order.orderId} order={order} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-8 text-center space-y-3">
          <div className="text-4xl text-[#CB96BA]">🌸</div>
          <h3 className="font-fredoka text-xl text-[#3E2D3B]">Belum Ada Riwayat</h3>
          <p className="text-xs text-[#8E7188]">Pesanan Anda akan tampil di sini setelah checkout.</p>
          <Link href="/" className="btn-card-buy max-w-xs mx-auto text-xs py-3">
            Mulai Belanja ✦
          </Link>
        </div>
      )}
    </div>
  )
}
