"use client";
import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useRouter } from "next/navigation";

export interface Reseller {
  id: string;
  nama_toko: string;
  slug: string;
  email: string;
  phone: string;
  logo_url: string | null;
  deskripsi: string | null;
  alamat: string | null;
  whatsapp: string | null;
  instagram: string | null;
  warna_tema: string;
  is_active: boolean;
  saldo: number;
  total_penjualan: number;
  total_komisi: number;
}

const ResellerContext = createContext<{ reseller: Reseller | null; refresh: () => void }>({
  reseller: null,
  refresh: () => {},
});

export function useReseller() {
  return useContext(ResellerContext);
}

export function ResellerProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [reseller, setReseller] = useState<Reseller | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchReseller() {
    try {
      const res = await fetch(`/api/auth/me?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setReseller(data.reseller);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReseller();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7fb]">
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-[#5c63f2] mb-4"></i>
          <p className="text-gray-500">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <ResellerContext.Provider value={{ reseller, refresh: fetchReseller }}>
      {children}
    </ResellerContext.Provider>
  );
}
