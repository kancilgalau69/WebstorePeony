export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getSessionReseller, getResellerId, supabaseAdmin } from '@/lib/auth'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

function calculatePrice(basePrice: number, marginType: string, marginValue: number): number {
  if (marginType === 'percent') return basePrice + (basePrice * marginValue / 100)
  return basePrice + marginValue
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionReseller(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resellerId = await getResellerId(session)
    if (!resellerId) return NextResponse.json({ error: 'Reseller not found' }, { status: 404 })

    // Get all active products
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, kode, nama, kategori, harga_web, harga_bot')
      .eq('aktif', true)
      .order('nama', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    // Get reseller prices directly from DB
    const { data: resellerPrices, error: priceErr } = await supabaseAdmin
      .from('reseller_prices')
      .select('product_id, margin_type, margin_value, harga_jual')
      .eq('reseller_id', resellerId)

    if (priceErr) {
      console.error('Reseller prices query error:', priceErr)
    }

    const priceMap = new Map(
      (resellerPrices || []).map(rp => [String(rp.product_id), rp])
    )

    const mergedProducts = (products || []).map(p => {
      const pid = String(p.id)
      const rp = priceMap.get(pid)
      const basePrice = Number(p.harga_web) || Number(p.harga_bot) || 0
      return {
        id: p.id,
        kode: p.kode,
        nama: p.nama,
        kategori: p.kategori,
        harga_web: basePrice,
        margin_type: rp?.margin_type || 'fixed',
        margin_value: Number(rp?.margin_value) || 0,
        harga_jual: rp?.harga_jual ? Number(rp.harga_jual) : basePrice,
      }
    })

    return NextResponse.json({ products: mergedProducts }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('Pricing GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionReseller(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resellerId = await getResellerId(session)
    if (!resellerId) return NextResponse.json({ error: 'Reseller not found' }, { status: 404 })
    const body = await request.json()

    // Bulk update
    if (body.bulk) {
      const { margin_type, margin_value } = body

      // Get all active products to calculate prices
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, harga_web, harga_bot')
        .eq('aktif', true)

      if (!products || products.length === 0) {
        return NextResponse.json({ error: 'No products found' }, { status: 404 })
      }

      // Delete all existing prices and re-insert (avoid upsert issues)
      await supabaseAdmin
        .from('reseller_prices')
        .delete()
        .eq('reseller_id', resellerId)

      const insertData = products.map(p => {
        const basePrice = Number(p.harga_web) || Number(p.harga_bot) || 0
        return {
          reseller_id: resellerId,
          product_id: p.id,
          margin_type,
          margin_value: Number(margin_value),
          harga_jual: calculatePrice(basePrice, margin_type, Number(margin_value)),
        }
      })

      const { error } = await supabaseAdmin
        .from('reseller_prices')
        .insert(insertData)

      if (error) {
        console.error('Bulk insert error:', error)
        return NextResponse.json({ error: 'Failed to update pricing' }, { status: 500 })
      }

      return NextResponse.json({ success: true, updated: products.length })
    }

    // Single product update
    const { product_id, margin_type, margin_value } = body

    if (!product_id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }

    // Get base price
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('harga_web, harga_bot')
      .eq('id', product_id)
      .single()

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const basePrice = Number(product.harga_web) || Number(product.harga_bot) || 0
    const hargaJual = calculatePrice(basePrice, margin_type, Number(margin_value))

    // Try upsert first (table has UNIQUE(reseller_id, product_id))
    const { error: upsertErr } = await supabaseAdmin
      .from('reseller_prices')
      .upsert({
        reseller_id: resellerId,
        product_id,
        margin_type,
        margin_value: Number(margin_value),
        harga_jual: hargaJual,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'reseller_id,product_id' })

    if (upsertErr) {
      console.error('Price upsert error, trying delete+insert:', upsertErr)
      // Fallback: delete then insert
      await supabaseAdmin
        .from('reseller_prices')
        .delete()
        .eq('reseller_id', resellerId)
        .eq('product_id', product_id)

      const { error: insertErr } = await supabaseAdmin
        .from('reseller_prices')
        .insert({
          reseller_id: resellerId,
          product_id,
          margin_type,
          margin_value: Number(margin_value),
          harga_jual: hargaJual,
        })

      if (insertErr) {
        console.error('Price insert error:', insertErr)
        return NextResponse.json({ error: 'Failed to update price' }, { status: 500 })
      }
    }

    // Verify save by reading back
    const { data: saved } = await supabaseAdmin
      .from('reseller_prices')
      .select('margin_type, margin_value, harga_jual')
      .eq('reseller_id', resellerId)
      .eq('product_id', product_id)
      .single()

    return NextResponse.json({
      success: true,
      harga_jual: saved?.harga_jual || hargaJual,
      margin_type: saved?.margin_type || margin_type,
      margin_value: saved?.margin_value || margin_value,
    })
  } catch (err: any) {
    console.error('Pricing PUT error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
