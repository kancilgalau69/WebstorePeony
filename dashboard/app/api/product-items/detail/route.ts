import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as createSupabaseAuthClient } from '@supabase/ssr'
import { createServerClient } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

type ProductItem = Database['public']['Tables']['product_items']['Row']
type ProductSummary = Pick<Database['public']['Tables']['products']['Row'], 'id' | 'kode' | 'nama'>

type OrderRow = {
  id: string
  order_id: string
  user_id: string | number | null
  status: string | null
  total_amount: number | string | null
  created_at: string | null
  paid_at: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  payment_method: string | null
  transaction_id: string | null
}

type UserRow = {
  user_id: string | number
  username: string | null
  first_name: string | null
  last_name: string | null
}

type BuyerDetail = {
  name: string | null
  email: string | null
  phone: string | null
  telegram_user_id: string | number | null
  username: string | null
  first_name: string | null
  last_name: string | null
}

function buildBuyer(order: OrderRow, user: UserRow | null): BuyerDetail {
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
  const username = user?.username ? `@${user.username}` : null

  return {
    name: order?.customer_name || userName || username || null,
    email: order?.customer_email || null,
    phone: order?.customer_phone || null,
    telegram_user_id: order?.user_id || user?.user_id || null,
    username: user?.username || null,
    first_name: user?.first_name || null,
    last_name: user?.last_name || null,
  }
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

export async function GET(request: NextRequest) {
  try {
    const authClient = createAuthClient(request)
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemId = request.nextUrl.searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: itemData, error: itemError } = await supabase
      .from('product_items')
      .select('*')
      .eq('id', itemId)
      .maybeSingle()

    if (itemError) throw itemError

    const item = itemData as ProductItem | null

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const { data: productData } = await supabase
      .from('products')
      .select('id, kode, nama')
      .eq('id', item.product_id)
      .maybeSingle()

    const product = productData as ProductSummary | null
    let order: (OrderRow & { buyer: BuyerDetail }) | null = null
    const itemOrderId = String(item.order_id || '').trim()

    if (item.status === 'sold' && itemOrderId) {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_id, user_id, status, total_amount, created_at, paid_at, customer_name, customer_email, customer_phone, payment_method, transaction_id')
        .eq('order_id', itemOrderId)
        .maybeSingle()

      if (orderError) throw orderError

      const orderRow = orderData as OrderRow | null

      if (orderRow) {
        let user: UserRow | null = null
        const orderUserId = orderRow.user_id

        if (orderUserId) {
          const { data: userRow } = await supabase
            .from('users')
            .select('user_id, username, first_name, last_name')
            .eq('user_id', orderUserId)
            .maybeSingle()

          user = (userRow as UserRow | null) || null
        }

        order = {
          ...orderRow,
          buyer: buildBuyer(orderRow, user),
        }
      }
    }

    return NextResponse.json({ item, product: product || null, order })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load item detail'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
