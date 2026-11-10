'use client'

import { useCallback, useEffect, useState } from 'react'

// قائمة مفضّلة الأسهم السعودية — محليّة لكل متصفّح (per-viewer).
const KEY = 'taraqob_saudi_favorites'

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function useSaudiFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    setFavorites(read())
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setFavorites(read()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback((symbol: string) => {
    setFavorites(prev => {
      const next = prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* تجاهل تعذّر الحفظ */ }
      return next
    })
  }, [])

  const isFavorite = useCallback((symbol: string) => favorites.includes(symbol), [favorites])

  return { favorites, toggle, isFavorite }
}
