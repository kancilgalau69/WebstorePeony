import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-md">
      <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-card">
        <div className="w-20 h-20 rounded-2xl bg-primary-50 mx-auto flex items-center justify-center mb-4">
          <i className="fa-solid fa-newspaper text-primary-400 text-3xl"></i>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Artikel Tidak Ditemukan</h1>
        <p className="text-gray-500 text-sm mb-6">Halaman yang Anda cari mungkin sudah dihapus atau dipindahkan.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
        >
          <i className="fa-solid fa-arrow-left text-xs"></i>
          Kembali ke Blog
        </Link>
      </div>
    </div>
  )
}
