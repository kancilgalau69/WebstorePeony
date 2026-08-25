"use client";
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

interface OrderItem {
  product_id: string
  product_name: string
  product_code: string
  quantity: number
  price: number
  total: number
  item_data?: string
  product_notes?: string
}

interface OrderDetails {
  orderId: string
  transactionId: string
  amount: number
  status: string
  items: OrderItem[]
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  transactionTime?: string
}

function OrderSuccessInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchControllerRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)

  const normalizeStatus = (status?: string) => {
    if (!status) return 'pending'
    const s = status.toLowerCase()
    if (['completed', 'success', 'settlement', 'capture'].includes(s)) return 'completed'
    if (['pending', 'pending_payment', 'waiting_payment'].includes(s)) return 'pending'
    if (['processing'].includes(s)) return 'processing'
    if (['expire', 'expired', 'cancel', 'denied', 'deny', 'failed', 'failure'].includes(s)) return 'failed'
    return status
  }

  const hasNonEmptyItemData = (value: unknown) => String(value || '').trim().length > 0

  const fetchOrderDetails = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true)
      setError(null)

      if (fetchControllerRef.current) {
        try { fetchControllerRef.current.abort() } catch {}
      }
      const controller = new AbortController()
      fetchControllerRef.current = controller
      inFlightRef.current = true

      const response = await fetch(`/api/orders/${orderId}` , { signal: controller.signal })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch order details')
      }

      const rawStatus = data.status || data.transaction?.transaction_status
      const normalizedStatus = normalizeStatus(rawStatus)

      const orderData: OrderDetails = {
        orderId: data.orderId,
        transactionId: data.transactionId,
        amount: Number(data.amount),
        status: normalizedStatus,
        items: data.items || data.transaction?.item_details || [],
        customerName: data.customerName || data.transaction?.customer_details?.first_name || 'Customer',
        customerEmail: data.customerEmail || data.transaction?.customer_details?.email || '',
        customerPhone: data.customerPhone || data.transaction?.customer_details?.phone || '',
        transactionTime: data.transactionTime,
      }

      setOrderDetails(orderData)
      
      if (normalizedStatus === 'processing') {
        const processingTime = (window as any).__processingStartTime || Date.now()
        if (!( window as any).__processingStartTime) {
          (window as any).__processingStartTime = processingTime
        }
        const elapsedSeconds = (Date.now() - processingTime) / 1000
        
        if (elapsedSeconds > 15) {
          setError('Proses mempersiapkan item terlalu lama. Coba refresh halaman atau hubungi support.')
          delete (window as any).__processingStartTime
        }
      } else {
        delete (window as any).__processingStartTime
      }

      if (normalizedStatus === 'completed' && (orderData.items || []).some((i: any) => hasNonEmptyItemData(i.item_data))) {
        delete (window as any).__orderRetryCount
      }

      try {
        const existing = localStorage.getItem('purchaseHistory')
        const history = existing ? JSON.parse(existing) : []
        const historyArray = Array.isArray(history) ? history : [history]
        
        const newOrder = {
          id: orderData.orderId,
          orderId: orderData.orderId,
          transactionId: orderData.transactionId,
          customerEmail: orderData.customerEmail,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          total: orderData.amount,
          status: orderData.status,
          transactionTime: orderData.transactionTime,
          items: orderData.items,
        }

        const updated = [newOrder, ...historyArray]
        localStorage.setItem('purchaseHistory', JSON.stringify(updated))
        if (orderData.customerEmail) {
          localStorage.setItem('purchaseHistoryEmail', orderData.customerEmail)
        }
      } catch (e) {}
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setError(err.message || 'Failed to fetch order details')
      setOrderDetails(prev => prev || {
        orderId: orderId || '',
        transactionId: '',
        amount: 0,
        status: 'pending',
        items: [],
      })
    } finally {
      inFlightRef.current = false
      fetchControllerRef.current = null
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    if (!orderId) {
      router.push('/')
      return
    }
    fetchOrderDetails()
  }, [orderId, router])

  useEffect(() => {
    if (!orderId || !orderDetails) return
    const isComplete = orderDetails.status === 'completed'
    const hasItems = (orderDetails.items || []).some((i: any) => hasNonEmptyItemData(i.item_data))
    
    if (isComplete && hasItems) return

    const interval = setInterval(() => {
      if (inFlightRef.current) return
      fetchOrderDetails(false)
    }, 4000)

    return () => clearInterval(interval)
  }, [orderId, orderDetails?.status, orderDetails?.items])

  const paymentTriggerRef = useRef(false)
  useEffect(() => {
    if (!orderId || !orderDetails) return
    const isProcessing = orderDetails.status === 'processing'
    const hasItems = (orderDetails.items || []).some((i: any) => hasNonEmptyItemData(i.item_data))

    if (!isProcessing || hasItems || paymentTriggerRef.current) return

    paymentTriggerRef.current = true
    fetch('/api/payment-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    })
      .then(r => r.json())
      .then(() => {
        setTimeout(() => { paymentTriggerRef.current = false }, 10000)
      })
      .catch(() => {
        paymentTriggerRef.current = false
      })
  }, [orderId, orderDetails?.status])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-'
    try { return new Date(dateString).toLocaleString('id-ID') } catch { return dateString }
  }

  const splitNotes = (notes?: string) => {
    if (!notes) return []
    return String(notes).split(/\r?\n|\|\|/).map((n) => n.trim()).filter(Boolean)
  }

  const normalizeItemDataText = (text: string) => text.replace(/\s*\|\|\s*/g, '\n').trim()

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

  const isCompleted = orderDetails?.status === 'completed'
  const isProcessing = orderDetails?.status === 'processing'

  if (loading) {
    return (
      <div className="py-12 text-center text-[#8E7188]">
        <div className="text-4xl animate-bounce mb-2">🌸</div>
        <p className="font-fredoka text-lg">Memuat Rincian Pesanan...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-6 animate-fadeIn space-y-6">
      {/* Header Banner Card */}
      <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-8 shadow-xs text-center space-y-3">
        <div className="text-5xl mb-2">
          {isCompleted ? '💖' : isProcessing ? '⏳' : '🌸'}
        </div>
        <h1 className="font-fredoka text-3xl text-[#3E2D3B]">
          {isCompleted ? 'Pembayaran Berhasil! 🌸' : isProcessing ? 'Memproses Pesanan...' : 'Menunggu Pembayaran'}
        </h1>
        <p className="text-xs font-extrabold text-[#8E7188] max-w-md mx-auto">
          {isCompleted
            ? 'Terima kasih telah berbelanja di Rain Store. Akun / item digital Anda siap digunakan di bawah!'
            : 'Pembayaran diterima. Sedang mempersiapkan item digital Anda...'}
        </p>

        {error && (
          <div className="bg-[#FFE4E6] border border-[#BE123C]/20 rounded-2xl p-3 text-xs font-bold text-[#BE123C] max-w-md mx-auto">
            {error}
          </div>
        )}
      </div>

      {orderDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items Purchased Box */}
            <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-fredoka text-xl text-[#3E2D3B]">Item Pembelian Anda 🌸</h2>
                
                {orderDetails.items && orderDetails.items.some((i: any) => hasNonEmptyItemData(i.item_data)) && (
                  <button
                    onClick={async () => {
                      let allItemsText = `=== RAIN STORE PEMBELIAN ===\nOrder ID: ${orderDetails.orderId}\n\n`
                      orderDetails.items.forEach((item: any) => {
                        if (hasNonEmptyItemData(item.item_data)) {
                          allItemsText += `📦 ${item.product_name || item.name}\n`
                          allItemsText += `${item.item_data}\n\n`
                        }
                      })
                      const ok = await copyToClipboard(allItemsText)
                      showCopyToast(ok ? 'Tersalin!' : 'Gagal menyalin')
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[#F7F2F6] text-[#CB96BA] border border-[#F0E2EB] font-extrabold text-xs hover:bg-[#F0E2EB]"
                  >
                    Copy Semua ✦
                  </button>
                )}
              </div>

              {orderDetails.items && orderDetails.items.length > 0 ? (
                <div className="space-y-4">
                  {orderDetails.items.map((item: any, index: number) => {
                    const itemDataArray = item.item_data
                      ? item.item_data.split(/\r?\n/).map((d: string) => normalizeItemDataText(d)).filter(Boolean)
                      : []
                    const notesList = splitNotes(item.product_notes)

                    return (
                      <div key={index} className="bg-[#F7F2F6] rounded-2xl border-2 border-[#F0E2EB] p-5 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-fredoka text-lg text-[#3E2D3B]">{item.product_name || item.name}</h3>
                            <p className="text-xs text-[#8E7188] font-bold">Qty: {item.quantity}x @ {formatPrice(item.price)}</p>
                          </div>
                          <span className="font-fredoka text-lg text-[#CB96BA]">{formatPrice(item.price * item.quantity)}</span>
                        </div>

                        {/* Item Accounts Data */}
                        {itemDataArray.length > 0 ? (
                          <div className="space-y-2 pt-2 border-t border-[#F0E2EB]">
                            <p className="text-xs font-extrabold text-[#3E2D3B] uppercase tracking-wider">Detail Akun / Kode Produk:</p>
                            {itemDataArray.map((data: string, dataIdx: number) => (
                              <div key={dataIdx} className="bg-white border-2 border-[#F0E2EB] rounded-xl p-3 flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-[#3E2D3B] break-all">{data}</span>
                                <button
                                  onClick={async () => {
                                    const ok = await copyToClipboard(data)
                                    showCopyToast(ok ? 'Tersalin!' : 'Gagal menyalin')
                                  }}
                                  className="px-3 py-1 rounded-lg bg-[#F7F2F6] text-[#CB96BA] font-extrabold text-[10px] shrink-0 hover:bg-[#F0E2EB]"
                                >
                                  Copy
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-white rounded-xl text-xs text-[#8E7188] font-bold">
                            Data akun sedang disiapkan sistem...
                          </div>
                        )}

                        {notesList.length > 0 && (
                          <div className="pt-2 border-t border-[#F0E2EB]">
                            <p className="text-xs font-extrabold text-[#3E2D3B]">Ketentuan Produk:</p>
                            <ul className="text-xs text-[#8E7188] list-disc list-inside mt-1 space-y-0.5">
                              {notesList.map((n: string, i: number) => (
                                <li key={i}>{n}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-6 shadow-xs space-y-3 text-xs font-bold text-[#8E7188]">
              <h3 className="font-fredoka text-lg text-[#3E2D3B] mb-2">Detail Transaksi</h3>
              <div className="flex justify-between">
                <span>Order ID:</span>
                <span className="font-mono text-[#3E2D3B]">{orderDetails.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span className="text-[#3E2D3B]">{formatDateTime(orderDetails.transactionTime)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-[#F0E2EB] pt-3 font-fredoka text-base">
                <span className="text-[#3E2D3B]">Total:</span>
                <span className="text-[#CB96BA]">{formatPrice(orderDetails.amount)}</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl border-2 border-[#F0E2EB] p-6 shadow-xs space-y-3">
              <h3 className="font-fredoka text-lg text-[#3E2D3B]">Butuh Bantuan?</h3>
              <p className="text-xs text-[#8E7188] font-bold">Tim CS Rain Store siap membantu 24/7 via WhatsApp.</p>
              <a
                href={`https://wa.me/6282340915319?text=Halo%20Admin%20Rain%20Store,%20saya%20butuh%20bantuan%20untuk%20Order%20ID%20${orderDetails.orderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-card-buy w-full text-xs py-3"
              >
                Chat WhatsApp Admin ✦
              </a>
              <Link
                href="/"
                className="block text-center text-xs font-extrabold text-[#CB96BA] pt-2 hover:underline"
              >
                ← Kembali ke Shop
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-[#8E7188]">
        <div className="text-4xl animate-bounce mb-2">🌸</div>
        <p className="font-fredoka text-lg">Memuat Rincian Transaksi...</p>
      </div>
    }>
      <OrderSuccessInner />
    </Suspense>
  )
}
