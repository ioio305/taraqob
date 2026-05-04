'use client'

import { useEffect, useState } from 'react'

type SessionStatus = 'pre_tokyo' | 'tokyo' | 'london' | 'pre_ny' | 'ny_open' | 'ny_mid' | 'ny_close' | 'closed'

type SessionInfo = {
  status:       SessionStatus
  label:        string
  description:  string
  icon:         string
  color:        string
  isActive:     boolean
  nextEvent:    string
  nextEventIn:  string // وقت متبقٍ
  recommendation: string
  killZoneActive: boolean
}

function getRiyadhHour(): number {
  return (new Date().getUTCHours() + 3) % 24
}

function getMinutesToNext(targetHour: number, currentHour: number, currentMin: number): string {
  let diff = targetHour * 60 - (currentHour * 60 + currentMin)
  if (diff < 0) diff += 24 * 60
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h === 0) return `${m} دقيقة`
  if (m === 0) return `${h} ساعة`
  return `${h} ساعة و${m} دقيقة`
}

function getSessionInfo(): SessionInfo {
  const now        = new Date()
  const riyadhHour = getRiyadhHour()
  const riyadhMin  = now.getUTCMinutes()
  const riyadhTime = riyadhHour + riyadhMin / 60

  // طوكيو: 2:00 ص — 11:00 ص (توقيت رياض)
  // لندن:  11:00 ص — 8:00 م
  // Pre-NY: 1:30 م — 4:30 م
  // نيويورك: 4:30 م — 1:00 ص
  // Kill Zones (NY time → Riyadh = +8h):
  // London Kill: 3-5 AM NY = 11:00 ص — 1:00 م رياض
  // NY Open Kill: 9:30-11 AM NY = 5:30 م — 7:00 م رياض
  // NY Close Kill: 2-3:30 PM NY = 10:00 م — 11:30 م رياض

  const isLondonKill  = riyadhTime >= 11.0  && riyadhTime < 13.0
  const isNYOpenKill  = riyadhTime >= 17.5  && riyadhTime < 19.0
  const isNYCloseKill = riyadhTime >= 22.0  && riyadhTime < 23.5
  const killZoneActive = isLondonKill || isNYOpenKill || isNYCloseKill

  if (riyadhTime >= 2.0 && riyadhTime < 11.0) {
    return {
      status: 'tokyo', label: 'جلسة طوكيو', icon: '🌏',
      color: 'bg-blue-50 border-blue-200 text-blue-700',
      isActive: true, killZoneActive: false,
      description: 'آسيا تتداول — راقب الاتجاه لتوقع SPX',
      nextEvent: 'افتتاح لندن', nextEventIn: getMinutesToNext(11, riyadhHour, riyadhMin),
      recommendation: 'وقت القراءة والتحليل — لا تداول في SPX بعد',
    }
  }
  if (riyadhTime >= 11.0 && riyadhTime < 13.5) {
    return {
      status: 'london', label: 'London Kill Zone 🔥', icon: '🇬🇧',
      color: 'bg-amber-50 border-amber-300 text-amber-700',
      isActive: true, killZoneActive: true,
      description: 'أفضل وقت لتشكّل London High/Low — راقب الاتجاه',
      nextEvent: 'Pre-Market نيويورك', nextEventIn: getMinutesToNext(13, riyadhHour, riyadhMin),
      recommendation: '📊 سجّل London High وLow الآن — ستحتاجه عند افتتاح NY',
    }
  }
  if (riyadhTime >= 13.5 && riyadhTime < 16.5) {
    return {
      status: 'pre_ny', label: 'تحضير نيويورك', icon: '⏳',
      color: 'bg-orange-50 border-orange-200 text-orange-700',
      isActive: true, killZoneActive: false,
      description: 'Pre-Market نشط — بيانات SPX Futures متاحة',
      nextEvent: 'افتتاح نيويورك', nextEventIn: getMinutesToNext(16, riyadhHour, riyadhMin),
      recommendation: '🎯 حدد استراتيجيتك الآن قبل الافتتاح',
    }
  }
  if (riyadhTime >= 16.5 && riyadhTime < 19.0) {
    return {
      status: 'ny_open', label: 'NY Open Kill Zone 🔥', icon: '🇺🇸',
      color: 'bg-emerald-50 border-emerald-300 text-emerald-700',
      isActive: true, killZoneActive: true,
      description: 'أفضل Kill Zone في اليوم — أعلى سيولة وأوضح إشارات',
      nextEvent: 'انتهاء Kill Zone', nextEventIn: getMinutesToNext(19, riyadhHour, riyadhMin),
      recommendation: '⚡ الوقت المثالي للدخول — انتهز الفرصة الآن',
    }
  }
  if (riyadhTime >= 19.0 && riyadhTime < 22.0) {
    return {
      status: 'ny_mid', label: 'منتصف جلسة نيويورك', icon: '🇺🇸',
      color: 'bg-surface-50 border-surface-200 text-surface-600',
      isActive: true, killZoneActive: false,
      description: 'هدوء نسبي — حجم التداول يتراجع قليلاً',
      nextEvent: 'NY Close Kill Zone', nextEventIn: getMinutesToNext(22, riyadhHour, riyadhMin),
      recommendation: '👀 راقب مواقفك — لا دخول جديد في هذا الوقت عادةً',
    }
  }
  if (riyadhTime >= 22.0 && riyadhTime < 23.5) {
    return {
      status: 'ny_close', label: 'NY Close Kill Zone 🔥', icon: '🇺🇸',
      color: 'bg-purple-50 border-purple-200 text-purple-700',
      isActive: true, killZoneActive: true,
      description: 'آخر فرصة قبل الإغلاق — إشارات نهاية الجلسة',
      nextEvent: 'إغلاق نيويورك', nextEventIn: getMinutesToNext(1, riyadhHour, riyadhMin),
      recommendation: '🕒 أغلق مواقفك قبل 12:00 منتصف الليل',
    }
  }
  if (riyadhTime >= 23.5 || riyadhTime < 2.0) {
    return {
      status: 'closed', label: 'السوق مغلق', icon: '🌙',
      color: 'bg-navy-50 border-navy-200 text-navy-600',
      isActive: false, killZoneActive: false,
      description: 'نيويورك أغلقت — وقت المراجعة والتحضير',
      nextEvent: 'افتتاح طوكيو', nextEventIn: getMinutesToNext(2, riyadhHour, riyadhMin),
      recommendation: '📝 راجع تحليلاتك وتحضّر لليوم القادم',
    }
  }

  return {
    status: 'closed', label: 'السوق مغلق', icon: '🌙',
    color: 'bg-navy-50 border-navy-200 text-navy-600',
    isActive: false, killZoneActive: false,
    description: 'خارج أوقات التداول',
    nextEvent: 'افتتاح طوكيو', nextEventIn: getMinutesToNext(2, riyadhHour, riyadhMin),
    recommendation: 'وقت الراحة والتحضير',
  }
}

export function SessionTracker() {
  const [session, setSession] = useState<SessionInfo>(getSessionInfo())
  const [time, setTime]       = useState('')

  useEffect(() => {
    function update() {
      setSession(getSessionInfo())
      const now = new Date()
      const h   = (now.getUTCHours() + 3) % 24
      const m   = now.getUTCMinutes().toString().padStart(2, '0')
      const s   = now.getUTCSeconds().toString().padStart(2, '0')
      setTime(`${h.toString().padStart(2, '0')}:${m}:${s}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const sessions = [
    { icon: '🌏', label: 'طوكيو',  active: session.status === 'tokyo',                    time: '2:00 ص — 11:00 ص' },
    { icon: '🇬🇧', label: 'لندن',   active: ['london','pre_ny'].includes(session.status),  time: '11:00 ص — 8:00 م' },
    { icon: '🇺🇸', label: 'نيويورك',active: ['ny_open','ny_mid','ny_close'].includes(session.status), time: '4:30 م — 1:00 ص' },
  ]

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${session.killZoneActive ? 'border-amber-300' : 'border-surface-200'}`} dir="rtl">
      {/* Header */}
      <div className={`px-4 py-3 ${session.killZoneActive ? 'bg-gradient-to-l from-amber-500 to-amber-600' : session.isActive ? 'bg-gradient-to-l from-navy-800 to-navy-900' : 'bg-navy-900'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {session.killZoneActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
            <span className="text-white font-bold text-sm">{session.icon} {session.label}</span>
          </div>
          <span className="text-white/70 text-xs font-mono">{time} AST</span>
        </div>
        <div className="text-white/80 text-xs mt-1">{session.description}</div>
      </div>

      {/* خريطة الجلسات */}
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-surface-100 bg-white">
        {sessions.map(s => (
          <div key={s.label} className={`px-3 py-2.5 text-center ${s.active ? 'bg-emerald-50' : ''}`}>
            <div className="text-base mb-0.5">{s.icon}</div>
            <div className={`text-xs font-bold ${s.active ? 'text-emerald-700' : 'text-surface-400'}`}>
              {s.label} {s.active && '🟢'}
            </div>
            <div className="text-[9px] text-surface-400">{s.time}</div>
          </div>
        ))}
      </div>

      {/* التوصية */}
      <div className={`px-4 py-3 border-t border-surface-100 ${session.killZoneActive ? 'bg-amber-50' : 'bg-surface-50'}`}>
        <div className="text-xs font-medium text-navy-900 mb-1">{session.recommendation}</div>
        <div className="flex items-center gap-2 text-[10px] text-surface-400">
          <span>⏰</span>
          <span>{session.nextEvent} بعد {session.nextEventIn}</span>
        </div>
      </div>
    </div>
  )
}
