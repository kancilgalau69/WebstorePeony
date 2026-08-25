'use client'

import { useEffect, useState } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiSearch, FiToggleLeft, FiToggleRight, FiBell } from 'react-icons/fi'

type Announcement = {
  id: string
  title: string
  body: string | null
  image_url: string | null
  button_label: string | null
  button_url: string | null
  category: 'info' | 'warning' | 'error'
  show_frequency: 'once_per_session' | 'once_per_day' | 'always'
  is_active: boolean
  sort_order: number
  valid_from: string | null
  valid_until: string | null
  created_at: string
}

type Toast = { type: 'success' | 'error'; message: string }

const CATEGORIES = [
  { value: 'info', label: 'Info (Biru)' },
  { value: 'warning', label: 'Warning (Kuning)' },
  { value: 'error', label: 'Error (Merah)' },
]

const FREQUENCIES = [
  { value: 'once_per_session', label: 'Sekali per Sesi Browser (sessionStorage)' },
  { value: 'once_per_day', label: 'Sekali per Hari Kalender (localStorage)' },
  { value: 'always', label: 'Selalu Tampil (Setiap Reload)' },
]

const emptyForm = {
  id: '',
  title: '',
  body: '',
  image_url: '',
  button_label: '',
  button_url: '',
  category: 'info',
  show_frequency: 'once_per_session',
  is_active: true,
  sort_order: '0',
  valid_from: '',
  valid_until: '',
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function fetchData() {
    try {
      const res = await fetch('/api/announcements', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) {
        setAnnouncements(json.announcements || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(a: Announcement) {
    setForm({
      id: a.id,
      title: a.title,
      body: a.body || '',
      image_url: a.image_url || '',
      button_label: a.button_label || '',
      button_url: a.button_url || '',
      category: a.category,
      show_frequency: a.show_frequency,
      is_active: a.is_active,
      sort_order: String(a.sort_order || 0),
      valid_from: a.valid_from ? a.valid_from.slice(0, 16) : '',
      valid_until: a.valid_until ? a.valid_until.slice(0, 16) : '',
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const isEdit = !!form.id
      const payload: any = {
        ...form,
        body: form.body || null,
        image_url: form.image_url || null,
        button_label: form.button_label || null,
        button_url: form.button_url || null,
        sort_order: Number(form.sort_order) || 0,
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      }

      const res = await fetch('/api/announcements', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (json.success) {
        setToast({
          type: 'success',
          message: isEdit ? 'Pengumuman diperbarui' : 'Pengumuman dibuat',
        })
        setShowForm(false)
        fetchData()
      } else {
        setToast({ type: 'error', message: json.error || 'Gagal menyimpan' })
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal menyimpan' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Hapus pengumuman "${title}"?`)) return
    const res = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      setToast({ type: 'success', message: 'Pengumuman dihapus' })
      fetchData()
    } else {
      setToast({ type: 'error', message: json.error || 'Gagal menghapus' })
    }
  }

  async function toggleActive(a: Announcement) {
    const res = await fetch('/api/announcements', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, is_active: !a.is_active }),
    })
    const json = await res.json()
    if (json.success) fetchData()
  }

  const formatDate = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'

  const filtered = announcements.filter((a) => {
    const q = search.toLowerCase()
    return a.title.toLowerCase().includes(q) || (a.body || '').toLowerCase().includes(q)
  })

  const categoryBadge = (cat: string) => {
    switch (cat) {
      case 'error':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Error</span>
      case 'warning':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Warning</span>
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Info</span>
    }
  }

  const frequencyLabel = (freq: string) => {
    return FREQUENCIES.find((x) => x.value === freq)?.label || freq
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    )

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Announcement Popup</h1>
          <p className="text-sm text-gray-500 mt-1">{announcements.length} pengumuman terdaftar</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <FiPlus /> Pengumuman Baru
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Pengumuman</p>
          <p className="text-2xl font-bold text-gray-900">{announcements.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Aktif</p>
          <p className="text-2xl font-bold text-emerald-600">
            {announcements.filter((a) => a.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Kategori Berbeda</p>
          <p className="text-2xl font-bold text-blue-600">
            {new Set(announcements.map((a) => a.category)).size}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <FiSearch className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Cari judul atau isi pengumuman..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {announcements.length === 0
              ? 'Belum ada pengumuman. Klik "Pengumuman Baru" untuk membuat.'
              : 'Tidak ada pengumuman yang cocok.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Urutan</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Kategori</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Judul</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Frekuensi</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Masa Berlaku</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-900">Aktif</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-900">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-medium text-gray-900">{a.sort_order}</td>
                    <td className="px-5 py-3">{categoryBadge(a.category)}</td>
                    <td className="px-5 py-3 font-medium text-gray-900 max-w-[250px] truncate" title={a.title}>
                      {a.title}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600">{frequencyLabel(a.show_frequency)}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {formatDate(a.valid_from)} — {formatDate(a.valid_until)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => toggleActive(a)} className="text-lg">
                        {a.is_active ? (
                          <FiToggleRight className="text-emerald-500" />
                        ) : (
                          <FiToggleLeft className="text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(a)}
                          className="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
                        >
                          <FiEdit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(a.id, a.title)}
                          className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                        >
                          <FiTrash2 size={12} />
                        </button>
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
              <h3 className="text-lg font-bold text-gray-900">
                {form.id ? 'Edit Pengumuman' : 'Pengumuman Baru'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <FiX className="mx-auto" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Judul *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    placeholder="e.g., Pemeliharaan Sistem / Layanan Baru"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Kategori *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Isi Pengumuman</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={4}
                  placeholder="Isi pesan informasi detail..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">URL Gambar (opsional)</label>
                  <input
                    type="text"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Frekuensi Tampilan</label>
                  <select
                    value={form.show_frequency}
                    onChange={(e) => setForm({ ...form, show_frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Label Tombol CTA (opsional)</label>
                  <input
                    type="text"
                    value={form.button_label}
                    onChange={(e) => setForm({ ...form, button_label: e.target.value })}
                    placeholder="e.g., Lihat Promo / Info Lebih Lanjut"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">URL Tombol CTA (opsional)</label>
                  <input
                    type="text"
                    value={form.button_url}
                    onChange={(e) => setForm({ ...form, button_url: e.target.value })}
                    placeholder="https://example.com/promo"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Urutan Sortir</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Semakin kecil, tampil di urutan atas.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Berlaku Dari</label>
                  <input
                    type="datetime-local"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Berlaku Sampai</label>
                  <input
                    type="datetime-local"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 py-2 border-t border-gray-100 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">Aktifkan Pengumuman Ini</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  <FiSave /> {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
