'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PLAN_NEAR_MIN_SCORE, type PlanPick } from '@/lib/v2/saudiPlan'
import { SAUDI_CALIBRATION } from '@/lib/v2/saudiIndicators'
import { SAUDI_HORIZONS, normalizeSaudiHorizon, saudiHorizonList, type SaudiHorizon } from '@/lib/v2/saudiHorizon'

const HORIZON_KEY = 'taraqob_saudi_horizon'

const ACCENT = '#16A34A'
const RED = '#F04760'
const AMBER = '#F5B301'

type PlanData = {
  asOf: string; universe: number; marketReturn3m: number | null; strongCount: number
  picks: PlanPick[]; horizon?: { key: SaudiHorizon }; error?: string
}

function n(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function Level({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: `${color}33`, background: `${color}0d` }}>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-sm font-black tabular-nums" style={{ color }}>{value}</div>
      {sub ? <div className="text-[10px] tabular-nums text-slate-500">{sub}</div> : null}
    </div>
  )
}

function PickCard({ p, rank }: { p: PlanPick; rank: number }) {
  const strong = p.tier === 'strong'
  const color = strong ? ACCENT : '#60A5FA'
  const up = p.change >= 0
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: `${color}44`, background: `linear-gradient(135deg, ${color}10, rgba(255,255,255,.015) 60%)` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-500">#{rank}</span>
            <Link href={`/saudi/stock/${p.symbol}`} className="truncate text-base font-black text-white hover:underline">{p.name}</Link>
            <span className="text-[10px] text-slate-500">{p.symbol}</span>
          </div>
          <div className="text-[11px] text-slate-500">{p.sector}</div>
        </div>
        <div className="shrink-0 text-left">
          <div className="text-base font-black tabular-nums text-white">{n(p.price)}</div>
          <div className="text-[11px] font-bold tabular-nums" style={{ color: up ? ACCENT : RED }}>{up ? '+' : ''}{n(p.change)}%</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full px-2.5 py-0.5 font-black" style={{ color, background: `${color}1e` }}>
          {strong ? 'مرشّح قوي' : 'قريب من الترشيح'} · {p.score}
        </span>
        {p.reasons.map(r => (
          <span key={r} className="rounded-full px-2 py-0.5 text-slate-300" style={{ background: 'rgba(255,255,255,.05)' }}>{r}</span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Level label="منطقة الدخول" value={`${n(p.plan.entryLow)} – ${n(p.plan.entry)}`} color="#E2E8F0" />
        <Level label="وقف الخسارة" value={n(p.plan.stop)} sub={`مخاطرة ${p.plan.riskPct}%`} color={RED} />
        {p.plan.targets.map(t => (
          <Level key={t.r} label={t.label} value={n(t.price)} sub={`+${t.pct}% · ${t.r}:1`} color={ACCENT} />
        ))}
      </div>
      {p.plan.resistanceNote ? <div className="mt-2 text-[11px] text-amber-300/80">⚠ {p.plan.resistanceNote}</div> : null}
    </div>
  )
}

export default function SaudiProPlan() {
  const [data, setData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [horizon, setHorizon] = useState<SaudiHorizon | null>(null)

  useEffect(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem(HORIZON_KEY) } catch { /* تجاهل */ }
    setHorizon(normalizeSaudiHorizon(saved))
  }, [])

  function switchHorizon(h: SaudiHorizon) {
    setHorizon(h)
    setLoading(true)
    try { localStorage.setItem(HORIZON_KEY, h) } catch { /* تجاهل */ }
  }

  const load = useCallback(async () => {
    if (!horizon) return
    try {
      const res = await fetch(`/api/v2/saudi/plan?horizon=${horizon}`)
      const json = (await res.json()) as PlanData
      if (!res.ok || json.error) setErr(json.error ?? 'تعذّر تحميل الخطة')
      else { setData(json); setErr('') }
    } catch { setErr('تعذّر الاتصال بمصدر البيانات') }
    setLoading(false)
  }, [horizon])

  useEffect(() => {
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  const bearish = data?.marketReturn3m != null && data.marketReturn3m <= 0
  const spec = SAUDI_HORIZONS[horizon ?? 'moderate']
  const targetsText = spec.targetsR.map(r => `${r}:1`).join(' و')

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">📋 خطة اليوم الاحترافية</h1>
        {data ? <div className="text-[10px] text-slate-500">من {data.universe} سهماً · {new Date(data.asOf).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div> : null}
      </div>

      <div className="space-y-2 rounded-2xl border border-white/10 p-3" style={{ background: 'rgba(255,255,255,.02)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-black text-white">ما أسلوبك في التداول؟</div>
          <div className="flex overflow-hidden rounded-lg border border-white/10" role="group" aria-label="أسلوب التداول">
            {saudiHorizonList().map(h => (
              <button key={h.key} type="button" onClick={() => switchHorizon(h.key)} aria-pressed={horizon === h.key}
                className="px-3 py-1.5 text-xs font-bold"
                style={{ background: horizon === h.key ? `${ACCENT}22` : 'transparent', color: horizon === h.key ? '#D1FAE5' : '#64748B' }}>
                {h.emoji} {h.labelAr}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs leading-6 text-slate-400">
          <span className="font-bold text-slate-200">مدة الاحتفاظ: {spec.holdAr}.</span> {spec.desc}
        </div>
        {!spec.tested ? (
          <div className="text-[11px] font-bold text-amber-300/80">هذا الأسلوب لم يُختبر تاريخياً بعد، فاستخدمه للمتابعة. الأسلوب المختبر هو «متوسط».</div>
        ) : null}
      </div>

      <p className="text-xs leading-6 text-slate-400">
        أفضل الأسهم فنياً اليوم من كل السوق، ولكل سهم منطقة دخول، ووقف خسارة على بعد {spec.stopAtr === 1 ? 'متوسط التذبذب اليومي مرة واحدة' : spec.stopAtr === 2 ? 'ضعفي متوسط التذبذب اليومي' : 'ثلاثة أضعاف متوسط التذبذب اليومي'}، وثلاثة أهداف بنسبة ربح إلى مخاطرة {targetsText}. هذه قائمة مراقبة مرتّبة، والقرار لك.
      </p>

      {bearish ? (
        <div className="rounded-xl border px-4 py-3 text-xs leading-6" style={{ borderColor: `${AMBER}44`, background: `${AMBER}0d`, color: '#FDE68A' }}>
          السوق العام هابط في آخر ٣ أشهر ({n(data!.marketReturn3m)}%). في هذه الحالة يخفّض المحرّك «المرشّح القوي» إلى «انتظر»، لأن الترشيحات في السوق الهابط كانت أضعف في الاختبار التاريخي. لذلك تجد هنا غالباً أسهماً «قريبة من الترشيح»: فوق متوسط 200 يوم، بلا تصريف، وبدرجة {PLAN_NEAR_MIN_SCORE} فأعلى. خفّف حجم مراكزك.
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
          <div className="text-sm text-slate-400">يجهّز خطة اليوم…</div>
        </div>
      ) : !data ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">{err || 'تعذّر التحميل'}</div>
      ) : data.picks.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-slate-400" style={{ background: 'rgba(255,255,255,.02)' }}>
          لا يوجد اليوم سهم يحقّق شروط الخطة. أحياناً يكون عدم الدخول هو القرار الأفضل.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-500">
            {data.strongCount > 0 ? `${data.strongCount} مرشّحاً قوياً اليوم` : 'لا مرشّح قوياً اليوم'} · يُعرض {data.picks.length}
          </div>
          {data.picks.map((p, i) => <PickCard key={p.symbol} p={p} rank={i + 1} />)}
        </div>
      )}

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        <span className="font-bold text-amber-300/80">قيد المعايرة: </span>{SAUDI_CALIBRATION.summary} الأسعار من ياهو مؤخّرة نحو 15 دقيقة، فراجع السعر الحي قبل أي قرار. تابع نتائج الترشيحات السابقة في <Link href="/saudi/performance" className="text-emerald-300">سجل الأداء</Link>.
      </div>
    </div>
  )
}
