'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import { getSelectedIndex, type IndexId } from '@/lib/v2/indexSelection'
import type { DecisionCouncil } from '@/lib/v2/decisionCouncil'
import type { OpportunityWindow, UnderlyingScenario } from '@/lib/v2/opportunityModel'

type Platform = 'index' | 'stocks' | 'funds'

type StripDecision = {
  symbol: string
  council: DecisionCouncil
  scenario: UnderlyingScenario | null
  window: OpportunityWindow | null
}

const ACTION = {
  call: { label: 'شراء صاعد', color: '#34D399', icon: '▲' },
  put: { label: 'شراء هابط', color: '#F87171', icon: '▼' },
  wait: { label: 'انتظار', color: '#FBBF24', icon: '◌' },
  manage: { label: 'إدارة فرصة قائمة', color: '#60A5FA', icon: '◆' },
} as const

function bestCouncilRow(rows: any[]): any | null {
  const executable = rows.filter(row => {
    const action = row?.decisionCouncil?.action
    return (action === 'call' || action === 'put')
      && row?.best?.type === action
      && row?.best?.status === 'execute'
  })
  const candidates = executable.length ? executable : rows
  let best: any | null = null
  for (const row of candidates) {
    if (!row?.decisionCouncil) continue
    if (!best || Number(row.decisionCouncil.opportunityScore ?? 0) > Number(best.decisionCouncil.opportunityScore ?? 0)) best = row
  }
  return best
}

export const DecisionCouncilStrip = memo(function DecisionCouncilStrip({ platform }: { platform: Platform }) {
  const [index, setIndex] = useState<IndexId>('SPX')
  const [decision, setDecision] = useState<StripDecision | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (platform !== 'index') return
    setIndex(getSelectedIndex())
    const onIndex = (event: Event) => setIndex((event as CustomEvent<IndexId>).detail ?? 'SPX')
    window.addEventListener('taraqob:index', onIndex)
    return () => window.removeEventListener('taraqob:index', onIndex)
  }, [platform])

  const load = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true)
    try {
      if (platform === 'index') {
        const url = index === 'SPX'
          ? '/api/v2/recommend?mode=balanced'
          : `/api/v2/recommend?asset=funds&symbol=${index}&mode=balanced`
        const response = await fetch(url, { cache: 'no-store', signal })
        const data = response.ok ? await response.json() : null
        setDecision(data?.decisionCouncil ? {
          symbol: index,
          council: data.decisionCouncil,
          scenario: data.scenario ?? null,
          window: data.opportunityWindow ?? null,
        } : null)
        return
      }

      if (platform === 'stocks') {
        const response = await fetch('/api/v2/stocks/scan?mode=balanced', { cache: 'no-store', signal })
        const data = response.ok ? await response.json() : null
        const row = bestCouncilRow(Array.isArray(data?.results) ? data.results : [])
        if (row) window.dispatchEvent(new CustomEvent('taraqob:stocks-decision', { detail: row }))
        setDecision(row ? {
          symbol: row.symbol,
          council: row.decisionCouncil,
          scenario: row.scenario ?? null,
          window: row.opportunityWindow ?? null,
        } : null)
        return
      }

      const response = await fetch('/api/v2/funds/advisory', { cache: 'no-store', signal })
      const data = response.ok ? await response.json() : null
      const row = data?.leadingDecision ?? null
      setDecision(row?.decisionCouncil ? {
        symbol: row.symbol,
        council: row.decisionCouncil,
        scenario: row.scenario ?? null,
        window: row.opportunityWindow ?? null,
      } : null)
    } catch { /* نحتفظ بآخر قرار صحيح */ } finally {
      setRefreshing(false)
    }
  }, [index, platform])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    const every = platform === 'index' ? 15_000 : 60_000
    const interval = window.setInterval(() => { void load() }, every)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, platform])

  if (!decision) return null
  const action = ACTION[decision.council.action]
  return (
    <button type="button" onClick={() => void load()} className="flex h-10 w-full shrink-0 items-center gap-3 overflow-hidden px-4 text-right"
      style={{ background: `${action.color}0B`, borderBottom: `1px solid ${action.color}25` }}
      title="تحديث القرار المركزي">
      <span className="shrink-0 text-[11px] font-black" style={{ color: action.color }}>قرار ترقّب</span>
      <span className="shrink-0 font-mono text-xs font-black text-white">{decision.symbol}</span>
      <span className="shrink-0 text-xs font-black" style={{ color: action.color }}>{action.icon} {action.label}</span>
      <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black" style={{ color: action.color, background: `${action.color}14` }}>
        {decision.council.opportunityScore}/100
      </span>
      <span className="hidden shrink-0 text-[10px] text-slate-500 sm:inline">{decision.council.marketState.label}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">{decision.council.explanation}</span>
      <span className="shrink-0 text-[9px] text-slate-600">{refreshing ? 'يتحدّث…' : decision.window?.label ?? 'قرار حي'}</span>
    </button>
  )
})
