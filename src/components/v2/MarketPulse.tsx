'use client'

// ── لوحة نبض السوق ───────────────────────────────────────────────────────────
// الخوف/الطمع + نسبة Put/Call + Max Pain + نظام الجاما + خريطة جاما حرارية.
// تُظهر «تمركز صانعي السوق» بنبرة مؤسسية — بيانات لا كومة.

import { useEffect, useState } from 'react'

interface Unusual { strike: number; type: 'call' | 'put'; volume: number; oi: number; ratio: number | null }
interface Pulse {
  vix: number | null
  fearGreed: { value: number; label: string; color: string } | null
  unusual?: Unusual[]
  gamma: {
    spot: number; regime: 'positive' | 'negative'; totalGex: number
    flipLevel: number | null; callWall: number | null; putWall: number | null
    maxPain: number | null; putCallRatio: number
    profile: { strike: number; gex: number }[]
    status: 'live' | 'delayed'; dataNoteAr: string
  } | null
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] mb-1" style={{ color: '#6E7E8F' }}>{label}</div>
      <div className="text-lg font-black font-mono leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] mt-1" style={{ color: '#5E6E7F' }}>{sub}</div>}
    </div>
  )
}

export function MarketPulse() {
  const [d, setD] = useState<Pulse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/v2/market-pulse')
      .then(r => r.json())
      .then(x => { if (alive) setD(x) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) {
    return <div className="rounded-2xl p-5 text-center text-sm animate-pulse" style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.06)', color: '#4A5568' }}>جارٍ قياس نبض السوق...</div>
  }
  if (!d?.gamma && !d?.fearGreed) return null

  const g = d.gamma
  const fg = d.fearGreed

  // نسبة Put/Call — تفسير
  const pcr = g?.putCallRatio ?? null
  const pcrColor = pcr == null ? '#6E7E8F' : pcr >= 1.15 ? '#EF4444' : pcr <= 0.75 ? '#26D07C' : '#C9943A'
  const pcrSub = pcr == null ? '' : pcr >= 1.15 ? 'دفاعي/هبوطي' : pcr <= 0.75 ? 'هجومي/صعودي' : 'متوازن'

  // خريطة الجاما — نافذة حول السعر
  const spot = g?.spot ?? 0
  const near = (g?.profile ?? [])
    .filter(p => spot > 0 && Math.abs(p.strike - spot) <= spot * 0.028)
    .sort((a, b) => b.strike - a.strike)
  const maxAbs = Math.max(1, ...near.map(p => Math.abs(p.gex)))

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* رأس */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-sm font-bold" style={{ color: '#E8D5A3' }}>🫀 نبض السوق</span>
        {g && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: g.status === 'live' ? 'rgba(38,208,124,0.12)' : 'rgba(201,148,58,0.12)', color: g.status === 'live' ? '#26D07C' : '#C9943A', border: `1px solid ${g.status === 'live' ? 'rgba(38,208,124,0.3)' : 'rgba(201,148,58,0.3)'}` }}>
            {g.status === 'live' ? '● مباشر' : 'الفائدة المفتوحة يومية'}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* بطاقات النبض */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {fg && <Stat label="الخوف/الطمع" value={`${fg.value}`} sub={`${fg.label}${d.vix ? ` · VIX ${d.vix.toFixed(1)}` : ''}`} color={fg.color} />}
          {pcr != null && <Stat label="Put / Call" value={pcr.toFixed(2)} sub={pcrSub} color={pcrColor} />}
          {g?.maxPain != null && <Stat label="Max Pain" value={Math.round(g.maxPain).toLocaleString()} sub="مغناطيس الإغلاق" color="#A78BFA" />}
          {g && <Stat label="الجاما" value={g.regime === 'positive' ? 'موجبة' : 'سالبة'} sub={g.regime === 'positive' ? 'مكبوح/ارتداد' : 'مضخّم/تسارع'} color={g.regime === 'positive' ? '#26D07C' : '#EF4444'} />}
        </div>

        {/* مؤشر الخوف/الطمع — شريط */}
        {fg && (
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: '#5E6E7F' }}>
              <span>خوف</span><span>محايد</span><span>طمع</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden relative" style={{ background: 'linear-gradient(90deg,#EF4444,#F59E0B,#C9943A,#26D07C)' }}>
              <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ left: `calc(${fg.value}% - 5px)`, background: fg.color }} />
            </div>
          </div>
        )}

        {/* جدران الجاما */}
        {g && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg px-2 py-2" style={{ background: 'rgba(240,67,90,0.06)', border: '1px solid rgba(240,67,90,0.2)' }}>
              <div className="text-[10px]" style={{ color: '#6E7E8F' }}>مقاومة (جدار كول)</div>
              <div className="text-sm font-black font-mono" style={{ color: '#F0435A' }}>{g.callWall ? Math.round(g.callWall).toLocaleString() : '—'}</div>
            </div>
            <div className="rounded-lg px-2 py-2" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div className="text-[10px]" style={{ color: '#6E7E8F' }}>نقطة الانقلاب</div>
              <div className="text-sm font-black font-mono" style={{ color: '#A78BFA' }}>{g.flipLevel ? Math.round(g.flipLevel).toLocaleString() : '—'}</div>
            </div>
            <div className="rounded-lg px-2 py-2" style={{ background: 'rgba(38,208,124,0.06)', border: '1px solid rgba(38,208,124,0.2)' }}>
              <div className="text-[10px]" style={{ color: '#6E7E8F' }}>دعم (جدار بوت)</div>
              <div className="text-sm font-black font-mono" style={{ color: '#26D07C' }}>{g.putWall ? Math.round(g.putWall).toLocaleString() : '—'}</div>
            </div>
          </div>
        )}

        {/* خريطة الجاما الحرارية */}
        {near.length > 3 && (
          <div>
            <div className="text-[11px] mb-1.5 font-bold" style={{ color: '#8A97A6' }}>خريطة الجاما — تمركز صانعي السوق حول السعر</div>
            <div className="space-y-0.5">
              {near.map(p => {
                const pos = p.gex >= 0
                const w = Math.round((Math.abs(p.gex) / maxAbs) * 100)
                const isSpot = Math.abs(p.strike - spot) < 2.5
                return (
                  <div key={p.strike} className="flex items-center gap-2">
                    <span className="w-12 text-[10px] font-mono text-left shrink-0" style={{ color: isSpot ? '#E8D5A3' : '#5E6E7F' }} dir="ltr">
                      {Math.round(p.strike)}
                    </span>
                    <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="h-full rounded-sm transition-all" style={{ width: `${w}%`, background: pos ? '#26D07C' : '#F0435A', opacity: isSpot ? 1 : 0.55 }} />
                    </div>
                    {isSpot && <span className="text-[9px] shrink-0" style={{ color: '#E8D5A3' }}>◄ السعر</span>}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px]" style={{ color: '#6E7E8F' }}>
              <span><b style={{ color: '#26D07C' }}>▮</b> جاما موجبة (دعم/تثبيت)</span>
              <span><b style={{ color: '#F0435A' }}>▮</b> جاما سالبة (تسارع)</span>
            </div>
          </div>
        )}

        {/* النشاط غير المعتاد — أكبر تدفّق اليوم */}
        {(d.unusual?.length ?? 0) > 0 && (
          <div>
            <div className="text-[11px] mb-1.5 font-bold" style={{ color: '#8A97A6' }}>🔥 أكبر تدفّق اليوم — أين يتحرّك المال</div>
            <div className="space-y-1">
              {d.unusual!.map((u, i) => {
                const isCall = u.type === 'call'
                const hot = u.ratio != null && u.ratio >= 2
                return (
                  <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: isCall ? 'rgba(38,208,124,0.12)' : 'rgba(167,139,250,0.12)', color: isCall ? '#26D07C' : '#A78BFA' }}>
                      {isCall ? '▲ كول' : '▼ بوت'}
                    </span>
                    <span className="text-sm font-mono font-bold text-white shrink-0" dir="ltr">{Math.round(u.strike).toLocaleString()}</span>
                    <span className="flex-1" />
                    <span className="text-[11px] font-mono" style={{ color: '#8A97A6' }}>حجم {u.volume.toLocaleString()}</span>
                    {u.ratio != null && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: hot ? 'rgba(240,67,90,0.14)' : 'rgba(255,255,255,0.04)', color: hot ? '#F0435A' : '#6E7E8F', border: `1px solid ${hot ? 'rgba(240,67,90,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                        {hot ? '🔥 ' : ''}×{u.ratio} من المفتوح
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="text-[10px] mt-1.5" style={{ color: '#5E6E7F' }}>نسبة الحجم للفائدة المفتوحة (×) الأعلى = تمركز جديد نشط اليوم. ترجيح لا ضمان.</div>
          </div>
        )}

        {g?.dataNoteAr && <div className="text-[10px] font-mono" style={{ color: '#3A4A5A' }}>{g.dataNoteAr}</div>}
      </div>
    </div>
  )
}
