export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'reseller_registration_enabled')
      .maybeSingle()

    return NextResponse.json({ enabled: data?.value !== 'false' }, { headers: NO_CACHE_HEADERS })
  } catch {
    return NextResponse.json({ enabled: true }, { headers: NO_CACHE_HEADERS })
  }
}
