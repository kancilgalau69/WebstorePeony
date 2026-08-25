export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    if (!q) {
      return NextResponse.json({ orders: [] })
    }

    const supabase = getSupabaseAdmin()

    // Get reseller
    const { data: reseller } = await supabase
      .from('resellers')
      .select('id')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .single()

    if (!reseller) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Search orders
    const { data: orders, error } = await supabase
      .from('reseller_orders')
      .select('order_id, customer_name, customer_email, customer_phone, total_amount, status, items, created_at')
      .eq('reseller_id', reseller.id)
      .or(`order_id.ilike.%${q}%,customer_email.ilike.%${q}%,customer_phone.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Order search error:', error)
      return NextResponse.json({ orders: [] })
    }

    return NextResponse.json({ orders: orders || [] })
  } catch (err: any) {
    console.error('Order search error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
