"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useStore } from "@/components/StoreProvider";

interface Order {
  order_id: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  status: string;
  items: any[];
  created_at: string;
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
  const { slug } = useParams();
  const { store } = useStore();
  const themeColor = store?.warna_tema || "#5c63f2";
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(`/api/store/${slug}/orders/search?q=${encodeURIComponent(search)}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 max-w-4xl py-8 animate-fadeIn">
      <h1 className="text-2xl font-bold text-[#141a33] mb-6">
        <i className="fa-solid fa-receipt mr-2" style={{ color: themeColor }}></i>
        Cek Pesanan
      </h1>

      <div className="bg-white rounded-2xl border border-[#e5e7ff] p-6 mb-6">
        <p className="text-sm text-gray-500 mb-4">
          Masukkan Order ID, email, atau nomor telepon untuk mencari pesanan Anda.
        </p>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order ID, email, atau no. telepon"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:border-transparent outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl text-white font-semibold"
            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
          >
            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : "Cari"}
          </button>
        </form>
      </div>

      {searched && (
        <div className="space-y-4">
          {orders.length > 0 ? (
            orders.map((order) => (
              <div key={order.order_id} className="bg-white rounded-2xl border border-[#e5e7ff] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-mono text-sm font-semibold" style={{ color: themeColor }}>
                      {order.order_id}
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleString("id-ID")}
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {order.items && Array.isArray(order.items) && (
                  <div className="space-y-2 mb-3">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm text-gray-600">
                        <span>{item.product_name || item.nama} x{item.quantity}</span>
                        <span className="font-medium">
                          Rp {((item.harga_jual || item.price || 0) * (item.quantity || 1)).toLocaleString("id-ID")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="text-lg font-bold" style={{ color: themeColor }}>
                    Rp {(order.total_amount || 0).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-2xl border border-[#e5e7ff] p-8 text-center text-gray-400">
              <i className="fa-solid fa-inbox text-4xl mb-3"></i>
              <p>Tidak ada pesanan ditemukan</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
