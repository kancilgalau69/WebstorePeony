'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiCheck, FiTrash2, FiToggleLeft, FiToggleRight, FiStar } from 'react-icons/fi'

type Testimonial = {
  id: string
  name: string
  title: string
  body: string
  rating: number
  is_active: boolean
  created_at: string
}

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')

  const fetchTestimonials = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/testimonials', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Gagal memuat testimoni')
      setTestimonials(json.testimonials || [])
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Gagal memuat testimoni')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTestimonials() }, [])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  const toggleActive = async (item: Testimonial) => {
    const response = await fetch('/api/testimonials', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
    })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      notify(json.error || 'Gagal mengubah status')
      return
    }
    setTestimonials(prev => prev.map(t => t.id === item.id ? { ...t, is_active: !item.is_active } : t))
    notify(item.is_active ? 'Testimoni dinonaktifkan' : 'Testimoni diaktifkan')
  }

  const deleteTestimonial = async (item: Testimonial) => {
    if (!window.confirm(`Hapus testimoni dari ${item.name}?`)) return
    const response = await fetch(`/api/testimonials?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      notify(json.error || 'Gagal menghapus testimoni')
      return
    }
    setTestimonials(prev => prev.filter(t => t.id !== item.id))
    notify('Testimoni dihapus')
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return testimonials
    return testimonials.filter(t => `${t.name} ${t.title} ${t.body}`.toLowerCase().includes(query))
  }, [testimonials, search])

  const activeCount = testimonials.filter(t => t.is_active).length
  const pendingCount = testimonials.filter(t => !t.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2"><FiStar className="text-amber-500" /> Testimoni</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola ulasan yang tampil di web store.</p>
        </div>
        <button onClick={fetchTestimonials} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Refresh</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-600"><p className="text-xs text-gray-500">Total Testimoni</p><p className="text-2xl font-bold text-gray-900 mt-1">{testimonials.length}</p></div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500"><p className="text-xs text-gray-500">Aktif di Web</p><p className="text-2xl font-bold text-gray-900 mt-1">{activeCount}</p></div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500"><p className="text-xs text-gray-500">Menunggu Review</p><p className="text-2xl font-bold text-gray-900 mt-1">{pendingCount}</p></div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau isi testimoni..." className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="py-12 text-center text-gray-500">Memuat testimoni...</div> : filtered.length === 0 ? <div className="py-12 text-center text-gray-500">Belum ada testimoni.</div> : (
          <div className="divide-y divide-gray-200">
            {filtered.map(item => (
              <div key={item.id} className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="w-10 h-10 shrink-0 rounded-full bg-[#DB8291] text-white flex items-center justify-center font-bold">{item.name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-gray-900">{item.name}</h3><span className="text-xs text-gray-500">Reseller</span><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.is_active ? 'Aktif' : 'Nonaktif'}</span></div>
                  <div className="flex items-center gap-2 mt-1"><span className="text-xs font-bold uppercase text-[#DB8291]">{item.title}</span><span className="text-amber-400 text-xs">{'★'.repeat(Math.min(5, Math.max(1, item.rating || 5)))}</span><span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString('id-ID')}</span></div>
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{item.body}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActive(item)} title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'} className="text-xl">{item.is_active ? <FiToggleRight className="text-emerald-500" /> : <FiToggleLeft className="text-gray-400" />}</button>
                  <button onClick={() => deleteTestimonial(item)} title="Hapus" className="p-2 rounded bg-red-50 text-red-600 hover:bg-red-100"><FiTrash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {toast && <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2"><FiCheck />{toast}</div>}
    </div>
  )
}
