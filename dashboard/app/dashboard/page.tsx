'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiBox, FiPackage, FiShoppingCart, FiUsers, FiTrendingUp, FiDollarSign, FiSettings, FiCheckCircle, FiBarChart } from 'react-icons/fi'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Stats {
  totalProducts: number
  totalItems: number
  totalOrders: number
  totalUsers: number
  revenueThisMonth: number
  totalRevenue: number
  avgOrderValue: number
  // Main web store data
  webStoreOrdersCount: number
  webStoreRevenue: number
  webStoreRevenueThisMonth: number
  // Web Market data
  sellerCount: number
  marketOrdersCount: number
  marketRevenue: number
  marketRevenueThisMonth: number
  marketStoreOrdersCount: number
  botMarketOrdersCount: number
  marketStoreRevenue: number
  botMarketRevenue: number
}

interface ChartData {
  date: string
  orders: number
  revenue: number
  pbsRevenue: number
  pbsOrders: number
  webStoreRevenue: number
  webStoreOrders: number
  marketRevenue: number
  marketOrders: number
}

interface TopUser {
  userId: string | null
  nama: string
  email: string
  phone: string
  txCount: number
  revenue: number
  registered: boolean
}

interface TopUsersResponse {
  period: 'day' | 'month'
  periodKey: string
  topUsers: TopUser[]
  totals: { totalTx: number; totalRevenue: number; uniqueUsers: number }
  error?: string
}

interface TooltipPayload {
  payload: ChartData
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-md text-xs md:text-sm">
        <p className="font-bold text-gray-900 mb-2">{label}</p>
        
        <div className="mb-3">
          <p className="text-indigo-600 font-semibold mb-1">
            Total Revenue: Rp {data.revenue.toLocaleString('id-ID')}
          </p>
          <div className="pl-3 border-l-2 border-indigo-200 space-y-0.5 text-gray-500 text-xs">
            <p>Bot Telegram: Rp {data.pbsRevenue.toLocaleString('id-ID')}</p>
            <p>Web Store: Rp {data.webStoreRevenue.toLocaleString('id-ID')}</p>
            <p>Web Market: Rp {data.marketRevenue.toLocaleString('id-ID')}</p>
          </div>
        </div>
        
        <div>
          <p className="text-green-600 font-semibold mb-1">
            Total Orders: {data.orders}
          </p>
          <div className="pl-3 border-l-2 border-green-200 space-y-0.5 text-gray-500 text-xs">
            <p>Bot Telegram: {data.pbsOrders} orders</p>
            <p>Web Store: {data.webStoreOrders} orders</p>
            <p>Web Market: {data.marketOrders} orders</p>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalItems: 0,
    totalOrders: 0,
    totalUsers: 0,
    revenueThisMonth: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    webStoreOrdersCount: 0,
    webStoreRevenue: 0,
    webStoreRevenueThisMonth: 0,
    sellerCount: 0,
    marketOrdersCount: 0,
    marketRevenue: 0,
    marketRevenueThisMonth: 0,
    marketStoreOrdersCount: 0,
    botMarketOrdersCount: 0,
    marketStoreRevenue: 0,
    botMarketRevenue: 0,
  })
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)

  // Top 10 users by transaction count (per-day / per-month)
  const todayKeyLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // 'YYYY-MM-DD'
  const [topPeriod, setTopPeriod] = useState<'day' | 'month'>('day')
  const [topDate, setTopDate] = useState<string>(todayKeyLocal)
  const [topMonth, setTopMonth] = useState<string>(todayKeyLocal.slice(0, 7))
  const [topUsers, setTopUsers] = useState<TopUser[]>([])
  const [topTotals, setTopTotals] = useState<{ totalTx: number; totalRevenue: number; uniqueUsers: number }>({ totalTx: 0, totalRevenue: 0, uniqueUsers: 0 })
  const [topLoading, setTopLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchTopUsers = async () => {
      try {
        setTopLoading(true)
        const qs = topPeriod === 'month'
          ? `period=month&month=${encodeURIComponent(topMonth)}`
          : `period=day&date=${encodeURIComponent(topDate)}`
        const res = await fetch(`/api/dashboard/top-users?${qs}`, { cache: 'no-store' })
        const payload = await res.json() as TopUsersResponse
        if (!res.ok) throw new Error(payload.error || 'Failed to load top users')
        if (cancelled) return
        setTopUsers(payload.topUsers || [])
        setTopTotals(payload.totals || { totalTx: 0, totalRevenue: 0, uniqueUsers: 0 })
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching top users:', error)
          setTopUsers([])
        }
      } finally {
        if (!cancelled) setTopLoading(false)
      }
    }
    fetchTopUsers()
    return () => { cancelled = true }
  }, [topPeriod, topDate, topMonth])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats', { cache: 'no-store' })
        const payload = await response.json() as { stats?: Stats; chartData?: ChartData[]; error?: string }

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load dashboard stats')
        }

        if (payload.stats) setStats(payload.stats)
        if (payload.chartData) setChartData(payload.chartData)
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    const supabase = createBrowserClient()
    fetchStats()
    // Auto-refresh dashboard stats every 30 seconds as fallback
    const interval = setInterval(() => fetchStats(), 30_000)

    // Supabase Realtime: auto-refresh stats on any table change
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_items' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_orders' }, () => fetchStats())
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Selamat Datang di Peony Store Admin</h2>
        <p className="text-sm md:text-base text-gray-600">Analitik &amp; manajemen real-time untuk Peony Store</p>
      </div>

      {/* Main Stats - 4 columns on desktop, 2 on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
        {/* Total Revenue */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-indigo-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs md:text-sm font-medium">Total Revenue</p>
              <p className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 md:mt-2">
                Rp {stats.totalRevenue.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-indigo-100 text-indigo-600 p-2 md:p-3 rounded-lg">
              <FiDollarSign className="text-lg md:text-xl lg:text-2xl" />
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-green-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs md:text-sm font-medium">Total Orders</p>
              <p className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 md:mt-2">{stats.totalOrders}</p>
            </div>
            <div className="bg-green-100 text-green-600 p-2 md:p-3 rounded-lg">
              <FiShoppingCart className="text-lg md:text-xl lg:text-2xl" />
            </div>
          </div>
        </div>

        {/* Avg Order Value */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-blue-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs md:text-sm font-medium">Avg Order Value</p>
              <p className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 md:mt-2">
                Rp {stats.avgOrderValue.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-blue-100 text-blue-600 p-2 md:p-3 rounded-lg">
              <FiTrendingUp className="text-lg md:text-xl lg:text-2xl" />
            </div>
          </div>
        </div>

        {/* This Month Revenue */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-purple-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs md:text-sm font-medium">This Month</p>
              <p className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 md:mt-2">
                Rp {stats.revenueThisMonth.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-purple-100 text-purple-600 p-2 md:p-3 rounded-lg">
              <FiTrendingUp className="text-lg md:text-xl lg:text-2xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Web Store User Overview */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 border-t-4 border-indigo-500 hover:shadow-lg transition">
        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FiShoppingCart className="text-indigo-500" />
          Web Store User & Bot Utama Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="p-4 bg-indigo-50 rounded-lg">
            <p className="text-gray-500 text-xs md:text-sm font-medium">Total Orders</p>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.webStoreOrdersCount}</p>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg">
            <p className="text-gray-500 text-xs md:text-sm font-medium">Total Revenue</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1 truncate" title={`Rp ${stats.webStoreRevenue.toLocaleString('id-ID')}`}>
              Rp {stats.webStoreRevenue.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg">
            <p className="text-gray-500 text-xs md:text-sm font-medium">This Month</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1 truncate" title={`Rp ${stats.webStoreRevenueThisMonth.toLocaleString('id-ID')}`}>
              Rp {stats.webStoreRevenueThisMonth.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>

      {/* Web Market Stats */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">
        {/* Web Market Stats Card */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-t-4 border-teal-500 hover:shadow-lg transition">
          <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiShoppingCart className="text-teal-500" />
            Web Market Overview
          </h3>
          <div className="grid grid-cols-2 gap-2 md:gap-4">
            <div className="p-3 bg-teal-50 rounded-lg">
              <p className="text-gray-500 text-xs md:text-sm font-medium">Total Sellers</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">{stats.sellerCount}</p>
            </div>
            <div className="p-3 bg-teal-50 rounded-lg">
              <p className="text-gray-500 text-xs md:text-sm font-medium">Total Orders</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900 mt-1">{stats.marketOrdersCount}</p>
            </div>
            <div className="p-3 bg-teal-50 rounded-lg">
              <p className="text-gray-500 text-xs md:text-sm font-medium">Revenue</p>
              <p className="text-sm md:text-lg lg:text-xl font-bold text-gray-900 mt-1 truncate" title={`Rp ${stats.marketRevenue.toLocaleString('id-ID')}`}>
                Rp {stats.marketRevenue.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 bg-teal-50 rounded-lg">
              <p className="text-gray-500 text-xs md:text-sm font-medium">This Month</p>
              <p className="text-sm md:text-lg lg:text-xl font-bold text-gray-900 mt-1 truncate" title={`Rp ${stats.marketRevenueThisMonth.toLocaleString('id-ID')}`}>
                Rp {stats.marketRevenueThisMonth.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section - 2 column on desktop, 1 on tablet/mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & Orders Chart */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4">Revenue & Orders (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" style={{ fontSize: '12px' }} />
              <YAxis yAxisId="left" style={{ fontSize: '12px' }} />
              <YAxis yAxisId="right" orientation="right" style={{ fontSize: '12px' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#4f46e5"
                name="Revenue (Rp)"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                stroke="#10b981"
                name="Orders"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Business Metrics Card */}
        <div className="space-y-4">
          {/* Total Products */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Products</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.totalProducts}</p>
              </div>
              <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                <FiBox className="text-2xl" />
              </div>
            </div>
          </div>

          {/* Product Items */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Product Items</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.totalItems}</p>
              </div>
              <div className="bg-green-100 text-green-600 p-3 rounded-lg">
                <FiPackage className="text-2xl" />
              </div>
            </div>
          </div>

          {/* Total Users */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Users</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
              </div>
              <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
                <FiUsers className="text-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 Users by Transactions */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 border-t-4 border-purple-500">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h3 className="text-base md:text-lg font-bold text-gray-900 flex items-center gap-2">
            <FiUsers className="text-purple-500" />
            Top 10 User Transaksi Terbanyak
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period toggle */}
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setTopPeriod('day')}
                className={`px-3 py-1.5 text-xs md:text-sm font-medium transition ${
                  topPeriod === 'day' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Per Hari
              </button>
              <button
                onClick={() => setTopPeriod('month')}
                className={`px-3 py-1.5 text-xs md:text-sm font-medium transition ${
                  topPeriod === 'month' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Per Bulan
              </button>
            </div>

            {/* Date / Month picker */}
            {topPeriod === 'day' ? (
              <input
                type="date"
                value={topDate}
                max={todayKeyLocal}
                onChange={(e) => setTopDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            ) : (
              <input
                type="month"
                value={topMonth}
                max={todayKeyLocal.slice(0, 7)}
                onChange={(e) => setTopMonth(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            )}
          </div>
        </div>

        {/* Period summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-gray-500 text-[11px] md:text-xs font-medium">Total Transaksi</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900 mt-0.5">{topTotals.totalTx}</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg">
            <p className="text-gray-500 text-[11px] md:text-xs font-medium">Total Omzet</p>
            <p className="text-sm md:text-xl font-bold text-gray-900 mt-0.5 truncate" title={`Rp ${topTotals.totalRevenue.toLocaleString('id-ID')}`}>
              Rp {topTotals.totalRevenue.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-gray-500 text-[11px] md:text-xs font-medium">User Aktif</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900 mt-0.5">{topTotals.uniqueUsers}</p>
          </div>
        </div>

        {topLoading ? (
          <div className="py-10 text-center text-gray-500 text-sm">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
            Memuat data...
          </div>
        ) : topUsers.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm">
            Belum ada transaksi pada periode ini.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-900 text-sm w-12">#</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-900 text-sm">Nama</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-900 text-sm">Email</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-900 text-sm">No. Telepon</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-900 text-sm">Transaksi</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-900 text-sm">Total Belanja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topUsers.map((u, idx) => (
                    <tr key={u.userId || u.email || idx} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-700'
                          : idx === 1 ? 'bg-gray-200 text-gray-700'
                          : idx === 2 ? 'bg-orange-100 text-orange-700'
                          : 'bg-purple-50 text-purple-600'
                        }`}>{idx + 1}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 flex items-center gap-2">
                          {u.nama}
                          {!u.registered && (
                            <span className="text-[10px] font-semibold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Guest</span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.phone}</td>
                      <td className="px-4 py-3 text-right"><span className="text-sm font-bold text-purple-700">{u.txCount}x</span></td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Rp {u.revenue.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {topUsers.map((u, idx) => (
                <div key={u.userId || u.email || idx} className="flex items-center gap-3 py-3">
                  <span className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                    idx === 0 ? 'bg-yellow-100 text-yellow-700'
                    : idx === 1 ? 'bg-gray-200 text-gray-700'
                    : idx === 2 ? 'bg-orange-100 text-orange-700'
                    : 'bg-purple-50 text-purple-600'
                  }`}>{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{u.nama}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-purple-700">{u.txCount}x</p>
                    <p className="text-xs text-gray-500">Rp {u.revenue.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-3 md:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <a
            href="/dashboard/products"
            className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <div className="flex items-center gap-2">
              <FiBox className="text-indigo-600" />
              <p className="font-medium text-gray-900 text-sm md:text-base">Manage Products</p>
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Add or edit</p>
          </a>
          <a
            href="/dashboard/items"
            className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <div className="flex items-center gap-2">
              <FiPackage className="text-indigo-600" />
              <p className="font-medium text-gray-900 text-sm md:text-base">Manage Items</p>
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Track inventory</p>
          </a>
          <a
            href="/dashboard/orders"
            className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <div className="flex items-center gap-2">
              <FiShoppingCart className="text-indigo-600" />
              <p className="font-medium text-gray-900 text-sm md:text-base">View Orders</p>
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Transactions</p>
          </a>
          <a
            href="/dashboard/settings"
            className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <div className="flex items-center gap-2">
              <FiSettings className="text-indigo-600" />
              <p className="font-medium text-gray-900 text-sm md:text-base">Settings</p>
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Configure</p>
          </a>
        </div>
      </div>

      {/* Info Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Database Status */}
        <div className="bg-linear-to-br from-green-50 to-green-100 rounded-lg shadow p-4 md:p-6 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <FiCheckCircle className="text-green-700" />
            <h3 className="text-base md:text-lg font-bold text-green-900">Database Status</h3>
          </div>
          <p className="text-sm md:text-base text-green-800">Supabase PostgreSQL connected and operational</p>
          <p className="text-xs md:text-sm text-green-700 mt-2">Real-time data sync enabled</p>
        </div>

        {/* System Info */}
        <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg shadow p-4 md:p-6 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <FiBarChart className="text-blue-700" />
            <h3 className="text-base md:text-lg font-bold text-blue-900">Analytics</h3>
          </div>
          <p className="text-sm md:text-base text-blue-800">Real-time revenue and order tracking</p>
          <p className="text-xs md:text-sm text-blue-700 mt-2">7-day performance overview</p>
        </div>
      </div>
    </div>
  )
}
