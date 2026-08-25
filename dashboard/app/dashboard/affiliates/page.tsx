'use client'

import { useEffect, useState } from 'react'
import { FiDollarSign, FiUsers, FiClock, FiCheckCircle, FiSettings, FiSearch } from 'react-icons/fi'

type Affiliate = {
  id: string
  affiliate_code: string
  saldo: number
  total_earnings: number
  total_withdrawn: number
  total_orders: number
  total_clicks: number
  is_active: boolean
  created_at: string
  user_web?: {
    id: string
    nama: string
    email: string
    phone: string
  } | null
}

type Withdrawal = {
  id: string
  affiliate_id: string
  amount: number
  bank_name: string
  account_number: string
  account_name: string
  status: string
  admin_notes: string | null
  processed_at: string | null
  created_at: string
}

type Settings = {
  affiliate_enabled?: string
  affiliate_commission_percent?: string
  affiliate_min_withdraw?: string
}

type Toast = { type: 'success' | 'error'; message: string }

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    pending: 'Menunggu',
    approved: 'Disetujui',
    completed: 'Selesai',
    rejected: 'Ditolak',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  )
}

export default function AffiliatesPage() {
  const [mode, setMode] = useState<'store' | 'market'>('store')
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'affiliates' | 'withdrawals' | 'settings'>('affiliates')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [marketData, setMarketData] = useState<any | null>(null)
  const [marketLoading, setMarketLoading] = useState(false)

  // Settings form
  const [commissionForm, setCommissionForm] = useState('5')
  const [minWithdrawForm, setMinWithdrawForm] = useState('50000')
  const [enabledForm, setEnabledForm] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function fetchData() {
    try {
      const res = await fetch('/api/affiliates', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.data) {
        setAffiliates(json.data.affiliates || [])
        setWithdrawals(json.data.withdrawals || [])
        setSettings(json.data.settings || {})
        setCommissionForm(json.data.settings?.affiliate_commission_percent || '5')
        setMinWithdrawForm(json.data.settings?.affiliate_min_withdraw || '50000')
        setEnabledForm(String(json.data.settings?.affiliate_enabled || 'true').toLowerCase() === 'true')
      }
    } catch (err) {
      console.error('Fetch affiliates error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMarketData() {
    setMarketLoading(true)
    try {
      const res = await fetch('/api/market-affiliates', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setMarketData(json)
      else setToast({ type: 'error', message: json.error || 'Gagal memuat affiliate market' })
    } finally {
      setMarketLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'market' && !marketData) fetchMarketData()
  }, [mode])

  async function processWithdrawal(id: string, action: 'approved' | 'rejected' | 'completed') {
    try {
      const res = await fetch('/api/affiliates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawal_id: id, action }),
      })
      const json = await res.json()
      if (json.success) {
        const labels: Record<string, string> = {
          approved: 'disetujui',
          rejected: 'ditolak',
          completed: 'selesai (transfer berhasil)',
        }
        setToast({ type: 'success', message: `Withdrawal ${labels[action] || action}` })
        fetchData()
      } else {
        setToast({ type: 'error', message: json.error || 'Gagal proses' })
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal proses' })
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const res = await fetch('/api/affiliates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commission_percent: Number(commissionForm),
          min_withdraw: Number(minWithdrawForm),
          enabled: enabledForm,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setToast({ type: 'success', message: 'Pengaturan berhasil disimpan' })
        fetchData()
      } else {
        setToast({ type: 'error', message: json.error || 'Gagal menyimpan' })
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal menyimpan' })
    } finally {
      setSavingSettings(false)
    }
  }

  async function processMarketWithdrawal(id: string, action: 'approved' | 'rejected' | 'completed') {
    const res = await fetch('/api/market-affiliates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ withdrawal_id: id, action }),
    })
    const json = await res.json()
    if (json.success) {
      setToast({ type: 'success', message: 'Withdrawal affiliate market diproses' })
      fetchMarketData()
    } else {
      setToast({ type: 'error', message: json.error || 'Gagal proses withdrawal market' })
    }
  }

  const formatIDR = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`
  const formatDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  const formatDateTime = (s: string) => new Date(s).toLocaleString('id-ID')

  // Find affiliate by id for withdrawal display
  const findAffiliate = (id: string) => affiliates.find(a => a.id === id)

  const filteredAffiliates = affiliates.filter(a => {
    const q = search.toLowerCase()
    return (
      a.affiliate_code.toLowerCase().includes(q) ||
      (a.user_web?.nama || '').toLowerCase().includes(q) ||
      (a.user_web?.email || '').toLowerCase().includes(q)
    )
  })

  const totalAffiliates = affiliates.length
  const totalEarnings = affiliates.reduce((s, a) => s + Number(a.total_earnings || 0), 0)
  const totalSaldo = affiliates.reduce((s, a) => s + Number(a.saldo || 0), 0)
  const pendingWithdrawalsCount = withdrawals.filter(w => w.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Affiliate Program</h1>
        <p className="text-sm text-gray-500 mt-1">
          Komisi saat ini: <strong>{settings.affiliate_commission_percent || '5'}%</strong> •
          Min. withdraw: <strong>{formatIDR(Number(settings.affiliate_min_withdraw || 50000))}</strong>
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-2 flex gap-2 w-fit">
        <button onClick={() => setMode('store')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode === 'store' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Affiliate Store</button>
        <button onClick={() => setMode('market')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode === 'market' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Affiliate Market</button>
      </div>

      {mode === 'market' && (
        <MarketAffiliateAdminView
          data={marketData}
          loading={marketLoading}
          formatIDR={formatIDR}
          formatDateTime={formatDateTime}
          processWithdrawal={processMarketWithdrawal}
          refresh={fetchMarketData}
        />
      )}

      {mode === 'store' && (
        <>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <FiUsers className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Affiliate</p>
              <p className="text-lg font-bold text-gray-900">{totalAffiliates}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <FiDollarSign className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Komisi Dibayarkan</p>
              <p className="text-lg font-bold text-gray-900">{formatIDR(totalEarnings)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <FiDollarSign className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Saldo Affiliate</p>
              <p className="text-lg font-bold text-gray-900">{formatIDR(totalSaldo)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <FiClock className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pending Withdraw</p>
              <p className="text-lg font-bold text-gray-900">{pendingWithdrawalsCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {[
            { key: 'affiliates', label: 'Daftar Affiliate' },
            { key: 'withdrawals', label: `Withdrawal ${pendingWithdrawalsCount > 0 ? `(${pendingWithdrawalsCount})` : ''}` },
            { key: 'settings', label: 'Pengaturan' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Affiliates */}
      {tab === 'affiliates' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama/email/kode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {filteredAffiliates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {affiliates.length === 0 ? 'Belum ada affiliate terdaftar' : 'Tidak ada yang cocok dengan pencarian'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold text-gray-900">User</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-900">Kode</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-900">Saldo</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-900">Total Komisi</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-900">Ditarik</th>
                      <th className="text-center px-5 py-3 font-semibold text-gray-900">Order</th>
                      <th className="text-center px-5 py-3 font-semibold text-gray-900">Klik</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-900">Terdaftar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAffiliates.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-gray-900">{a.user_web?.nama || '-'}</div>
                          <div className="text-xs text-gray-700">{a.user_web?.email}</div>
                        </td>
                        <td className="px-5 py-3">
                          <code className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                            {a.affiliate_code}
                          </code>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-emerald-600">{formatIDR(a.saldo)}</td>
                        <td className="px-5 py-3 text-right text-gray-900">{formatIDR(a.total_earnings)}</td>
                        <td className="px-5 py-3 text-right text-gray-900 font-medium">{formatIDR(a.total_withdrawn)}</td>
                        <td className="px-5 py-3 text-center text-gray-900 font-medium">{a.total_orders}</td>
                        <td className="px-5 py-3 text-center text-gray-900 font-medium">{a.total_clicks}</td>
                        <td className="px-5 py-3 text-xs text-gray-700 font-medium">{formatDate(a.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Withdrawals */}
      {tab === 'withdrawals' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {withdrawals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Belum ada permintaan withdraw</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-900">User</th>
                    <th className="text-right px-5 py-3 font-semibold text-gray-900">Jumlah</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-900">Bank</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-900">Rekening</th>
                    <th className="text-center px-5 py-3 font-semibold text-gray-900">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-900">Tanggal</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-900">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {withdrawals.map(w => {
                    const aff = findAffiliate(w.affiliate_id)
                    return (
                      <tr key={w.id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-gray-900">{aff?.user_web?.nama || '-'}</div>
                          <div className="text-xs text-gray-700">{aff?.user_web?.email} • <code className="font-mono text-indigo-700 font-semibold">{aff?.affiliate_code}</code></div>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900">{formatIDR(w.amount)}</td>
                        <td className="px-5 py-3 text-gray-900 font-medium">{w.bank_name}</td>
                        <td className="px-5 py-3">
                          <div className="font-mono text-xs">{w.account_number}</div>
                          <div className="text-xs text-gray-700">{w.account_name}</div>
                        </td>
                        <td className="px-5 py-3 text-center"><StatusBadge status={w.status} /></td>
                        <td className="px-5 py-3 text-xs text-gray-700 font-medium">{formatDateTime(w.created_at)}</td>
                        <td className="px-5 py-3">
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
                            <span className="text-xs text-gray-700 font-medium">{formatDate(w.processed_at)}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {tab === 'settings' && (
        <form onSubmit={saveSettings} className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <FiSettings className="text-indigo-600" />
            <h2 className="font-bold text-gray-900">Pengaturan Affiliate Program</h2>
          </div>

          <label className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-semibold text-sm text-gray-900">Aktifkan Program Affiliate</p>
              <p className="text-xs text-gray-500 mt-0.5">Jika nonaktif, link ref tidak akan menghasilkan komisi</p>
            </div>
            <input
              type="checkbox"
              checked={enabledForm}
              onChange={e => setEnabledForm(e.target.checked)}
              className="w-5 h-5"
            />
          </label>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Persentase Komisi (%)</label>
            <p className="text-xs text-gray-500 mb-2">Dihitung dari total transaksi order completed</p>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={commissionForm}
              onChange={e => setCommissionForm(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Minimum Withdraw (Rp)</label>
            <p className="text-xs text-gray-500 mb-2">User hanya bisa tarik saldo jika minimal mencapai nilai ini</p>
            <input
              type="number"
              min="0"
              value={minWithdrawForm}
              onChange={e => setMinWithdrawForm(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex gap-2 items-start">
            <FiCheckCircle className="flex-shrink-0 mt-0.5" />
            <p>Perubahan berlaku untuk transaksi baru. Komisi yang sudah dicatat tidak berubah.</p>
          </div>
        </form>
      )}
        </>
      )}
    </div>
  )
}

function MarketAffiliateAdminView({ data, loading, formatIDR, formatDateTime, processWithdrawal, refresh }: any) {
  const [tab, setTab] = useState<'affiliates' | 'sellers' | 'withdrawals'>('affiliates')
  if (loading || !data) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
  }

  const totalEarnings = data.affiliates.reduce((s: number, a: any) => s + Number(a.total_earnings || 0), 0)
  const pendingWd = data.withdrawals.filter((w: any) => w.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs font-medium text-gray-600">Affiliate Market</p><p className="text-lg font-bold text-gray-950">{data.affiliates.length}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs font-medium text-gray-600">Seller Aktif Affiliate</p><p className="text-lg font-bold text-gray-950">{data.enabledSellers.length}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs font-medium text-gray-600">Total Komisi</p><p className="text-lg font-bold text-gray-950">{formatIDR(totalEarnings)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs font-medium text-gray-600">Pending WD</p><p className="text-lg font-bold text-gray-950">{pendingWd}</p></div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        WD affiliate market diproses oleh admin pusat. Saldo affiliate dikurangi otomatis saat status WD diubah menjadi <strong>completed</strong>.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-2 flex gap-2 w-fit">
        {[
          ['affiliates', 'Daftar Affiliate'],
          ['sellers', 'Seller Aktif'],
          ['withdrawals', `WD Affiliate ${pendingWd ? `(${pendingWd})` : ''}`],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === key ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>{label}</button>
        ))}
        <button onClick={refresh} className="px-4 py-2 rounded-lg text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Refresh</button>
      </div>

      {tab === 'affiliates' && <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b flex justify-between"><h2 className="font-bold text-gray-950">Daftar Affiliate Market & Saldo</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-gray-800"><tr><th className="px-5 py-3 text-left">User</th><th className="px-5 py-3 text-left">Kode</th><th className="px-5 py-3 text-right">Saldo</th><th className="px-5 py-3 text-right">Total Komisi</th><th className="px-5 py-3 text-center">Order</th><th className="px-5 py-3 text-center">Klik</th></tr></thead><tbody className="divide-y">
          {data.affiliates.map((a: any) => <tr key={a.id}><td className="px-5 py-3"><p className="font-semibold text-gray-950">{a.user_web?.nama || '-'}</p><p className="text-xs text-gray-700">{a.user_web?.email}</p></td><td className="px-5 py-3 font-mono font-bold text-indigo-700">{a.affiliate_code}</td><td className="px-5 py-3 text-right font-bold text-emerald-600">{formatIDR(a.saldo)}</td><td className="px-5 py-3 text-right text-gray-900 font-medium">{formatIDR(a.total_earnings)}</td><td className="px-5 py-3 text-center text-gray-900 font-medium">{a.total_orders}</td><td className="px-5 py-3 text-center text-gray-900 font-medium">{a.total_clicks}</td></tr>)}
        </tbody></table></div>
      </div>}

      {tab === 'sellers' && <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b"><h2 className="font-bold text-gray-950">Seller yang Mengaktifkan Affiliate</h2></div>
        {data.enabledSellers.length === 0 ? <div className="p-8 text-center text-gray-600">Belum ada seller aktif affiliate.</div> : data.enabledSellers.map((s: any) => <div key={s.id} className="px-5 py-3 border-b flex justify-between text-sm"><div><p className="font-bold text-gray-950">{s.sellers?.nama_toko}</p><p className="text-xs text-gray-600">/{s.sellers?.slug}</p></div><p className="font-bold text-indigo-600">{s.commission_percent}%</p></div>)}
      </div>}

      {tab === 'withdrawals' && <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b"><h2 className="font-bold text-gray-950">Informasi WD Affiliate Market</h2></div>
        {data.withdrawals.length === 0 ? <div className="p-8 text-center text-gray-600">Belum ada WD affiliate market.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-gray-700"><tr><th className="px-5 py-3 text-left">User</th><th className="px-5 py-3 text-right">Jumlah</th><th className="px-5 py-3 text-left">Tujuan</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Aksi</th></tr></thead><tbody className="divide-y">
          {data.withdrawals.map((w: any) => <tr key={w.id}><td className="px-5 py-3"><p className="font-semibold text-gray-950">{w.market_affiliates?.user_web?.nama || '-'}</p><p className="text-xs text-indigo-700 font-mono font-semibold">{w.market_affiliates?.affiliate_code}</p></td><td className="px-5 py-3 text-right font-bold text-gray-950">{formatIDR(w.amount)}</td><td className="px-5 py-3"><p className="text-gray-900 font-medium">{w.bank_name} - {w.account_number}</p><p className="text-xs text-gray-700">{w.account_name}</p></td><td className="px-5 py-3 text-center text-gray-900 font-semibold">{w.status}</td><td className="px-5 py-3"><div className="flex gap-1">{w.status === 'pending' && <><button onClick={() => processWithdrawal(w.id, 'approved')} className="px-2 py-1 bg-green-600 text-white rounded text-xs">Setujui</button><button onClick={() => processWithdrawal(w.id, 'rejected')} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Tolak</button></>}{w.status === 'approved' && <button onClick={() => processWithdrawal(w.id, 'completed')} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Selesai</button>}</div></td></tr>)}
        </tbody></table></div>}
      </div>}
    </div>
  )
}
