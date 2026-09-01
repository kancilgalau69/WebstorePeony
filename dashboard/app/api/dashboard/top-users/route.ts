import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as createSupabaseAuthClient } from '@supabase/ssr'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type DbError = { message?: string }
type RowsResult<T> = { data: T[] | null; error: DbError | null }

type OrderRow = {
  user_web_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  total_amount: number | string | null
  status: string | null
  created_at: string | null
}

type UserWebRow = {
  id: string
  nama: string | null
  email: string | null
  phone: string | null
}

type TopUser = {
  userId: string | null
  nama: string
  email: string
  phone: string
  txCount: number
  revenue: number
  registered: boolean
}

const PAID_STATUSES = new Set(['paid', 'completed', 'settlement', 'capture', 'success'])

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

function createAuthClient(request: NextRequest) {
  return createSupabaseAuthClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as DbError).message || 'Unknown error')
  return 'Unknown error'
}

async function fetchAllRows<T>(buildQuery: (from: number, to: number) => PromiseLike<RowsResult<T>>) {
  const pageSize = 1000
  let from = 0
  let rows: T[] = []

  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) throw new Error(getErrorMessage(error))
    const pageRows = data || []
    rows = rows.concat(pageRows)
    if (pageRows.length < pageSize) break
    from += pageSize
  }

  return rows
}

function isPaidOrder(order: { status: string | null }) {
  return PAID_STATUSES.has(String(order.status || '').toLowerCase())
}

function amount(value: number | string | null | undefined) {
  return Number(value || 0) || 0
}

// Date key in Asia/Jakarta timezone -> 'YYYY-MM-DD'. Use .slice(0,7) for 'YYYY-MM'.
function jakartaDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value || '0000'
  const month = parts.find(part => part.type === 'month')?.value || '00'
  const day = parts.find(part => part.type === 'day')?.value || '00'
  return `${year}-${month}-${day}`
}

export async function GET(request: NextRequest) {
  try {
    // Admin-only: verify the logged-in dashboard user.
    const authClient = createAuthClient(request)
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return jsonNoStore({ error: 'Unauthorized' }, 401)
    }

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'day').toLowerCase() === 'month' ? 'month' : 'day'

    // Determine the period key to filter by (defaults to "today"/"this month" in Jakarta).
    const todayKey = jakartaDateKey(new Date())
    let periodKey: string
    if (period === 'month') {
      const monthParam = (searchParams.get('month') || '').trim() // 'YYYY-MM'
      periodKey = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : todayKey.slice(0, 7)
    } else {
      const dateParam = (searchParams.get('date') || '').trim() // 'YYYY-MM-DD'
      periodKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayKey
    }

    const supabase = createServerClient()

    // Pull all orders (paginated) and registered web users to resolve names.
    const [orders, webUsers] = await Promise.all([
      fetchAllRows<OrderRow>((from, to) => supabase
        .from('orders')
        .select('user_web_id, customer_name, customer_email, customer_phone, total_amount, status, created_at')
        .range(from, to) as unknown as PromiseLike<RowsResult<OrderRow>>),
      fetchAllRows<UserWebRow>((from, to) => supabase
        .from('user_web')
        .select('id, nama, email, phone')
        .range(from, to) as unknown as PromiseLike<RowsResult<UserWebRow>>),
    ])

    const userById = new Map<string, UserWebRow>()
    const userByEmail = new Map<string, UserWebRow>()
    for (const u of webUsers) {
      if (u.id) userById.set(u.id, u)
      if (u.email) userByEmail.set(String(u.email).toLowerCase(), u)
    }

    // Aggregate paid orders in the selected period, grouped per user.
    const agg = new Map<string, TopUser>()

    for (const order of orders) {
      if (!isPaidOrder(order)) continue
      if (!order.created_at) continue

      const key = jakartaDateKey(order.created_at)
      const matches = period === 'month' ? key.slice(0, 7) === periodKey : key === periodKey
      if (!matches) continue

      // Resolve the user: prefer user_web_id, fall back to matching email to a registered user.
      let resolvedUser: UserWebRow | null = null
      let groupKey: string
      let registered = false

      if (order.user_web_id && userById.has(order.user_web_id)) {
        resolvedUser = userById.get(order.user_web_id)!
        groupKey = `id:${order.user_web_id}`
        registered = true
      } else if (order.user_web_id) {
        // Has a user_web_id but the user row is missing (deleted); group by that id.
        groupKey = `id:${order.user_web_id}`
        registered = true
      } else {
        const email = String(order.customer_email || '').toLowerCase()
        const matchedByEmail = email ? userByEmail.get(email) : undefined
        if (matchedByEmail) {
          resolvedUser = matchedByEmail
          groupKey = `id:${matchedByEmail.id}`
          registered = true
        } else {
          // Guest order: group by email or phone so guests are still counted.
          groupKey = email ? `email:${email}` : `phone:${String(order.customer_phone || 'unknown')}`
          registered = false
        }
      }

      const existing = agg.get(groupKey)
      if (existing) {
        existing.txCount += 1
        existing.revenue += amount(order.total_amount)
      } else {
        agg.set(groupKey, {
          userId: resolvedUser?.id || (order.user_web_id || null),
          nama: resolvedUser?.nama || order.customer_name || (order.customer_email || order.customer_phone || 'Guest'),
          email: resolvedUser?.email || order.customer_email || '-',
          phone: resolvedUser?.phone || order.customer_phone || '-',
          txCount: 1,
          revenue: amount(order.total_amount),
          registered,
        })
      }
    }

    const topUsers = Array.from(agg.values())
      .sort((a, b) => b.txCount - a.txCount || b.revenue - a.revenue)
      .slice(0, 10)

    const totalTx = topUsers.reduce((sum, u) => sum + u.txCount, 0)
    const totalRevenue = topUsers.reduce((sum, u) => sum + u.revenue, 0)

    return jsonNoStore({
      period,
      periodKey,
      topUsers,
      totals: { totalTx, totalRevenue, uniqueUsers: agg.size },
    })
  } catch (error) {
    return jsonNoStore({ error: getErrorMessage(error) }, 500)
  }
}
