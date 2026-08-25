'use client'

import { useEffect, useState } from 'react'
import { FiSend, FiPlus, FiClock, FiTrash2, FiEdit2, FiX, FiImage, FiEye } from 'react-icons/fi'
import TelegramMessageEditor from '@/components/TelegramMessageEditor'

type Broadcast = {
  id: string
  title: string
  message: string
  parse_mode: string
  image_url: string | null
  status: string
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  total_recipients: number
  sent_count: number
  failed_count: number
  created_by: string
  created_at: string
}

type Toast = { type: 'success' | 'error'; message: string }

const emptyForm = {
  id: '',
  title: '',
  message: '',
  parse_mode: 'HTML',
  image_url: '',
  scheduled_at: '',
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-blue-100 text-blue-700',
    sending: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    draft: 'Draft',
    scheduled: 'Terjadwal',
    sending: 'Mengirim...',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  )
}

export default function BroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10_000) // refresh every 10s to see sending progress
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function fetchData() {
    try {
      const res = await fetch('/api/broadcast', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) {
        setBroadcasts(json.broadcasts || [])
        setTotalUsers(json.totalUsers || 0)
      }
    } catch (err) {
      console.error('Fetch broadcasts error:', err)
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(b: Broadcast) {
    setForm({
      id: b.id,
      title: b.title,
      message: b.message,
      parse_mode: b.parse_mode,
      image_url: b.image_url || '',
      scheduled_at: b.scheduled_at ? b.scheduled_at.slice(0, 16) : '',
    })
    setShowForm(true)
  }

  async function handleSave(sendNow: boolean) {
    setSaving(true)
    try {
      const isEdit = !!form.id
      const payload: any = {
        title: form.title,
        message: form.message,
        parse_mode: form.parse_mode,
        image_url: form.image_url || null,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      }

      if (sendNow) {
        payload.send_now = true
        payload.scheduled_at = null
      }

      if (isEdit) payload.id = form.id

      const res = await fetch('/api/broadcast', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (json.success) {
        setToast({
          type: 'success',
          message: sendNow ? 'Broadcast sedang dikirim...' : (form.scheduled_at ? 'Broadcast dijadwalkan' : 'Broadcast disimpan sebagai draft'),
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
    if (!confirm(`Hapus broadcast "${title}"?`)) return
    try {
      const res = await fetch(`/api/broadcast?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setToast({ type: 'success', message: 'Broadcast dihapus' })
        fetchData()
      } else {
        setToast({ type: 'error', message: json.error || 'Gagal hapus' })
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal hapus' })
    }
  }

  async function handleCancel(id: string) {
    try {
      const res = await fetch('/api/broadcast', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'cancelled' }),
      })
      const json = await res.json()
      if (json.success) {
        setToast({ type: 'success', message: 'Broadcast dibatalkan' })
        fetchData()
      }
    } catch {}
  }

  async function handleSendNow(id: string) {
    if (!confirm('Kirim broadcast ini sekarang?')) return
    try {
      // Trigger via bot webhook
      const res = await fetch('/api/broadcast', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, scheduled_at: null }),
      })
      if (res.ok) {
        // Now trigger the bot
        await fetch('/api/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'trigger',
            message: 'trigger',
            send_now: true,
          }),
        }).catch(() => {})

        // Actually, better to use the existing broadcast. Let's trigger via a dedicated endpoint.
        const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:3000'
        await fetch(`${botUrl}/webhook/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-refresh-key': process.env.WEBHOOK_SECRET || 'supersecret-bot',
          },
          body: JSON.stringify({ broadcast_id: id }),
        }).catch(() => {})

        setToast({ type: 'success', message: 'Broadcast sedang dikirim...' })
        fetchData()
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal trigger' })
    }
  }

  const formatDateTime = (s: string | null) => {
    if (!s) return '—'
    return new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const stats = {
    total: broadcasts.length,
    completed: broadcasts.filter(b => b.status === 'completed').length,
    scheduled: broadcasts.filter(b => b.status === 'scheduled').length,
    sending: broadcasts.filter(b => b.status === 'sending').length,
  }

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Broadcast</h1>
          <p className="text-sm text-gray-500 mt-1">Kirim pesan ke {totalUsers} user Telegram</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <FiPlus /> Broadcast Baru
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Broadcast</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Selesai</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Terjadwal</p>
          <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Sedang Kirim</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.sending}</p>
        </div>
      </div>

      {/* Broadcast List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {broadcasts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FiSend className="mx-auto text-4xl text-gray-300 mb-3" />
            <p>Belum ada broadcast. Klik "Broadcast Baru" untuk mulai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Judul</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-900">Status</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-900">Terkirim</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-900">Gagal</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Jadwal</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-900">Dibuat</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-900">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {broadcasts.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-gray-900 truncate max-w-[200px]">{b.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        {b.image_url && <span className="text-blue-500"><FiImage size={12} /></span>}
                        <span className="font-mono">{b.parse_mode}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3 text-center font-semibold text-emerald-600">{b.sent_count}/{b.total_recipients}</td>
                    <td className="px-5 py-3 text-center font-semibold text-red-500">{b.failed_count}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{b.scheduled_at ? formatDateTime(b.scheduled_at) : '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{formatDateTime(b.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {(b.status === 'draft' || b.status === 'scheduled') && (
                          <>
                            <button onClick={() => handleSendNow(b.id)} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700" title="Kirim Sekarang">
                              <FiSend size={12} />
                            </button>
                            <button onClick={() => openEdit(b)} className="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100" title="Edit">
                              <FiEdit2 size={12} />
                            </button>
                            <button onClick={() => handleDelete(b.id, b.title)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100" title="Hapus">
                              <FiTrash2 size={12} />
                            </button>
                          </>
                        )}
                        {b.status === 'scheduled' && (
                          <button onClick={() => handleCancel(b.id)} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100" title="Batalkan">
                            <FiX size={12} />
                          </button>
                        )}
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
              <h3 className="text-lg font-bold text-gray-900">{form.id ? 'Edit Broadcast' : 'Broadcast Baru'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500">
                <FiX className="mx-auto" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Judul (internal) *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Contoh: Promo Akhir Tahun"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <TelegramMessageEditor
                value={form.message}
                onChange={message => setForm({ ...form, message, parse_mode: 'HTML' })}
                placeholder={`🎉 <b>Promo Spesial!</b>\n\nDiskon 50% untuk semua produk streaming.\n\n<i>Berlaku sampai 31 Desember 2026</i>\n\n<a href="https://store.com">Belanja Sekarang →</a>`}
                label="Pesan *"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Format</label>
                  <input
                    value="HTML (Telegram compatible)"
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    <FiClock className="inline mr-1" size={14} />
                    Jadwal Kirim (opsional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Kosongkan untuk kirim manual / langsung</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  <FiImage className="inline mr-1" size={14} />
                  URL Gambar (opsional)
                </label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={e => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://... (gambar publik)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Jika diisi, pesan dikirim sebagai foto dengan caption</p>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 flex gap-2 items-start">
                <FiEye className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Tips:</p>
                  <p>• Pesan akan dikirim persis seperti yang Anda tulis (termasuk format HTML)</p>
                  <p>• Akan dikirim ke <b>{totalUsers}</b> user Telegram yang terdaftar</p>
                  <p>• Jika ada jadwal, bot akan otomatis kirim pada waktu tersebut</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100 flex-wrap">
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || !form.title.trim() || !form.message.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  <FiSend size={14} /> {saving ? 'Mengirim...' : 'Kirim Sekarang'}
                </button>
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || !form.title.trim() || !form.message.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {form.scheduled_at ? <><FiClock size={14} /> Jadwalkan</> : 'Simpan Draft'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
