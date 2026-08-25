'use client'

import { useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  label?: string
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildPreview(html: string) {
  const escaped = escapeHtml(html)
  return escaped
    .replace(/&lt;(b|strong)&gt;([\s\S]*?)&lt;\/(b|strong)&gt;/g, '<strong>$2</strong>')
    .replace(/&lt;(i|em)&gt;([\s\S]*?)&lt;\/(i|em)&gt;/g, '<em>$2</em>')
    .replace(/&lt;(u|ins)&gt;([\s\S]*?)&lt;\/(u|ins)&gt;/g, '<u>$2</u>')
    .replace(/&lt;(s|strike|del)&gt;([\s\S]*?)&lt;\/(s|strike|del)&gt;/g, '<s>$2</s>')
    .replace(/&lt;code&gt;([\s\S]*?)&lt;\/code&gt;/g, '<code class="px-1 py-0.5 bg-gray-100 rounded text-rose-700">$1</code>')
    .replace(/&lt;pre&gt;([\s\S]*?)&lt;\/pre&gt;/g, '<pre class="p-3 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-xs">$1</pre>')
    .replace(/&lt;a href=&quot;([^&]+)&quot;&gt;([\s\S]*?)&lt;\/a&gt;/g, '<a class="text-indigo-600 underline" href="$1" target="_blank" rel="noreferrer">$2</a>')
    .replace(/\n/g, '<br />')
}

export default function TelegramMessageEditor({ value, onChange, rows = 8, placeholder, label = 'Pesan *' }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [preview, setPreview] = useState(false)

  function wrap(open: string, close: string, fallback: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || fallback
    const next = value.slice(0, start) + open + selected + close + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + open.length, start + open.length + selected.length)
    })
  }

  function addLink() {
    const url = window.prompt('Masukkan URL link:', 'https://')
    if (!url) return
    wrap(`<a href="${url}">`, '</a>', 'teks link')
  }

  const tools = [
    { label: 'B', title: 'Bold', open: '<b>', close: '</b>', fallback: 'teks tebal', className: 'font-black' },
    { label: 'I', title: 'Italic', open: '<i>', close: '</i>', fallback: 'teks miring', className: 'italic' },
    { label: 'U', title: 'Underline', open: '<u>', close: '</u>', fallback: 'teks underline', className: 'underline' },
    { label: 'S', title: 'Strikethrough', open: '<s>', close: '</s>', fallback: 'teks coret', className: 'line-through' },
    { label: '<>', title: 'Inline code', open: '<code>', close: '</code>', fallback: 'kode', className: 'font-mono' },
    { label: 'PRE', title: 'Code block', open: '<pre>', close: '</pre>', fallback: 'blok kode', className: 'font-mono text-[11px]' },
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
        <button type="button" onClick={() => setPreview(!preview)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          {preview ? 'Edit Pesan' : 'Preview'}
        </button>
      </div>

      <div className="border border-gray-300 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
        <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
          {tools.map(tool => (
            <button key={tool.title} type="button" title={tool.title} onClick={() => wrap(tool.open, tool.close, tool.fallback)} className={`px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-xs text-gray-900 ${tool.className}`}>
              {tool.label}
            </button>
          ))}
          <button type="button" onClick={addLink} className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-xs font-semibold text-gray-900">
            Link
          </button>
        </div>

        {preview ? (
          <div className="min-h-40 p-3 text-sm text-gray-950 leading-relaxed bg-white" dangerouslySetInnerHTML={{ __html: buildPreview(value || '<i>Preview kosong</i>') }} />
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            required
            rows={rows}
            className="w-full px-3 py-2 outline-none font-mono text-sm resize-y text-gray-950"
            placeholder={placeholder}
          />
        )}
      </div>

      <div className="text-xs text-gray-600 leading-relaxed">
        Format Telegram HTML: <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;u&gt;</code>, <code>&lt;s&gt;</code>, <code>&lt;a href=&quot;url&quot;&gt;</code>, <code>&lt;code&gt;</code>, <code>&lt;pre&gt;</code>.
      </div>
    </div>
  )
}
