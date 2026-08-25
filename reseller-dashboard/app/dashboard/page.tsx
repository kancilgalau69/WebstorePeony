"use client";
import { useEffect, useState } from "react";
import { useReseller } from "@/components/ResellerProvider";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SummaryData {
  totalOrders: number;
  todayOrders: number;
  monthRevenue: number;
  monthKomisi: number;
  saldo: number;
  lifetimePenjualan: number;
  lifetimeKomisi: number;
  chartData: { date: string; orders: number; revenue: number }[];
  recentOrders: {
    id: string;
    order_id: string;
    customer_name: string;
    total_amount: number;
    komisi: number;
    status: string;
    created_at: string;
  }[];
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-700",
    expired: "bg-gray-100 text-gray-600",
  };
  const labels: Record<string, string> = {
    pending: "Menunggu",
    completed: "Selesai",
    cancelled: "Dibatalkan",
    expired: "Kedaluwarsa",
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
}

export default function DashboardPage() {
  const { reseller } = useReseller();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  async function fetchSummary() {
    try {
      const res = await fetch(`/api/dashboard/summary?_t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-28"></div>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-6 animate-pulse h-80"></div>
      </div>
    );
  }

  const stats = [
    {
      label: "Saldo Komisi",
      value: `Rp ${(data?.saldo || 0).toLocaleString("id-ID")}`,
      icon: "fa-wallet",
      bgColor: "bg-emerald-50",
      textColor: "text-emerald-600",
      small: true,
    },
    {
      label: "Total Order",
      value: data?.totalOrders || 0,
      icon: "fa-receipt",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
    },
    {
      label: "Pendapatan Bulan Ini",
      value: `Rp ${(data?.monthRevenue || 0).toLocaleString("id-ID")}`,
      icon: "fa-chart-line",
      bgColor: "bg-purple-50",
      textColor: "text-purple-600",
      small: true,
    },
    {
      label: "Komisi Bulan Ini",
      value: `Rp ${(data?.monthKomisi || 0).toLocaleString("id-ID")}`,
      icon: "fa-coins",
      bgColor: "bg-amber-50",
      textColor: "text-amber-600",
      small: true,
    },
  ];

  return (
    <div data-tour="dashboard-home-root" className="space-y-6">
      {/* Welcome */}
      <div data-tour="dashboard-home-welcome" className="bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold">
          Selamat datang, {reseller?.nama_toko || "Reseller"}! 👋
        </h2>
        <p className="text-white/80 mt-1 text-sm">
          Berikut ringkasan performa toko Anda hari ini.
        </p>
      </div>

      {/* Stats Cards */}
      <div data-tour="dashboard-home-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <i className={`fa-solid ${stat.icon} ${stat.textColor}`}></i>
              </div>
            </div>
            <div className={`font-bold ${stat.small ? "text-lg" : "text-2xl"} text-[#141a33]`}>
              {stat.value}
            </div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Lifetime Stats */}
      <div data-tour="dashboard-home-lifetime-stats" className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-xs text-gray-500 mb-1">Total Penjualan (Lifetime)</div>
          <div className="text-sm font-bold text-[#141a33]">Rp {(data?.lifetimePenjualan || 0).toLocaleString("id-ID")}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-xs text-gray-500 mb-1">Total Komisi (Lifetime)</div>
          <div className="text-sm font-bold text-emerald-600">Rp {(data?.lifetimeKomisi || 0).toLocaleString("id-ID")}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <div className="text-xs text-gray-500 mb-1">Order Hari Ini</div>
          <div className="text-sm font-bold text-[#141a33]">{data?.todayOrders || 0}</div>
        </div>
      </div>

      {/* Chart */}
      <div data-tour="dashboard-home-orders-chart-card" className="bg-white rounded-2xl p-6 border border-gray-100">
        <h3 className="text-base font-bold text-[#141a33] mb-4">Order 7 Hari Terakhir</h3>
        {data?.chartData && data.chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.chartData}>
              <defs>
                <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5c63f2" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#5c63f2" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#999" />
              <YAxis tick={{ fontSize: 12 }} stroke="#999" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e7ff",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              />
              <Area
                type="monotone"
                dataKey="orders"
                stroke="#5c63f2"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorOrders)"
                name="Jumlah Order"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-60 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <i className="fa-solid fa-chart-area text-4xl mb-2"></i>
              <p className="text-sm">Belum ada data order</p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Orders */}
      <div data-tour="dashboard-home-recent-orders" className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-[#141a33]">Order Terbaru</h3>
          <a href="/dashboard/orders" className="text-sm text-[#5c63f2] hover:underline">
            Lihat Semua <i className="fa-solid fa-arrow-right ml-1"></i>
          </a>
        </div>
        {data?.recentOrders && data.recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Order ID</th>
                  <th className="px-6 py-3 text-left">Customer</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3 text-right">Komisi</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentOrders.map((order) => (
                  <tr key={order.id} className="table-row-hover">
                    <td className="px-6 py-3 font-mono text-xs font-semibold text-[#5c63f2]">
                      {order.order_id}
                    </td>
                    <td className="px-6 py-3 text-gray-700">{order.customer_name || "-"}</td>
                    <td className="px-6 py-3 text-right font-medium">
                      Rp {(order.total_amount || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-emerald-600">
                      +Rp {(order.komisi || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-3 text-right text-gray-500 text-xs">
                      {new Date(order.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <i className="fa-solid fa-inbox text-4xl mb-3"></i>
            <p>Belum ada order</p>
          </div>
        )}
      </div>
    </div>
  );
}
