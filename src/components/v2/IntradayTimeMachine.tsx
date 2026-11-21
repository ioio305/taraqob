'use client'

// آلة الزمن لـ SPX والصناديق: تعيد سيناريو التوصية (حركة الأصل حتى الهدف أو الوقف أو نهاية
// نافذة الفرصة) 10,000 مرة من شموع 5 دقائق لآخر 60 يوماً. عرض فقط — لا تغيّر التوصية.

import { useCallback, useEffect, useState } from 'react'
import type { TmHistory, TmRun } from '@/lib/v2/timeMachine'
import {
  TM_AMBER, TM_GRAY, TM_GREEN, TM_RED, TmBar, TmChip, TmLocked, TmRunButton, TmShell, TmSpinner, TmVerdict, tmAvgText, tmPct,
} from './TimeMachineParts'

type Scenario = { direction: 'call' | 'put'; entry: number; target1: { value: number }; target2: { value: number }; invalidation: { value: number } }
type OppWindow = { kind: string; maxMinutes: number; label?: string }
type Resp = {
  symbol: string
  plan: { direction: 'up' | 'down'; entry: number; stop: number; target: number; targetIndex: number; targetsCount: number; riskPct: number; targetPct: number }
  window: { bars: number; minutes: number; style: 'day' | 'swing'; startsAtOpen: boolean; cappedAtExit: boolean }
  neutral: TmRun
  trend: TmRun
  history: TmHistory
  data: { sessions: number; from: string; to: string; seed: number }
  error?: string
}

const n2 = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} دقيقة`
  if (minutes < 390) {
    const h = Math.floor(minutes / 60), m = minutes % 60
    return m ? `${h} ساعة و${m} دقيقة` : `${h} ساعة`
  }
  const d = Math.round(minutes / 390)
  return d <= 1 ? 'جلسة كاملة' : `${d} جلسات`
}

export function IntradayTimeMachine({ platform, symbol, scenario, window: win }: {
  platform: 'spx' | 'funds'
  symbol: string
  scenario: Scenario
  window: OppWindow
}) {
  const [t, setT] = useState(1)
  const [started, setStarted] = useState(false)
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [locked, setLocked] = useState(false)

  const qs = new URLSearchParams({
    dir: scenario.direction === 'call' ? 'up' : 'down',
    entry: String(scenario.entry),
    stop: String(scenario.invalidation.value),
    t1: String(scenario.target1.value),
    t2: String(scenario.target2.value),
    minutes: String(Math.max(5, Math.round(win.maxMinutes))),
    style: win.kind === 'multi-session' ? 'swing' : 'day',
  })
  const base = platform === 'spx' ? '/api/v2/timemachine' : '/api/v2/funds/timemachine'
  if (platform === 'funds') qs.set('symbol', symbol)
  const query = qs.toString()

  const run = useCallback(async (ti: number) => {
    setLoading(true)
    try {
      const res = await fetch(`${base}?${query}&t=${ti}`)
      if (res.status === 403) { setLocked(true); setLoading(false); return }
      const json = (await res.json()) as Resp
      if (!res.ok || json.error) { setErr(json.error ?? 'تعذّر تشغيل آلة الزمن'); setData(null) }
      else { setData(json); setErr('') }
    } catch { setErr('تعذّر الاتصال') }
    setLoading(false)
  }, [base, query])

  useEffect(() => { if (started) run(t) }, [started, t, run])

  if (locked) return <TmLocked upgradeHref="/upgrade?market=us" />

  const r = data?.neutral
  const tr = data?.trend
  const h = data?.history
  const up = scenario.direction === 'call'
  const name = platform === 'spx' ? 'المؤشر' : 'الصندوق'
  const trendDiffers = r && tr && tr.verdict.key !== r.verdict.key
  const span = data ? duration(data.window.minutes) : ''

  return (
    <TmShell sub={`قبل أن تدخل: نعيد حركة ${name} من الآن 10,000 مرة من شموعه في آخر 60 يوماً، ونقول لك كم مرة وصلت الهدف قبل الوقف.`}>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <TmChip tone="green" active={t === 1} onClick={() => setT(1)}>الهدف الأول</TmChip>
        <TmChip tone="green" active={t === 2} onClick={() => setT(2)}>الهدف الثاني</TmChip>
      </div>

      {!started ? <TmRunButton onClick={() => setStarted(true)} />
        : loading && !data ? <TmSpinner />
        : err ? <div className="mt-4 rounded-xl px-3 py-3 text-xs text-slate-400" style={{ background: 'rgba(255,255,255,.03)' }}>{err}</div>
        : data && r && tr && h ? (
          <div className={`mt-4 space-y-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl px-2 py-2" style={{ background: 'rgba(255,255,255,.04)' }}>
                <div className="text-[10px] text-slate-500">{up ? 'دخول صاعد' : 'دخول هابط'}</div>
                <div className="text-sm font-black text-white">{n2(data.plan.entry)}</div>
              </div>
              <div className="rounded-xl px-2 py-2" style={{ background: `${TM_RED}12` }}>
                <div className="text-[10px] text-slate-500">إلغاء السيناريو</div>
                <div className="text-sm font-black" style={{ color: TM_RED }}>{n2(data.plan.stop)}</div>
                <div className="text-[10px] text-slate-500">{data.plan.riskPct}%</div>
              </div>
              <div className="rounded-xl px-2 py-2" style={{ background: `${TM_GREEN}12` }}>
                <div className="text-[10px] text-slate-500">{data.plan.targetIndex === 1 ? 'الهدف الأول' : 'الهدف الثاني'}</div>
                <div className="text-sm font-black" style={{ color: TM_GREEN }}>{n2(data.plan.target)}</div>
                <div className="text-[10px] text-slate-500">{data.plan.targetPct}%</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500">
              المدة: {span}{data.window.startsAtOpen ? ' — تبدأ من افتتاح الجلسة القادمة' : ''}{data.window.cappedAtExit ? ' — حتى الخروج الإجباري 3:30 م بتوقيت نيويورك' : ''}
            </div>

            <div className="space-y-2.5">
              <TmBar label="وصل الهدف أولاً" value={r.pTarget} color={TM_GREEN} />
              <TmBar label="ضرب الوقف أولاً" value={r.pStop} color={TM_RED} />
              <TmBar label={`لم يُحسم خلال ${span}`} value={r.pOpen} color={TM_GRAY} />
            </div>

            <TmVerdict text={r.verdict.text} tone={r.verdict.tone} notes={r.notes} />

            <ul className="space-y-1.5 text-xs leading-5 text-slate-300">
              <li>• {tmAvgText(r.avgR, false)} (حركة {name}).</li>
              <li>• سعر {name} بعد {span}: غالباً قرب {n2(r.endMedian)}، و9 من كل 10 محاولات بين {n2(r.endP5)} و{n2(r.endP95)}.</li>
              <li>
                • ما حدث فعلاً:{' '}
                {h.enough
                  ? <>في آخر {h.samples} جلسة، بالدخول في الوقت نفسه وبالاتجاه نفسه والمسافات نفسها: وصل الهدف {h.target} مرة، وضرب الوقف {h.stop} مرة، ولم يُحسم {h.open}.</>
                  : <>العيّنة التاريخية صغيرة ({h.samples} جلسة) فلا نحكم منها.</>}
              </li>
              {trendDiffers ? (
                <li style={{ color: TM_AMBER }}>
                  • لو استمر اتجاه آخر 60 يوماً: الهدف أولاً {tmPct(tr.pTarget)} والوقف أولاً {tmPct(tr.pStop)}. الفرق من الاتجاه الماضي وحده، ولا ضمان أن يستمر.
                </li>
              ) : null}
            </ul>

            <div className="rounded-xl px-3 py-2.5 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.025)' }}>
              هذه محاكاة لحركة {name} نفسه من {data.data.from} إلى {data.data.to}، وليست توقعاً. سعر العقد يتأثر أيضاً بمرور الوقت والتذبذب، فقد يخسر العقد حتى لو تحرّك {name} في صالحك ببطء.
              الأخبار والبيانات الاقتصادية قد تفعل ما لم يحدث في الماضي. رقم التكرار {data.data.seed}: النتيجة نفسها في كل مرة.
            </div>
          </div>
        ) : null}
    </TmShell>
  )
}
