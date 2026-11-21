'use client'

// آلة الزمن — بطاقة في صفحة السهم السعودي: قبل الدخول نعيد الصفقة 10,000 مرة من حركة السهم
// نفسه ونقول الحقيقة بحكم واحد. عرض فقط، لغة مبسّطة، بلا «R» ولا «مونت كارلو».

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { TmHistory, TmRun } from '@/lib/v2/timeMachine'

const ACCENT = '#16A34A'
const RED = '#F04760'
const AMBER = '#F5B301'
const GRAY = '#64748B'

type Horizon = 'aggressive' | 'moderate' | 'conservative'
type Resp = {
  name: string
  horizon: { key: Horizon; labelAr: string; emoji: string; holdAr: string; bars: number; tested: boolean }
  plan: { entry: number; stop: number; target: number; targetLabel: string; targetIndex: number; targetR: number; riskPct: number; targetPct: number; targetsCount: number }
  neutral: TmRun
  trend: TmRun
  history: TmHistory
  data: { sessions: number; from: string; to: string; costPct: number; seed: number }
  error?: string
}

const HORIZONS: Array<{ key: Horizon; label: string }> = [
  { key: 'aggressive', label: '🔴 مغامر' },
  { key: 'moderate', label: '🟡 متوسط' },
  { key: 'conservative', label: '🟢 محافظ' },
]

const pct = (v: number) => `${Math.round(v * 100)}%`
const n2 = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const toneColor = (t: 'good' | 'bad' | 'neutral') => (t === 'good' ? ACCENT : t === 'bad' ? RED : AMBER)

// متوسط النتيجة بكلام بسيط: نسبة من المبلغ الذي خاطرت به.
function avgText(avgR: number): string {
  const p = Math.round(avgR * 100)
  if (p === 0) return 'في المتوسط: لا ربح ولا خسارة تُذكر بعد التكاليف'
  return p > 0
    ? `في المتوسط: تربح ${p}% من المبلغ الذي خاطرت به، بعد التكاليف`
    : `في المتوسط: تخسر ${-p}% من المبلغ الذي خاطرت به، بعد التكاليف`
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-300">{label}</span>
        <span className="font-black" style={{ color }}>{pct(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.06)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(1, value * 100)}%`, background: color }} />
      </div>
    </div>
  )
}

export function SaudiTimeMachine({ symbol }: { symbol: string }) {
  const [horizon, setHorizon] = useState<Horizon>('moderate')
  const [t, setT] = useState(1)
  const [started, setStarted] = useState(false)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [locked, setLocked] = useState(false)

  const run = useCallback(async (h: Horizon, ti: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v2/saudi/timemachine/${encodeURIComponent(symbol)}?horizon=${h}&t=${ti}`)
      if (res.status === 403) { setLocked(true); setLoading(false); return }
      const json = (await res.json()) as Resp
      if (!res.ok || json.error) { setErr(json.error ?? 'تعذّر تشغيل آلة الزمن'); setData(null) }
      else { setData(json); setErr('') }
    } catch { setErr('تعذّر الاتصال') }
    setLoading(false)
  }, [symbol])

  useEffect(() => { if (started) run(horizon, t) }, [started, horizon, t, run])

  const r = data?.neutral
  const tr = data?.trend
  const h = data?.history
  const trendDiffers = r && tr && tr.verdict.key !== r.verdict.key

  if (locked) {
    return (
      <div className="rounded-2xl border p-5 text-center" style={{ borderColor: `${AMBER}40`, background: `${AMBER}0a` }}>
        <div className="text-2xl">🔒</div>
        <div className="mt-2 text-sm font-black text-white">⏳ آلة الزمن</div>
        <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-slate-400">
          قبل أن تدخل: نعيد الصفقة 10,000 مرة من حركة السهم نفسه، ونريك كم مرة وصلت الهدف وكم مرة ضربت الوقف، وما حدث فعلاً في الأيام السابقة، مع حكم صريح.
        </p>
        <Link href="/upgrade?market=saudi" className="mt-3 inline-block rounded-lg px-4 py-2 text-xs font-black text-white" style={{ background: ACCENT }}>
          متاح في الباقة المتقدمة
        </Link>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border p-4" style={{ borderColor: 'rgba(167,139,250,.35)', background: 'linear-gradient(135deg, rgba(167,139,250,.08), rgba(255,255,255,.02) 60%)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-white">⏳ آلة الزمن</h3>
          <p className="mt-0.5 text-[11px] leading-5 text-slate-400">قبل أن تدخل: نعيد هذه الصفقة 10,000 مرة من حركة السهم نفسه في آخر سنتين، ونقول لك كم مرة نجحت.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {HORIZONS.map(o => (
          <button key={o.key} type="button" onClick={() => { setHorizon(o.key); setT(1) }}
            className="rounded-full px-3 py-1 text-xs font-bold transition-colors"
            style={{ background: horizon === o.key ? 'rgba(167,139,250,.25)' : 'rgba(255,255,255,.05)', color: horizon === o.key ? '#E9D5FF' : '#94A3B8' }}>
            {o.label}
          </button>
        ))}
        {data && data.plan.targetsCount > 1 ? (
          <span className="mx-1 self-center text-slate-600">|</span>
        ) : null}
        {data ? Array.from({ length: data.plan.targetsCount }, (_, i) => i + 1).map(i => (
          <button key={i} type="button" onClick={() => setT(i)}
            className="rounded-full px-3 py-1 text-xs font-bold transition-colors"
            style={{ background: t === i ? 'rgba(22,163,74,.22)' : 'rgba(255,255,255,.05)', color: t === i ? '#BBF7D0' : '#94A3B8' }}>
            {['الهدف الأول', 'الهدف الثاني', 'الهدف الثالث'][i - 1]}
          </button>
        )) : null}
      </div>

      {!started ? (
        <button type="button" onClick={() => setStarted(true)}
          className="mt-4 w-full rounded-xl py-3 text-sm font-black text-white transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(90deg, #7C3AED, #A78BFA)' }}>
          شغّل آلة الزمن
        </button>
      ) : loading && !data ? (
        <div className="mt-4 flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: '#A78BFA', borderTopColor: 'transparent' }} />
          نعيد الصفقة 10,000 مرة…
        </div>
      ) : err ? (
        <div className="mt-4 rounded-xl px-3 py-3 text-xs text-slate-400" style={{ background: 'rgba(255,255,255,.03)' }}>{err}</div>
      ) : data && r && tr && h ? (
        <div className={`mt-4 space-y-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {/* الخطة التي نختبرها */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl px-2 py-2" style={{ background: 'rgba(255,255,255,.04)' }}>
              <div className="text-[10px] text-slate-500">الدخول</div>
              <div className="text-sm font-black text-white">{n2(data.plan.entry)}</div>
            </div>
            <div className="rounded-xl px-2 py-2" style={{ background: `${RED}12` }}>
              <div className="text-[10px] text-slate-500">الوقف</div>
              <div className="text-sm font-black" style={{ color: RED }}>{n2(data.plan.stop)}</div>
              <div className="text-[10px] text-slate-500">−{data.plan.riskPct}%</div>
            </div>
            <div className="rounded-xl px-2 py-2" style={{ background: `${ACCENT}12` }}>
              <div className="text-[10px] text-slate-500">{data.plan.targetLabel}</div>
              <div className="text-sm font-black" style={{ color: ACCENT }}>{n2(data.plan.target)}</div>
              <div className="text-[10px] text-slate-500">+{data.plan.targetPct}%</div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">المدة: {data.horizon.bars} جلسة ({data.horizon.holdAr})</div>

          {/* النتيجة */}
          <div className="space-y-2.5">
            <Bar label="وصلت الهدف أولاً" value={r.pTarget} color={ACCENT} />
            <Bar label="ضربت الوقف أولاً" value={r.pStop} color={RED} />
            <Bar label={`لم تُحسم خلال ${data.horizon.bars} جلسة`} value={r.pOpen} color={GRAY} />
          </div>

          {/* الحكم */}
          <div className="rounded-xl border-2 px-4 py-3" style={{ borderColor: toneColor(r.verdict.tone), background: `${toneColor(r.verdict.tone)}12` }}>
            <div className="text-[10px] font-bold text-slate-400">الحكم</div>
            <div className="mt-0.5 text-sm font-black" style={{ color: toneColor(r.verdict.tone) }}>{r.verdict.text}</div>
          </div>

          <ul className="space-y-1.5 text-xs leading-5 text-slate-300">
            <li>• {avgText(r.avgR)}.</li>
            <li>• السعر بعد {data.horizon.bars} جلسة: غالباً قرب {n2(r.endMedian)}، و9 من كل 10 محاولات بين {n2(r.endP5)} و{n2(r.endP95)}.</li>
            <li>
              • ما حدث فعلاً:{' '}
              {h.enough
                ? <>لو دخلت بالقاعدة نفسها في {h.samples} يوماً سابقاً: وصلت الهدف {h.target} مرة، وضربت الوقف {h.stop} مرة، ولم تُحسم {h.open}. {avgText(h.avgR)}.</>
                : <>العيّنة التاريخية صغيرة ({h.samples} مرة) فلا نحكم منها.</>}
            </li>
            {trendDiffers ? (
              <li style={{ color: AMBER }}>
                • لو استمر اتجاه السهم كما في السنتين الماضيتين: الهدف أولاً {pct(tr.pTarget)} والوقف أولاً {pct(tr.pStop)}. الفرق يأتي من الاتجاه الماضي وحده، ولا ضمان أن يستمر.
              </li>
            ) : null}
            {!data.horizon.tested ? (
              <li className="text-slate-500">• تصنيف «{data.horizon.labelAr}» لم يُختبر تاريخياً بعد — للمتابعة فقط.</li>
            ) : null}
          </ul>

          <div className="rounded-xl px-3 py-2.5 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.025)' }}>
            هذه محاكاة من حركة السهم من {data.data.from} إلى {data.data.to}، وليست توقعاً. النتائج المالية والأخبار قد تفعل ما لم يحدث في الماضي.
            التكلفة محسوبة ({data.data.costPct}%)، والفجوة تحت الوقف محسوبة بسعر الافتتاح. رقم التكرار {data.data.seed}: النتيجة نفسها في كل مرة.
          </div>
        </div>
      ) : null}
    </section>
  )
}
