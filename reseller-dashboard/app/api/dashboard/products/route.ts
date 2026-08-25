export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getSessionReseller, getResellerId, supabaseAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionReseller(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resellerId = await getResellerId(session)
    if (!resellerId) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 })
    }

    // Get all active products from admin
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, kode, nama, kategori, harga_web, harga_bot, stok, ikon, aktif, deskripsi')
      .eq('aktif', true)
      .order('nama', { ascending: true })

    if (error) {
      console.error('Products query error:', error)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    // Get reseller's product visibility settings
    const { data: resellerProducts } = await supabaseAdmin
      .from('reseller_products')
      .select('product_id, is_visible')
      .eq('reseller_id', resellerId)

    const visibilityMap = new Map(
      (resellerProducts || []).map(rp => [rp.product_id, rp.is_visible])
    )

    // Merge: default to visible if no record exists
    // Only explicit false means hidden; null/undefined/true = visible (consistent with storefront)
    const mergedProducts = (products || []).map(p => ({
      ...p,
      is_visible: visibilityMap.has(p.id) ? visibilityMap.get(p.id) !== false : true,
    }))

    return NextResponse.json({ products: mergedProducts })
  } catch (err: any) {
    console.error('Products error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionReseller(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { product_id, product_ids, is_visible } = body

    const ids: string[] = product_ids ? product_ids : product_id ? [product_id] : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No product IDs provided' }, { status: 400 })
    }

    const resellerId = await getResellerId(session)
    if (!resellerId) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 })
    }
    const targetVisible = is_visible === true || is_visible === 'true'
    const errors: string[] = []

    for (const pid of ids) {
      // Delete existing record first, then insert fresh
      // This avoids all upsert/update issues with null values
      await supabaseAdmin
        .from('reseller_products')
        .delete()
        .eq('reseller_id', resellerId)
        .eq('product_id', pid)

      // Insert fresh record with explicit boolean
      const { error: insertErr } = await supabaseAdmin
        .from('reseller_products')
        .insert({
          reseller_id: resellerId,
          product_id: pid,
          is_visible: targetVisible,
        })

      if (insertErr) {
        console.error('Insert visibility error:', pid, insertErr)
        errors.push(`${pid}: ${insertErr.message}`)
      }
    }

    // Verify
    const { data: verifyData } = await supabaseAdmin
      .from('reseller_products')
      .select('product_id, is_visible')
      .eq('reseller_id', resellerId)
      .in('product_id', ids)

    return NextResponse.json({
      success: errors.length === 0,
      reseller_id: resellerId,
      requested_visible: targetVisible,
      verified: (verifyData || []).map(v => ({ id: v.product_id, visible: v.is_visible })),
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('Products PUT error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
