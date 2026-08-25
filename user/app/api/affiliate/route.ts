export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, supabaseAdmin } from '@/lib/auth'
import crypto from 'crypto'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

/**
 * Generate a short random affiliate code (8 chars, A-Z 0-9)
 */
function generateAffiliateCode(): string {
  // 5 bytes -> 8 base32-ish chars, uppercase for readability
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
  let code = ''
  const bytes = crypto.randomBytes(8)
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}

async function getOrCreateAffiliate(userWebId: string) {
  // Try find existing
  const { data: existing } = await supabaseAdmin
    .from('user_web_affiliates')
    .select('*')
    .eq('user_web_id', userWebId)
    .single()

  if (existing) return existing

  // Create new with unique code (retry up to 5 times)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAffiliateCode()
    const { data, error } = await supabaseAdmin
      .from('user_web_affiliates')
      .insert({
        user_web_id: userWebId,
        affiliate_code: code,
      })
      .select()
      .single()

    if (!error && data) return data

    // If it's a duplicate (23505), retry with a new code
    if (error && (error as any).code !== '23505') {
      console.error('Create affiliate error:', error)
      return null
    }
  }
  return null
}

/**
 * GET /api/affiliate — returns current user's affiliate profile + stats
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS })
    }

    // Check enabled
    const { data: enabledSetting } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'affiliate_enabled')
      .single()

    const enabled = String(enabledSetting?.value || 'true').toLowerCase() === 'true'

    // Get settings (commission % + min withdraw)
    const { data: settingsRows } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', ['affiliate_commission_percent', 'affiliate_min_withdraw'])

    const settingsMap = new Map((settingsRows || []).map(r => [r.key, r.value]))
    const commissionPercent = Number(settingsMap.get('affiliate_commission_percent') || 5)
    const minWithdraw = Number(settingsMap.get('affiliate_min_withdraw') || 50000)

    const affiliate = await getOrCreateAffiliate(session.userId)
    if (!affiliate) {
      return NextResponse.json({ error: 'Failed to load affiliate profile' }, { status: 500, headers: NO_CACHE_HEADERS })
    }

    // Recent earnings
    const { data: earnings } = await supabaseAdmin
      .from('affiliate_earnings')
      .select('id, order_code, order_amount, commission_percent, commission_amount, status, created_at')
      .eq('affiliate_id', affiliate.id)
      .order('created_at', { ascending: false })
      .limit(30)

    // Withdrawals
    const { data: withdrawals } = await supabaseAdmin
      .from('affiliate_withdrawals')
      .select('*')
      .eq('affiliate_id', affiliate.id)
      .order('created_at', { ascending: false })
      .limit(30)

    // Pending withdrawals total (for available balance calc)
    const pendingAmount = (withdrawals || [])
      .filter(w => w.status === 'pending' || w.status === 'approved')
      .reduce((sum, w) => sum + Number(w.amount || 0), 0)

    const availableSaldo = Math.max(0, Number(affiliate.saldo || 0) - pendingAmount)

    return NextResponse.json({
      enabled,
      affiliate: {
        id: affiliate.id,
        affiliate_code: affiliate.affiliate_code,
        saldo: Number(affiliate.saldo || 0),
        available_saldo: availableSaldo,
        pending_withdrawal: pendingAmount,
        total_earnings: Number(affiliate.total_earnings || 0),
        total_withdrawn: Number(affiliate.total_withdrawn || 0),
        total_orders: affiliate.total_orders || 0,
        total_clicks: affiliate.total_clicks || 0,
        is_active: affiliate.is_active,
      },
      settings: {
        commission_percent: commissionPercent,
        min_withdraw: minWithdraw,
      },
      earnings: earnings || [],
      withdrawals: withdrawals || [],
    }, { headers: NO_CACHE_HEADERS })
  } catch (err: any) {
    console.error('Affiliate GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}

/**
 * POST /api/affiliate — track a click (when visitor lands via ?ref=)
 * Body: { affiliate_code: string, product_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const code = String(body.affiliate_code || '').trim().toUpperCase()
    if (!code) {
      return NextResponse.json({ ok: false, error: 'Missing affiliate_code' }, { status: 400 })
    }

    const { data: affiliate } = await supabaseAdmin
      .from('user_web_affiliates')
      .select('id, is_active')
      .eq('affiliate_code', code)
      .single()

    if (!affiliate || !affiliate.is_active) {
      return NextResponse.json({ ok: false, error: 'Invalid code' }, { status: 404 })
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    // Fire-and-forget insert + counter increment
    await supabaseAdmin.from('affiliate_clicks').insert({
      affiliate_id: affiliate.id,
      affiliate_code: code,
      product_id: body.product_id || null,
      ip,
      user_agent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
    })

    // Increment total_clicks counter
    await supabaseAdmin.rpc('increment_affiliate_clicks', { p_affiliate_id: affiliate.id }).then(
      () => {},
      () => {
        // If RPC doesn't exist, do manual update
        supabaseAdmin
          .from('user_web_affiliates')
          .select('total_clicks')
          .eq('id', affiliate.id)
          .single()
          .then(({ data }) => {
            if (data) {
              supabaseAdmin
                .from('user_web_affiliates')
                .update({ total_clicks: (data.total_clicks || 0) + 1 })
                .eq('id', affiliate.id)
                .then(() => {}, () => {})
            }
          })
      }
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Affiliate click POST error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
