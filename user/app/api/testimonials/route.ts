import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'
import { sendTelegramToAdmins } from '@/lib/telegram-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function jsonNoStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !key) throw new Error('Missing Supabase server configuration')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const POSITIVE_TITLES = new Set(['LOVE', 'mantap', 'good', 'keren banget', 'satset', 'recommended'])

export async function GET() {
  try {
    const supabase = getServerSupabase()
    const { data, error } = await supabase
      .from('web_testimonials')
      .select('id, name, title, body, rating, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) return jsonNoStore({ error: error.message }, 500)
    return jsonNoStore({ testimonials: data || [] })
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : 'Failed to fetch testimonials' }, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser(request)
    if (!session) return jsonNoStore({ error: 'Anda harus login untuk mengirim testimoni.', requireAuth: true }, 401)

    const body = await request.json()
    const testimonial = String(body.testimonial || '').trim()
    const title = String(body.title || '').trim()
    const rating = Math.min(5, Math.max(1, Number(body.rating) || 5))

    if (testimonial.length < 5) return jsonNoStore({ error: 'Testimoni minimal 5 karakter.' }, 400)
    if (testimonial.length > 500) return jsonNoStore({ error: 'Testimoni maksimal 500 karakter.' }, 400)
    if (!POSITIVE_TITLES.has(title)) return jsonNoStore({ error: 'Pilihan kata testimoni tidak valid.' }, 400)

    const supabase = getServerSupabase()
    const { data, error } = await supabase
      .from('web_testimonials')
      .insert({
        user_web_id: session.userId,
        name: session.nama,
        title,
        body: testimonial,
        rating,
        is_active: false,
      })
      .select('id, name, title, body, rating, created_at')
      .single()

    if (error) return jsonNoStore({ error: error.message }, 500)
    try {
      await sendTelegramToAdmins([
        '🌸 TESTIMONI BARU MASUK',
        '',
        `Nama: ${session.nama}`,
        `Email: ${session.email}`,
        `Phone: ${session.phone}`,
        `Kesan: ${title}`,
        `Rating: ${'★'.repeat(rating)} (${rating}/5)`,
        '',
        'Isi Testimoni:',
        testimonial,
        '',
        'Status: menunggu admin aktifkan',
        `Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
      ].join('\n'), 'TESTIMONIAL:new')
    } catch (notifyError: any) {
      console.warn('Failed sending testimonial Telegram notification', notifyError?.message || notifyError)
    }
    return jsonNoStore({ success: true, data, message: 'Testimoni berhasil dikirim dan menunggu persetujuan admin.' }, 201)
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : 'Failed to submit testimonial' }, 500)
  }
}
