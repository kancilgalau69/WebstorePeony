"use client";
import { createContext, useContext, ReactNode } from "react";

export interface StoreInfo {
  id: string;
  nama_toko: string;
  slug: string;
  deskripsi: string;
  logo_url: string;
  whatsapp: string;
  instagram: string;
  warna_tema: string;
}

const StoreContext = createContext<{ store: StoreInfo | null }>({ store: null });

export function useStore() {
  return useContext(StoreContext);
}

export function StoreProvider({ store, children }: { store: StoreInfo | null; children: ReactNode }) {
  return (
    <StoreContext.Provider value={{ store }}>
      {children}
    </StoreContext.Provider>
  );
}
