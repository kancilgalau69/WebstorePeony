'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiDownload, FiDatabase, FiBox, FiPackage, FiUsers, FiFile, FiHardDrive } from 'react-icons/fi'

type Product = { id: string; kode: string; nama: string }

export default function BackupPage() {
  const supabase = createBrowserClient()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, kode, nama')
        .eq('aktif', true)
        .order('nama')
      setProducts(data || [])
    } catch {} finally { setLoading(false) }
  }

  async function download(type: string, format: string = 'sql', productId?: string) {
    const key = `${type}-${format}-${productId || ''}`
    setDownloading(key)
    try {
      let url = `/api/backup?type=${type}&format=${format}`
      if (productId) url += `&product_id=${productId}`

      const res = await fetch(url)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'Backup gagal')
        return
      }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] || `backup-${type}.${format}`

      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    } catch (err: any) {
      alert('Download gagal: ' + (err?.message || 'Unknown error'))
    } finally {
      setDownloading(null)
    }
  }

  const isDownloading = (key: string) => downloading === key

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Backup Database</h1>
        <p className="text-sm text-gray-500 mt-1">Download backup data dalam format SQL atau TXT</p>
      </div>

      {/* Full & Schema */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FiHardDrive className="text-indigo-600 text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Full Backup</h3>
              <p className="text-xs text-gray-500">Semua data (schema + isi semua tabel)</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            File SQL berisi INSERT statements untuk semua tabel. Bisa digunakan untuk restore data ke database baru.
          </p>
          <button
            onClick={() => download('full', 'sql')}
            disabled={!!downloading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            <FiDownload /> {isDownloading('full-sql-') ? 'Downloading...' : 'Download SQL'}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
              <FiDatabase className="text-purple-600 text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Schema Only</h3>
              <p className="text-xs text-gray-500">Struktur database tanpa data</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Referensi schema. Untuk schema lengkap, gunakan migration files di folder supabase/migrations/.
          </p>
          <button
            onClick={() => download('schema', 'sql')}
            disabled={!!downloading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition"
          >
            <FiDownload /> {isDownloading('schema-sql-') ? 'Downloading...' : 'Download SQL'}
          </button>
        </div>
      </div>

      {/* Per-table backups */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FiBox className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Produk</h3>
              <p className="text-[11px] text-gray-500">Semua data produk</p>
            </div>
          </div>
          <button
            onClick={() => download('products', 'sql')}
            disabled={!!downloading}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-50 transition"
          >
            <FiDownload size={12} /> {isDownloading('products-sql-') ? '...' : 'SQL'}
          </button>
        </div>

        {/* All Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <FiPackage className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Semua Items</h3>
              <p className="text-[11px] text-gray-500">Semua product_items</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => download('items', 'sql')}
              disabled={!!downloading}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 transition"
            >
              <FiDownload size={12} /> SQL
            </button>
            <button
              onClick={() => download('items', 'txt')}
              disabled={!!downloading}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 transition"
            >
              <FiFile size={12} /> TXT
            </button>
          </div>
        </div>

        {/* Users */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <FiUsers className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Users</h3>
              <p className="text-[11px] text-gray-500">Telegram + Web users</p>
            </div>
          </div>
          <button
            onClick={() => download('users', 'sql')}
            disabled={!!downloading}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 transition"
          >
            <FiDownload size={12} /> {isDownloading('users-sql-') ? '...' : 'SQL'}
          </button>
        </div>
      </div>

      {/* Items per Product */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center">
            <FiPackage className="text-orange-600 text-xl" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Backup Items per Produk</h3>
            <p className="text-xs text-gray-500">Download items untuk produk tertentu</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="">Pilih produk...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => selectedProduct && download('items_product', 'sql', selectedProduct)}
              disabled={!selectedProduct || !!downloading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <FiDownload size={14} /> SQL
            </button>
            <button
              onClick={() => selectedProduct && download('items_product', 'txt', selectedProduct)}
              disabled={!selectedProduct || !!downloading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <FiFile size={14} /> TXT
            </button>
          </div>
        </div>

        {selectedProduct && (
          <p className="text-xs text-gray-500 mt-3">
            <strong>SQL:</strong> INSERT statements (bisa di-restore ke database) &nbsp;|&nbsp;
            <strong>TXT:</strong> Item data saja per baris (grouped by status)
          </p>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 flex gap-3 items-start">
        <FiDatabase className="flex-shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="font-semibold mb-1">Catatan Backup</p>
          <ul className="space-y-0.5 list-disc list-inside text-blue-600">
            <li>Full backup berisi semua data dari semua tabel (bisa besar jika banyak data)</li>
            <li>File SQL menggunakan <code>ON CONFLICT DO NOTHING</code> agar aman di-restore tanpa duplikasi</li>
            <li>Format TXT hanya berisi item_data per baris (cocok untuk import ulang atau arsip)</li>
            <li>Untuk schema lengkap, gunakan migration files di <code>supabase/migrations/</code></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
