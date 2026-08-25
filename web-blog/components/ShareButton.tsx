'use client'

import { useState } from 'react'

interface ShareButtonProps {
  title: string
  slug: string
  excerpt?: string | null
  variant?: 'inline' | 'floating'
}

export default function ShareButton({ title, slug, excerpt, variant = 'inline' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (typeof window === 'undefined') return

    const url = `${window.location.origin}/${slug}`
    const text = excerpt || title

    // Try Web Share API first (works on mobile + supported desktop browsers)
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url })
        return
      } catch (err: any) {
        // User cancelled the share — don't fallback to copy
        if (err?.name === 'AbortError') return
        // Other errors → fallback to copy
      }
    }

    // Fallback: copy to clipboard + visual feedback
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Last resort: show prompt
      window.prompt('Salin link ini:', url)
    }
  }

  if (variant === 'floating') {
    return (
      <button
        onClick={handleShare}
        type="button"
        aria-label={copied ? 'Link disalin' : 'Bagikan artikel'}
        title={copied ? 'Link disalin' : 'Bagikan artikel'}
        className={`inline-flex items-center justify-center w-11 h-11 rounded-full border transition-all shadow-sm ${
          copied
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'bg-white border-gray-200 text-gray-600 hover:text-primary-600 hover:border-primary-300 hover:shadow-md'
        }`}
      >
        <i className={`fa-solid ${copied ? 'fa-check' : 'fa-share-nodes'}`}></i>
      </button>
    )
  }

  return (
    <button
      onClick={handleShare}
      type="button"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
        copied
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-primary-50 border-primary-100 text-primary-600 hover:bg-primary-100'
      }`}
    >
      <i className={`fa-solid ${copied ? 'fa-check' : 'fa-share-nodes'}`}></i>
      <span>{copied ? 'Link Disalin' : 'Bagikan'}</span>
    </button>
  )
}
