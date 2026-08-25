"use client";
import { useEffect, useState, useMemo } from "react";
import Pagination from "@/components/Pagination";

interface PricingProduct {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  harga_web: number;
  margin_type: "fixed" | "percent";
  margin_value: number;
  harga_jual: number;
}

export default function PricingPage() {
  const [products, setProducts] = useState<PricingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bulkMarginType, setBulkMarginType] = useState<"fixed" | "percent">("fixed");
  const [bulkMarginValue, setBulkMarginValue] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMarginType, setEditMarginType] = useState<"fixed" | "percent">("fixed");
  const [editMarginValue, setEditMarginValue] = useState("");

  useEffect(() => {
    fetchPricing();
  }, []);

  async function fetchPricing() {
    try {
      const res = await fetch(`/api/dashboard/pricing?_t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setProducts(json.products || []);
    } catch (err) {
      console.error("Failed to fetch pricing:", err);
    } finally {
      setLoading(false);
    }
  }

  async function savePricing(productId: string, marginType: string, marginValue: number) {
    setSaving(productId);
    try {
      const res = await fetch("/api/dashboard/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, margin_type: marginType, margin_value: marginValue }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Update local state immediately with verified data from server
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  margin_type: json.margin_type || marginType,
                  margin_value: Number(json.margin_value) || marginValue,
                  harga_jual: Number(json.harga_jual) || p.harga_jual,
                }
              : p
          )
        );
        setEditingId(null);
      } else {
        console.error("Save failed:", json.error);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(null);
    }
  }

  async function saveBulkPricing() {
    if (!bulkMarginValue) return;
    setBulkSaving(true);
    try {
      const res = await fetch("/api/dashboard/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: true,
          margin_type: bulkMarginType,
          margin_value: parseFloat(bulkMarginValue),
        }),
      });
      if (res.ok) {
        await fetchPricing();
        setShowBulk(false);
        setBulkMarginValue("");
      }
    } catch (err) {
      console.error("Bulk save failed:", err);
    } finally {
      setBulkSaving(false);
    }
  }

  function startEdit(product: PricingProduct) {
    setEditingId(product.id);
    setEditMarginType(product.margin_type || "fixed");
    setEditMarginValue(String(product.margin_value || 0));
  }

  function calculatePrice(basePrice: number, type: string, value: number) {
    if (type === "percent") return basePrice + (basePrice * value) / 100;
    return basePrice + value;
  }

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredProducts = products.filter(
    (p) =>
      p.nama?.toLowerCase().includes(search.toLowerCase()) ||
      p.kode?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => { setCurrentPage(1); }, [search]);

  const paginatedProducts = useMemo(() => {
    if (pageSize === 0) return filteredProducts;
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  return (
    <div data-tour="pricing-root" className="space-y-6">
      {/* Info */}
      <div data-tour="pricing-info-banner" className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3 text-sm text-blue-700 flex items-start gap-2">
        <i className="fa-solid fa-circle-info mt-0.5"></i>
        <span>
          Atur margin harga jual Anda. Harga jual = Harga Pusat + Margin. Anda bisa mengatur secara satuan atau massal.
        </span>
      </div>

      {/* Controls */}
      <div data-tour="pricing-controls" className="bg-white rounded-2xl p-4 border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 w-full">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={() => setShowBulk(!showBulk)}
            data-tour="pricing-bulk-toggle-button"
            className={`px-4 py-2.5 rounded-xl text-xs font-medium transition ${
              showBulk ? "bg-[#5c63f2] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <i className="fa-solid fa-sliders mr-1"></i>
            Atur Massal
          </button>
        </div>

        {/* Bulk pricing form */}
        {showBulk && (
          <div data-tour="pricing-bulk-form" className="mt-4 p-4 bg-[#f4f5ff] rounded-xl border border-[#e5e7ff]">
            <h4 className="text-sm font-semibold text-[#141a33] mb-3">Atur Margin Massal</h4>
            <p className="text-xs text-gray-500 mb-3">
              Margin ini akan diterapkan ke SEMUA produk sekaligus.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={bulkMarginType}
                onChange={(e) => setBulkMarginType(e.target.value as any)}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
              >
                <option value="fixed">Nominal (Rp)</option>
                <option value="percent">Persentase (%)</option>
              </select>
              <input
                type="number"
                value={bulkMarginValue}
                onChange={(e) => setBulkMarginValue(e.target.value)}
                placeholder={bulkMarginType === "fixed" ? "Contoh: 5000" : "Contoh: 10"}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] outline-none"
                min="0"
              />
              <button
                onClick={saveBulkPricing}
                disabled={bulkSaving || !bulkMarginValue}
                className="px-6 py-2.5 bg-[#5c63f2] text-white rounded-xl text-sm font-medium hover:bg-[#4f55e0] transition disabled:opacity-50"
              >
                {bulkSaving ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  "Terapkan Semua"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pagination top */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredProducts.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

      {/* Pricing Table */}
      <div data-tour="pricing-table-card" className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
            <p className="text-sm">Memuat data...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Produk</th>
                  <th className="px-6 py-3 text-right">Harga Pusat</th>
                  <th className="px-6 py-3 text-center">Tipe Margin</th>
                  <th className="px-6 py-3 text-right">Nilai Margin</th>
                  <th className="px-6 py-3 text-right">Harga Jual</th>
                  <th className="px-6 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedProducts.map((product) => (
                  <tr key={product.id} data-tour="pricing-row" className="table-row-hover">
                    <td className="px-6 py-3">
                      <div className="font-medium text-[#141a33]">{product.nama}</div>
                      <div className="text-xs text-gray-400 font-mono">{product.kode}</div>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      Rp {(product.harga_web || 0).toLocaleString("id-ID")}
                    </td>

                    {editingId === product.id ? (
                      <>
                        <td data-tour="pricing-row-edit-form" className="px-6 py-3 text-center">
                          <select
                            value={editMarginType}
                            onChange={(e) => setEditMarginType(e.target.value as any)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#5c63f2] outline-none"
                          >
                            <option value="fixed">Nominal</option>
                            <option value="percent">Persen</option>
                          </select>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <input
                            type="number"
                            value={editMarginValue}
                            onChange={(e) => setEditMarginValue(e.target.value)}
                            className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right focus:ring-2 focus:ring-[#5c63f2] outline-none"
                            min="0"
                            autoFocus
                          />
                        </td>
                        <td data-tour="pricing-edit-selling-price-preview" className="px-6 py-3 text-right font-semibold text-[#5c63f2]">
                          Rp{" "}
                          {calculatePrice(
                            product.harga_web || 0,
                            editMarginType,
                            parseFloat(editMarginValue) || 0
                          ).toLocaleString("id-ID")}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() =>
                                savePricing(product.id, editMarginType, parseFloat(editMarginValue) || 0)
                              }
                              disabled={saving === product.id}
                              className="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg text-xs hover:bg-emerald-600 disabled:opacity-50"
                            >
                              {saving === product.id ? (
                                <i className="fa-solid fa-spinner fa-spin"></i>
                              ) : (
                                <i className="fa-solid fa-check"></i>
                              )}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-300"
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-3 text-center">
                          {product.margin_value > 0 ? (
                            <span className="px-2 py-1 bg-emerald-50 rounded-lg text-xs text-emerald-600">
                              {product.margin_type === "percent" ? "Persen" : "Nominal"}
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-50 rounded-lg text-xs text-gray-400">
                              Default
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {product.margin_value > 0 ? (
                            <span className="text-gray-700 font-medium">
                              {product.margin_type === "percent"
                                ? `+${product.margin_value}%`
                                : `+Rp ${product.margin_value.toLocaleString("id-ID")}`}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Belum diatur</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right font-semibold text-[#5c63f2]">
                          Rp {(product.harga_jual || product.harga_web || 0).toLocaleString("id-ID")}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <button
                            onClick={() => startEdit(product)}
                            data-tour="pricing-row-edit-button"
                            className="px-3 py-1.5 bg-[#f4f5ff] text-[#5c63f2] rounded-lg text-xs font-medium hover:bg-[#e8e9ff] transition"
                          >
                            <i className="fa-solid fa-pen mr-1"></i> Edit
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <i className="fa-solid fa-tags text-4xl mb-3"></i>
            <p>Tidak ada produk ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
}
