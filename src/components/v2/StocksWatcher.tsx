'use client'

import { useEffect } from 'react'
import { showBrowserNotificationOnce } from '@/lib/v2/browserNotifications'

const SENT_KEY = 'taraqob_stocks_alerted_v1'

function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function alreadySent(key: string): boolean {
  try {
    const sent: Record<string, string> = JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}')
    return sent[key] === today()
  } catch { return false }
}

function markSent(key: string) {
  try {
    const sent: Record<string, string> = JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}')
    sent[key] = today()
    localStorage.setItem(SENT_KEY, JSON.stringify(sent))
  } catch { /* تجاهل */ }
}

function browserNotice(title: string, body: string) {
  showBrowserNotificationOnce(title, body)
}

async function saveBell(key: string, title: string, body: string, symbol: string) {
  const response = await fetch('/api/v2/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'signal',
      title,
      body,
      url: `/stocks/analyze?symbol=${encodeURIComponent(symbol)}`,
      dedupe_key: `${today()}|${key}`,
    }),
  })
  if (response.ok) window.dispatchEvent(new Event('taraqob:notifications-changed'))
}

export function StocksWatcher() {
  useEffect(() => {
    const ask = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }
      window.removeEventListener('pointerdown', ask)
    }
    window.addEventListener('pointerdown', ask)

    async function handleDecision(event: Event) {
      try {
        const row = (event as CustomEvent<any>).detail
        const action = row?.decisionCouncil?.action
        if ((action !== 'call' && action !== 'put')
          || row?.best?.type !== action
          || row?.best?.status !== 'execute'
          || Number(row?.decisionCouncil?.opportunityScore ?? 0) < 70) return
        const key = `stock-${row.symbol}-${row.best.type}-${row.best.strike}-${row.best.expiration}`
        if (alreadySent(key)) return
        const direction = row.best.type === 'put' ? 'هبوط' : 'صعود'
        const title = `فرصة دخول — ${row.symbol}`
        const body = `${direction} · عقد ${row.best.strike} · درجة ${row.decisionCouncil.opportunityScore} · الهدف ${row.scenario?.target1?.value ?? '—'} · الإلغاء ${row.scenario?.invalidation?.value ?? '—'} · ${row.opportunityWindow?.label ?? ''}`
        browserNotice(title, body)
        await saveBell(key, title, body, row.symbol).catch(() => {})
        markSent(key)
      } catch { /* يعاد التقييم عند وصول القرار القادم */ }
    }

    window.addEventListener('taraqob:stocks-decision', handleDecision)
    return () => {
      window.removeEventListener('taraqob:stocks-decision', handleDecision)
      window.removeEventListener('pointerdown', ask)
    }
  }, [])

  return null
}
