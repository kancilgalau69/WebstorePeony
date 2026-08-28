// Settings utility functions for reading and writing app settings
import { createBrowserClient } from '@/lib/supabase'

/**
 * Notify bot to refresh product cache after dashboard mutations.
 * This calls the dashboard's own /api/bot/refresh endpoint which
 * then forwards to the bot's webhook.
 * Returns true if bot was notified, false if it failed (non-blocking).
 */
export async function notifyBotRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/bot/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    if (data?.refreshed) {
      console.log('✅ Bot cache refreshed')
      return true
    }
    console.warn('⚠️ Bot refresh skipped:', data?.message)
    return false
  } catch (err) {
    console.warn('⚠️ Bot refresh failed (non-critical):', err)
    return false
  }
}

export interface AppSettings {
  store_name: string
  store_description: string
  support_contact: string
  catalog_banner_url: string
  items_per_page: number
  grid_cols: number
  enable_promo: boolean
  enable_referral: boolean
  enable_analytics: boolean
  enable_favorites: boolean
  payment_ttl_minutes: number
  currency: string
  locale: string
  market_gateway_fee_percent: number
  market_platform_fee_percent: number
  market_platform_fee_seller_percent: number
  market_platform_fee_customer_percent: number
  market_withdrawal_fee: number
  market_withdrawal_min_amount: number
  market_withdrawal_cooldown_hours: number
  market_fee_model: string  // 'both' | 'seller_only' | 'buyer_only'
  active_payment_gateway: string
}

export const defaultSettings: AppSettings = {
  store_name: 'Putra Btt Store',
  store_description: 'Toko Digital Terpercaya #1',
  support_contact: '@aryadwinata543',
  catalog_banner_url: 'https://imgcdn.dev/i/YaULTN',
  items_per_page: 10,
  grid_cols: 5,
  enable_promo: true,
  enable_referral: true,
  enable_analytics: true,
  enable_favorites: true,
  payment_ttl_minutes: 15,
  currency: 'IDR',
  locale: 'id-ID',
  market_gateway_fee_percent: 0.7,
  market_platform_fee_percent: 5.0,
  market_platform_fee_seller_percent: 5.0,
  market_platform_fee_customer_percent: 5.0,
  market_withdrawal_fee: 5000,
  market_withdrawal_min_amount: 50000,
  market_withdrawal_cooldown_hours: 72,
  market_fee_model: 'both',
  active_payment_gateway: 'midtrans',
}

export async function getSettings(): Promise<AppSettings> {
  const supabase = createBrowserClient()
  
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
    
    if (error) throw error
    
    const settings = { ...defaultSettings }
    
    data?.forEach((item: any) => {
      const key = item.key as keyof AppSettings
      const value = item.value
      
      // Parse value based on type
      if (key === 'items_per_page' || key === 'grid_cols' || key === 'payment_ttl_minutes' || key === 'market_withdrawal_fee' || key === 'market_withdrawal_min_amount' || key === 'market_withdrawal_cooldown_hours') {
        settings[key] = parseInt(value, 10)
      } else if (key === 'market_gateway_fee_percent' || key === 'market_platform_fee_percent' || key === 'market_platform_fee_seller_percent' || key === 'market_platform_fee_customer_percent') {
        settings[key] = parseFloat(value)
      } else if (key === 'enable_promo' || key === 'enable_referral' || key === 'enable_analytics' || key === 'enable_favorites') {
        settings[key] = value === 'true'
      } else {
        // @ts-ignore
        settings[key] = value
      }
    })
    
    return settings
  } catch (error) {
    console.error('Error fetching settings:', error)
    return defaultSettings
  }
}

export async function getSetting(key: keyof AppSettings): Promise<any> {
  const settings = await getSettings()
  return settings[key]
}

export async function updateSetting(key: keyof AppSettings, value: any, userId?: string): Promise<void> {
  const supabase = createBrowserClient()
  
  try {
    let stringValue: string
    
    // Convert value to string for storage
    if (typeof value === 'boolean') {
      stringValue = value.toString()
    } else if (typeof value === 'number') {
      stringValue = value.toString()
    } else {
      stringValue = value
    }
    
    const updateData: any = {
      key,
      value: stringValue,
    }
    
    if (userId) {
      updateData.updated_by = userId
    }
    
    const { error } = await supabase
      .from('settings')
      .upsert(updateData, { onConflict: 'key' })
    
    if (error) throw error
  } catch (error) {
    console.error('Error updating setting:', error)
    throw error
  }
}

export async function updateSettings(settings: Partial<AppSettings>, userId?: string): Promise<void> {
  const supabase = createBrowserClient()
  
  try {
    const updates = Object.entries(settings).map(([key, value]) => {
      let stringValue: string
      
      if (typeof value === 'boolean') {
        stringValue = value.toString()
      } else if (typeof value === 'number') {
        stringValue = value.toString()
      } else {
        stringValue = value
      }
      
      const data: any = {
        key,
        value: stringValue,
      }
      
      if (userId) {
        data.updated_by = userId
      }
      
      return data
    })
    
    const { error } = await supabase
      .from('settings')
      .upsert(updates, { onConflict: 'key' })
    
    if (error) throw error
  } catch (error) {
    console.error('Error updating settings:', error)
    throw error
  }
}
