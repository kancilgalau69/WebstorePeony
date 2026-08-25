"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ResellerProvider, useReseller } from "@/components/ResellerProvider";
import OnboardingTour from "./OnboardingTour";

const navItems = [
  { href: "/dashboard", label: "Ringkasan", icon: "fa-chart-pie", exact: true },
  { href: "/dashboard/orders", label: "Riwayat Order", icon: "fa-receipt" },
  { href: "/dashboard/products", label: "Produk", icon: "fa-box" },
  { href: "/dashboard/pricing", label: "Harga Jual", icon: "fa-tags" },
  { href: "/dashboard/store-settings", label: "Pengaturan Toko", icon: "fa-gear" },
  { href: "/dashboard/balance", label: "Saldo & Komisi", icon: "fa-wallet" },
];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { reseller } = useReseller();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen flex bg-[#f6f7fb]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-[260px] bg-[#0f1229] text-white flex flex-col z-50 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Sidebar header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5c63f2] to-[#7b5cf7] flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-store text-sm"></i>
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm truncate">{reseller?.nama_toko || "Toko Reseller"}</h2>
              <p className="text-xs text-white/50 truncate">{reseller?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 sidebar-scroll overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              data-tour={`nav-${item.href}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive(item.href, item.exact)
                  ? "bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white shadow-lg shadow-[#5c63f2]/25"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
            >
              <i className={`fa-solid ${item.icon} w-5 text-center`}></i>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3 mb-3">
            <div className="text-xs text-white/50 mb-1">Total Komisi</div>
            <div className="text-lg font-bold text-emerald-400">
              Rp {(reseller?.total_komisi || 0).toLocaleString("id-ID")}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <i className="fa-solid fa-right-from-bracket w-5 text-center"></i>
            Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100 h-16 flex items-center px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden mr-3 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600"
          >
            <i className="fa-solid fa-bars text-lg"></i>
          </button>

          <div className="flex-1">
            <h1 className="text-lg font-bold text-[#141a33]">
              {navItems.find((n) => isActive(n.href, n.exact))?.label || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/store-settings"
              className="text-sm text-gray-500 hover:text-[#5c63f2] transition-colors"
            >
              <i className="fa-solid fa-gear mr-1"></i>
              <span className="hidden sm:inline">Pengaturan</span>
            </Link>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5c63f2] to-[#7b5cf7] flex items-center justify-center text-white text-sm font-bold">
              {reseller?.nama_toko?.charAt(0)?.toUpperCase() || "R"}
            </div>
          </div>
        </header>

        {/* Page content */}
          <main className="p-4 lg:p-6 animate-fadeIn">{children}</main>
          <OnboardingTour />
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ResellerProvider>
      <DashboardShell>{children}</DashboardShell>
    </ResellerProvider>
  );
}
