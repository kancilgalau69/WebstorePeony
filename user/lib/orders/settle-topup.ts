import { createClient } from '@supabase/supabase-js'
import { logError, logInfo, logWarn } from '@/lib/logging/terminal-log'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

const supabase = createClient(supabaseUrl, supabaseServerKey)

export interface TopupSettleResult {
  completed: boolean
  alreadyCompleted?: boolean
  credited?: number
}

/**
 * Settle a paid saldo topup order: mark completed (idempotent) and credit the
 * user's wallet exactly once via the atomic RPC. Safe to call from callback +
 * mutasi poller.
 */
export async function settleTopupOrder(topupId: string): Promise<TopupSettleResult> {
  const { data: topup } = await supabase
    .from('saldo_topup_orders')
    .select('id, topup_id, user_id, amount, status')
    .eq('topup_id', topupId)
    .single()

  if (!topup) {
    logWarn('TOPUP', 'Topup order not found', { topupId })
    return { completed: false }
  }

  if (String(topup.status).toLowerCase() === 'completed') {
    return { completed: true, alreadyCompleted: true }
  }

  // Claim the transition pending -> completed (only one caller wins).
  const { data: claimed, error: claimErr } = await supabase
    .from('saldo_topup_orders')
    .update({ status: 'completed', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('topup_id', topupId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (claimErr) {
    logError('TOPUP', 'Failed to claim topup', { topupId, error: claimErr.message })
    return { completed: false }
  }
  if (!claimed) {
    // someone else settled it
    return { completed: true, alreadyCompleted: true }
  }

  // Credit wallet with the topup nominal (credit the base `amount`, not the
  // unique-coded total_amount, so the user receives the amount they asked for).
  const creditAmount = Number(topup.amount || 0)
  try {
    const { data: rpc, error } = await supabase.rpc('wallet_credit_user', {
      p_user_id: topup.user_id,
      p_amount: creditAmount,
      p_type: 'topup',
      p_description: `Deposit saldo ${topupId}`,
      p_ref_id: topupId,
    })
    if (error) {
      logError('TOPUP', 'wallet_credit_user RPC error', { topupId, error: error.message })
      return { completed: true }
    }
    if (!rpc?.ok) {
      logWarn('TOPUP', 'wallet_credit_user returned not-ok', { topupId, rpc })
      return { completed: true }
    }
    logInfo('TOPUP', 'Wallet credited from topup', { topupId, creditAmount, balance: rpc.balance })
    return { completed: true, credited: creditAmount }
  } catch (e: any) {
    logError('TOPUP', 'wallet credit exception', { topupId, error: e?.message })
    return { completed: true }
  }
}

/** Find a pending topup whose unique total_amount matches the paid nominal. */
export async function findPendingTopupByAmount(amount: number): Promise<string | null> {
  const { data } = await supabase
    .from('saldo_topup_orders')
    .select('topup_id, total_amount, status, created_at')
    .eq('status', 'pending')
    .eq('total_amount', amount)
    .order('created_at', { ascending: true })
    .limit(1)
  return data?.[0]?.topup_id || null
}
