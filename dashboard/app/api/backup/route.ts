import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const FALLBACK_TABLES = [
  'settings',
  'products',
  'product_items',
  'users',
  'user_web',
  'orders',
  'order_items',
  'favorites',
  'web_promos',
  'web_promo_usages',
  'user_web_affiliates',
  'affiliate_clicks',
  'affiliate_earnings',
  'affiliate_withdrawals',
  'blog_categories',
  'blog_posts',
  'broadcasts',
]

function getPostgresType(prop: { format?: string; type?: string; maxLength?: number }): string {
  const format = prop.format || ''
  const type = prop.type || ''
  
  if (format === 'uuid') return 'UUID'
  if (format === 'timestamp with time zone') return 'TIMESTAMPTZ'
  if (format === 'timestamp without time zone') return 'TIMESTAMP'
  if (format === 'date') return 'DATE'
  if (format === 'boolean') return 'BOOLEAN'
  if (format === 'numeric') return 'NUMERIC'
  if (format === 'integer') return 'INTEGER'
  if (format === 'bigint') return 'BIGINT'
  if (format === 'json' || format === 'jsonb') return 'JSONB'
  if (format === 'text') return 'TEXT'
  if (format === 'character varying') {
    return prop.maxLength ? `VARCHAR(${prop.maxLength})` : 'VARCHAR'
  }
  
  // Fallbacks
  if (type === 'number') return 'NUMERIC'
  if (type === 'boolean') return 'BOOLEAN'
  if (type === 'integer') return 'INTEGER'
  if (type === 'array') return 'TEXT[]'
  if (type === 'object') return 'JSONB'
  
  return 'TEXT'
}

interface TableDefinition {
  tableName: string
  isView: boolean
  columns: string[]
  createTableSql: string
}

async function introspectSchema(supabaseUrl: string, serviceKey: string): Promise<TableDefinition[]> {
  try {
    const url = `${supabaseUrl}/rest/v1/`
    const headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    }
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`PostgREST OpenAPI fetch failed: ${res.statusText}`)
    const data = await res.json()
    
    const tables = Object.keys(data.definitions || {})
    const results: TableDefinition[] = []
    
    for (const table of tables) {
      const def = data.definitions[table]
      const pathDef = data.paths[`/${table}`]
      const isView = !pathDef?.post
      
      const properties = def.properties || {}
      const columns = Object.keys(properties)
      
      // Build CREATE TABLE SQL
      const colDefs: string[] = []
      for (const colName of columns) {
        const prop = properties[colName]
        const pgType = getPostgresType(prop)
        let defStr = `  ${colName} ${pgType}`
        if (prop.default !== undefined) {
          const defaultVal = String(prop.default)
          if (defaultVal === 'now()' || defaultVal === 'gen_random_uuid()' || defaultVal === 'true' || defaultVal === 'false' || !isNaN(Number(defaultVal))) {
            defStr += ` DEFAULT ${defaultVal}`
          } else {
            defStr += ` DEFAULT '${defaultVal.replace(/'/g, "''")}'`
          }
        }
        colDefs.push(defStr)
      }
      
      const createTableSql = `CREATE TABLE IF NOT EXISTS public.${table} (\n${colDefs.join(',\n')}\n);`
      
      results.push({
        tableName: table,
        isView,
        columns,
        createTableSql,
      })
    }
    
    return results
  } catch (err) {
    console.error('Schema introspection failed:', err)
    return []
  }
}

function escapeSQL(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) {
    return `'{${val.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(',')}}'`
  }
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
  return `'${String(val).replace(/'/g, "''")}'`
}

function rowsToInsertSQL(table: string, rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return `-- No data in ${table}\n`
  const columns = Object.keys(rows[0])
  const lines: string[] = []
  lines.push(`-- Table: ${table} (${rows.length} rows)`)
  for (const row of rows) {
    const values = columns.map(col => escapeSQL(row[col]))
    lines.push(`INSERT INTO public.${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`)
  }
  lines.push('')
  return lines.join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRows(supabase: any, table: string): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 1000
  let all: Record<string, unknown>[] = []
  let from = 0
  let hasMore = true
  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error(`Backup: failed to fetch ${table}:`, error.message)
      break
    }
    all = all.concat((data || []) as Record<string, unknown>[])
    hasMore = (data || []).length >= PAGE_SIZE
    from += PAGE_SIZE
  }
  return all
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'full'
    const format = searchParams.get('format') || 'sql'
    const productId = searchParams.get('product_id') || ''

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      ''

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    let content = ''
    let filename = ''
    const contentType = 'text/plain'

    switch (type) {
      case 'schema': {
        const tableDefs = await introspectSchema(supabaseUrl, serviceKey)
        const lines: string[] = []
        lines.push(`-- ============================================`)
        lines.push(`-- PBS Digital Store - Database Schema`)
        lines.push(`-- Generated: ${new Date().toISOString()}`)
        lines.push(`-- ============================================\n`)

        lines.push(`SET session_replication_role = 'replica';\n`)

        if (tableDefs.length > 0) {
          for (const def of tableDefs) {
            if (def.isView) {
              lines.push(`-- View: ${def.tableName} (skipped in schema backup)\n`)
            } else {
              lines.push(`-- Table: ${def.tableName}`)
              lines.push(def.createTableSql)
              lines.push('')
            }
          }
        } else {
          // Fallback to sample row inference if schema introspection failed
          lines.push(`-- Note: Schema introspection failed, using fallback inference\n`)
          for (const table of FALLBACK_TABLES) {
            try {
              const { data: sampleRow, error: sampleErr } = await supabase.from(table).select('*').limit(1)
              if (sampleErr) {
                lines.push(`-- Table: ${table} (error: ${sampleErr.message})\n`)
                continue
              }
              if (sampleRow && sampleRow.length > 0) {
                const cols = Object.keys(sampleRow[0])
                lines.push(`CREATE TABLE IF NOT EXISTS public.${table} (`)
                const colDefs = cols.map(col => {
                  const val = sampleRow[0][col]
                  let type = 'TEXT'
                  if (typeof val === 'boolean') type = 'BOOLEAN'
                  else if (typeof val === 'number') type = Number.isInteger(val) ? 'INTEGER' : 'DECIMAL(15,2)'
                  else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) type = 'TIMESTAMPTZ'
                  else if (typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(val)) type = 'UUID'
                  else if (Array.isArray(val)) type = 'TEXT[]'
                  else if (val !== null && typeof val === 'object') type = 'JSONB'
                  else if (val === null) type = 'TEXT'
                  return `  ${col} ${type}`
                })
                lines.push(colDefs.join(',\n'))
                lines.push(`);\n`)
              } else {
                lines.push(`-- Table: ${table} (empty, columns unknown)\n`)
              }
            } catch {
              lines.push(`-- Table: ${table} (inaccessible)\n`)
            }
          }
        }

        lines.push(`SET session_replication_role = 'origin';\n`)

        content = lines.join('\n')
        filename = `backup-schema-${timestamp}.sql`
        break
      }

      case 'full': {
        const tableDefs = await introspectSchema(supabaseUrl, serviceKey)
        const lines: string[] = []
        lines.push(`-- ============================================`)
        lines.push(`-- PBS Digital Store - Full Database Backup`)
        lines.push(`-- Generated: ${new Date().toISOString()}`)
        lines.push(`-- ============================================\n`)

        lines.push(`SET session_replication_role = 'replica';\n`)

        const tablesToFetch = tableDefs.length > 0 
          ? tableDefs.filter(d => !d.isView).map(d => d.tableName)
          : FALLBACK_TABLES

        for (const table of tablesToFetch) {
          try {
            const rows = await fetchAllRows(supabase, table)
            lines.push(rowsToInsertSQL(table, rows))
          } catch (err: unknown) {
            lines.push(`-- ERROR fetching ${table}: ${err instanceof Error ? err.message : String(err)}\n`)
          }
        }

        lines.push(`SET session_replication_role = 'origin';\n`)

        content = lines.join('\n')
        filename = `backup-full-${timestamp}.sql`
        break
      }

      case 'products': {
        const rows = await fetchAllRows(supabase, 'products')
        content = `-- Products Backup (${rows.length} rows)\n-- Generated: ${new Date().toISOString()}\n\n`
        content += `SET session_replication_role = 'replica';\n\n`
        content += rowsToInsertSQL('products', rows)
        content += `\nSET session_replication_role = 'origin';\n`
        filename = `backup-products-${timestamp}.sql`
        break
      }

      case 'items': {
        const rows = await fetchAllRows(supabase, 'product_items')

        if (format === 'txt') {
          const grouped: Record<string, string[]> = {}
          for (const row of rows) {
            const code = (row.product_code as string) || 'UNKNOWN'
            if (!grouped[code]) grouped[code] = []
            grouped[code].push((row.item_data as string) || '')
          }
          const lines: string[] = []
          lines.push(`# Product Items Backup (${rows.length} items)`)
          lines.push(`# Generated: ${new Date().toISOString()}\n`)
          for (const [code, items] of Object.entries(grouped)) {
            lines.push(`=== ${code} (${items.length} items) ===`)
            items.forEach(item => lines.push(item))
            lines.push('')
          }
          content = lines.join('\n')
          filename = `backup-items-${timestamp}.txt`
        } else {
          content = `-- Product Items Backup (${rows.length} rows)\n-- Generated: ${new Date().toISOString()}\n\n`
          content += `SET session_replication_role = 'replica';\n\n`
          content += rowsToInsertSQL('product_items', rows)
          content += `\nSET session_replication_role = 'origin';\n`
          filename = `backup-items-${timestamp}.sql`
        }
        break
      }

      case 'items_product': {
        if (!productId) {
          return NextResponse.json({ error: 'Missing product_id parameter' }, { status: 400 })
        }

        const { data: product } = await supabase
          .from('products')
          .select('kode, nama')
          .eq('id', productId)
          .single()

        const { data: rows } = await supabase
          .from('product_items')
          .select('*')
          .eq('product_id', productId)
          .order('status')
          .order('created_at', { ascending: false })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = (rows || []) as any[]
        const productCode = product?.kode || 'UNKNOWN'
        const productName = product?.nama || 'Unknown Product'

        if (format === 'txt') {
          const lines: string[] = []
          lines.push(`# Items: ${productName} (${productCode})`)
          lines.push(`# Total: ${items.length} items`)
          lines.push(`# Generated: ${new Date().toISOString()}`)
          lines.push(`# Status: available=${items.filter(i => i.status === 'available').length}, sold=${items.filter(i => i.status === 'sold').length}, reserved=${items.filter(i => i.status === 'reserved').length}`)
          lines.push('')
          lines.push('--- AVAILABLE ---')
          items.filter(i => i.status === 'available').forEach(i => lines.push(i.item_data))
          lines.push('')
          lines.push('--- SOLD ---')
          items.filter(i => i.status === 'sold').forEach(i => lines.push(i.item_data))
          if (items.some(i => i.status === 'reserved')) {
            lines.push('')
            lines.push('--- RESERVED ---')
            items.filter(i => i.status === 'reserved').forEach(i => lines.push(i.item_data))
          }
          content = lines.join('\n')
          filename = `backup-items-${productCode}-${timestamp}.txt`
        } else {
          content = `-- Items for: ${productName} (${productCode})\n-- Total: ${items.length} rows\n-- Generated: ${new Date().toISOString()}\n\n`
          content += `SET session_replication_role = 'replica';\n\n`
          content += rowsToInsertSQL('product_items', items)
          content += `\nSET session_replication_role = 'origin';\n`
          filename = `backup-items-${productCode}-${timestamp}.sql`
        }
        break
      }

      case 'users': {
        const [tgUsers, webUsers] = await Promise.all([
          fetchAllRows(supabase, 'users'),
          fetchAllRows(supabase, 'user_web'),
        ])
        content = `-- Users Backup\n-- Telegram users: ${tgUsers.length}, Web users: ${webUsers.length}\n-- Generated: ${new Date().toISOString()}\n\n`
        content += `SET session_replication_role = 'replica';\n\n`
        content += rowsToInsertSQL('users', tgUsers)
        content += rowsToInsertSQL('user_web', webUsers)
        content += `\nSET session_replication_role = 'origin';\n`
        filename = `backup-users-${timestamp}.sql`
        break
      }

      default:
        return NextResponse.json({ error: `Unknown backup type: ${type}` }, { status: 400 })
    }

    // Return as downloadable file
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    console.error('Backup error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Backup failed' }, { status: 500 })
  }
}
