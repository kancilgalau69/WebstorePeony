import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

const supabase = createClient(supabaseUrl, supabaseServerKey)

// GET - current user's wallet balance + recent transactions
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', requireAuth: true }, { status: 401 })
    }

    // Ensure wallet row exists, then read balance
    let balance = 0
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('saldo')
      .eq('user_id', session.userId)
      .maybeSingle()

    if (wallet) {
      balance = Number(wallet.saldo || 0)
    } else {
      // create on first access
      await supabase.from('user_wallets').insert({ user_id: session.userId, saldo: 0 })
    }

    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('id, type, amount, balance_after, description, status, created_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(30)

    return NextResponse.json({
      success: true,
      balance,
      transactions: transactions || [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load wallet' }, { status: 500 })
  }
}
