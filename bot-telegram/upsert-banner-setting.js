import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServerKey) {
  console.error('Supabase env vars not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServerKey)

async function run() {
  try {
    console.log('Upserting market_banners setting...')
    const { error } = await supabase
      .from('settings')
      .upsert({
        key: 'market_banners',
        value: '[{"id":"default-1","image_url":"https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop","link":"#katalog"}]',
        description: 'JSON array of marketplace storefront hero banners'
      }, { onConflict: 'key' })

    if (error) {
      console.error('Failed to upsert setting:', error)
      process.exit(1)
    }

    console.log('Successfully upserted market_banners setting')
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

run()
