'use client'

// ── مراقب التنبيهات — المنصة تناديك بدل أن تراقبها ──────────────────────────
// يعمل بصمت في الخلفية على كل الصفحات (مُركّب في V2Shell) ويصدر إشعاراً حين:
//   1. تظهر فرصة قوية (A+/A) قابلة للتنفيذ
//   2. يكسر السعر نقطة انقلاب جاما (تغيّر سلوك السوق)
//   3. تحتاج صفقة محفوظة (مساعد الخروج) إلى قرار: اخرج / أدر ربحك
// لا تكرار: كل تنبيه يُرسل مرة واحدة في اليوم لنفس السبب.

import { useEffect, useRef, useState } from 'react'
import { getSelectedIndex } from '@/lib/v2/indexSelection'
import {
  buildEntryNotification,
  buildExitNotification,
  riyadhDateTime,
  type BellNotification,
} from '@/lib/v2/notificationEvents'

const POLL_MS = 15_000   // متابعة قريبة من اللحظة أثناء السوق
const BELL_SENT_KEY = 'taraqob_bell_alerted_v1'
const SIGNAL_LOGGED_KEY = 'taraqob_signal_logged_v1'
const RECOMMENDED_POSITIONS_KEY = 'taraqob_recommended_positions_v1'

// صفقة محفوظة للمتابعة التلقائية
export interface WatchedPosition {
  strike: number
  type: 'call' | 'put'
  entry: number
  expiry?: string
  underlying?: string
  addedAt: string
  source?: 'manual' | 'recommendation'
}

export function loadPositions(): WatchedPosition[] {
  try { return JSON.parse(localStorage.getItem('taraqob_positions') ?? '[]') } catch { return [] }
}
export function savePositions(list: WatchedPosition[]) {
  try { localStorage.setItem('taraqob_positions', JSON.stringify(list)) } catch { /* تجاهل */ }
}

function loadRecommendedPositions(): WatchedPosition[] {
  try { return JSON.parse(localStorage.getItem(RECOMMENDED_POSITIONS_KEY) ?? '[]') } catch { return [] }
}

function watchRecommendation(contract: {
  type: 'call' | 'put'
  strike: number
  expiration?: string
  mid?: number
  ask?: number
  strategy?: { entryBalanced?: number }
}, underlying?: string) {
  const entry = contract.strategy?.entryBalanced ?? contract.mid ?? contract.ask
  if (!entry || !Number.isFinite(entry)) return

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const current = loadRecommendedPositions().filter(pos => !pos.expiry || pos.expiry >= today)
  const alreadyWatched = current.some(pos =>
    pos.strike === contract.strike && pos.type === contract.type && pos.expiry === contract.expiration
    && (pos.underlying ?? 'SPX') === (underlying ?? 'SPX'),
  )
  if (alreadyWatched) return

  const next = [...current, {
    strike: contract.strike,
    type: contract.type,
    entry,
    expiry: contract.expiration,
    underlying: underlying ?? 'SPX',
    addedAt: new Date().toISOString(),
    source: 'recommendation',
  }].slice(-5)
  try { localStorage.setItem(RECOMMENDED_POSITIONS_KEY, JSON.stringify(next)) } catch { /* تجاهل */ }
}

function marketOpenNow(): boolean {
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay(); const t = ny.getHours() * 60 + ny.getMinutes()
  return day >= 1 && day <= 5 && t >= 9 * 60 + 30 && t < 16 * 60
}

// إشعار مع منع تكرار (نفس المفتاح لا يتكرر في نفس اليوم)
function notifyOnce(key: string, title: string, body: string) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const fullKey = `${today}|${key}`
  try {
    const sent: string[] = JSON.parse(localStorage.getItem('taraqob_alerted') ?? '[]')
    if (sent.includes(fullKey)) return
    // نحتفظ بآخر 100 مفتاح فقط
    localStorage.setItem('taraqob_alerted', JSON.stringify([...sent.slice(-99), fullKey]))
  } catch { /* تجاهل */ }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/favicon.ico', dir: 'rtl', lang: 'ar' }) } catch { /* تجاهل */ }
  }
}

function dailyKey(key: string): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  return `${today}|${key}`
}

function hasBeenSent(storageKey: string, key: string): boolean {
  try {
    const sent: string[] = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    return sent.includes(key)
  } catch { return false }
}

function rememberSent(storageKey: string, key: string) {
  try {
    const sent: string[] = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!sent.includes(key)) {
      localStorage.setItem(storageKey, JSON.stringify([...sent.slice(-99), key]))
    }
  } catch { /* تجاهل */ }
}

async function saveBellOnce(key: string, notice: BellNotification) {
  const fullKey = dailyKey(key)
  if (hasBeenSent(BELL_SENT_KEY, fullKey)) return

  try {
    const response = await fetch('/api/v2/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...notice, dedupe_key: fullKey }),
    })
    if (!response.ok) return
    const result = await response.json()
    if (!result.success) return

    rememberSent(BELL_SENT_KEY, fullKey)
    window.dispatchEvent(new Event('taraqob:notifications-changed'))
  } catch { /* يعاد تلقائياً في الدورة القادمة */ }
}

async function logSignalOnce(key: string, contract: any, market: any, scenario?: any, opportunityWindow?: any) {
  const fullKey = dailyKey(key)
  if (hasBeenSent(SIGNAL_LOGGED_KEY, fullKey)) return

  try {
    const response = await fetch('/api/v2/signals/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract_symbol: contract.symbol,
        contract_type: contract.type,
        strike: contract.strike,
        expiry: contract.expiration,
        total_score: contract.score,
        grade: contract.grade,
        entry_price: contract.strategy?.entryBalanced ?? contract.mid ?? contract.ask ?? null,
        entry_bid: contract.bid ?? null,
        entry_ask: contract.ask ?? null,
        contract_stop_price: contract.execution?.hardProtectionPrice ?? null,
        contract_target_price: null,
        stop_loss_level: scenario?.invalidation?.value ?? null,
        target_level: scenario?.target1?.value ?? null,
        target2_level: scenario?.target2?.value ?? null,
        opportunity_window: opportunityWindow?.label ?? null,
        valid_until: opportunityWindow?.validUntil ?? null,
        risk_reward_ratio: scenario
          ? Math.abs((scenario.target1.value - scenario.entry) / (scenario.entry - scenario.invalidation.value))
          : null,
        spx_at_signal: market?.spx?.price ?? null,
        reason: `${contract.reason ?? ''}${opportunityWindow?.label ? ` — نافذة الفرصة: ${opportunityWindow.label}` : ''}`,
      }),
    })
    if (!response.ok) return
    const result = await response.json()
    if (!result.ok) return
    rememberSent(SIGNAL_LOGGED_KEY, fullKey)
  } catch { /* يعاد تلقائياً في الدورة القادمة */ }
}

export function AlertsWatcher() {
  const [permission, setPermission] = useState<string>('default')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission)

    async function tick() {
      if (!marketOpenNow()) return
      const idx = getSelectedIndex()
      // ── 1. فرص قوية قابلة للتنفيذ (على المؤشر المختار) ──
      try {
        const recUrl = idx === 'SPX' ? '/api/v2/recommend' : `/api/v2/recommend?asset=funds&symbol=${idx}`
        const rec = await fetch(recUrl).then(r => r.json())
        // توحيد شكل السوق: توصية المؤشرات ترجع السعر مباشرة في market
        const marketNorm = rec?.market?.spx
          ? rec.market
          : { spx: rec?.market ? { price: rec.market.price } : undefined }
        const [c] = (rec?.contracts ?? [])
          .filter((contract: any) => (contract.grade === 'A+' || contract.grade === 'A')
            && contract.status === 'execute' && rec?.decisionCouncil?.action === contract.type)
          .sort((a: any, b: any) => (b.grade === 'A+' ? 1 : 0) - (a.grade === 'A+' ? 1 : 0) || Number(b.score ?? 0) - Number(a.score ?? 0))
        if (c) {
          const typeAr = c.type === 'put' ? 'بوت' : 'كول'
          notifyOnce(`sig-${c.symbol}`,
            `🚨 فرصة ${c.grade} — ترقب`,
            `${typeAr} ${c.strike} بسعر ~$${c.mid ?? c.ask} — افتح المنصة للتفاصيل`)
          watchRecommendation(c, idx)
          void saveBellOnce(`sig-${c.symbol}`, buildEntryNotification({ ...c, scenario: rec?.scenario, opportunityWindow: rec?.opportunityWindow }))
          void logSignalOnce(`sig-${c.symbol}`, c, marketNorm, rec?.scenario, rec?.opportunityWindow)
        }
      } catch { /* تجاهل */ }

      // ── 2. كسر نقطة انقلاب جاما (خاص بسباكس — مصدر الجاما) ──
      if (idx === 'SPX') try {
        const g = await fetch('/api/v2/gamma').then(r => r.json())
        const gamma = g?.gamma
        if (gamma?.spot && gamma?.flipLevel) {
          const side = gamma.spot >= gamma.flipLevel ? 'above' : 'below'
          const prev = localStorage.getItem('taraqob_gamma_side')
          if (prev && prev !== side) {
            const gammaBody = side === 'below'
              ? `SPX كسر نقطة الانقلاب (${Math.round(gamma.flipLevel)}) نزولاً — الحركة ستصبح أعنف، شدّد وقفك`
              : `SPX عاد فوق نقطة الانقلاب (${Math.round(gamma.flipLevel)}) — السوق أهدأ`
            notifyOnce(`flip-${side}`,
              '⚡ السوق غيّر سلوكه — ترقب',
              gammaBody)
            void saveBellOnce(`flip-${side}`, {
              type: 'alert',
              title: 'تغيّر سلوك السوق',
              body: `${gammaBody} · ${riyadhDateTime()} بتوقيت الرياض`,
              url: '/v2/chart',
            })
          }
          localStorage.setItem('taraqob_gamma_side', side)
        }
      } catch { /* تجاهل */ }

      // ── 3. الصفقات المحفوظة: هل تحتاج قراراً؟ ──
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      const recommended = loadRecommendedPositions().filter(pos => !pos.expiry || pos.expiry >= todayStr)
      const combined = new Map<string, WatchedPosition>()
      for (const pos of [...recommended, ...loadPositions()]) {
        combined.set(`${pos.underlying ?? 'SPX'}-${pos.type}-${pos.strike}-${pos.expiry ?? ''}`, pos)
      }

      for (const pos of Array.from(combined.values()).slice(-8)) {
        if (pos.expiry && pos.expiry < todayStr) continue   // عقد منتهٍ — لا داعي للاستعلام
        const posUnderlying = pos.underlying ?? 'SPX'
        const symParam = posUnderlying !== 'SPX' ? `&symbol=${posUnderlying}` : ''
        const posLabel = `${pos.type === 'put' ? 'بوت' : 'كول'} ${posUnderlying !== 'SPX' ? `${posUnderlying} ` : ''}${pos.strike}`
        const posKey = `${posUnderlying}-${pos.type}${pos.strike}`
        try {
          const q = `strike=${pos.strike}&type=${pos.type}&entry=${pos.entry}${pos.expiry ? `&expiry=${pos.expiry}` : ''}${symParam}`
          const ex = await fetch(`/api/v2/exit?${q}`).then(r => r.json())
          if (ex?.verdict === 'exit_now' || ex?.verdict === 'exit_thesis') {
            notifyOnce(`exit-${posKey}`,
              '🚪 قرار خروج — ترقب',
              `${posLabel}: ${ex.verdictText ?? 'اخرج الآن'}`)
            void saveBellOnce(
              `exit-${posKey}`,
              buildExitNotification(pos, ex, 'exit'),
            )
          } else if (
            ex?.verdict === 'manage_profit' &&
            (pos.source !== 'recommendation' || (ex?.pnl?.pct ?? 0) >= 30)
          ) {
            notifyOnce(`profit-${posKey}`,
              '💰 أدر ربحك — ترقب',
              `${posLabel}: ${ex.verdictText ?? 'حان وقت جني جزء من الربح'}`)
            void saveBellOnce(
              `profit-${posKey}`,
              buildExitNotification(pos, ex, 'profit'),
            )
          }
        } catch { /* تجاهل */ }
      }
    }

    tick()
    timer.current = setInterval(tick, POLL_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])

  // زر تفعيل الإشعارات (يظهر فقط إن لم تُفعّل بعد)
  if (permission !== 'default') return null
  return (
    <button
      onClick={async () => {
        try {
          const p = await Notification.requestPermission()
          setPermission(p)
        } catch { setPermission('denied') }
      }}
      className="fixed bottom-4 left-4 z-50 text-xs font-bold px-3 py-2 rounded-xl shadow-lg"
      style={{
        background: 'rgba(201,148,58,0.15)', border: '1px solid rgba(201,148,58,0.5)',
        color: '#E8D5A3', backdropFilter: 'blur(8px)',
      }}
      dir="rtl">
      🔔 فعّل التنبيهات — لتناديك ترقب عند الفرص القوية
    </button>
  )
}
