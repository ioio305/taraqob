'use client'

// ── مراقب التنبيهات — المنصة تناديك بدل أن تراقبها ──────────────────────────
// يعمل بصمت في الخلفية على كل الصفحات (مُركّب في V2Shell) ويصدر إشعاراً حين:
//   1. تظهر فرصة قوية (A+/A) قابلة للتنفيذ
//   2. يكسر السعر نقطة انقلاب جاما (تغيّر سلوك السوق)
//   3. تحتاج صفقة محفوظة (مساعد الخروج) إلى قرار: اخرج / أدر ربحك
// لا تكرار: كل تنبيه يُرسل مرة واحدة في اليوم لنفس السبب.

import { useEffect, useRef, useState } from 'react'

const POLL_MS = 90_000   // كل 90 ثانية أثناء السوق

// صفقة محفوظة للمتابعة التلقائية
export interface WatchedPosition {
  strike: number
  type: 'call' | 'put'
  entry: number
  expiry?: string
  addedAt: string
}

export function loadPositions(): WatchedPosition[] {
  try { return JSON.parse(localStorage.getItem('taraqob_positions') ?? '[]') } catch { return [] }
}
export function savePositions(list: WatchedPosition[]) {
  try { localStorage.setItem('taraqob_positions', JSON.stringify(list)) } catch { /* تجاهل */ }
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

export function AlertsWatcher() {
  const [permission, setPermission] = useState<string>('default')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission)

    async function tick() {
      if (!marketOpenNow()) return
      // ── 1. فرص قوية قابلة للتنفيذ ──
      try {
        const rec = await fetch('/api/v2/recommend').then(r => r.json())
        for (const c of rec?.contracts ?? []) {
          if ((c.grade === 'A+' || c.grade === 'A') && c.status === 'execute') {
            const typeAr = c.type === 'put' ? 'بوت' : 'كول'
            notifyOnce(`sig-${c.symbol}`,
              `🚨 فرصة ${c.grade} — ترقب`,
              `${typeAr} ${c.strike} بسعر ~$${c.mid ?? c.ask} — افتح المنصة للتفاصيل`)
          }
        }
      } catch { /* تجاهل */ }

      // ── 2. كسر نقطة انقلاب جاما ──
      try {
        const g = await fetch('/api/v2/gamma').then(r => r.json())
        const gamma = g?.gamma
        if (gamma?.spot && gamma?.flipLevel) {
          const side = gamma.spot >= gamma.flipLevel ? 'above' : 'below'
          const prev = localStorage.getItem('taraqob_gamma_side')
          if (prev && prev !== side) {
            notifyOnce(`flip-${side}`,
              '⚡ السوق غيّر سلوكه — ترقب',
              side === 'below'
                ? `SPX كسر نقطة الانقلاب (${Math.round(gamma.flipLevel)}) نزولاً — الحركة ستصبح أعنف، شدّد وقفك`
                : `SPX عاد فوق نقطة الانقلاب (${Math.round(gamma.flipLevel)}) — السوق أهدأ`)
          }
          localStorage.setItem('taraqob_gamma_side', side)
        }
      } catch { /* تجاهل */ }

      // ── 3. الصفقات المحفوظة: هل تحتاج قراراً؟ ──
      const positions = loadPositions()
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      for (const pos of positions.slice(0, 5)) {
        if (pos.expiry && pos.expiry < todayStr) continue   // عقد منتهٍ — لا داعي للاستعلام
        try {
          const q = `strike=${pos.strike}&type=${pos.type}&entry=${pos.entry}${pos.expiry ? `&expiry=${pos.expiry}` : ''}`
          const ex = await fetch(`/api/v2/exit?${q}`).then(r => r.json())
          if (ex?.verdict === 'exit_now' || ex?.verdict === 'exit_thesis') {
            notifyOnce(`exit-${pos.type}${pos.strike}`,
              '🚪 قرار خروج — ترقب',
              `${pos.type === 'put' ? 'بوت' : 'كول'} ${pos.strike}: ${ex.verdictText ?? 'اخرج الآن'}`)
          } else if (ex?.verdict === 'manage_profit') {
            notifyOnce(`profit-${pos.type}${pos.strike}`,
              '💰 أدر ربحك — ترقب',
              `${pos.type === 'put' ? 'بوت' : 'كول'} ${pos.strike}: ${ex.verdictText ?? 'حان وقت جني جزء من الربح'}`)
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
