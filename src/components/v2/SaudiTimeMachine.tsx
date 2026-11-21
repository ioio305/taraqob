'use client'

// آلة الزمن — بطاقة في صفحة السهم السعودي: قبل الدخول نعيد الصفقة 10,000 مرة من حركة السهم
// نفسه ونقول الحقيقة بحكم واحد. عرض فقط، لغة مبسّطة، بلا «R» ولا «مونت كارلو».

import { useCallback, useEffect, useState } from 'react'
import type { TmHistory, TmRun } from '@/lib/v2/timeMachine'
import {
  TM_AMBER, TM_GRAY, TM_GREEN, TM_RED, TmBar, TmChip, TmLocked, TmRunButton, TmShell, TmSpinner, TmVerdict, tmAvgText, tmPct,
} from './TimeMachineParts'

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
const TARGET_LABELS = ['الهدف الأول', 'الهدف الثاني', 'الهدف الثالث']
const n2 = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

  if (locked) return <TmLocked upgradeHref="/upgrade?market=saudi" />

  const r = data?.neutral
  const tr = data?.trend
  const h = data?.history
  const trendDiffers = r && tr && tr.verdict.key !== r.verdict.key

  return (
    <TmShell sub="قبل أن تدخل: نعيد هذه الصفقة 10,000 مرة من حركة السهم نفسه في آخر سنتين، ونقول لك كم مرة نجحت.">
      <div className="mt-3 flex flex-wrap gap-1.5">
        {HORIZONS.map(o => (
          <TmChip key={o.key} active={horizon === o.key} onClick={() => { setHorizon(o.key); setT(1) }}>{o.label}</TmChip>
        ))}
        {data && data.plan.targetsCount > 1 ? <span className="mx-1 self-center text-slate-600">|</span> : null}
        {data ? Array.from({ length: data.plan.targetsCount }, (_, i) => i + 1).map(i => (
          <TmChip key={i} tone="green" active={t === i} onClick={() => setT(i)}>{TARGET_LABELS[i - 1]}</TmChip>
        )) : null}
      </div>

      {!started ? <TmRunButton onClick={() => setStarted(true)} />
        : loading && !data ? <TmSpinner />
        : err ? <div className="mt-4 rounded-xl px-3 py-3 text-xs text-slate-400" style={{ background: 'rgba(255,255,255,.03)' }}>{err}</div>
        : data && r && tr && h ? (
          <div className={`mt-4 space-y-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl px-2 py-2" style={{ background: 'rgba(255,255,255,.04)' }}>
                <div className="text-[10px] text-slate-500">الدخول</div>
                <div className="text-sm font-black text-white">{n2(data.plan.entry)}</div>
              </div>
              <div className="rounded-xl px-2 py-2" style={{ background: `${TM_RED}12` }}>
                <div className="text-[10px] text-slate-500">الوقف</div>
                <div className="text-sm font-black" style={{ color: TM_RED }}>{n2(data.plan.stop)}</div>
                <div className="text-[10px] text-slate-500">−{data.plan.riskPct}%</div>
              </div>
              <div className="rounded-xl px-2 py-2" style={{ background: `${TM_GREEN}12` }}>
                <div className="text-[10px] text-slate-500">{data.plan.targetLabel}</div>
                <div className="text-sm font-black" style={{ color: TM_GREEN }}>{n2(data.plan.target)}</div>
                <div className="text-[10px] text-slate-500">+{data.plan.targetPct}%</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500">المدة: {data.horizon.bars} جلسة ({data.horizon.holdAr})</div>

            <div className="space-y-2.5">
              <TmBar label="وصلت الهدف أولاً" value={r.pTarget} color={TM_GREEN} />
              <TmBar label="ضربت الوقف أولاً" value={r.pStop} color={TM_RED} />
              <TmBar label={`لم تُحسم خلال ${data.horizon.bars} جلسة`} value={r.pOpen} color={TM_GRAY} />
            </div>

            <TmVerdict text={r.verdict.text} tone={r.verdict.tone} notes={r.notes} />

            <ul className="space-y-1.5 text-xs leading-5 text-slate-300">
              <li>• {tmAvgText(r.avgR)}.</li>
              <li>• السعر بعد {data.horizon.bars} جلسة: غالباً قرب {n2(r.endMedian)}، و9 من كل 10 محاولات بين {n2(r.endP5)} و{n2(r.endP95)}.</li>
              <li>
                • ما حدث فعلاً:{' '}
                {h.enough
                  ? <>لو دخلت بالقاعدة نفسها في {h.samples} يوماً سابقاً: وصلت الهدف {h.target} مرة، وضربت الوقف {h.stop} مرة، ولم تُحسم {h.open}. {tmAvgText(h.avgR)}.</>
                  : <>العيّنة التاريخية صغيرة ({h.samples} مرة) فلا نحكم منها.</>}
              </li>
              {trendDiffers ? (
                <li style={{ color: TM_AMBER }}>
                  • لو استمر اتجاه السهم كما في السنتين الماضيتين: الهدف أولاً {tmPct(tr.pTarget)} والوقف أولاً {tmPct(tr.pStop)}. الفرق يأتي من الاتجاه الماضي وحده، ولا ضمان أن يستمر.
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
    </TmShell>
  )
}
