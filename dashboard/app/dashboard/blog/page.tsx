'use client'

import { useEffect, useRef, useState } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiSearch, FiX, FiSave, FiFolder, FiBold, FiItalic, FiLink, FiImage, FiList, FiCode } from 'react-icons/fi'

type Post = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  featured_image: string | null
  category_id: string | null
  author_name: string
  status: string
  published_at: string | null
  view_count: number
  meta_title: string | null
  meta_description: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  blog_categories?: { id: string; name: string; slug: string } | null
}

type Category = {
  id: string
  slug: string
  name: string
  description: string | null
}

type Toast = { type: 'success' | 'error'; message: string }

const emptyForm = {
  id: '',
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  featured_image: '',
  category_id: '',
  author_name: 'Admin',
  status: 'draft',
  meta_title: '',
  meta_description: '',
  tags: '',
}

function renderMarkdownPreview(value: string) {
  const escapeHtml = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const inline = (text: string) => escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-gray-100 text-pink-700">$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" class="my-3 max-h-64 rounded-lg border object-cover" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-indigo-600 underline" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')

  return value
    .split('\n')
    .map(line => {
      if (line.startsWith('### ')) return `<h3 class="text-lg font-bold mt-4 mb-2">${inline(line.slice(4))}</h3>`
      if (line.startsWith('## ')) return `<h2 class="text-xl font-bold mt-5 mb-2">${inline(line.slice(3))}</h2>`
      if (line.startsWith('# ')) return `<h1 class="text-2xl font-black mt-5 mb-3">${inline(line.slice(2))}</h1>`
      if (line.startsWith('> ')) return `<blockquote class="border-l-4 border-indigo-300 pl-3 my-2 text-gray-600 italic">${inline(line.slice(2))}</blockquote>`
      if (line.startsWith('- ')) return `<div class="flex gap-2 my-1"><span>•</span><span>${inline(line.slice(2))}</span></div>`
      if (!line.trim()) return '<br />'
      return `<p class="my-2 leading-relaxed">${inline(line)}</p>`
    })
    .join('')
}

function MarkdownWysiwygEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [mode, setMode] = useState<'write' | 'preview'>('write')

  function insertMarkdown(before: string, after = '', placeholder = 'teks') {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  function insertLine(prefix: string, placeholder = 'Tulis konten') {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const needsNewline = start > 0 && value[start - 1] !== '\n'
    const insertion = `${needsNewline ? '\n' : ''}${prefix}${placeholder}`
    const next = value.slice(0, start) + insertion + value.slice(textarea.selectionEnd)
    onChange(next)
    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + insertion.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const toolClass = 'h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-lg text-xs font-bold text-gray-700 hover:bg-white hover:text-indigo-700 border border-transparent hover:border-gray-200'

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => insertMarkdown('**', '**', 'teks tebal')} title="Bold" className={toolClass}><FiBold size={15} /></button>
          <button type="button" onClick={() => insertMarkdown('*', '*', 'teks miring')} title="Italic" className={toolClass}><FiItalic size={15} /></button>
          <button type="button" onClick={() => insertLine('## ', 'Sub Judul')} title="Heading" className={toolClass}>H2</button>
          <button type="button" onClick={() => insertLine('- ', 'Poin list')} title="List" className={toolClass}><FiList size={15} /></button>
          <button type="button" onClick={() => insertLine('> ', 'Kutipan')} title="Quote" className={toolClass}>“”</button>
          <button type="button" onClick={() => insertMarkdown('[', '](https://example.com)', 'teks link')} title="Link" className={toolClass}><FiLink size={15} /></button>
          <button type="button" onClick={() => insertMarkdown('![', '](https://example.com/image.jpg)', 'alt image')} title="Image" className={toolClass}><FiImage size={15} /></button>
          <button type="button" onClick={() => insertMarkdown('`', '`', 'kode')} title="Code" className={toolClass}><FiCode size={15} /></button>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-bold">
          <button type="button" onClick={() => setMode('write')} className={`px-3 py-1.5 rounded-md ${mode === 'write' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>Tulis</button>
          <button type="button" onClick={() => setMode('preview')} className={`px-3 py-1.5 rounded-md ${mode === 'preview' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>Preview</button>
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          rows={16}
          className="w-full px-4 py-3 focus:outline-none font-mono text-sm resize-y min-h-[360px]"
          placeholder={`# Judul Section\n\nIsi paragraf...\n\n## Sub Heading\n\n- Poin 1\n- Poin 2\n\n[Link](https://example.com)`}
        />
      ) : (
        <div
          className="min-h-[360px] px-5 py-4 text-sm text-gray-800 bg-white prose-preview"
          dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(value || 'Preview kosong') }}
        />
      )}
    </div>
  )
}

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'posts' | 'categories'>('posts')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all')
  const [toast, setToast] = useState<Toast | null>(null)

  // Post form
  const [showPostForm, setShowPostForm] = useState(false)
  const [postForm, setPostForm] = useState(emptyForm)
  const [savingPost, setSavingPost] = useState(false)

  // Category form
  const [showCatForm, setShowCatForm] = useState(false)
  const [catForm, setCatForm] = useState({ id: '', name: '', slug: '', description: '' })
  const [savingCat, setSavingCat] = useState(false)

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
      const res = await fetch('/api/blog', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) {
        setPosts(json.posts || [])
        setCategories(json.categories || [])
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  function openNewPost() {
    setPostForm(emptyForm)
    setShowPostForm(true)
  }

  function openEditPost(p: Post) {
    setPostForm({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt || '',
      content: p.content || '',
      featured_image: p.featured_image || '',
      category_id: p.category_id || '',
      author_name: p.author_name || 'Admin',
      status: p.status,
      meta_title: p.meta_title || '',
      meta_description: p.meta_description || '',
      tags: (p.tags || []).join(', '),
    })
    setShowPostForm(true)
  }

  async function savePost(e: React.FormEvent) {
    e.preventDefault()
    setSavingPost(true)
    try {
      const tagsArr = postForm.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      const payload: any = {
        title: postForm.title,
        slug: postForm.slug || undefined,
        excerpt: postForm.excerpt || null,
        content: postForm.content,
        featured_image: postForm.featured_image || null,
        category_id: postForm.category_id || null,
        author_name: postForm.author_name || 'Admin',
        status: postForm.status,
        meta_title: postForm.meta_title || null,
        meta_description: postForm.meta_description || null,
        tags: tagsArr,
      }

      const isEdit = !!postForm.id
      const res = await fetch('/api/blog', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: postForm.id, ...payload } : payload),
      })
      const json = await res.json()
      if (json.success) {
        setToast({ type: 'success', message: isEdit ? 'Post berhasil diperbarui' : 'Post berhasil dibuat' })
        setShowPostForm(false)
        fetchData()
      } else {
        setToast({ type: 'error', message: json.error || 'Gagal menyimpan' })
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal menyimpan' })
    } finally {
      setSavingPost(false)
    }
  }

  async function deletePost(id: string, title: string) {
    if (!confirm(`Hapus post "${title}"?`)) return
    try {
      const res = await fetch(`/api/blog?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setToast({ type: 'success', message: 'Post dihapus' })
        fetchData()
      } else {
        setToast({ type: 'error', message: json.error || 'Gagal hapus' })
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal hapus' })
    }
  }

  function openNewCategory() {
    setCatForm({ id: '', name: '', slug: '', description: '' })
    setShowCatForm(true)
  }

  function openEditCategory(c: Category) {
    setCatForm({ id: c.id, name: c.name, slug: c.slug, description: c.description || '' })
    setShowCatForm(true)
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault()
    setSavingCat(true)
    try {
      const isEdit = !!catForm.id
      const res = await fetch('/api/blog/categories', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? catForm : { name: catForm.name, slug: catForm.slug, description: catForm.description }),
      })
      const json = await res.json()
      if (json.success) {
        setToast({ type: 'success', message: isEdit ? 'Kategori diperbarui' : 'Kategori dibuat' })
        setShowCatForm(false)
        fetchData()
      } else {
        setToast({ type: 'error', message: json.error || 'Gagal' })
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal' })
    } finally {
      setSavingCat(false)
    }
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`Hapus kategori "${name}"? Post yang masuk kategori ini akan kehilangan kategori (tidak dihapus).`)) return
    try {
      const res = await fetch(`/api/blog/categories?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setToast({ type: 'success', message: 'Kategori dihapus' })
        fetchData()
      } else {
        setToast({ type: 'error', message: json.error || 'Gagal hapus' })
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal hapus' })
    }
  }

  const blogPublicUrl = process.env.NEXT_PUBLIC_BLOG_URL || 'http://localhost:3005'

  const filteredPosts = posts.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    draft: posts.filter(p => p.status === 'draft').length,
    views: posts.reduce((s, p) => s + (p.view_count || 0), 0),
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

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Blog & Artikel</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola konten blog publik</p>
        </div>
        {tab === 'posts' && (
          <button
            onClick={openNewPost}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            <FiPlus /> Post Baru
          </button>
        )}
        {tab === 'categories' && (
          <button
            onClick={openNewCategory}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            <FiPlus /> Kategori Baru
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Post</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Published</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.published}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Draft</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.draft}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Views</p>
          <p className="text-2xl font-bold text-blue-600">{stats.views}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {[
            { key: 'posts', label: 'Posts', icon: FiEdit2 },
            { key: 'categories', label: 'Kategori', icon: FiFolder },
          ].map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  tab === t.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      {tab === 'posts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Cari judul atau slug..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                {posts.length === 0 ? 'Belum ada post. Klik "Post Baru" untuk membuat artikel pertama.' : 'Tidak ada yang cocok.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold text-gray-900">Judul</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-900">Kategori</th>
                      <th className="text-center px-5 py-3 font-semibold text-gray-900">Status</th>
                      <th className="text-center px-5 py-3 font-semibold text-gray-900">Views</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-900">Update</th>
                      <th className="text-center px-5 py-3 font-semibold text-gray-900">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredPosts.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-gray-900">{p.title}</div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">/{p.slug}</div>
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {p.blog_categories?.name || <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            p.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {p.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-gray-600">{p.view_count}</td>
                        <td className="px-5 py-3 text-xs text-gray-500">{new Date(p.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {p.status === 'published' && (
                              <a
                                href={`${blogPublicUrl}/${p.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                title="Lihat"
                              >
                                <FiEye />
                              </a>
                            )}
                            <button
                              onClick={() => openEditPost(p)}
                              className="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
                              title="Edit"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              onClick={() => deletePost(p.id, p.title)}
                              className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                              title="Hapus"
                            >
                              <FiTrash2 />
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
        </div>
      )}

      {tab === 'categories' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {categories.length === 0 ? (
            <div className="text-center py-16 text-gray-500">Belum ada kategori.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-900">Nama</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-900">Slug</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-900">Deskripsi</th>
                    <th className="text-center px-5 py-3 font-semibold text-gray-900">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {categories.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-semibold text-gray-900">{c.name}</td>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{c.slug}</td>
                      <td className="px-5 py-3 text-gray-600 truncate max-w-xs">{c.description || '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditCategory(c)} className="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100">
                            <FiEdit2 />
                          </button>
                          <button onClick={() => deleteCategory(c.id, c.name)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">
                            <FiTrash2 />
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
      )}

      {/* Post Form Modal */}
      {showPostForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl my-8 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{postForm.id ? 'Edit Post' : 'Post Baru'}</h3>
              <button onClick={() => setShowPostForm(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500">
                <FiX className="mx-auto" />
              </button>
            </div>
            <form onSubmit={savePost} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Judul *</label>
                <input
                  type="text"
                  value={postForm.title}
                  onChange={e => setPostForm({ ...postForm, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Slug</label>
                  <input
                    type="text"
                    value={postForm.slug}
                    onChange={e => setPostForm({ ...postForm, slug: e.target.value })}
                    placeholder="auto-generate dari judul"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Kategori</label>
                  <select
                    value={postForm.category_id}
                    onChange={e => setPostForm({ ...postForm, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Tanpa Kategori</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Excerpt (ringkasan singkat)</label>
                <textarea
                  value={postForm.excerpt}
                  onChange={e => setPostForm({ ...postForm, excerpt: e.target.value })}
                  rows={2}
                  placeholder="Ringkasan singkat untuk preview di list blog..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Featured Image URL</label>
                <input
                  type="url"
                  value={postForm.featured_image}
                  onChange={e => setPostForm({ ...postForm, featured_image: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Konten Artikel *
                  <span className="text-xs text-gray-400 font-normal ml-2">Gunakan toolbar untuk styling. Konten tetap disimpan sebagai Markdown.</span>
                </label>
                <MarkdownWysiwygEditor
                  value={postForm.content}
                  onChange={content => setPostForm({ ...postForm, content })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    value={postForm.status}
                    onChange={e => setPostForm({ ...postForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Author</label>
                  <input
                    type="text"
                    value={postForm.author_name}
                    onChange={e => setPostForm({ ...postForm, author_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tags (pisah koma)</label>
                  <input
                    type="text"
                    value={postForm.tags}
                    onChange={e => setPostForm({ ...postForm, tags: e.target.value })}
                    placeholder="netflix, premium, tips"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              <details className="bg-gray-50 rounded-lg p-3">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700">SEO (opsional)</summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Meta Title</label>
                    <input
                      type="text"
                      value={postForm.meta_title}
                      onChange={e => setPostForm({ ...postForm, meta_title: e.target.value })}
                      placeholder="Default: judul post"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Meta Description</label>
                    <textarea
                      value={postForm.meta_description}
                      onChange={e => setPostForm({ ...postForm, meta_description: e.target.value })}
                      rows={2}
                      placeholder="Default: excerpt"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>
              </details>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={savingPost}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  <FiSave /> {savingPost ? 'Menyimpan...' : (postForm.id ? 'Update' : 'Simpan')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPostForm(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{catForm.id ? 'Edit Kategori' : 'Kategori Baru'}</h3>
              <button onClick={() => setShowCatForm(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500">
                <FiX className="mx-auto" />
              </button>
            </div>
            <form onSubmit={saveCategory} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama *</label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={catForm.slug}
                  onChange={e => setCatForm({ ...catForm, slug: e.target.value })}
                  placeholder="auto-generate dari nama"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Deskripsi</label>
                <textarea
                  value={catForm.description}
                  onChange={e => setCatForm({ ...catForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={savingCat}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {savingCat ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCatForm(false)}
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
