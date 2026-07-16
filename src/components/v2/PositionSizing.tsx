'use client'

import { useState, useEffect } from 'react'
import { DEFAULT_RISK, computePositionSize, type RiskSettings } from '@/lib/v2/positionSizing'

// ── Hook: إعدادات المخاطرة (محفوظة محلياً) ──────────────────────────────────
export function useRiskSettings() {
  const [settings, setSettings] = useState<RiskSettings>(DEFAULT_RISK)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('taraqob_risk')
      if (raw) setSettings({ ...DEFAULT_RISK, ...JSON.parse(raw) })
    } catch { /* تجاهل */ }
  }, [])
  function update(patch: Partial<RiskSettings>) {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem('taraqob_risk', JSON.stringify(next)) } catch { /* تجاهل */ }
      return next
    })
  }
  return { settings, update }
}

// ── الانضباط: حد الخسارة اليومي والأسبوعي ────────────────────────────────────
// خسارتان في اليوم = انتهى يومك. خمس خسائر في الأسبوع = انتهى أسبوعك.
// أقوى حماية من «التداول الانتقامي» — أكبر مدمّر لحسابات المتداولين.
interface DisciplineState { day: string; dayWins: number; dayLosses: number; week: string; weekLosses: number }

function tradingDayNY(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}
function weekKeyNY(): string {
  // مفتاح الأسبوع = تاريخ يوم الاثنين (بتوقيت نيويورك)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = (now.getDay() + 6) % 7   // الاثنين = 0
  now.setDate(now.getDate() - day)
  return now.toISOString().slice(0, 10)
}
const FRESH_DISCIPLINE = (): DisciplineState => ({
  day: tradingDayNY(), dayWins: 0, dayLosses: 0, week: weekKeyNY(), weekLosses: 0,
})

export const DAY_LOSS_LIMIT = 2
export const WEEK_LOSS_LIMIT = 5

export function useDiscipline() {
  const [state, setState] = useState<DisciplineState>(FRESH_DISCIPLINE())
  useEffect(() => {
    try {
      const raw = localStorage.getItem('taraqob_discipline')
      if (raw) {
        const saved: DisciplineState = JSON.parse(raw)
        // يوم جديد يصفّر عدّاد اليوم؛ أسبوع جديد يصفّر عدّاد الأسبوع
        const next = { ...saved }
        if (saved.day !== tradingDayNY()) { next.day = tradingDayNY(); next.dayWins = 0; next.dayLosses = 0 }
        if (saved.week !== weekKeyNY())   { next.week = weekKeyNY(); next.weekLosses = 0 }
        setState(next)
      }
    } catch { /* تجاهل */ }
  }, [])
  function record(result: 'win' | 'loss') {
    setState(prev => {
      const next = { ...prev }
      if (result === 'win') next.dayWins++
      else { next.dayLosses++; next.weekLosses++ }
      try { localStorage.setItem('taraqob_discipline', JSON.stringify(next)) } catch { /* تجاهل */ }
      return next
    })
  }
  function undo() {
    setState(() => {
      const next = FRESH_DISCIPLINE()
      try { localStorage.setItem('taraqob_discipline', JSON.stringify(next)) } catch { /* تجاهل */ }
      return next
    })
  }
  const dayBlocked  = state.dayLosses  >= DAY_LOSS_LIMIT
  const weekBlocked = state.weekLosses >= WEEK_LOSS_LIMIT
  const blockNote = weekBlocked
    ? `خسرت ${state.weekLosses} صفقات هذا الأسبوع — انتهى أسبوعك. ارتح وعُد الاثنين، الحساب المحمي يتعافى`
    : dayBlocked
    ? `خسرت صفقتين اليوم — انتهى يومك. أفضل صفقة الآن هي عدم الدخول: التداول الانتقامي يدمّر الحسابات`
    : null
  return { state, record, undo, dayBlocked, weekBlocked, blocked: dayBlocked || weekBlocked, blockNote }
}

// ── شريط الانضباط: عدّاد اليوم + تسجيل النتيجة ──────────────────────────────
export function DisciplineBar() {
  const d = useDiscipline()
  return (
    <div className="rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap"
      style={{
        background: d.blocked ? 'rgba(240,67,90,0.08)' : '#0a1929',
        border: d.blocked ? '1px solid rgba(240,67,90,0.5)' : '1px solid #1e3a50',
      }}>
      <span className="text-xs text-gray-500">انضباط اليوم:</span>
      <span className="text-xs font-mono">
        <span className="text-emerald-400">{d.state.dayWins} ربح</span>
        <span className="text-gray-600"> / </span>
        <span className="text-red-400">{d.state.dayLosses} خسارة</span>
        <span className="text-gray-600"> (الحد {DAY_LOSS_LIMIT})</span>
      </span>
      <div className="flex gap-1.5">
        <button onClick={() => d.record('win')}
          className="text-xs px-2.5 py-1 rounded-lg font-bold"
          style={{ background: 'rgba(38,208,124,0.12)', border: '1px solid rgba(38,208,124,0.35)', color: '#26D07C' }}>
          + ربحت صفقة
        </button>
        <button onClick={() => d.record('loss')}
          className="text-xs px-2.5 py-1 rounded-lg font-bold"
          style={{ background: 'rgba(240,67,90,0.12)', border: '1px solid rgba(240,67,90,0.35)', color: '#F0435A' }}>
          − خسرت صفقة
        </button>
      </div>
      {d.blockNote && (
        <div className="w-full text-sm font-bold mt-1" style={{ color: '#F0435A' }}>
          🛑 {d.blockNote}
        </div>
      )}
    </div>
  )
}

// ── شريط إعداد المخاطرة ──────────────────────────────────────────────────────
export function RiskBar({ settings, update }: { settings: RiskSettings; update: (p: Partial<RiskSettings>) => void }) {
  return (
    <div className="flex items-center gap-3 flex-wrap bg-[#0a1929] border border-[#1e3a50] rounded-xl px-4 py-2.5">
      <span className="text-xs text-gray-500">إدارة المخاطر:</span>
      <label className="flex items-center gap-1.5 text-xs text-gray-400">
        رصيد الحساب $
        <input type="number" value={settings.balance || ''} min={0}
          onChange={e => update({ balance: Math.max(0, parseFloat(e.target.value) || 0) })}
          className="w-24 rounded-lg px-2 py-1 text-sm text-white outline-none font-mono"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-gray-400">
        مخاطرة لكل صفقة %
        <input type="number" value={settings.riskPct || ''} min={0.1} max={10} step={0.5}
          onChange={e => update({ riskPct: Math.min(10, Math.max(0.1, parseFloat(e.target.value) || 1)) })}
          className="w-16 rounded-lg px-2 py-1 text-sm text-white outline-none font-mono"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,148,58,0.3)' }} />
      </label>
    </div>
  )
}

// ── بطاقة حجم المركز (من الدخول والوقف) ─────────────────────────────────────
export function SizeCard({ settings, entryPerShare, stopPerShare }: {
  settings: RiskSettings; entryPerShare: number; stopPerShare: number
}) {
  const discipline = useDiscipline()
  const ps = computePositionSize(settings, entryPerShare, stopPerShare)
  if (!ps) return null
  // حد الخسارة: حين يُقفل اليوم/الأسبوع لا نعرض حجم صفقة إطلاقاً
  if (discipline.blocked) {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'rgba(240,67,90,0.06)', border: '1px solid rgba(240,67,90,0.45)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span>🛑</span>
          <span className="text-sm font-bold" style={{ color: '#F0435A' }}>حجم المركز: صفر عقود</span>
        </div>
        <p className="text-sm text-gray-400">{discipline.blockNote}</p>
      </div>
    )
  }
  const ok = ps.affordable && ps.cost <= settings.balance
  const accent = ok ? '#26D07C' : '#F0435A'
  return (
    <div className="rounded-2xl p-4" style={{ background: `${accent}0D`, border: `1px solid ${accent}44` }}>
      <div className="flex items-center gap-2 mb-2">
        <span>📐</span>
        <span className="text-sm font-bold" style={{ color: accent }}>حجم المركز المقترح</span>
      </div>
      {ok ? (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-gray-500">اشترِ</div>
              <div className="text-2xl font-black" style={{ color: accent }}>{ps.contracts}</div>
              <div className="text-xs text-gray-600">عقد</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">أقصى خسارة</div>
              <div className="text-xl font-black font-mono text-red-400 mt-0.5">${ps.maxLoss}</div>
              <div className="text-xs text-gray-600">{settings.riskPct}% من حسابك</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">تكلفة الدخول</div>
              <div className="text-xl font-black font-mono text-[#E8D5A3] mt-0.5">${ps.cost}</div>
              <div className="text-xs text-gray-600">إجمالي</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">{ps.note}</p>
        </>
      ) : (
        <p className="text-sm" style={{ color: '#F0435A' }}>⚠ {ps.note}</p>
      )}
    </div>
  )
}
