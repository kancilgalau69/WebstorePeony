'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Announcement = {
  id: string
  title: string
  body: string | null
  image_url: string | null
  button_label: string | null
  button_url: string | null
  category: 'info' | 'warning' | 'error'
  show_frequency: 'once_per_session' | 'once_per_day' | 'always'
  sort_order: number
  valid_from: string | null
  valid_until: string | null
  created_at: string
}

export default function AnnouncementPopup() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false) // For smooth transition

  useEffect(() => {
    fetchActiveAnnouncements()
  }, [])

  async function fetchActiveAnnouncements() {
    try {
      const { data: rawData, error } = await supabase
        .from('web_announcements' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching announcements:', error)
        return
      }

      const data = rawData as Announcement[] | null

      if (data && data.length > 0) {
        const currentDate = new Date()
        const todayStr = currentDate.toISOString().split('T')[0] // YYYY-MM-DD

        // Filter valid period & check if unread
        const unread = data.filter((a) => {
          // 1. Period check
          if (a.valid_from && new Date(a.valid_from) > currentDate) return false
          if (a.valid_until && new Date(a.valid_until) < currentDate) return false

          // 2. Frequency / read state check
          if (a.show_frequency === 'once_per_session') {
            const hasReadSession = sessionStorage.getItem(`pbs_announcement_${a.id}_read`)
            if (hasReadSession === 'true') return false
          } else if (a.show_frequency === 'once_per_day') {
            const lastReadDay = localStorage.getItem(`pbs_announcement_${a.id}_last_read`)
            if (lastReadDay === todayStr) return false
          }
          return true
        })

        if (unread.length > 0) {
          setAnnouncements(unread)
          setIsOpen(true)
          // Small delay for fade-in animation
          setTimeout(() => setIsVisible(true), 50)
        }
      }
    } catch (err) {
      console.error('Failed to load announcements:', err)
    }
  }

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      setIsOpen(false)

      // Mark all displayed announcements as read
      const todayStr = new Date().toISOString().split('T')[0]
      announcements.forEach((a) => {
        if (a.show_frequency === 'once_per_session') {
          sessionStorage.setItem(`pbs_announcement_${a.id}_read`, 'true')
        } else if (a.show_frequency === 'once_per_day') {
          localStorage.setItem(`pbs_announcement_${a.id}_last_read`, todayStr)
        }
      })
    }, 200) // Delay to match transition duration
  };

  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case 'error':
        return {
          label: 'GANGGUAN',
          badgeClass: 'bg-[#C81E3A] text-white',
        }
      case 'warning':
        return {
          label: 'PENTING',
          badgeClass: 'bg-[#DB8291] text-white',
        }
      default:
        return {
          label: 'INFO',
          badgeClass: 'bg-[#720002] text-white',
        }
    }
  }

  const formatAnnouncementDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - date.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

      if (diffDays <= 1 && date.getDate() === now.getDate()) {
        return `Hari Ini - ${timeStr}`
      } else if (diffDays <= 2 && date.getDate() === new Date(now.setDate(now.getDate() - 1)).getDate()) {
        return `Kemarin - ${timeStr}`
      } else {
        return `${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${timeStr}`
      }
    } catch {
      return 'Baru Saja'
    }
  }

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? 'opacity-100 visible' : 'opacity-0 invisible'
      }`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#720002]/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Modal Box */}
      <div
        className={`relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border-2 border-[#F4D6DC] flex flex-col transition-all duration-300 max-h-[85vh] md:max-h-[80vh] ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F4D6DC] bg-[#FBEEF1] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl strawberry-gradient text-white flex items-center justify-center text-base shadow-sm">
              <i className="fa-solid fa-bullhorn text-sm"></i>
            </span>
            <h2 className="font-fredoka text-[#720002] text-base md:text-lg">Informasi Terbaru</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F4D6DC] text-[#9E6B72] hover:text-[#720002] transition-colors flex items-center justify-center"
            aria-label="Tutup"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-2 scroll-container">
          <div className="divide-y divide-[#F4D6DC]">
            {announcements.map((a) => {
              const catDetails = getCategoryDetails(a.category)
              return (
                <div key={a.id} className="py-5 first:pt-4 last:pb-4 flex flex-col gap-2">
                  {/* Category & Date */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase inline-flex items-center ${catDetails.badgeClass}`}
                    >
                      {catDetails.label}
                    </span>
                    <span className="text-[10px] text-[#9E6B72] font-semibold">
                      {formatAnnouncementDate(a.created_at)}
                    </span>
                  </div>

                  {/* Title */}
                  {a.title && (
                    <h3 className="font-fredoka text-[#720002] text-base leading-snug">{a.title}</h3>
                  )}

                  {/* Body Text */}
                  {a.body && (
                    <div className="text-xs md:text-sm text-[#8A3A44] leading-relaxed whitespace-pre-wrap">
                      {a.body}
                    </div>
                  )}

                  {/* Image */}
                  {a.image_url && (
                    <div className="mt-2 rounded-2xl overflow-hidden shadow-sm max-h-64 border border-[#F4D6DC] bg-[#FBEEF1] flex justify-center items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.image_url}
                        alt={a.title}
                        className="w-full h-full object-contain max-h-64"
                      />
                    </div>
                  )}

                  {/* Individual CTA Link */}
                  {a.button_label && a.button_url && (
                    <div className="mt-2.5">
                      <a
                        href={a.button_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full strawberry-gradient text-white font-bold text-xs shadow-sm hover:-translate-y-0.5 transition-transform"
                      >
                        {a.button_label}
                        <i className="fa-solid fa-chevron-right text-[9px]"></i>
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#F4D6DC] bg-[#FBEEF1] flex justify-end flex-shrink-0">
          <button
            onClick={handleClose}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 strawberry-gradient text-white font-extrabold text-xs md:text-sm rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <i className="fa-solid fa-thumbs-up text-xs md:text-sm"></i>
            Sudah membaca
          </button>
        </div>
      </div>
    </div>
  )
}
