'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export type LiveQuote = {
  symbol: string
  price: number
  prevClose: number
  high: number
  low: number
  changePct: number
  source: string
  asOf: string | null
  status: 'live' | 'fallback'
  bid?: number | null
  ask?: number | null
  mid?: number | null
  last?: number | null
}

type LiveQuotesState = {
  quotes: Record<string, LiveQuote | null>
  generatedAt: string | null
  loading: boolean
}

export function useLiveQuotes(symbols: string[], pollMs = 2_000): LiveQuotesState {
  const requestedSymbols = symbols.join(',')
  const symbolsKey = useMemo(
    () => [...new Set(symbols.map(value => value.trim().toUpperCase()).filter(Boolean))].sort().join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestedSymbols],
  )
  const [state, setState] = useState<LiveQuotesState>({ quotes: {}, generatedAt: null, loading: true })

  const load = useCallback(async () => {
    if (!symbolsKey || document.visibilityState === 'hidden') return
    try {
      const response = await fetch(`/api/v2/live-quotes?symbols=${encodeURIComponent(symbolsKey)}&_=${Date.now()}`, {
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok && data?.success) {
        setState({ quotes: data.quotes ?? {}, generatedAt: data.generatedAt ?? null, loading: false })
      }
    } catch {
      setState(current => ({ ...current, loading: false }))
    }
  }, [symbolsKey])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { void load() }, Math.max(1_000, pollMs))
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, pollMs])

  return state
}

export function useLiveQuote(symbol: string, pollMs = 2_000) {
  const key = symbol.trim().toUpperCase()
  const state = useLiveQuotes(key ? [key] : [], pollMs)
  return { ...state, quote: key ? state.quotes[key] ?? null : null }
}
