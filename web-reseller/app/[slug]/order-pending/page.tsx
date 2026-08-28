"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useStore } from "@/components/StoreProvider";
import Link from "next/link";

interface OrderItem {
  product_name: string;
  product_code: string;
  quantity: number;
  price: number;
  item_data?: string | null;
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

export default function OrderPendingPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order_id") || "";
  const paymentUrl = searchParams.get("payment_url") || "";
  const qrStringParam = searchParams.get("qr_string") || "";
  const amountParam = searchParams.get("amount") || "";
  const adminFeeParam = searchParams.get("admin_fee") || "";
  const subtotalParam = searchParams.get("subtotal") || "";
  const { store } = useStore();
  const themeColor = store?.warna_tema || "#3B82F6";
  const [status, setStatus] = useState("pending");
  const [checking, setChecking] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);

  // Prefer the raw QRIS payload (renders reliably); fall back to a QR image URL.
  const qrImageSrc = qrStringParam
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrStringParam)}`
    : paymentUrl;

  const [countdown, setCountdown] = useState(15 * 60); // 15 minutes
  const inFlightRef = useRef(false);
  const createdAtRef = useRef(Date.now());

  // Countdown timer
  useEffect(() => {
    if (status !== "pending") return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - createdAtRef.current) / 1000);
      const remaining = Math.max(0, 15 * 60 - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) {
        setStatus("expired");
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  // Poll payment status
  useEffect(() => {
    if (!orderId) return;
    if (status === "cancelled" || status === "expired" || status === "completed") return;

    // Check immediately
    checkPaymentStatus();

    const interval = setInterval(() => {
      // Stop polling once the QR has expired.
      const elapsed = Math.floor((Date.now() - createdAtRef.current) / 1000);
      if (elapsed >= 15 * 60) {
        setStatus("expired");
        clearInterval(interval);
        return;
      }
      if (inFlightRef.current) return;
      checkPaymentStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [orderId, slug, status]);

  // Fetch order detail on mount (for items/total display while pending)
  useEffect(() => {
    if (!orderId) return;
    fetchOrderDetail();
  }, [orderId]);



  async function checkPaymentStatus() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(`/api/store/${slug}/order-status?order_id=${orderId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.status === "completed") {
        // Redirect to success page
        router.push(`/${slug}/order-success?order_id=${orderId}`);
        return;
      } else if (data.status === "cancelled" || data.status === "expired") {
        setStatus(data.status);
      }
    } catch {}
    inFlightRef.current = false;
  }

  async function fetchOrderDetail() {
    try {
      const res = await fetch(`/api/store/${slug}/order-detail?order_id=${orderId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setOrderDetail(data);
        if (data.status === "processing") {
          setStatus("processing");
        }
      }
    } catch {}
  }

  async function checkStatus() {
    setChecking(true);
    await checkPaymentStatus();
    if (status === "completed") {
      await fetchOrderDetail();
    }
    setChecking(false);
  }



  // --- CANCELLED / EXPIRED ---
  if (status === "cancelled" || status === "expired") {
    return (
      <div className="container mx-auto px-4 max-w-lg py-16 text-center animate-fadeIn">
        <div className="bg-white rounded-2xl border border-red-200 p-8">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-xmark text-3xl text-red-600"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {status === "cancelled" ? "Order Dibatalkan" : "Order Kedaluwarsa"}
          </h2>
          <p className="text-gray-500 mb-6">Silakan buat order baru.</p>
          <Link
            href={`/${slug}`}
            className="px-6 py-3 rounded-xl text-white font-semibold inline-block"
            style={{ backgroundColor: themeColor }}
          >
            Kembali ke Toko
          </Link>
        </div>
      </div>
    );
  }

  // (completed state now redirects to /order-success)

  // --- PENDING (waiting for payment) ---
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const isUrgent = countdown < 120;

  function downloadQris() {
    if (!qrImageSrc) return;
    const a = document.createElement("a");
    a.href = qrImageSrc;
    a.download = `QRIS-${orderId}.png`;
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="container mx-auto px-4 max-w-lg py-6 animate-fadeIn space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Menunggu Pembayaran</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isUrgent ? "bg-red-100 text-red-700 animate-pulse" : "bg-yellow-100 text-yellow-700"
          }`}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
        <p className="text-gray-500 text-xs">
          Order ID: <span className="font-mono font-semibold text-gray-700">{orderId}</span>
        </p>
      </div>

      {/* QRIS */}
      {qrImageSrc && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
          <p className="text-sm font-medium text-gray-700 mb-3">Scan QR Code untuk membayar</p>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 inline-block">
            <img src={qrImageSrc} alt="QRIS Payment" className="w-56 h-56 mx-auto" />
          </div>
          <div className="mt-3">
            <button
              onClick={downloadQris}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <i className="fa-solid fa-download"></i>
              Download QR
            </button>
          </div>
        </div>
      )}

      {/* Total Payment */}
      {amountParam && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-1.5">
          {subtotalParam && adminFeeParam && Number(adminFeeParam) > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="text-gray-900">Rp {Number(subtotalParam).toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Biaya Admin (kode unik)</span>
                <span className="text-gray-900">Rp {Number(adminFeeParam).toLocaleString("id-ID")}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-sm font-bold text-gray-900">Total Pembayaran</span>
            <span className="text-xl font-bold" style={{ color: themeColor }}>
              Rp {Number(amountParam).toLocaleString("id-ID")}
            </span>
          </div>
          {adminFeeParam && Number(adminFeeParam) > 0 && (
            <p className="text-[11px] text-gray-500 pt-1">
              ⚠️ Bayar tepat sesuai nominal di atas (termasuk kode unik) agar pembayaran terverifikasi otomatis.
            </p>
          )}
        </div>
      )}

      {/* Order Summary */}
      {orderDetail && orderDetail.items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            <i className="fa-solid fa-receipt mr-1.5 text-gray-400"></i>
            Ringkasan Pesanan
          </h3>
          <div className="space-y-2">
            {orderDetail.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <span className="text-sm text-gray-800">{item.product_name}</span>
                  <span className="text-xs text-gray-400 ml-1">x{item.quantity}</span>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
            <span className="text-sm font-bold text-gray-900">Total</span>
            <span className="text-base font-bold" style={{ color: themeColor }}>
              Rp {(orderDetail.totalAmount || 0).toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      )}

      {/* Payment Instructions */}
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
        <h4 className="text-xs font-bold text-blue-800 mb-2">
          <i className="fa-solid fa-circle-info mr-1"></i>
          Cara Pembayaran
        </h4>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Buka aplikasi e-wallet atau mobile banking Anda</li>
          <li>Pilih menu <strong>Scan QR / QRIS</strong></li>
          <li>Scan QR code di atas atau gunakan QR yang sudah didownload</li>
          <li>Konfirmasi pembayaran sesuai total</li>
          <li>Halaman ini otomatis update setelah pembayaran berhasil</li>
        </ol>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={checkStatus}
          disabled={checking}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition"
        >
          {checking ? (
            <span><i className="fa-solid fa-spinner fa-spin mr-1.5"></i>Mengecek...</span>
          ) : (
            <span><i className="fa-solid fa-rotate mr-1.5"></i>Cek Status</span>
          )}
        </button>
        <Link
          href={`/${slug}`}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition"
        >
          <i className="fa-solid fa-xmark mr-1.5"></i>Batalkan
        </Link>
      </div>

      {/* Auto update notice */}
      <p className="text-center text-[10px] text-gray-400">
        Halaman otomatis refresh setiap 5 detik untuk mengecek status pembayaran
      </p>
    </div>
  );
}
