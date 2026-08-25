export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

// --- Stock stabilization (same logic as user web) ---
const STOCK_SWITCH_CONFIRMATION = 3
const ZERO_DROP_EXTRA_CONFIRMATION = 2
const MAX_STABLE_PRODUCTS = 500

type StableProductState = {
  stableStock: number
  stableAvailable: number
  stableTotal: number
  pendingStock: number | null
  pendingAvailable: number | null
  pendingTotal: number | null
  pendingHits: number
  lastSeenAt: number
}

const stableStockByProductId = new Map<string, StableProductState>()

function asNumber(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function sameTuple(
  a: { stock: number; available: number; total: number },
  b: { stock: number; available: number; total: number }
) {
  return a.stock === b.stock && a.available === b.available && a.total === b.total
}

function pruneStableProductMap() {
  if (stableStockByProductId.size <= MAX_STABLE_PRODUCTS) return
  let oldestKey: string | null = null
  let oldestSeenAt = Number.MAX_SAFE_INTEGER
  stableStockByProductId.forEach((state, key) => {
    if (state.lastSeenAt < oldestSeenAt) {
      oldestSeenAt = state.lastSeenAt
      oldestKey = key
    }
  })
  if (oldestKey) stableStockByProductId.delete(oldestKey)
}

function stabilizeProductStock(productId: string, candidate: { stock: number; available: number; total: number }) {
  if (!productId) return candidate
  const now = Date.now()
  const current = stableStockByProductId.get(productId)

  if (!current) {
    stableStockByProductId.set(productId, {
      stableStock: candidate.stock,
      stableAvailable: candidate.available,
      stableTotal: candidate.total,
      pendingStock: null,
      pendingAvailable: null,
      pendingTotal: null,
      pendingHits: 0,
      lastSeenAt: now,
    })
    pruneStableProductMap()
    return candidate
  }

  current.lastSeenAt = now
  const stableTuple = {
    stock: current.stableStock,
    available: current.stableAvailable,
    total: current.stableTotal,
  }

  if (sameTuple(candidate, stableTuple)) {
    current.pendingStock = null
    current.pendingAvailable = null
    current.pendingTotal = null
    current.pendingHits = 0
    return candidate
  }

  // Bias against false-zero flicker: move up immediately
  if (candidate.stock > stableTuple.stock) {
    current.stableStock = candidate.stock
    current.stableAvailable = candidate.available
    current.stableTotal = candidate.total
    current.pendingStock = null
    current.pendingAvailable = null
    current.pendingTotal = null
    current.pendingHits = 0
    return candidate
  }

  const isSuspiciousDropToZero = stableTuple.stock > 0 && candidate.stock === 0 && candidate.total > 0
  const requiredHits = isSuspiciousDropToZero
    ? STOCK_SWITCH_CONFIRMATION + ZERO_DROP_EXTRA_CONFIRMATION
    : STOCK_SWITCH_CONFIRMATION

  const pendingTuple =
    current.pendingStock === null || current.pendingAvailable === null || current.pendingTotal === null
      ? null
      : { stock: current.pendingStock, available: current.pendingAvailable, total: current.pendingTotal }

  if (pendingTuple && sameTuple(candidate, pendingTuple)) {
    current.pendingHits += 1
  } else {
    current.pendingStock = candidate.stock
    current.pendingAvailable = candidate.available
    current.pendingTotal = candidate.total
    current.pendingHits = 1
  }

  if (current.pendingHits >= requiredHits) {
    current.stableStock = candidate.stock
    current.stableAvailable = candidate.available
    current.stableTotal = candidate.total
    current.pendingStock = null
    current.pendingAvailable = null
    current.pendingTotal = null
    current.pendingHits = 0
    return candidate
  }

  return stableTuple
}
// --- End stock stabilization ---

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = getSupabaseAdmin()

    // Get reseller by slug
    const { data: reseller } = await supabase
      .from('resellers')
      .select('id')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .single()

    if (!reseller) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: NO_CACHE_HEADERS })
    }

    // Get all active products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, kode, nama, kategori, harga_web, harga_bot, harga_lama, stok, ikon, deskripsi, aktif')
      .eq('aktif', true)
      .order('kategori')
      .order('nama')

    if (prodError) {
      console.error('Products query error:', prodError)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500, headers: NO_CACHE_HEADERS })
    }

    // Get inventory summary for accurate stock (same as user web)
    const productIds = (products || []).map(p => p.id).filter(Boolean)
    const inventoryMap = new Map<string, { available: number; total: number }>()

    if (productIds.length > 0) {
      const { data: inventoryRows } = await supabase
        .from('product_inventory_summary')
        .select('product_id, available_items, total_items')
        .in('product_id', productIds)

      ;(inventoryRows || []).forEach((row: any) => {
        const key = String(row.product_id || '').trim()
        if (!key) return
        inventoryMap.set(key, {
          available: Number(row.available_items || 0),
          total: Number(row.total_items || 0),
        })
      })
    }

    // Get reseller product visibility
    const { data: resellerProducts, error: visError } = await supabase
      .from('reseller_products')
      .select('product_id, is_visible')
      .eq('reseller_id', reseller.id)

    if (visError) {
      console.error('Visibility query error:', visError, 'reseller_id:', reseller.id)
    }

    const visibilityMap = new Map(
      (resellerProducts || []).map(rp => [String(rp.product_id).trim(), rp.is_visible])
    )

    // Get reseller prices
    const { data: resellerPrices } = await supabase
      .from('reseller_prices')
      .select('product_id, harga_jual')
      .eq('reseller_id', reseller.id)

    const priceMap = new Map(
      (resellerPrices || []).map(rp => [rp.product_id, Number(rp.harga_jual)])
    )

    // Filter visible products and apply reseller prices
    const visibleProducts = (products || [])
      .filter(p => {
        const pid = String(p.id).trim()
        // If reseller has a visibility record, use it. Otherwise default to visible.
        // Treat null/undefined as visible (only explicit false hides)
        if (!visibilityMap.has(pid)) return true
        const val = visibilityMap.get(pid)
        return val !== false
      })
      .map(p => {
        const basePrice = Number(p.harga_web) || Number(p.harga_bot) || 0
        const resellerPrice = priceMap.get(p.id)

        // Use inventory summary for stock (consistent with user web)
        const inv = inventoryMap.get(String(p.id))
        const availableItems = inv?.available || 0
        const totalItems = inv?.total || 0
        const candidateStock = totalItems > 0 ? availableItems : asNumber(p.stok)

        const stable = stabilizeProductStock(String(p.id), {
          stock: candidateStock,
          available: availableItems,
          total: totalItems,
        })

        // Calculate harga_lama: if reseller has custom price, use base price as "old price"
        const hargaJual = resellerPrice || basePrice
        let hargaLama: number | null = p.harga_lama ? Number(p.harga_lama) : null
        // If reseller set a higher price than harga_lama, harga_lama becomes misleading - clear it
        if (hargaLama !== null && hargaJual >= hargaLama) {
          hargaLama = null
        }

        return {
          id: p.id,
          kode: p.kode,
          nama: p.nama,
          kategori: p.kategori,
          harga_jual: hargaJual,
          harga_lama: hargaLama,
          stok: stable.stock,
          ikon: p.ikon,
          deskripsi: p.deskripsi,
        }
      })

    return NextResponse.json({ products: visibleProducts }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('Store products error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}
