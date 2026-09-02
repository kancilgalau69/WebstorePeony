'use client'

import { useEffect, useState, useCallback } from 'react'
import { FiPlus, FiTrash2, FiCopy, FiKey, FiCheckCircle, FiClock, FiRefreshCw, FiUsers } from 'react-icons/fi'

type Token = {
  id: string
  token: string
  status: 'unused' | 'used'
  note: string | null
  used_by_email: string | null
  used_at: string | null
  created_at: string
  max_uses?: number
  used_count?: number
  remaining_uses?: number
}

type Stats = { total: number; unused: number; used: number; slotsLeft?: number }
type Toast = { type: 'success' | 'error'; message: string }

export default function RegistrationTokensPage() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, unused: 0, used: 0, slotsLeft: 0 })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [count, setCount] = useState('1')
  const [maxUses, setMaxUses] = useState('1')
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('all')

  const showToast = (t: Toast) => {
    setToast(t)
    setTimeout(() => setToast(null), 2500)
  }

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/registration-tokens', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat token')
      setTokens(data.tokens || [])
      setStats(data.stats || { total: 0, unused: 0, used: 0, slotsLeft: 0 })
    } catch (err: any) {
      showToast({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/registration-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: parseInt(count, 10) || 1, note, maxUses: parseInt(maxUses, 10) || 1 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal generate token')
      const perToken = parseInt(maxUses, 10) || 1
      showToast({
        type: 'success',
        message: `${data.tokens?.length || 0} token berhasil dibuat${perToken > 1 ? ` (masing-masing untuk ${perToken} user)` : ''}`,
      })
      setNote('')
      setCount('1')
      setMaxUses('1')
      fetchTokens()
    } catch (err: any) {
      showToast({ type: 'error', message: err.message })
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus token ini? Token yang sudah dihapus tidak bisa dipakai untuk daftar.')) return
    try {
      const res = await fetch('/api/registration-tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus')
      showToast({ type: 'success', message: 'Token dihapus' })
      fetchTokens()
    } catch (err: any) {
      showToast({ type: 'error', message: err.message })
    }
  }

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      showToast({ type: 'success', message: `Token ${token} disalin` })
    } catch {
      showToast({ type: 'error', message: 'Gagal menyalin' })
    }
  }

  const filtered = tokens.filter((t) => filter === 'all' || t.status === filter)

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiKey className="text-indigo-600" /> Token Pendaftaran
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Buat token untuk diberikan ke calon pembeli. Token wajib diisi saat mendaftar akun.
          </p>
        </div>
        <button
          onClick={fetchTokens}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2"
        >
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow p-4 border-t-4 border-indigo-500">
          <p className="text-xs text-gray-500 font-medium">Total Token</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-t-4 border-green-500">
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1"><FiClock /> Masih Aktif</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.unused}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-t-4 border-purple-500">
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1"><FiUsers /> Sisa Kuota User</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.slotsLeft ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-t-4 border-gray-400">
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1"><FiCheckCircle /> Habis Dipakai</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.used}</p>
        </div>
      </div>

      {/* Generator */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FiPlus /> Generate Token Baru
        </h2>
        <div className="grid md:grid-cols-[110px_150px_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jumlah Token</label>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dipakai Berapa User?</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              title="Berapa user yang bisa memakai satu token ini"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Catatan (opsional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="mis. untuk pembeli Budi / batch promo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 justify-center"
          >
            <FiPlus /> {generating ? 'Membuat...' : 'Generate'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Isi <span className="font-semibold">1</span> agar token hanya bisa dipakai satu user (default). Isi lebih dari 1
          untuk token yang bisa dipakai beberapa user, mis. <span className="font-semibold">10</span> untuk satu token yang
          dibagikan ke 10 orang.
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'unused', 'used'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
              filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {f === 'all' ? 'Semua' : f === 'unused' ? 'Masih Aktif' : 'Habis Dipakai'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Memuat token...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Belum ada token.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Token</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Pemakaian</th>
                  <th className="text-left px-4 py-3 font-semibold">Catatan</th>
                  <th className="text-left px-4 py-3 font-semibold">Dipakai Oleh</th>
                  <th className="text-left px-4 py-3 font-semibold">Dibuat</th>
                  <th className="text-right px-4 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => {
                  const maxUses = Number(t.max_uses ?? 1) || 1
                  const usedCount = Number(t.used_count ?? (t.status === 'used' ? 1 : 0)) || 0
                  const remaining = Math.max(0, maxUses - usedCount)
                  return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-gray-900">{t.token}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        t.status === 'unused' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {t.status === 'unused' ? 'Masih aktif' : 'Habis dipakai'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">{usedCount}</span>
                      <span className="text-gray-400"> / {maxUses} user</span>
                      {remaining > 0 && (
                        <span className="ml-2 text-[11px] font-semibold text-indigo-600">sisa {remaining}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.note || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{t.used_by_email || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(t.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => copyToken(t.token)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Salin token"
                        >
                          <FiCopy />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Hapus token"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
