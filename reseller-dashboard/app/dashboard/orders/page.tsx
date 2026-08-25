"use client";
import { useEffect, useState, useMemo, Fragment } from "react";
import Pagination from "@/components/Pagination";

interface Order {
  id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  total_modal: number;
  komisi: number;
  status: string;
  payment_method: string;
  created_at: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  harga_modal: number;
  harga_jual: number;
  item_data: string | null;
  sent: boolean;
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  async function fetchOrders() {
    try {
      const res = await fetch(`/api/dashboard/orders?_t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        setOrders(json.orders || []);
        setOrderItems(json.orderItems || {});
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 1500);
    } catch {}
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        o.order_id.toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) ||
        (o.customer_email || "").toLowerCase().includes(q) ||
        (o.customer_phone || "").includes(q);
      const matchStatus = statusFilter === "all" || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  const paginatedOrders = useMemo(() => {
    if (pageSize === 0) return filteredOrders;
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Stats
  const stats = useMemo(() => ({
    total: orders.length,
    completed: orders.filter(o => o.status === "completed").length,
    pending: orders.filter(o => o.status === "pending").length,
    revenue: orders.filter(o => o.status === "completed").reduce((s, o) => s + Number(o.total_amount || 0), 0),
    komisi: orders.filter(o => o.status === "completed").reduce((s, o) => s + Number(o.komisi || 0), 0),
  }), [orders]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
        <div className="h-64 bg-white rounded-2xl animate-pulse border border-gray-100" />
      </div>
    );
  }

  return (
    <div data-tour="orders-root" className="space-y-5">
      {/* Copy toast */}
      {copiedText && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
          <i className="fa-solid fa-check mr-1"></i> Disalin!
        </div>
      )}

      {/* Stats */}
      <div data-tour="orders-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="text-2xl font-bold text-[#141a33]">{stats.total}</div>
          <div className="text-xs text-gray-500">Total Order</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
          <div className="text-xs text-gray-500">Selesai</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="text-lg font-bold text-[#141a33]">Rp {stats.revenue.toLocaleString("id-ID")}</div>
          <div className="text-xs text-gray-500">Total Penjualan</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="text-lg font-bold text-emerald-600">Rp {stats.komisi.toLocaleString("id-ID")}</div>
          <div className="text-xs text-gray-500">Total Komisi</div>
        </div>
      </div>

      {/* Filters */}
      <div data-tour="orders-filters" className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari order ID, nama, email, phone..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", "completed", "pending", "cancelled", "expired"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition ${
                  statusFilter === s
                    ? "bg-[#5c63f2] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "Semua" : s === "completed" ? "Selesai" : s === "pending" ? "Menunggu" : s === "cancelled" ? "Batal" : "Expired"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pagination top */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredOrders.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

      {/* Orders List */}
      <div data-tour="orders-list-card" className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <i className="fa-solid fa-inbox text-4xl mb-3"></i>
            <p className="text-sm">Tidak ada order ditemukan</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Order</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Komisi</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => {
                    const items = orderItems[order.id] || [];
                    const isExpanded = expandedOrderId === order.id;
                    return (
                      <Fragment key={order.id}>
                        <tr
                          data-tour="orders-row"
                          className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition"
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs font-semibold text-[#5c63f2]">{order.order_id}</div>
                            {items.length > 0 && (
                              <div className="text-[10px] text-gray-400 mt-0.5">{items.length} item</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-800 text-sm">{order.customer_name || "-"}</div>
                            <div className="text-[10px] text-gray-400">{order.customer_email}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                            Rp {Number(order.total_amount || 0).toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600 whitespace-nowrap">
                            +Rp {Number(order.komisi || 0).toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                            {new Date(order.created_at).toLocaleDateString("id-ID", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr data-tour="orders-expanded-detail" className="bg-gray-50">
                            <td colSpan={6} className="px-4 pb-4 pt-2">
                              <div data-tour="orders-expanded-meta" className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 text-xs">
                                <div><span className="text-gray-400">Phone:</span> <span className="font-medium">{order.customer_phone || "-"}</span></div>
                                <div><span className="text-gray-400">Payment:</span> <span className="font-medium">{order.payment_method || "-"}</span></div>
                                <div><span className="text-gray-400">Modal:</span> <span className="font-medium">Rp {Number(order.total_modal || 0).toLocaleString("id-ID")}</span></div>
                                <div><span className="text-gray-400">Tanggal:</span> <span className="font-medium">{new Date(order.created_at).toLocaleString("id-ID")}</span></div>
                              </div>

                              {/* Order Items */}
                              {items.length > 0 ? (
                                <div data-tour="orders-items-section" className="space-y-2 mt-2">
                                  <div className="text-xs font-semibold text-gray-600 mb-1">Item Digital:</div>
                                  {items.map((item) => (
                                    <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-3">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-gray-900">
                                          {item.product_name} <span className="text-gray-400">x{item.quantity}</span>
                                        </span>
                                        <span className="text-xs text-gray-500">Rp {Number(item.harga_jual).toLocaleString("id-ID")}</span>
                                      </div>
                                      {item.item_data ? (
                                        <div className="mt-1.5 relative group/item">
                                          <pre className="text-xs font-mono bg-emerald-50 border border-emerald-200 rounded-lg p-2 whitespace-pre-wrap break-all text-gray-800">
                                            {item.item_data}
                                          </pre>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); copyText(item.item_data!); }}
                                            className="absolute top-1 right-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-500 hover:text-[#5c63f2] hover:border-[#5c63f2] transition opacity-0 group-hover/item:opacity-100"
                                          >
                                            <i className="fa-solid fa-copy mr-0.5"></i>Copy
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="text-xs text-yellow-600 mt-1">
                                          <i className="fa-solid fa-clock mr-1"></i>Item belum tersedia
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : order.status === "completed" ? (
                                <div className="text-xs text-yellow-600 mt-2">
                                  <i className="fa-solid fa-spinner fa-spin mr-1"></i>Item sedang diproses...
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>


          </>
        )}
      </div>
    </div>
  );
}
