'use client'

// ── مراقب تنبيهات الصناديق — يناديك عند فرصة جديدة بدل أن تراقب الشاشة ────────
// يفحص توصية اليوم كل 5 دقائق. فرصة جديدة (قوية أو استثنائية) = تنبيه واحد
// لكل صندوق في اليوم، بلا تكرار. يعمل بصمت داخل هيكل الصناديق.

import { useEffect } from 'react'

const POLL_MS = 300_000
const SENT_KEY = 'taraqob_funds_alerted_v1'

function alreadySent(key: string): boolean {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const log: Record<string, string> = JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}')
    return log[key] === today
  } catch { return false }
}

function markSent(key: string) {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const log: Record<string, string> = JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}')
    log[key] = today
    localStorage.setItem(SENT_KEY, JSON.stringify(log))
  } catch { /* تجاهل */ }
}

function notify(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try { new Notification(title, { body, icon: '/favicon.ico', dir: 'rtl', lang: 'ar' }) } catch { /* تجاهل */ }
}

export function FundsWatcher() {
  useEffect(() => {
    // نطلب إذن التنبيهات عند أول تفاعل (لا نزعج المستخدم فور الدخول)
    const ask = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }
      window.removeEventListener('pointerdown', ask)
    }
    window.addEventListener('pointerdown', ask)

    let alive = true
    async function check() {
      try {
        const res = await fetch('/api/v2/funds/advisory')
        const json = await res.json()
        if (!alive || !json?.success) return
        for (const c of json.opportunities ?? []) {
          const key = `funds-${c.symbol}`
          if (alreadySent(key)) continue
          markSent(key)
          const p = c.verdict.plan
          notify(
            `${c.verdict.tierLabelAr} — ${c.nameAr}`,
            p ? `درجة ${c.verdict.score} — دخول ${p.entryLow}–${p.entryHigh}، وقف ${p.stop}، هدف ${p.t1}` : `درجة ${c.verdict.score}`,
          )
        }
      } catch { /* أبقِ الصمت */ }
    }
    const t = setInterval(check, POLL_MS)
    const first = setTimeout(check, 15_000) // فحص أول بعد استقرار الصفحة
    return () => { alive = false; clearInterval(t); clearTimeout(first); window.removeEventListener('pointerdown', ask) }
  }, [])

  return null
}
