"use client";
import { useEffect, useState, useMemo } from "react";
import Pagination from "@/components/Pagination";

interface Product {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  harga_web: number;
  harga_bot: number;
  stok: number;
  ikon: string;
  aktif: boolean;
  deskripsi?: string;
  is_visible: boolean;
}

interface PricingData {
  margin_type: string;
  margin_value: number;
  harga_jual: number;
}

type ViewMode = "grid" | "list";
type FilterMode = "all" | "visible" | "hidden";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<Map<string, PricingData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchPricing();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function fetchProducts() {
    try {
      const res = await fetch(`/api/dashboard/products?_t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setProducts(json.products || []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPricing() {
    try {
      const res = await fetch(`/api/dashboard/pricing?_t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.products) {
        const map = new Map<string, PricingData>();
        json.products.forEach((p: any) => {
          map.set(p.id, {
            margin_type: p.margin_type,
            margin_value: p.margin_value,
            harga_jual: p.harga_jual,
          });
        });
        setPricing(map);
      }
    } catch {}
  }

  async function toggleVisibility(productId: string, visible: boolean) {
    // Optimistic update - toggle immediately for snappy UX
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, is_visible: visible } : p))
    );
    setSaving(productId);
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, is_visible: visible }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // Revert on failure
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, is_visible: !visible } : p))
        );
        setToast({ msg: json.error || "Gagal update visibility", type: "error" });
      }
    } catch {
      // Revert on error
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_visible: !visible } : p))
      );
      setToast({ msg: "Gagal update visibility", type: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function bulkToggle(visible: boolean) {
    if (selectedIds.size === 0) return;
    setSaving("bulk");
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: Array.from(selectedIds), is_visible: visible }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (selectedIds.has(p.id) ? { ...p, is_visible: visible } : p))
        );
        setSelectedIds(new Set());
        setBulkMode(false);
        setToast({ msg: `${selectedIds.size} produk berhasil diupdate`, type: "success" });
      }
    } catch {}
    finally { setSaving(null); }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  }

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.kategori).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = !search ||
        p.nama?.toLowerCase().includes(search.toLowerCase()) ||
        p.kode?.toLowerCase().includes(search.toLowerCase()) ||
        p.kategori?.toLowerCase().includes(search.toLowerCase());
      const matchVisibility = filterMode === "all" ||
        (filterMode === "visible" && p.is_visible) ||
        (filterMode === "hidden" && !p.is_visible);
      const matchCategory = categoryFilter === "all" || p.kategori === categoryFilter;
      return matchSearch && matchVisibility && matchCategory;
    });
  }, [products, search, filterMode, categoryFilter]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterMode, categoryFilter]);

  const paginatedProducts = useMemo(() => {
    if (pageSize === 0) return filteredProducts;
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const visibleCount = products.filter((p) => p.is_visible).length;
  const hiddenCount = products.filter((p) => !p.is_visible).length;

  function getSellingPrice(product: Product) {
    const p = pricing.get(product.id);
    if (p && p.harga_jual) return p.harga_jual;
    return Number(product.harga_web) || Number(product.harga_bot) || 0;
  }

  function formatPrice(n: number) {
    return n.toLocaleString("id-ID");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
        <div className="h-16 bg-white rounded-2xl animate-pulse border border-gray-100" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-36 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      </div>
    );
  }

  return (
    <div data-tour="products-root" className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div data-tour="products-stats" className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setFilterMode("all")}
          className={`rounded-2xl p-4 border text-center transition ${
            filterMode === "all" ? "border-[#5c63f2] bg-[#f4f5ff]" : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <div className="text-2xl font-bold text-[#141a33]">{products.length}</div>
          <div className="text-xs text-gray-500">Total Produk</div>
        </button>
        <button
          onClick={() => setFilterMode("visible")}
          className={`rounded-2xl p-4 border text-center transition ${
            filterMode === "visible" ? "border-emerald-400 bg-emerald-50" : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <div className="text-2xl font-bold text-emerald-600">{visibleCount}</div>
          <div className="text-xs text-gray-500">Ditampilkan</div>
        </button>
        <button
          onClick={() => setFilterMode("hidden")}
          className={`rounded-2xl p-4 border text-center transition ${
            filterMode === "hidden" ? "border-gray-300 bg-gray-50" : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <div className="text-2xl font-bold text-gray-400">{hiddenCount}</div>
          <div className="text-xs text-gray-500">Disembunyikan</div>
        </button>
      </div>

      {/* Controls */}
      <div data-tour="products-controls" className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div data-tour="products-search-input" className="relative flex-1">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, kode, atau kategori..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#5c63f2] focus:border-transparent outline-none"
            />
          </div>
          <div className="flex gap-2">
            {/* Category filter */}
            <select
              data-tour="products-category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-600 bg-white focus:ring-2 focus:ring-[#5c63f2] outline-none"
            >
              <option value="all">Semua Kategori</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            {/* View toggle */}
            <div data-tour="products-view-toggle" className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-2 text-xs ${viewMode === "grid" ? "bg-[#5c63f2] text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                <i className="fa-solid fa-grid-2"></i>
              </button>
              <button
                onClick={() => setViewMode("list")}
                data-tour="products-view-list-button"
                className={`px-3 py-2 text-xs ${viewMode === "list" ? "bg-[#5c63f2] text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                <i className="fa-solid fa-list"></i>
              </button>
            </div>
            {/* Bulk mode */}
            <button
              onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
              data-tour="products-bulk-toggle-button"
              className={`px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                bulkMode ? "bg-[#5c63f2] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <i className="fa-solid fa-check-double mr-1"></i>
              {bulkMode ? "Batal" : "Massal"}
            </button>
          </div>
        </div>

        {/* Bulk actions bar */}
        {bulkMode && selectedIds.size > 0 && (
          <div data-tour="products-bulk-actions" className="flex items-center gap-3 p-3 bg-[#f4f5ff] rounded-xl">
            <span className="text-sm text-gray-700 font-medium">{selectedIds.size} dipilih</span>
            <button onClick={() => bulkToggle(true)} disabled={saving === "bulk"}
              className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-50">
              <i className="fa-solid fa-eye mr-1"></i>Tampilkan
            </button>
            <button onClick={() => bulkToggle(false)} disabled={saving === "bulk"}
              className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 disabled:opacity-50">
              <i className="fa-solid fa-eye-slash mr-1"></i>Sembunyikan
            </button>
            <span className="ml-auto">
              <button onClick={selectAll} className="text-xs text-[#5c63f2] hover:underline">
                {selectedIds.size === filteredProducts.length ? "Batal Semua" : "Pilih Semua"}
              </button>
            </span>
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

      {/* Products */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl py-16 text-center text-gray-400 border border-gray-100">
          <i className="fa-solid fa-box-open text-4xl mb-3"></i>
          <p className="text-sm">Tidak ada produk ditemukan</p>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div data-tour="products-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {paginatedProducts.map((product) => {
            const sellingPrice = getSellingPrice(product);
            const basePrice = Number(product.harga_web) || Number(product.harga_bot) || 0;
            const hasMargin = sellingPrice > basePrice;

            return (
              <div
                key={product.id}
                className={`bg-white rounded-2xl border transition-all ${
                  product.is_visible ? "border-gray-100 hover:border-[#5c63f2]/30 hover:shadow-sm" : "border-gray-100 opacity-60"
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {bulkMode && (
                      <input data-tour="products-grid-card-checkbox" type="checkbox" checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="mt-1 w-4 h-4 rounded accent-[#5c63f2]" />
                    )}
                    <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100">
                      {product.ikon ? (
                        <img src={product.ikon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <i className="fa-solid fa-box text-gray-300 text-sm"></i>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-[#141a33] truncate">{product.nama}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-400 font-mono">{product.kode}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                        <span className="text-[10px] text-gray-400">{product.kategori}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleVisibility(product.id, !product.is_visible)}
                      disabled={saving === product.id}
                      data-tour="products-grid-visibility-toggle"
                      aria-label={product.is_visible ? "Sembunyikan" : "Tampilkan"}
                      className={`flex-shrink-0 inline-flex items-center w-[42px] h-[24px] rounded-full p-[2px] transition-colors duration-200 ${
                        product.is_visible ? "bg-emerald-500" : "bg-gray-300"
                      } ${saving === product.id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                    >
                      <span className={`inline-block w-[20px] h-[20px] bg-white rounded-full shadow transition-transform duration-200 ${
                        product.is_visible ? "translate-x-[18px]" : "translate-x-0"
                      }`} />
                    </button>
                  </div>

                  {/* Price & Stock */}
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-[#5c63f2]">Rp {formatPrice(sellingPrice)}</span>
                      {hasMargin && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Modal: Rp {formatPrice(basePrice)}
                          <span className="text-emerald-500 ml-1">+{formatPrice(sellingPrice - basePrice)}</span>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      product.stok > 5 ? "bg-emerald-50 text-emerald-600" :
                      product.stok > 0 ? "bg-yellow-50 text-yellow-600" :
                      "bg-red-50 text-red-600"
                    }`}>
                      {product.stok > 0 ? `${product.stok} stok` : "Habis"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div data-tour="products-list" className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {bulkMode && <th className="px-4 py-3 w-8"><input type="checkbox" onChange={selectAll} checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0} className="accent-[#5c63f2]" /></th>}
                <th className="px-4 py-3 text-left">Produk</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-right">Harga Jual</th>
                <th className="px-4 py-3 text-right">Modal</th>
                <th className="px-4 py-3 text-center">Stok</th>
                <th className="px-4 py-3 text-center">Tampil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedProducts.map((product) => {
                const sellingPrice = getSellingPrice(product);
                const basePrice = Number(product.harga_web) || Number(product.harga_bot) || 0;
                return (
                  <tr key={product.id} className={`${!product.is_visible ? "opacity-50" : "hover:bg-gray-50"}`}>
                    {bulkMode && (
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => toggleSelect(product.id)} className="accent-[#5c63f2]" />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 flex-shrink-0">
                          {product.ikon ? <img src={product.ikon} alt="" className="w-full h-full object-cover" /> : <i className="fa-solid fa-box text-gray-300 text-xs"></i>}
                        </div>
                        <div>
                          <div className="font-medium text-[#141a33] text-sm">{product.nama}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{product.kode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{product.kategori}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-[#5c63f2]">Rp {formatPrice(sellingPrice)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">Rp {formatPrice(basePrice)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        product.stok > 5 ? "bg-emerald-50 text-emerald-600" :
                        product.stok > 0 ? "bg-yellow-50 text-yellow-600" :
                        "bg-red-50 text-red-600"
                      }`}>{product.stok}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleVisibility(product.id, !product.is_visible)} disabled={saving === product.id}
                        aria-label={product.is_visible ? "Sembunyikan" : "Tampilkan"}
                        className={`inline-flex items-center w-[38px] h-[22px] rounded-full p-[2px] transition-colors duration-200 ${product.is_visible ? "bg-emerald-500" : "bg-gray-300"} ${saving === product.id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}>
                        <span className={`inline-block w-[18px] h-[18px] bg-white rounded-full shadow transition-transform duration-200 ${product.is_visible ? "translate-x-[16px]" : "translate-x-0"}`} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}


    </div>
  );
}
