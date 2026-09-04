'use client'

import { useEffect, useState, Fragment, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiSearch, FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight, FiMessageCircle, FiDownload } from 'react-icons/fi'

// ==================== TYPES ====================

type Order = {
  id: string
  order_id: string
  user_id: string | null
  status: string
  total_amount: number
  created_at: string
  transaction_id?: string | null
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  payment_method?: string | null
  items?: any[] | null
}

type OrderItem = {
  id: string
  order_id: string
  product_id: string
  product_code: string
  product_name: string
  quantity: number
  price: number
  item_data: string | null
}

// ==================== MAIN COMPONENT ====================

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-xl md:text-2xl font-bold text-gray-900">Orders</h1>

      {/* Content */}
      <UserOrdersTab />
    </div>
  )
}


// ==================== USER ORDERS TAB ====================

function UserOrdersTab() {
  const supabase = createBrowserClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilterType, setDateFilterType] = useState<'all' | 'date' | 'month' | 'year'>('all')
  const [dateValue, setDateValue] = useState('')
  const [monthValue, setMonthValue] = useState('')
  const [yearValue, setYearValue] = useState('')
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({})
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(() => fetchOrders(), 30_000)
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe()
    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => { setCurrentPage(1) }, [searchQuery, statusFilter, dateFilterType, dateValue, monthValue, yearValue])
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const fetchOrders = async () => {
    try {
      const resp = await fetch('/api/orders', { cache: 'no-store' })
      const payload = await resp.json()
      if (!resp.ok) throw new Error(payload?.error || 'Failed to fetch orders')
      setOrders(payload?.orders || [])
      setOrderItems(payload?.orderItems || {})
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'expired': return 'bg-orange-100 text-orange-800'
      case 'paid': return 'bg-blue-100 text-blue-800'
      case 'shipped': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEffectiveStatus = (order: Order) => {
    if (order.status !== 'pending') return order.status
    const createdAtMs = new Date(order.created_at).getTime()
    const expiresAtMs = createdAtMs + 15 * 60 * 1000
    return nowTs > expiresAtMs ? 'expired' : 'pending'
  }

  const getWhatsappUrl = (phone?: string | null) => {
    const digits = String(phone || '').replace(/\D/g, '')
    if (!digits) return null
    const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits.startsWith('62') ? digits : digits
    return `https://wa.me/${normalized}`
  }

  const stringifyOrderItemsForSearch = (order: Order) => {
    const chunks: string[] = []

    for (const item of orderItems[order.id] || []) {
      chunks.push(item.product_name, item.product_code, item.item_data || '')
    }

    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        chunks.push(
          item?.product_name || item?.name || '',
          item?.product_code || item?.code || '',
          item?.item_data || ''
        )
        try {
          chunks.push(JSON.stringify(item))
        } catch {}
      }
    }

    return chunks.filter(Boolean).join(' ').toLowerCase()
  }

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const searchLower = searchQuery.toLowerCase().trim()
      const matchesSearch = !searchLower ||
        String(order.order_id || '').toLowerCase().includes(searchLower) ||
        String(order.user_id || '').toLowerCase().includes(searchLower) ||
        String(order.customer_name || '').toLowerCase().includes(searchLower) ||
        String(order.customer_email || '').toLowerCase().includes(searchLower) ||
        String(order.customer_phone || '').toLowerCase().includes(searchLower) ||
        stringifyOrderItemsForSearch(order).includes(searchLower)

      const effectiveStatus = getEffectiveStatus(order)
      const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter

      const created = new Date(order.created_at)
      let matchesDate = true
      if (dateFilterType === 'date' && dateValue) {
        const target = new Date(dateValue)
        matchesDate = created.getFullYear() === target.getFullYear() && created.getMonth() === target.getMonth() && created.getDate() === target.getDate()
      }
      if (dateFilterType === 'month' && monthValue) {
        const [y, m] = monthValue.split('-').map(Number)
        matchesDate = created.getFullYear() === y && created.getMonth() + 1 === m
      }
      if (dateFilterType === 'year' && yearValue) {
        matchesDate = created.getFullYear() === Number(yearValue)
      }
      return matchesSearch && matchesStatus && matchesDate
    })
  }, [orders, orderItems, searchQuery, statusFilter, dateFilterType, dateValue, monthValue, yearValue, nowTs])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredOrders.slice(start, start + pageSize)
  }, [filteredOrders, currentPage, pageSize])

  useEffect(() => { setCurrentPage(prev => Math.min(prev, Math.max(1, totalPages))) }, [totalPages])

  const handleCopyItemData = async (text: string) => {
    try {
      setCopyError(null)
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      setTimeout(() => setCopiedText(null), 1500)
    } catch {
      setCopyError('Copy failed')
      setTimeout(() => setCopyError(null), 2000)
    }
  }

  const allStats = {
    total: orders.length,
    pending: orders.filter(o => getEffectiveStatus(o) === 'pending').length,
    paid: orders.filter(o => getEffectiveStatus(o) === 'paid').length,
    completed: orders.filter(o => getEffectiveStatus(o) === 'completed').length,
    expired: orders.filter(o => getEffectiveStatus(o) === 'expired').length,
    revenue: orders.filter(o => getEffectiveStatus(o) === 'completed').reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
  }

  const isFiltered = searchQuery || statusFilter !== 'all' || dateFilterType !== 'all'
  const stats = isFiltered ? {
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => getEffectiveStatus(o) === 'pending').length,
    paid: filteredOrders.filter(o => getEffectiveStatus(o) === 'paid').length,
    completed: filteredOrders.filter(o => getEffectiveStatus(o) === 'completed').length,
    expired: filteredOrders.filter(o => getEffectiveStatus(o) === 'expired').length,
    revenue: filteredOrders.filter(o => getEffectiveStatus(o) === 'completed').reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
  } : allStats

  const getItemCount = (orderUUID: string) => {
    const botItems = orderItems[orderUUID]?.length || 0
    if (botItems > 0) return botItems
    const order = orders.find(o => o.id === orderUUID)
    if (order && order.items && Array.isArray(order.items)) return order.items.length
    return 0
  }

  const getOrderItemDetails = (orderUUID: string) => {
    const items = orderItems[orderUUID] || []
    if (items.length > 0) {
      const groupedByProduct = items.reduce((acc, item) => {
        const key = item.product_code || item.product_name
        if (!acc[key]) { acc[key] = { productName: item.product_name, productCode: item.product_code, items: [], totalPrice: 0, totalQty: 0 } }
        if (item.item_data) {
          try {
            const parsed = JSON.parse(item.item_data)
            if (Array.isArray(parsed)) { parsed.forEach((obj: any) => { if (obj?.item_data) acc[key].items.push(obj.item_data); else if (typeof obj === 'string') acc[key].items.push(obj) }) }
            else if (parsed?.item_data) acc[key].items.push(parsed.item_data)
            else if (typeof parsed === 'string') acc[key].items.push(parsed)
            else if (acc[key].items.length === 0) acc[key].items.push(item.item_data)
          } catch { acc[key].items.push(item.item_data) }
        }
        acc[key].totalPrice += item.price || 0
        acc[key].totalQty += item.quantity || 1
        return acc
      }, {} as Record<string, any>)
      return Object.values(groupedByProduct).map((group: any) => ({
        productName: group.productName, productCode: group.productCode,
        itemData: group.items.join('\n'), itemCount: group.items.length,
        quantity: group.totalQty, price: group.totalPrice
      }))
    }
    const order = orders.find(o => o.id === orderUUID)
    if (order?.items && Array.isArray(order.items)) {
      return order.items.map((item: any) => ({
        productName: item.product_name || item.name || '-', productCode: item.product_code || item.code || '-',
        itemData: 'Menunggu proses pembayaran', itemCount: 1, quantity: item.quantity || 1, price: item.price || 0
      }))
    }
    return []
  }

  const escapeHtml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  const getExportPeriodLabel = () => {
    if (dateFilterType === 'date' && dateValue) return `hari-${dateValue}`
    if (dateFilterType === 'month' && monthValue) return `bulan-${monthValue}`
    if (dateFilterType === 'year' && yearValue) return `tahun-${yearValue}`
    return 'semua-periode'
  }

  const exportOrdersToExcel = () => {
    if (filteredOrders.length === 0) {
      alert('Tidak ada order untuk diexport')
      return
    }

    type ExportRow = {
      orderId: string
      date: string
      status: string
      customerName: string
      customerEmail: string
      customerPhone: string
      userId: string
      paymentMethod: string
      productName: string
      productCode: string
      quantity: number | string
      price: number | string
      total: number
      itemData: string
    }

    const rows: ExportRow[] = filteredOrders.flatMap((order): ExportRow[] => {
      const details = getOrderItemDetails(order.id)
      const base = {
        orderId: order.order_id,
        customerName: order.customer_name || '-',
        customerEmail: order.customer_email || '-',
        customerPhone: order.customer_phone || '-',
        userId: order.user_id || '-',
        status: getEffectiveStatus(order),
        paymentMethod: order.payment_method || '-',
        total: Number(order.total_amount || 0),
        date: new Date(order.created_at).toLocaleString('id-ID'),
      }
      if (details.length === 0) return [{ ...base, productName: '-', productCode: '-', quantity: '-', price: '-', itemData: '-' }]
      return details.map((item: any) => ({
        ...base,
        productName: item.productName || '-',
        productCode: item.productCode || '-',
        quantity: item.quantity || '-',
        price: Number(item.price || 0),
        itemData: item.itemData || '-',
      }))
    })

    const title = `Export Orders Peony Store - ${getExportPeriodLabel()}`
    const tableRows = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.orderId)}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${escapeHtml(row.customerName)}</td>
        <td>${escapeHtml(row.customerEmail)}</td>
        <td style="mso-number-format:'\\@';">${escapeHtml(row.customerPhone)}</td>
        <td>${escapeHtml(row.userId)}</td>
        <td>${escapeHtml(row.paymentMethod)}</td>
        <td>${escapeHtml(row.productName)}</td>
        <td>${escapeHtml(row.productCode)}</td>
        <td>${escapeHtml(row.quantity)}</td>
        <td>${escapeHtml(row.price)}</td>
        <td>${escapeHtml(row.total)}</td>
        <td>${escapeHtml(row.itemData).replace(/\n/g, '<br/>')}</td>
      </tr>`).join('')

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8" />
          <style>
            table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
            th { background: #4f46e5; color: white; font-weight: bold; border: 1px solid #d1d5db; padding: 8px; }
            td { border: 1px solid #d1d5db; padding: 7px; vertical-align: top; }
            .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="title">${escapeHtml(title)}</div>
          <table>
            <thead><tr>
              <th>Order ID</th><th>Tanggal</th><th>Status</th><th>Nama Customer</th><th>Email</th><th>No. HP</th><th>User ID</th><th>Metode Bayar</th><th>Nama Produk</th><th>Kode Produk</th><th>Qty</th><th>Harga Item</th><th>Total Order</th><th>Detail Item / Akun</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>`

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${getExportPeriodLabel()}.xls`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="text-center py-8">Loading orders...</div>

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-indigo-600 hover:shadow-lg transition">
          <p className="text-gray-600 text-xs md:text-sm font-medium">Total Orders</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 md:mt-2">{allStats.total}</p>
          {isFiltered && <p className="text-xs text-indigo-600 mt-1">Menampilkan: {stats.total}</p>}
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-yellow-500 hover:shadow-lg transition">
          <p className="text-yellow-700 text-xs md:text-sm font-medium">Pending</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-yellow-600 mt-1 md:mt-2">{isFiltered ? stats.pending : allStats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-green-600 hover:shadow-lg transition">
          <p className="text-green-700 text-xs md:text-sm font-medium">Completed</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-green-600 mt-1 md:mt-2">{isFiltered ? stats.completed : allStats.completed}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-blue-600 hover:shadow-lg transition">
          <p className="text-blue-700 text-xs md:text-sm font-medium">Revenue</p>
          <p className="text-lg md:text-xl lg:text-2xl font-bold text-blue-600 mt-1 md:mt-2">Rp {(isFiltered ? stats.revenue : allStats.revenue).toLocaleString('id-ID')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="flex-1">
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
            <input type="text" placeholder="Search order, customer, produk, kode, atau item..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="paid">Paid</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={dateFilterType} onChange={(e) => { const v = e.target.value as any; setDateFilterType(v); if (v !== 'date') setDateValue(''); if (v !== 'month') setMonthValue(''); if (v !== 'year') setYearValue('') }} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="all">All Dates</option>
          <option value="date">Filter by Date</option>
          <option value="month">Filter by Month</option>
          <option value="year">Filter by Year</option>
        </select>
        {dateFilterType === 'date' && <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />}
        {dateFilterType === 'month' && <input type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />}
        {dateFilterType === 'year' && (
          <select value={yearValue} onChange={(e) => setYearValue(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Select Year</option>
            {Array.from(new Set(orders.map(o => new Date(o.created_at).getFullYear()))).sort((a, b) => b - a).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <button
          onClick={exportOrdersToExcel}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 whitespace-nowrap"
          title="Export data order sesuai filter/periode yang aktif"
        >
          <FiDownload size={16} /> Export Excel
        </button>
      </div>

      {/* Pagination */}
      {filteredOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-800">Page {currentPage} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700">Per page</label>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                {[10, 20, 30, 50].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-60"><FiChevronLeft size={14} /> Prev</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-60">Next <FiChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{orders.length === 0 ? 'No orders yet' : 'No orders match your search'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 w-12"></th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-900">Order ID</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-900">User ID/Phone</th>
                  <th className="text-right px-6 py-3 font-semibold text-gray-900">Total (IDR)</th>
                  <th className="text-center px-6 py-3 font-semibold text-gray-900">Items</th>
                  <th className="text-center px-6 py-3 font-semibold text-gray-900">Status</th>
                  <th className="text-left px-6 py-3 font-semibold text-gray-900">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedOrders.map((order) => (
                  <Fragment key={order.order_id}>
                    <tr className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setExpandedOrderId(expandedOrderId === order.order_id ? null : order.order_id)} className="p-1 hover:bg-gray-200 rounded">
                          {expandedOrderId === order.order_id ? <FiChevronUp className="text-gray-600" /> : <FiChevronDown className="text-gray-600" />}
                        </button>
                      </td>
                      <td className="px-6 py-3"><span className="font-mono text-sm font-medium text-gray-900">{order.order_id}</span></td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {order.user_id || (!order.customer_phone ? '-' : null)}
                        {order.customer_phone && (
                          <div className="mt-0.5">
                            <a
                              href={getWhatsappUrl(order.customer_phone) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700 hover:underline"
                              title="Chat customer via WhatsApp"
                            >
                              <FiMessageCircle size={13} />
                              {order.customer_phone}
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right"><span className="font-semibold text-gray-900">Rp {Number(order.total_amount || 0).toLocaleString('id-ID')}</span></td>
                      <td className="px-6 py-3 text-center"><span className="inline-block bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">{getItemCount(order.id)}</span></td>
                      <td className="px-6 py-3 text-center"><span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(getEffectiveStatus(order))}`}>{getEffectiveStatus(order).charAt(0).toUpperCase() + getEffectiveStatus(order).slice(1)}</span></td>
                      <td className="px-6 py-3 text-sm text-gray-600">{new Date(order.created_at).toLocaleDateString('id-ID')} • {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                    </tr>
                    {expandedOrderId === order.order_id && (
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-gray-900">Purchased Items</h4>
                            {(order.customer_name || order.customer_email || order.customer_phone) && (
                              <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-gray-900 mb-2">Customer Info</h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                  <div><p className="text-xs text-gray-500">Name</p><p className="text-gray-900">{order.customer_name || '-'}</p></div>
                                  <div><p className="text-xs text-gray-500">Email</p><p className="text-gray-900">{order.customer_email || '-'}</p></div>
                                  <div><p className="text-xs text-gray-500">Phone</p><p className="text-gray-900">{order.customer_phone || '-'}</p></div>
                                </div>
                              </div>
                            )}
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                              {getOrderItemDetails(order.id).length > 0 ? (
                                <div className="space-y-4">
                                  {getOrderItemDetails(order.id).map((item, idx) => (
                                    <div key={idx} className={`pb-4 ${idx !== getOrderItemDetails(order.id).length - 1 ? 'border-b border-gray-200' : ''}`}>
                                      <div className="flex justify-between items-start">
                                        <div><p className="text-gray-900 font-semibold">{item.productName}</p><p className="text-gray-600 text-xs">Code: {item.productCode}</p></div>
                                        <p className="text-gray-900 font-semibold">Rp {item.price.toLocaleString('id-ID')}</p>
                                      </div>
                                      <div className="mt-2">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="text-gray-500 text-xs font-medium">Item Data</p>
                                          <button onClick={() => handleCopyItemData(item.itemData)} className={`text-[11px] font-medium px-2 py-0.5 rounded border ${copiedText === item.itemData ? 'bg-green-50 text-green-700 border-green-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}>{copiedText === item.itemData ? 'Copied' : 'Copy'}</button>
                                          {copyError && <span className="text-xs text-red-600">{copyError}</span>}
                                        </div>
                                        <code className="text-xs bg-gray-50 px-3 py-2 rounded block break-all text-gray-700 whitespace-pre-wrap border border-gray-200">{item.itemData}</code>
                                      </div>
                                    </div>
                                  ))}
                                  <div className="pt-3 border-t-2 border-gray-300 flex justify-between items-center">
                                    <span className="text-base font-semibold text-gray-700">Total</span>
                                    <span className="text-lg font-bold text-indigo-600">Rp {Number(order.total_amount || 0).toLocaleString('id-ID')}</span>
                                  </div>
                                </div>
                              ) : <p className="text-gray-500 text-sm">No items</p>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
