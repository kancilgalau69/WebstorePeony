"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { useStore } from "@/components/StoreProvider";
import Link from "next/link";
import Script from "next/script";

export default function CheckoutPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const { store } = useStore();

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string>("");
  const [captchaReady, setCaptchaReady] = useState(false);
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);

  // Render (or re-render) the hCaptcha widget into captchaRef
  const renderCaptcha = () => {
    const hc = (window as any).hcaptcha;
    if (!hc || !captchaRef.current) return;

    // Remove old widget if present
    if (widgetIdRef.current !== null) {
      try {
        hc.remove(widgetIdRef.current);
      } catch {}
      widgetIdRef.current = null;
    }
    captchaRef.current.innerHTML = "";

    try {
      widgetIdRef.current = hc.render(captchaRef.current, {
        sitekey: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "",
        callback: (token: string) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      });
      setCaptchaReady(true);
    } catch (err) {
      console.warn("hCaptcha render error:", err);
    }
  };

  const resetCaptcha = () => {
    setCaptchaToken("");
    const hc = (window as any).hcaptcha;
    if (hc && widgetIdRef.current !== null) {
      try {
        hc.reset(widgetIdRef.current);
      } catch {}
    }
  };

  // On mount: reset state and render captcha
  useEffect(() => {
    setLoading(false);
    setCaptchaToken("");
    setCaptchaReady(false);
    widgetIdRef.current = null;

    // Poll briefly until window.hcaptcha appears, then render
    let attempts = 0;
    const tryRender = () => {
      if ((window as any).hcaptcha && captchaRef.current) {
        renderCaptcha();
        return;
      }
      attempts++;
      if (attempts < 30) setTimeout(tryRender, 200); // try for up to 6 seconds
    };
    setTimeout(tryRender, 100);

    return () => {
      attempts = 999;
    }; // cancel on unmount
  }, []);

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-50 rounded-full flex items-center justify-center">
            <i className="fa-solid fa-cart-shopping text-4xl text-gray-300"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Keranjang Kosong</h2>
          <Link href={`/${slug}`} className="text-blue-600 hover:text-blue-700 font-medium">
            Kembali ke Toko
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/store/${slug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            product_id: i.id,
            kode: i.kode,
            nama: i.nama,
            quantity: i.quantity,
            harga_jual: i.harga,
          })),
          ...form,
          captchaToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Checkout gagal");
        resetCaptcha();
        return;
      }

      // Redirect to payment or success
      if (data.payment_url) {
        clearCart();
        router.push(`/${slug}/order-pending?order_id=${data.order_id}&payment_url=${encodeURIComponent(data.payment_url)}`);
      } else {
        clearCart();
        router.push(`/${slug}/order-pending?order_id=${data.order_id}`);
      }
    } catch (err: any) {
      setError("Terjadi kesalahan. Coba lagi.");
      resetCaptcha();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script
        src="https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off"
        strategy="afterInteractive"
        onLoad={() => {
          // First-time load: render captcha if ref is ready
          if (captchaRef.current && !(widgetIdRef.current !== null)) {
            renderCaptcha();
          }
        }}
      />

      <div className="container mx-auto px-4 max-w-6xl py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <i className="fa-solid fa-lock text-blue-600"></i>
            Checkout
          </h1>
          <p className="text-gray-600">Lengkapi data untuk menyelesaikan pembelian</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            {/* Customer Data */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Data Pembeli</h3>
              <p className="text-sm text-gray-500 mb-6">Isi data dengan lengkap dan benar</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6 flex items-start gap-2">
                  <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    placeholder="Masukkan nama lengkap"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.customer_email}
                    onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    placeholder="email@contoh.com"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <i className="fa-solid fa-info-circle"></i>
                    Produk digital akan dikirim ke email ini
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    No. WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    placeholder="08xxxxxxxxxx"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Security Verification */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Verifikasi Keamanan</h3>
              <p className="text-sm text-gray-500 mb-6">Selesaikan verifikasi untuk melanjutkan</p>
              
              <div ref={captchaRef} className="mb-3" />
              
              <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                <i className="fa-solid fa-shield-halved text-blue-600 mt-0.5"></i>
                <span>Verifikasi ini membantu melindungi transaksi Anda dari aktivitas mencurigakan</span>
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Produk yang Dipesan</h3>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4">
                    <div className="w-14 h-14 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                      {item.ikon ? (
                        <img src={item.ikon} alt={item.nama} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <i className="fa-solid fa-box text-gray-300"></i>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{item.nama}</div>
                      <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                    </div>
                    <div className="font-bold text-blue-600">
                      Rp {(item.harga * item.quantity).toLocaleString("id-ID")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (!captchaToken && captchaReady)}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Memproses Pembayaran...</span>
                </>
              ) : !captchaToken && captchaReady ? (
                <>
                  <i className="fa-solid fa-lock"></i>
                  <span>Selesaikan Verifikasi Dulu</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-qrcode"></i>
                  <span>Bayar Rp {totalPrice.toLocaleString("id-ID")}</span>
                </>
              )}
            </button>
          </form>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Ringkasan Pesanan</h3>
              
              <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} item)
                  </span>
                  <span className="font-medium text-gray-900">
                    Rp {totalPrice.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Biaya Admin</span>
                  <span className="font-medium text-green-600">Gratis</span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-bold text-gray-900">Total Pembayaran</span>
                <span className="text-2xl font-bold text-blue-600">
                  Rp {totalPrice.toLocaleString("id-ID")}
                </span>
              </div>

              {/* Payment Info */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <i className="fa-solid fa-qrcode text-blue-600 text-xl mt-0.5"></i>
                  <div>
                    <div className="font-semibold text-blue-900 text-sm mb-1">Pembayaran QRIS</div>
                    <div className="text-xs text-blue-700">
                      Scan QR code dengan aplikasi e-wallet atau mobile banking Anda
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <i className="fa-solid fa-shield-halved text-green-600 text-lg mt-0.5"></i>
                  <div className="text-xs text-gray-700">
                    <div className="font-semibold mb-1">Transaksi Aman</div>
                    <div>Produk akan dikirim otomatis ke email setelah pembayaran berhasil diverifikasi</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
