'use client'

import { useEffect, useState } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiSearch, FiToggleLeft, FiToggleRight } from 'react-icons/fi'

type Promo = {
  id: string; code: string; title: string; description: string | null
  promo_type: string; discount_percent: number; discount_amount: number
  max_discount: number | null; min_purchase: number
  required_product_id: string | null; required_qty: number
  reward_product_id: string | null; reward_qty: number
  eligible_for: string; is_public: boolean; is_active: boolean
  valid_from: string | null; valid_until: string | null
  usage_limit: number | null; usage_per_user: number | null; usage_count: number
  created_at: string
}
type Product = { id: string; kode: string; nama: string }
type Toast = { type: 'success' | 'error'; message: string }

const PROMO_TYPES = [
  { value: 'percent', label: 'Potongan Persentase (%)' },
  { value: 'fixed', label: 'Potongan Nominal (Rp)' },
  { value: 'buy_x_get_y', label: 'Beli A Gratis B' },
  { value: 'buy_x_get_x', label: 'Beli X Gratis 1 (Produk Sama)' },
]

const emptyForm = {
  id: '', code: '', title: '', description: '', promo_type: 'percent',
  discount_percent: '0', discount_amount: '0', max_discount: '', min_purchase: '0',
  required_product_id: '', required_qty: '1', reward_product_id: '', reward_qty: '1',
  eligible_for: 'registered_only', is_public: true, is_active: true,
  applicable_product_ids: '' as string,
  valid_from: '', valid_until: '', usage_limit: '', usage_per_user: '1',
}

export default function PromosPage() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchData() }, [])
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t) } }, [toast])

  async function fetchData() {
    try {
      const res = await fetch('/api/promos', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) { setPromos(json.promos || []); setProducts(json.products || []) }
    } catch {} finally { setLoading(false) }
  }

  function openNew() { setForm(emptyForm); setShowForm(true) }
  function openEdit(p: Promo) {
    setForm({
      id: p.id, code: p.code, title: p.title, description: p.description || '',
      promo_type: p.promo_type, discount_percent: String(p.discount_percent || 0),
      discount_amount: String(p.discount_amount || 0), max_discount: p.max_discount ? String(p.max_discount) : '',
      min_purchase: String(p.min_purchase || 0), required_product_id: p.required_product_id || '',
      required_qty: String(p.required_qty || 1), reward_product_id: p.reward_product_id || '',
      reward_qty: String(p.reward_qty || 1), eligible_for: p.eligible_for,
      is_public: p.is_public, is_active: p.is_active,
      applicable_product_ids: ((p as any).applicable_product_ids || []).join(','),
      valid_from: p.valid_from ? p.valid_from.slice(0, 16) : '',
      valid_until: p.valid_until ? p.valid_until.slice(0, 16) : '',
      usage_limit: p.usage_limit ? String(p.usage_limit) : '',
      usage_per_user: p.usage_per_user ? String(p.usage_per_user) : '1',
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const isEdit = !!form.id
      const applicableIds = form.applicable_product_ids
        ? form.applicable_product_ids.split(',').map(s => s.trim()).filter(s => s && s !== '_pending')
        : null
      const payload: any = { ...form, discount_percent: Number(form.discount_percent), discount_amount: Number(form.discount_amount), max_discount: form.max_discount ? Number(form.max_discount) : null, min_purchase: Number(form.min_purchase), required_qty: Number(form.required_qty), reward_qty: Number(form.reward_qty), valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null, valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null, usage_limit: form.usage_limit ? Number(form.usage_limit) : null, usage_per_user: form.usage_per_user ? Number(form.usage_per_user) : null, required_product_id: form.required_product_id || null, reward_product_id: form.reward_product_id || null, applicable_product_ids: applicableIds && applicableIds.length > 0 ? applicableIds : null }
      const res = await fetch('/api/promos', { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (json.success) { setToast({ type: 'success', message: isEdit ? 'Promo diperbarui' : 'Promo dibuat' }); setShowForm(false); fetchData() }
      else setToast({ type: 'error', message: json.error || 'Gagal' })
    } catch { setToast({ type: 'error', message: 'Gagal menyimpan' }) } finally { setSaving(false) }
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Hapus promo "${code}"?`)) return
    const res = await fetch(`/api/promos?id=${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { setToast({ type: 'success', message: 'Promo dihapus' }); fetchData() }
    else setToast({ type: 'error', message: json.error || 'Gagal' })
  }

  async function toggleActive(p: Promo) {
    const res = await fetch('/api/promos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, is_active: !p.is_active }) })
    const json = await res.json()
    if (json.success) fetchData()
  }

  const formatIDR = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`
  const formatDate = (s: string | null) => s ? new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const getProductName = (id: string | null) => id ? products.find(p => p.id === id)?.nama || '?' : '—'

  const filtered = promos.filter(p => {
    const q = search.toLowerCase()
    return p.code.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)
  })

  const typeLabel = (t: string) => PROMO_TYPES.find(x => x.value === t)?.label || t

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>

  return (
    <div className="space-y-6">
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{toast.message}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl md:text-2xl font-bold text-gray-900">Promo & Kupon</h1><p className="text-sm text-gray-500 mt-1">{promos.length} promo terdaftar</p></div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"><FiPlus /> Promo Baru</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Total Promo</p><p className="text-2xl font-bold text-gray-900">{promos.length}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Aktif</p><p className="text-2xl font-bold text-emerald-600">{promos.filter(p => p.is_active).length}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Publik</p><p className="text-2xl font-bold text-blue-600">{promos.filter(p => p.is_public).length}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Total Digunakan</p><p className="text-2xl font-bold text-purple-600">{promos.reduce((s, p) => s + p.usage_count, 0)}</p></div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <FiSearch className="absolute left-3 top-3 text-gray-400" />
        <input type="text" placeholder="Cari kode atau judul..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">{promos.length === 0 ? 'Belum ada promo. Klik "Promo Baru" untuk membuat.' : 'Tidak ada yang cocok.'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Kode</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Judul</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Tipe</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Nilai</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-900">Untuk</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-900">Dipakai</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Berlaku</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-900">Aktif</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-900">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3"><code className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">{p.code}</code></td>
                    <td className="px-5 py-3 font-medium text-gray-900 max-w-[200px] truncate">{p.title}</td>
                    <td className="px-5 py-3 text-xs text-gray-600">{typeLabel(p.promo_type)}</td>
                    <td className="px-5 py-3 text-xs text-gray-900 font-medium">
                      {p.promo_type === 'percent' && `${p.discount_percent}%${p.max_discount ? ` (max ${formatIDR(p.max_discount)})` : ''}`}
                      {p.promo_type === 'fixed' && formatIDR(p.discount_amount)}
                      {p.promo_type === 'buy_x_get_y' && `Beli ${p.required_qty}x → Gratis ${getProductName(p.reward_product_id)}`}
                      {p.promo_type === 'buy_x_get_x' && `Beli ${p.required_qty}x → Gratis ${p.reward_qty}x`}
                    </td>
                    <td className="px-5 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.eligible_for === 'all' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{p.eligible_for === 'all' ? 'Semua' : 'Member'}</span></td>
                    <td className="px-5 py-3 text-center text-gray-600">{p.usage_count}{p.usage_limit ? `/${p.usage_limit}` : ''}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{formatDate(p.valid_from)} — {formatDate(p.valid_until)}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => toggleActive(p)} className="text-lg">{p.is_active ? <FiToggleRight className="text-emerald-500" /> : <FiToggleLeft className="text-gray-400" />}</button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(p)} className="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"><FiEdit2 size={12} /></button>
                        <button onClick={() => handleDelete(p.id, p.code)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"><FiTrash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{form.id ? 'Edit Promo' : 'Promo Baru'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500"><FiX className="mx-auto" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Kode Promo *</label><input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} required placeholder="DISKON10" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase" /></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Judul *</label><input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Diskon 10% Semua Produk" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1">Deskripsi (opsional)</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Deskripsi promo untuk ditampilkan ke user..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" /></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Tipe Promo *</label>
                  <select value={form.promo_type} onChange={e => setForm({ ...form, promo_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {PROMO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Untuk Siapa</label>
                  <select value={form.eligible_for} onChange={e => setForm({ ...form, eligible_for: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="registered_only">Member (sudah daftar)</option>
                    <option value="all">Semua (termasuk tamu)</option>
                  </select>
                </div>
              </div>

              {/* Applicable products (for percent/fixed) */}
              {(form.promo_type === 'percent' || form.promo_type === 'fixed') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Berlaku untuk Produk</label>
                  <select
                    value={form.applicable_product_ids ? 'specific' : 'all'}
                    onChange={e => {
                      if (e.target.value === 'all') {
                        setForm({ ...form, applicable_product_ids: '' })
                      } else {
                        // Switch to specific — set a placeholder so dropdown stays on "Produk Tertentu"
                        setForm({ ...form, applicable_product_ids: form.applicable_product_ids || '_pending' })
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm mb-2"
                  >
                    <option value="all">Semua Produk</option>
                    <option value="specific">Produk Tertentu</option>
                  </select>
                  {form.applicable_product_ids && (
                    <>
                      <select
                        multiple
                        value={form.applicable_product_ids.split(',').filter(v => v && v !== '_pending')}
                        onChange={e => {
                          const selected = Array.from(e.target.selectedOptions).map(o => o.value)
                          setForm({ ...form, applicable_product_ids: selected.length > 0 ? selected.join(',') : '_pending' })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm h-32"
                      >
                        {products.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>)}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Ctrl+klik untuk pilih beberapa produk.</p>
                    </>
                  )}
                </div>
              )}
              {(form.promo_type === 'percent') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Persentase (%)</label><input type="number" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} min="0" max="100" step="0.1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Max Potongan (Rp)</label><input type="number" value={form.max_discount} onChange={e => setForm({ ...form, max_discount: e.target.value })} placeholder="Tanpa batas" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Min. Belanja (Rp)</label><input type="number" value={form.min_purchase} onChange={e => setForm({ ...form, min_purchase: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                </div>
              )}
              {(form.promo_type === 'fixed') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Potongan (Rp)</label><input type="number" value={form.discount_amount} onChange={e => setForm({ ...form, discount_amount: e.target.value })} min="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Min. Belanja (Rp)</label><input type="number" value={form.min_purchase} onChange={e => setForm({ ...form, min_purchase: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                </div>
              )}
              {(form.promo_type === 'buy_x_get_y') && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-600">Beli produk A → Gratis produk B</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className="block text-xs text-gray-600 mb-1">Produk yang harus dibeli</label><select value={form.required_product_id} onChange={e => setForm({ ...form, required_product_id: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"><option value="">Pilih produk</option>{products.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>)}</select></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Min. qty</label><input type="number" value={form.required_qty} onChange={e => setForm({ ...form, required_qty: e.target.value })} min="1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Produk gratis</label><select value={form.reward_product_id} onChange={e => setForm({ ...form, reward_product_id: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"><option value="">Pilih produk</option>{products.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>)}</select></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Qty gratis</label><input type="number" value={form.reward_qty} onChange={e => setForm({ ...form, reward_qty: e.target.value })} min="1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  </div>
                </div>
              )}
              {(form.promo_type === 'buy_x_get_x') && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-600">Beli X qty → Gratis 1 (produk sama)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><label className="block text-xs text-gray-600 mb-1">Produk</label><select value={form.required_product_id} onChange={e => setForm({ ...form, required_product_id: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"><option value="">Pilih produk</option>{products.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>)}</select></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Min. qty beli</label><input type="number" value={form.required_qty} onChange={e => setForm({ ...form, required_qty: e.target.value })} min="2" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Qty gratis</label><input type="number" value={form.reward_qty} onChange={e => setForm({ ...form, reward_qty: e.target.value })} min="1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  </div>
                </div>
              )}

              {/* Period & Limits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Berlaku Dari</label><input type="datetime-local" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" /><p className="text-xs text-gray-400 mt-1">Kosong = langsung aktif</p></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Berlaku Sampai</label><input type="datetime-local" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" /><p className="text-xs text-gray-400 mt-1">Kosong = tanpa batas</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Batas Penggunaan Total</label><input type="number" value={form.usage_limit} onChange={e => setForm({ ...form, usage_limit: e.target.value })} placeholder="Unlimited" min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" /></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Batas Per User</label><input type="number" value={form.usage_per_user} onChange={e => setForm({ ...form, usage_per_user: e.target.value })} placeholder="1" min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" /></div>
                <div className="flex items-end gap-4 pb-2">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} className="w-4 h-4" /><span className="text-sm text-gray-700">Tampilkan di homepage</span></label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"><FiSave /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
