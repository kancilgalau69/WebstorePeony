import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''

if (!supabaseUrl || !supabaseServerKey) {
  console.error('Supabase env vars not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServerKey)

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '022_add_long_description.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('Running migration 022...')
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }) // Note: check parameter name or fallback to sql

    let finalErr = error
    if (error) {
      console.warn('exec_sql with sql_query failed, trying parameter name "sql"')
      const { error: error2 } = await supabase.rpc('exec_sql', { sql })
      finalErr = error2
    }

    if (finalErr) {
      console.error('Migration failed:', finalErr)
      process.exit(1)
    }

    console.log('Migration completed successfully')
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

runMigration()
