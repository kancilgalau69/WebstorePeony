'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  FiSearch, FiX, FiCheck, FiToggleLeft, FiToggleRight,
  FiAlertCircle, FiCheckCircle, FiExternalLink,
  FiDollarSign, FiShoppingCart, FiTrendingUp, FiClock,
  FiUser, FiMail, FiPhone, FiMapPin, FiGlobe, FiEye,
  FiChevronDown, FiChevronUp, FiCreditCard
} from 'react-icons/fi'

type Reseller = {
  id: string
  nama_reseller?: string
  nama_toko: string
  slug: string
  email: string
  phone: string
  whatsapp?: string
  instagram?: string
  deskripsi?: string
  logo_url?: string
  warna_tema?: string
  is_active: boolean
  saldo: number
  total_penjualan: number
  total_komisi: number
  created_at: string
  // Enriched stats
  order_count: number
  completed_orders: number
  total_revenue: number
  total_komisi_calc: number
  pending_withdrawals: number
}

type ResellerOrder = {
  id: string
  order_id: string
  status: string
  total_amount: number
  total_modal: number
  komisi: number
  customer_name: string
  customer_email: string
  customer_phone: string
  payment_method: string
  created_at: string
}

type Withdrawal = {
  id: string
  amount: number
  bank_name: string
  account_number: string
  account_name: string
  status: string
  admin_notes?: string
  created_at: string
  processed_at?: string
}

type OrderItem = {
  order_id: string
  product_name: string
  product_code: string
  quantity: number
  harga_modal: number
  harga_jual: number
  item_data: string | null
}

type ResellerDetail = Reseller & {
  orders: ResellerOrder[]
  orderItems: Record<string, OrderItem[]>
  withdrawals: Withdrawal[]
  visible_products: number
  custom_prices: number
}

type Toast = { message: string; type: 'success' | 'error' }

function ToastComponent({ message, type, onClose }: Toast & { onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`}>
      {type === 'success' ? <FiCheckCircle size={16} /> : <FiAlertCircle size={16} />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80"><FiX size={14} /></button>
    </div>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-600',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function ResellersPage() {
  const [resellers, setResellers] = useState<Reseller[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [selectedReseller, setSelectedReseller] = useState<ResellerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string>('orders')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ nama_reseller: '', nama_toko: '', email: '', phone: '', password: '', slug: '', whatsapp: '', deskripsi: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [registrationSaving, setRegistrationSaving] = useState(false)

  const fetchResellers = useCallback(async () => {
    try {
      const res = await fetch('/api/resellers')
      const json = await res.json()
      if (json.data) setResellers(json.data)
      if (json.settings?.reseller_registration_enabled !== undefined) {
        setRegistrationEnabled(Boolean(json.settings.reseller_registration_enabled))
      }
    } catch (err: any) {
      setToast({ message: 'Gagal memuat data reseller', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  async function createReseller(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    try {
      const res = await fetch('/api/resellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const json = await res.json()
      if (json.success) {
        setToast({ message: `Reseller "${addForm.nama_toko}" berhasil dibuat`, type: 'success' })
        setShowAddForm(false)
        setAddForm({ nama_reseller: '', nama_toko: '', email: '', phone: '', password: '', slug: '', whatsapp: '', deskripsi: '' })
        fetchResellers()
      } else {
        setToast({ message: json.error || 'Gagal membuat reseller', type: 'error' })
      }
    } catch {
      setToast({ message: 'Gagal membuat reseller', type: 'error' })
    } finally {
      setAddSaving(false)
    }
  }

  useEffect(() => {
    fetchResellers()
  }, [fetchResellers])

  async function fetchDetail(id: string) {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/resellers?id=${id}`)
      const json = await res.json()
      if (json.data) setSelectedReseller(json.data)
    } catch {
      setToast({ message: 'Gagal memuat detail reseller', type: 'error' })
    } finally {
      setDetailLoading(false)
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const res = await fetch('/api/resellers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      })
      const json = await res.json()
      if (json.data) {
        setResellers(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentActive } : r))
        setToast({ message: `Reseller ${!currentActive ? 'diaktifkan' : 'dinonaktifkan'}`, type: 'success' })
      } else {
        setToast({ message: json.error || 'Gagal update', type: 'error' })
      }
    } catch {
      setToast({ message: 'Gagal update status', type: 'error' })
    }
  }

  async function toggleRegistrationEnabled() {
    setRegistrationSaving(true)
    try {
      const nextValue = !registrationEnabled
      const res = await fetch('/api/resellers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_enabled: nextValue }),
      })
      const json = await res.json()
      if (json.success) {
        setRegistrationEnabled(nextValue)
        setToast({ message: `Pendaftaran reseller publik ${nextValue ? 'diaktifkan' : 'dinonaktifkan'}`, type: 'success' })
      } else {
        setToast({ message: json.error || 'Gagal update pengaturan pendaftaran', type: 'error' })
      }
    } catch {
      setToast({ message: 'Gagal update pengaturan pendaftaran', type: 'error' })
    } finally {
      setRegistrationSaving(false)
    }
  }

  async function processWithdrawal(withdrawalId: string, action: 'approved' | 'rejected' | 'completed') {
    const actionLabels: Record<string, string> = {
      approved: 'disetujui',
      rejected: 'ditolak',
      completed: 'selesai (transfer berhasil)',
    }
    try {
      const res = await fetch('/api/resellers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawal_id: withdrawalId, action }),
      })
      const json = await res.json()
      if (json.success) {
        setToast({ message: `Withdrawal ${actionLabels[action] || action}`, type: 'success' })
        // Refresh detail
        if (selectedReseller) fetchDetail(selectedReseller.id)
        fetchResellers()
      } else {
        setToast({ message: json.error || 'Gagal proses', type: 'error' })
      }
    } catch {
      setToast({ message: 'Gagal proses withdrawal', type: 'error' })
    }
  }

  const filtered = resellers.filter(r => {
    const q = search.toLowerCase()
    return r.nama_toko.toLowerCase().includes(q) ||
      (r.nama_reseller || '').toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      (r.phone || '').includes(q)
  })

  // Summary stats
  const totalResellers = resellers.length
  const activeResellers = resellers.filter(r => r.is_active).length
  const totalRevenue = resellers.reduce((sum, r) => sum + (r.total_revenue || 0), 0)
  const totalKomisi = resellers.reduce((sum, r) => sum + (r.total_komisi_calc || 0), 0)
  const pendingWithdrawals = resellers.reduce((sum, r) => sum + (r.pending_withdrawals || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  // Detail view
  if (selectedReseller) {
    return (
      <div className="space-y-6">
        {toast && <ToastComponent {...toast} onClose={() => setToast(null)} />}

        {/* Back button */}
        <button
          onClick={() => setSelectedReseller(null)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
        >
          <FiX size={16} /> Kembali ke daftar
        </button>

        {/* Reseller Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {selectedReseller.logo_url ? (
                <img src={selectedReseller.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover border" />
              ) : (
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: selectedReseller.warna_tema || '#6366f1' }}
                >
                  {selectedReseller.nama_toko.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedReseller.nama_toko}</h2>
                <p className="text-sm text-gray-500">/{selectedReseller.slug}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {selectedReseller.nama_reseller && <span><FiUser className="inline mr-1" />{selectedReseller.nama_reseller}</span>}
                  <span><FiMail className="inline mr-1" />{selectedReseller.email}</span>
                  <span><FiPhone className="inline mr-1" />{selectedReseller.phone || '-'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${selectedReseller.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {selectedReseller.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>

          {selectedReseller.deskripsi && (
            <p className="mt-3 text-sm text-gray-600">{selectedReseller.deskripsi}</p>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{formatCurrency(selectedReseller.saldo)}</div>
              <div className="text-xs text-gray-500">Saldo</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{formatCurrency(selectedReseller.total_penjualan)}</div>
              <div className="text-xs text-gray-500">Total Penjualan</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{formatCurrency(selectedReseller.total_komisi)}</div>
              <div className="text-xs text-gray-500">Total Komisi</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{selectedReseller.visible_products}</div>
              <div className="text-xs text-gray-500">Produk Aktif</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{selectedReseller.custom_prices}</div>
              <div className="text-xs text-gray-500">Harga Custom</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-400">
            Bergabung: {formatDate(selectedReseller.created_at)}
            {selectedReseller.whatsapp && <span className="ml-4">WA: {selectedReseller.whatsapp}</span>}
            {selectedReseller.instagram && <span className="ml-4">IG: @{selectedReseller.instagram}</span>}
          </div>
        </div>

        {/* Orders Section */}
        <div className="bg-white rounded-xl border border-gray-200">
          <button
            onClick={() => setExpandedSection(expandedSection === 'orders' ? '' : 'orders')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FiShoppingCart size={16} />
              Orders ({selectedReseller.orders.length})
            </h3>
            {expandedSection === 'orders' ? <FiChevronUp /> : <FiChevronDown />}
          </button>
          {expandedSection === 'orders' && (
            <div className="border-t border-gray-100">
              {selectedReseller.orders.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Belum ada order.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {selectedReseller.orders.map((order) => {
                    const isExpanded = expandedOrderId === order.order_id
                    const items = selectedReseller.orderItems?.[order.id] || []
                    return (
                      <div key={order.order_id}>
                        {/* Order row */}
                        <div
                          className="grid grid-cols-6 items-center px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 transition"
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.order_id)}
                        >
                          <div className="font-mono text-xs text-indigo-600 font-semibold">{order.order_id}</div>
                          <div>
                            <div className="text-gray-900 text-sm">{order.customer_name}</div>
                            <div className="text-xs text-gray-400">{order.customer_email}</div>
                          </div>
                          <div className="font-medium">{formatCurrency(order.total_amount)}</div>
                          <div className="text-green-600 font-medium">{formatCurrency(order.komisi)}</div>
                          <div><StatusBadge status={order.status} /></div>
                          <div className="text-gray-500 text-xs flex items-center justify-between">
                            {formatDateTime(order.created_at)}
                            <FiChevronDown className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={14} />
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-xs">
                              <div><span className="text-gray-400">Phone:</span> <span className="font-medium">{order.customer_phone || '-'}</span></div>
                              <div><span className="text-gray-400">Payment:</span> <span className="font-medium">{order.payment_method || '-'}</span></div>
                              <div><span className="text-gray-400">Modal:</span> <span className="font-medium">{formatCurrency(order.total_modal)}</span></div>
                              <div><span className="text-gray-400">Profit:</span> <span className="font-medium text-green-600">{formatCurrency(order.komisi)}</span></div>
                            </div>

                            {/* Order Items */}
                            {items.length > 0 ? (
                              <div className="space-y-2 mt-2">
                                <div className="text-xs font-semibold text-gray-600">Item Digital ({items.length}):</div>
                                {items.map((item, idx) => (
                                  <div key={idx} className="bg-white rounded-lg border border-gray-200 p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-medium text-gray-900">
                                        {item.product_name} <span className="text-gray-400 text-xs">x{item.quantity}</span>
                                      </span>
                                      <span className="text-xs text-gray-500">{formatCurrency(item.harga_jual)}</span>
                                    </div>
                                    {item.item_data ? (
                                      <pre className="text-xs font-mono bg-emerald-50 border border-emerald-200 rounded p-2 whitespace-pre-wrap break-all text-gray-800 mt-1">
                                        {item.item_data}
                                      </pre>
                                    ) : (
                                      <span className="text-xs text-yellow-600">
                                        <FiClock className="inline mr-1" size={10} />Item belum tersedia
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : order.status === 'completed' ? (
                              <p className="text-xs text-yellow-600 mt-2">
                                <FiClock className="inline mr-1" size={10} />Item sedang diproses...
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Withdrawals Section */}
        <div className="bg-white rounded-xl border border-gray-200">
          <button
            onClick={() => setExpandedSection(expandedSection === 'withdrawals' ? '' : 'withdrawals')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FiCreditCard size={16} />
              Withdrawals ({selectedReseller.withdrawals.length})
            </h3>
            {expandedSection === 'withdrawals' ? <FiChevronUp /> : <FiChevronDown />}
          </button>
          {expandedSection === 'withdrawals' && (
            <div className="border-t border-gray-100 overflow-x-auto">
              {selectedReseller.withdrawals.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Belum ada withdrawal.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Jumlah</th>
                      <th className="px-4 py-2 text-left font-medium">Bank</th>
                      <th className="px-4 py-2 text-left font-medium">Rekening</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Tanggal</th>
                      <th className="px-4 py-2 text-left font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedReseller.withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-bold text-gray-900">{formatCurrency(w.amount)}</td>
                        <td className="px-4 py-2">{w.bank_name}</td>
                        <td className="px-4 py-2">
                          <div className="text-gray-900">{w.account_number}</div>
                          <div className="text-xs text-gray-500">{w.account_name}</div>
                        </td>
                        <td className="px-4 py-2"><StatusBadge status={w.status} /></td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{formatDateTime(w.created_at)}</td>
                        <td className="px-4 py-2">
                          {w.status === 'pending' && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => processWithdrawal(w.id, 'approved')}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => processWithdrawal(w.id, 'rejected')}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
                              >
                                Tolak
                              </button>
                            </div>
                          )}
                          {w.status === 'approved' && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => processWithdrawal(w.id, 'completed')}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                              >
                                Transfer Selesai
                              </button>
                              <button
                                onClick={() => processWithdrawal(w.id, 'rejected')}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
                              >
                                Batalkan
                              </button>
                            </div>
                          )}
                          {(w.status === 'completed' || w.status === 'rejected') && w.processed_at && (
                            <span className="text-xs text-gray-400">{formatDate(w.processed_at)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-6">
      {toast && <ToastComponent {...toast} onClose={() => setToast(null)} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <FiUser className="text-indigo-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalResellers}</div>
              <div className="text-xs text-gray-500">Total Reseller</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <FiCheck className="text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{activeResellers}</div>
              <div className="text-xs text-gray-500">Aktif</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FiTrendingUp className="text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(totalRevenue)}</div>
              <div className="text-xs text-gray-500">Total Revenue</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <FiDollarSign className="text-emerald-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(totalKomisi)}</div>
              <div className="text-xs text-gray-500">Total Komisi</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <FiClock className="text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{pendingWithdrawals}</div>
              <div className="text-xs text-gray-500">Pending WD</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Add Button */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Pendaftaran Reseller Publik</h3>
            <p className="text-xs text-gray-500">Atur apakah calon reseller bisa mendaftar sendiri dari halaman register.</p>
          </div>
          <button
            onClick={toggleRegistrationEnabled}
            disabled={registrationSaving}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              registrationEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-60`}
          >
            {registrationEnabled ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
            {registrationSaving ? 'Menyimpan...' : registrationEnabled ? 'Pendaftaran Aktif' : 'Pendaftaran Nonaktif'}
          </button>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari reseller (nama, toko, email, slug)..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              showAddForm ? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {showAddForm ? <><FiX className="inline mr-1" />Batal</> : <>+ Tambah Reseller</>}
          </button>
        </div>

        {/* Add Reseller Form */}
        {showAddForm && (
          <form onSubmit={createReseller} className="mt-4 pt-4 border-t border-gray-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nama Reseller *</label>
                <input
                  type="text"
                  value={addForm.nama_reseller}
                  onChange={(e) => setAddForm({ ...addForm, nama_reseller: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Nama pemilik/reseller"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nama Toko *</label>
                <input
                  type="text"
                  value={addForm.nama_toko}
                  onChange={(e) => setAddForm({ ...addForm, nama_toko: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Nama toko reseller"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Slug URL *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">/</span>
                  <input
                    type="text"
                    value={addForm.slug}
                    onChange={(e) => setAddForm({ ...addForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="nama-toko"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="email@reseller.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="text"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Min. 8 karakter"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">No. Telepon</label>
                <input
                  type="text"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="08xxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={addForm.whatsapp}
                  onChange={(e) => setAddForm({ ...addForm, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="628xxxxxxxxx"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Deskripsi Toko</label>
              <textarea
                value={addForm.deskripsi}
                onChange={(e) => setAddForm({ ...addForm, deskripsi: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                rows={2}
                placeholder="Deskripsi singkat toko (opsional)"
              />
            </div>
            <button
              type="submit"
              disabled={addSaving}
              className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {addSaving ? 'Menyimpan...' : 'Buat Reseller'}
            </button>
          </form>
        )}
      </div>

      {/* Resellers Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Toko</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Kontak</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Orders</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Revenue</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Komisi</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Saldo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    {search ? 'Tidak ada reseller ditemukan.' : 'Belum ada reseller.'}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {r.logo_url ? (
                          <img src={r.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover border" />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: r.warna_tema || '#6366f1' }}
                          >
                            {r.nama_toko.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{r.nama_toko}</div>
                          <div className="text-xs text-gray-400">/{r.slug}</div>
                          {r.nama_reseller && <div className="text-xs text-gray-500">{r.nama_reseller}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900 text-xs">{r.email}</div>
                      <div className="text-gray-500 text-xs">{r.phone || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.completed_orders}</div>
                      <div className="text-xs text-gray-400">{r.order_count} total</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(r.total_revenue)}
                    </td>
                    <td className="px-4 py-3 font-medium text-green-600">
                      {formatCurrency(r.total_komisi_calc)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(r.saldo)}
                      {r.pending_withdrawals > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                          {r.pending_withdrawals} WD
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(r.id, r.is_active)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition ${
                          r.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {r.is_active ? <FiToggleRight size={14} /> : <FiToggleLeft size={14} />}
                        {r.is_active ? 'Aktif' : 'Off'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => fetchDetail(r.id)}
                        className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition"
                      >
                        <FiEye className="inline mr-1" size={12} />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
