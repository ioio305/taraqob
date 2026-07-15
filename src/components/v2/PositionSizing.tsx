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
  const ps = computePositionSize(settings, entryPerShare, stopPerShare)
  if (!ps) return null
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
