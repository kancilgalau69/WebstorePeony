'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface FavoritesContextType {
  favorites: string[]              // product IDs
  isFavorite: (productId: string) => boolean
  toggleFavorite: (productId: string) => void
  count: number
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined)

const STORAGE_KEY = 'peony_favorites'

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const arr = JSON.parse(saved)
        if (Array.isArray(arr)) setFavorites(arr.filter((x) => typeof x === 'string'))
      }
    } catch {}
  }, [])

  // Persist whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
    } catch {}
  }, [favorites])

  const isFavorite = useCallback((productId: string) => favorites.includes(productId), [favorites])

  const toggleFavorite = useCallback((productId: string) => {
    if (!productId) return
    setFavorites((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [productId, ...prev]
    )
  }, [])

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, count: favorites.length }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) {
    // Safe fallback so components don't crash if used outside provider
    return {
      favorites: [] as string[],
      isFavorite: () => false,
      toggleFavorite: () => {},
      count: 0,
    }
  }
  return ctx
}
