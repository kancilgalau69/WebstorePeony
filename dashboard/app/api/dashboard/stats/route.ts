import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as createSupabaseAuthClient } from '@supabase/ssr'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type DbError = { message?: string }
type RowsResult<T> = { data: T[] | null; error: DbError | null }

type OrderRow = {
  status: string | null
  total_amount: number | string | null
  created_at: string | null
  customer_email: string | null
  customer_phone: string | null
  payment_method: string | null
  items: unknown
}

type ResellerOrderRow = OrderRow & {
  komisi: number | string | null
}

type MarketOrderRow = OrderRow & {
  order_id: string | null
  order_source: string | null
}

type ChartData = {
  date: string
  orders: number
  revenue: number
  pbsRevenue: number
  pbsOrders: number
  webStoreRevenue: number
  webStoreOrders: number
  marketRevenue: number
  marketOrders: number
  resellerRevenue: number
  resellerOrders: number
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

function jakartaDateLabel(value: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    month: 'short',
    day: 'numeric',
  }).format(value)
}

function isMarketBotOrder(order: MarketOrderRow) {
  return String(order.order_source || '').toLowerCase() === 'seller_bot' || String(order.order_id || '').startsWith('MKT-BOT-')
}

function isWebStoreOrder(order: OrderRow) {
  const hasItems = Array.isArray(order.items) ? order.items.length > 0 : Boolean(order.items)
  return Boolean(order.customer_email || order.customer_phone || order.payment_method || hasItems)
}

function sumRevenue<T extends OrderRow>(orders: T[]) {
  return orders.reduce((sum, order) => sum + amount(order.total_amount), 0)
}

export async function GET(request: NextRequest) {
  try {
    const authClient = createAuthClient(request)
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) {
      return jsonNoStore({ error: 'Unauthorized' }, 401)
    }

    const supabase = createServerClient()

    const [{ count: productsCount, error: productsError }, { count: itemsCount, error: itemsError }, { count: usersCount, error: usersError }, { count: resellerCount, error: resellerError }, { count: sellerCount, error: sellerError }] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('product_items').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('resellers').select('*', { count: 'exact', head: true }),
      supabase.from('sellers').select('id', { count: 'exact', head: true }),
    ])

    const countError = productsError || itemsError || usersError || resellerError || sellerError
    if (countError) throw new Error(getErrorMessage(countError))

    const [orders, resellerOrders, marketOrders] = await Promise.all([
      fetchAllRows<OrderRow>((from, to) => supabase
        .from('orders')
        .select('status, total_amount, created_at, customer_email, customer_phone, payment_method, items')
        .range(from, to) as unknown as PromiseLike<RowsResult<OrderRow>>),
      fetchAllRows<ResellerOrderRow>((from, to) => supabase
        .from('reseller_orders')
        .select('status, total_amount, komisi, created_at')
        .range(from, to) as unknown as PromiseLike<RowsResult<ResellerOrderRow>>),
      fetchAllRows<MarketOrderRow>((from, to) => supabase
        .from('market_orders')
        .select('order_id, status, total_amount, order_source, created_at')
        .range(from, to) as unknown as PromiseLike<RowsResult<MarketOrderRow>>),
    ])

    const paidOrders = orders.filter(isPaidOrder)
    const paidResellerOrders = resellerOrders.filter(isPaidOrder)
    const paidMarketOrders = marketOrders.filter(isPaidOrder)

    const webStoreOrders = orders.filter(isWebStoreOrder)
    const pbsBotOrders = orders.filter(order => !isWebStoreOrder(order))
    const paidWebStoreOrders = webStoreOrders.filter(isPaidOrder)
    const paidPbsBotOrders = pbsBotOrders.filter(isPaidOrder)

    const marketStoreOrders = marketOrders.filter(order => !isMarketBotOrder(order))
    const botMarketOrders = marketOrders.filter(isMarketBotOrder)
    const paidMarketStoreOrders = marketStoreOrders.filter(isPaidOrder)
    const paidBotMarketOrders = botMarketOrders.filter(isPaidOrder)

    const pbsTotalRevenue = sumRevenue(paidPbsBotOrders)
    const webStoreRevenue = sumRevenue(paidWebStoreOrders)
    const mainStoreRevenue = pbsTotalRevenue + webStoreRevenue
    const resellerRevenue = sumRevenue(paidResellerOrders)
    const marketStoreRevenue = sumRevenue(paidMarketStoreOrders)
    const botMarketRevenue = sumRevenue(paidBotMarketOrders)
    const marketRevenue = marketStoreRevenue + botMarketRevenue
    const totalRevenue = pbsTotalRevenue + webStoreRevenue + resellerRevenue + marketRevenue

    const currentMonth = jakartaDateKey(new Date()).slice(0, 7)
    const isThisMonth = (order: OrderRow) => Boolean(order.created_at && jakartaDateKey(order.created_at).startsWith(currentMonth))
    const revenueThisMonth =
      sumRevenue(paidPbsBotOrders.filter(isThisMonth)) +
      sumRevenue(paidWebStoreOrders.filter(isThisMonth)) +
      sumRevenue(paidResellerOrders.filter(isThisMonth)) +
      sumRevenue(paidMarketOrders.filter(isThisMonth))
    const mainStoreRevenueThisMonth =
      sumRevenue(paidPbsBotOrders.filter(isThisMonth)) +
      sumRevenue(paidWebStoreOrders.filter(isThisMonth))
    const resellerRevenueThisMonth = sumRevenue(paidResellerOrders.filter(isThisMonth))
    const marketRevenueThisMonth = sumRevenue(paidMarketOrders.filter(isThisMonth))

    const totalPaidOrdersCount = paidOrders.length + paidResellerOrders.length + paidMarketOrders.length
    const avgOrderValue = totalPaidOrdersCount > 0 ? totalRevenue / totalPaidOrdersCount : 0

    const chartData: ChartData[] = []
    const days = 7
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateKey = jakartaDateKey(date)

      const dayPbsOrders = paidPbsBotOrders.filter(order => order.created_at && jakartaDateKey(order.created_at) === dateKey)
      const dayWebStoreOrders = paidWebStoreOrders.filter(order => order.created_at && jakartaDateKey(order.created_at) === dateKey)
      const dayMarketOrders = paidMarketOrders.filter(order => order.created_at && jakartaDateKey(order.created_at) === dateKey)
      const dayResellerOrders = paidResellerOrders.filter(order => order.created_at && jakartaDateKey(order.created_at) === dateKey)

      const dayPbsRevenue = sumRevenue(dayPbsOrders)
      const dayWebStoreRevenue = sumRevenue(dayWebStoreOrders)
      const dayMarketRevenue = sumRevenue(dayMarketOrders)
      const dayResellerRevenue = sumRevenue(dayResellerOrders)

      chartData.push({
        date: jakartaDateLabel(date),
        orders: dayPbsOrders.length + dayWebStoreOrders.length + dayMarketOrders.length + dayResellerOrders.length,
        revenue: dayPbsRevenue + dayWebStoreRevenue + dayMarketRevenue + dayResellerRevenue,
        pbsRevenue: dayPbsRevenue,
        pbsOrders: dayPbsOrders.length,
        webStoreRevenue: dayWebStoreRevenue,
        webStoreOrders: dayWebStoreOrders.length,
        marketRevenue: dayMarketRevenue,
        marketOrders: dayMarketOrders.length,
        resellerRevenue: dayResellerRevenue,
        resellerOrders: dayResellerOrders.length,
      })
    }

    return jsonNoStore({
      stats: {
        totalProducts: productsCount || 0,
        totalItems: itemsCount || 0,
        totalOrders: orders.length + resellerOrders.length + marketOrders.length,
        totalUsers: usersCount || 0,
        revenueThisMonth,
        totalRevenue,
        avgOrderValue: Math.round(avgOrderValue),
        webStoreOrdersCount: orders.length,
        webStoreRevenue: mainStoreRevenue,
        webStoreRevenueThisMonth: mainStoreRevenueThisMonth,
        resellerCount: resellerCount || 0,
        resellerOrdersCount: resellerOrders.length,
        resellerRevenue,
        resellerRevenueThisMonth,
        sellerCount: sellerCount || 0,
        marketOrdersCount: marketOrders.length,
        marketRevenue,
        marketRevenueThisMonth,
        marketStoreOrdersCount: marketStoreOrders.length,
        botMarketOrdersCount: botMarketOrders.length,
        marketStoreRevenue,
        botMarketRevenue,
      },
      chartData,
    })
  } catch (error: unknown) {
    return jsonNoStore({ error: getErrorMessage(error) || 'Failed to load dashboard stats' }, 500)
  }
}
