"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useStore } from "@/components/StoreProvider";
import Link from "next/link";

interface OrderItem {
  product_name: string;
  product_code: string;
  quantity: number;
  price: number;
  item_data?: string | null;
  product_notes?: string | null;
}

interface OrderDetail {
  orderId: string;
  status: string;
  totalAmount: number;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  itemsReady: boolean;
}

export default function OrderSuccessPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id") || "";
  const { store } = useStore();
  const themeColor = store?.warna_tema || "#3B82F6";
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyMsg, setCopyMsg] = useState("");
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!orderId) return;
    fetchOrderDetail();
    const interval = setInterval(() => {
      if (orderDetail?.itemsReady) return;
      fetchOrderDetail();
    }, 4000);
    return () => clearInterval(interval);
  }, [orderId, orderDetail?.itemsReady]);

  async function fetchOrderDetail() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(`/api/store/${slug}/order-detail?order_id=${orderId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) setOrderDetail(data);
    } catch {}
    inFlightRef.current = false;
    setLoading(false);
  }

  function normalizeItemData(text: string): string {
    return text.replace(/\s*\|\|\s*/g, "\n").trim();
  }

  function getItemDataLines(itemData?: string | null): string[] {
    if (!itemData) return [];
    return String(itemData).split(/\r?\n/).map(line => normalizeItemData(line)).filter(Boolean);
  }

  function splitNotes(notes?: string | null): string[] {
    if (!notes) return [];
    return String(notes).split(/\r?\n|\|\|/).map(n => n.trim()).filter(Boolean);
  }

  async function copyToClipboard(text: string) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "-1000px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch { return false; }
  }

  function showCopyToast(msg: string) {
    setCopyMsg(msg);
    setTimeout(() => setCopyMsg(""), 2000);
  }

  async function copyAllItems() {
    if (!orderDetail) return;
    const lines: string[] = [
      `Order ID: ${orderDetail.orderId}`,
      `Total: Rp ${orderDetail.totalAmount.toLocaleString("id-ID")}`,
      "",
      "=== ITEM PEMBELIAN ===",
    ];
    orderDetail.items.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.product_name} (${item.product_code})`);
      lines.push(`   Qty: ${item.quantity}x @ Rp ${item.price.toLocaleString("id-ID")}`);
      const dataLines = getItemDataLines(item.item_data);
      if (dataLines.length > 0) {
        lines.push("   Detail Item:");
        dataLines.forEach((line, i) => lines.push(`   #${i + 1}: ${line}`));
      }
      const notes = splitNotes(item.product_notes);
      if (notes.length > 0) {
        lines.push("   Ketentuan:");
        notes.forEach(note => lines.push(`   - ${note}`));
      }
      lines.push("");
    });
    const ok = await copyToClipboard(lines.join("\n"));
    showCopyToast(ok ? "Semua item berhasil disalin!" : "Gagal menyalin");
  }

  function downloadAllItems() {
    if (!orderDetail) return;
    const lines: string[] = [
      `Order ID: ${orderDetail.orderId}`,
      `Nama: ${orderDetail.customerName}`,
      `Email: ${orderDetail.customerEmail}`,
      `Total: Rp ${orderDetail.totalAmount.toLocaleString("id-ID")}`,
      "",
      "=== ITEM PEMBELIAN ===",
      "",
    ];
    orderDetail.items.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.product_name} (${item.product_code})`);
      lines.push(`   Qty: ${item.quantity}x @ Rp ${item.price.toLocaleString("id-ID")}`);
      const dataLines = getItemDataLines(item.item_data);
      if (dataLines.length > 0) {
        lines.push("   Detail Item:");
        dataLines.forEach((line, i) => lines.push(`   #${i + 1}: ${line}`));
      }
      const notes = splitNotes(item.product_notes);
      if (notes.length > 0) {
        lines.push("   Ketentuan:");
        notes.forEach(note => lines.push(`   - ${note}`));
      }
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order-${orderDetail.orderId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasItems = orderDetail?.itemsReady;

  if (loading) {
    return (
      <div className="container mx-auto px-4 max-w-2xl py-12 text-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Memuat detail pesanan...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 max-w-2xl py-8 animate-fadeIn">
      {/* Copy toast */}
      {copyMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg">
          {copyMsg}
        </div>
      )}

      {/* Success Header */}
      <div className="bg-white rounded-2xl border border-emerald-200 p-6 mb-4 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          {hasItems ? (
            <i className="fa-solid fa-check text-2xl text-emerald-600"></i>
          ) : (
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {hasItems ? "Pembayaran Berhasil!" : "Memproses Pesanan..."}
        </h2>
        <p className="text-gray-500 text-sm mb-1">
          Order ID: <span className="font-mono font-semibold">{orderId}</span>
        </p>
        {!hasItems && (
          <p className="text-blue-600 text-xs mt-2">
            <i className="fa-solid fa-spinner fa-spin mr-1"></i>
            Sedang mempersiapkan item digital Anda...
          </p>
        )}
        {hasItems && orderDetail?.customerEmail && (
          <p className="text-gray-400 text-xs mt-1">
            Data juga dikirim ke <strong>{orderDetail.customerEmail}</strong>
          </p>
        )}
      </div>

      {/* Order Summary */}
      {orderDetail && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">
              <i className="fa-solid fa-receipt mr-1.5 text-gray-400"></i>Detail Pesanan
            </h3>
            {hasItems && (
              <div className="flex gap-2">
                <button onClick={copyAllItems}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition">
                  <i className="fa-solid fa-copy mr-1"></i>Copy
                </button>
                <button onClick={downloadAllItems}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition">
                  <i className="fa-solid fa-download mr-1"></i>Download
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {orderDetail.items.map((item, idx) => {
              const dataLines = getItemDataLines(item.item_data);
              const notesList = splitNotes(item.product_notes);
              return (
                <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* Item header */}
                  <div className="p-4 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.product_code} &bull; {item.quantity}x @ Rp {item.price.toLocaleString("id-ID")}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-700">
                        Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {/* Item Data */}
                  <div className="p-4">
                    {dataLines.length > 0 ? (
                      <div className="space-y-2">
                        {dataLines.map((line, i) => (
                          <div key={i}
                            className="flex items-start justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-emerald-700 font-medium mb-0.5">Item #{i + 1}</div>
                              <pre className="text-sm text-gray-900 font-mono whitespace-pre-wrap break-all">{line}</pre>
                            </div>
                            <button
                              onClick={async () => {
                                const ok = await copyToClipboard(line);
                                showCopyToast(ok ? "Disalin!" : "Gagal");
                              }}
                              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-700 transition"
                              title="Salin"
                            >
                              <i className="fa-solid fa-copy text-xs"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                        Data item sedang diproses...
                      </div>
                    )}

                    {/* Ketentuan Produk */}
                    {notesList.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-blue-100">
                        <p className="text-xs font-semibold text-blue-800 mb-1.5">
                          <i className="fa-solid fa-circle-info mr-1"></i>Ketentuan Produk
                        </p>
                        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                          {notesList.map((note, ni) => (
                            <li key={ni}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <span className="font-bold text-gray-900">Total Pembayaran</span>
            <span className="text-lg font-bold" style={{ color: themeColor }}>
              Rp {(orderDetail.totalAmount || 0).toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      )}

      {/* Important Notice */}
      {hasItems && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5"></i>
            <div className="text-sm text-amber-800">
              <strong>PENTING:</strong> Simpan data item di atas! Salin atau download sekarang.
            </div>
          </div>
        </div>
      )}

      {/* Back to Store */}
      <div className="text-center">
        <Link
          href={`/${slug}`}
          className="inline-block px-6 py-3 rounded-xl text-white font-semibold"
          style={{ backgroundColor: themeColor }}
        >
          <i className="fa-solid fa-arrow-left mr-2"></i>
          Kembali ke Toko
        </Link>
      </div>
    </div>
  );
}
