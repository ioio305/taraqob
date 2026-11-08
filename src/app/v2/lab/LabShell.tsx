'use client'

import { useCallback, useEffect, useState } from 'react'
import type { StrategyRun, RunResults, RunStatus } from '@/lib/v2/lab/types'
import type { StrategySpec } from '@/lib/v2/lab/strategySpec'

// بصمة البيئة (معرّفة محليًا كي لا نستورد وحدة الخادم في حزمة العميل).
type LabEnvironment = {
  leanCli: { present: boolean; version: string | null }
  docker: { present: boolean; daemonRunning: boolean }
  localData: { dir: string; present: boolean }
  ready: boolean
  missingAr: string[]
  checkedAt: string
}

type Horizon = 'aggressive' | 'moderate' | 'conservative'

const STATUS_META: Record<RunStatus, { label: string; color: string }> = {
  pending:           { label: 'في الانتظار',    color: '#7C8A99' },
  running:           { label: 'قيد التشغيل',     color: '#60A5FA' },
  completed:         { label: 'مكتمل',           color: '#26D07C' },
  failed:            { label: 'فشل',             color: '#EF4444' },
  insufficient_data: { label: 'بيانات غير كافية', color: '#F59E0B' },
}
const LABEL_META: Record<string, { label: string; color: string }> = {
  historical: { label: 'تاريخي', color: '#60A5FA' },
  paper:      { label: 'ورقي',   color: '#A78BFA' },
  live:       { label: 'حقيقي',  color: '#26D07C' },
}
const HORIZONS: { h: Horizon; label: string; tip: string }[] = [
  { h: 'aggressive',   label: '🔴 مغامر', tip: 'انتهاء خلال يوم (DTE 0–1)' },
  { h: 'moderate',     label: '🟡 متوسط', tip: 'انتهاء خلال ٢–٥ أيام' },
  { h: 'conservative', label: '🟢 محافظ', tip: 'انتهاء أسبوع فأكثر (٧–٤٥)' },
]

function n(v: number | null | undefined, d = 2) {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export default function LabShell() {
  const [spec, setSpec] = useState<StrategySpec | null>(null)
  const [runs, setRuns] = useState<StrategyRun[]>([])
  const [env, setEnv] = useState<LabEnvironment | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const [horizon, setHorizon] = useState<Horizon>('moderate')
  const [from, setFrom] = useState('2023-01-01')
  const [to, setTo] = useState('2023-06-30')
  const [resolution, setResolution] = useState<'minute' | 'hour' | 'daily'>('minute')

  const load = useCallback(async () => {
    try {
      const [listRes, envRes] = await Promise.all([
        fetch('/api/v2/lab'),
        fetch('/api/v2/lab/environment'),
      ])
      if (listRes.ok) {
        const j = await listRes.json()
        setSpec(j.spec ?? null)
        setRuns(j.runs ?? [])
      }
      if (envRes.ok) setEnv((await envRes.json()).environment ?? null)
    } catch { /* تجاهل */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function runBacktest() {
    setRunning(true)
    try {
      const res = await fetch('/api/v2/lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizon, from, to, resolution }),
      })
      const j = await res.json()
      if (j.run) {
        setRuns((prev) => [j.run, ...prev])
        setSelected(j.run.id)
      }
    } catch { /* تجاهل */ }
    setRunning(false)
  }

  const current = runs.find((r) => r.id === selected) ?? null
  const dteBand = spec?.dteBands.find((b) => b.horizon === horizon)

  return (
    <div className="min-h-full p-4 pb-10 space-y-4 max-w-4xl mx-auto"
         style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">

      {/* ── العنوان ── */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🧪</span> مختبر الاستراتيجيات
        </h1>
        <p className="text-sm mt-1" style={{ color: '#7C8A99' }}>
          اختبار قواعد استراتيجية SPX تاريخيًا عبر محرك QuantConnect LEAN — خدمة بحث منفصلة عن توصيات المنصة.
        </p>
      </div>

      {/* ── تنبيه صدق دائم: التمييز + أن النتائج ليست توصيات ── */}
      <div className="rounded-xl px-4 py-3 text-xs leading-6"
           style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)', color: '#FCD34D' }}>
        <b>تنبيه:</b> نتائج المختبر لأغراض البحث فقط، وتُصنَّف بوضوح
        <span style={{ color: '#60A5FA' }}> تاريخي</span> /
        <span style={{ color: '#A78BFA' }}> ورقي</span> /
        <span style={{ color: '#26D07C' }}> حقيقي</span>.
        نجاح الاختبار التاريخي <b>ليس</b> توصية تنفيذ ولا وعد ربح. ولا تُعرض أرقام تركيبية: عند نقص
        البيانات يظهر السبب والمتطلبات لا نتيجة ملفّقة.
      </div>

      {/* ── بطاقة بيئة المحرك ── */}
      <EnvCard env={env} loading={loading} />

      {/* ── مواصفة الاستراتيجية (القواعد والتكاليف) ── */}
      {spec && <SpecCard spec={spec} />}

      {/* ── نموذج تشغيل جديد ── */}
      <section className="rounded-2xl p-4 space-y-3"
               style={{ background: 'rgba(13,27,42,0.82)', border: '1px solid rgba(201,148,58,0.18)' }}>
        <div className="text-sm font-bold" style={{ color: '#C9943A' }}>تشغيل اختبار جديد — {spec?.label ?? 'SPX OTM'}</div>

        <div>
          <div className="text-xs mb-1.5" style={{ color: '#7C8A99' }}>الأفق الزمني (يحدّد نطاق الانتهاء DTE)</div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {HORIZONS.map((x) => (
              <button key={x.h} onClick={() => setHorizon(x.h)} title={x.tip}
                className="text-xs px-3 py-1.5 font-bold flex-1"
                style={{ background: horizon === x.h ? 'rgba(201,148,58,0.2)' : 'transparent', color: horizon === x.h ? '#E8D5A3' : '#7C8A99' }}>
                {x.label}
              </button>
            ))}
          </div>
          {dteBand && (
            <div className="text-xs mt-1.5" style={{ color: '#5E6E7F' }}>
              تاريخ الانتهاء: {dteBand.min}–{dteBand.max} يوم (هدف {dteBand.target}) ·
              مدة الاحتفاظ وإطار التحليل مستقلّان عن الانتهاء.
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="من تاريخ">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="إلى تاريخ">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="دقّة البيانات">
            <select value={resolution} onChange={(e) => setResolution(e.target.value as never)} style={inputStyle}>
              <option value="minute">دقيقة (الأدق لِلمس الوقف/الهدف)</option>
              <option value="hour">ساعة</option>
              <option value="daily">يومي</option>
            </select>
          </Field>
        </div>

        <button onClick={runBacktest} disabled={running}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
          style={{ background: 'rgba(201,148,58,0.18)', border: '1px solid rgba(201,148,58,0.4)', color: '#E8D5A3' }}>
          {running ? 'جارٍ التشغيل…' : '▶ شغّل الاختبار عبر LEAN'}
        </button>
        {env && !env.ready && (
          <div className="text-xs" style={{ color: '#F59E0B' }}>
            البيئة غير جاهزة لتشغيل حقيقي الآن — سيُسجَّل التشغيل بحالة «بيانات غير كافية» مع المتطلبات.
          </div>
        )}
      </section>

      {/* ── قائمة التشغيلات + التفاصيل ── */}
      <section className="space-y-3">
        <div className="text-sm font-bold" style={{ color: '#C9943A' }}>التشغيلات ({runs.length})</div>
        {runs.length === 0 && !loading && (
          <div className="text-sm py-6 text-center rounded-xl"
               style={{ color: '#5E6E7F', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            لا تشغيلات بعد — ابدأ باختبار جديد أعلاه.
          </div>
        )}
        {runs.map((r) => (
          <RunRow key={r.id} run={r} open={r.id === selected} onToggle={() => setSelected(r.id === selected ? null : r.id)} />
        ))}
      </section>

      {current && <RunDetail run={current} />}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '6px 10px', color: '#E8EDF2', fontSize: 13,
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs mb-1" style={{ color: '#7C8A99' }}>{label}</div>
      {children}
    </label>
  )
}

function EnvCard({ env, loading }: { env: LabEnvironment | null; loading: boolean }) {
  if (loading && !env) return <div className="text-xs" style={{ color: '#7C8A99' }}>جارٍ فحص بيئة المحرك…</div>
  if (!env) return null
  const chip = (ok: boolean, label: string, detail?: string) => (
    <span className="text-xs px-2 py-1 rounded-lg" title={detail}
      style={{ background: ok ? 'rgba(38,208,124,0.12)' : 'rgba(239,68,68,0.12)', color: ok ? '#34D399' : '#F87171', border: `1px solid ${ok ? 'rgba(38,208,124,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
      {ok ? '✓' : '✕'} {label}
    </span>
  )
  return (
    <section className="rounded-2xl p-4 space-y-2.5"
             style={{ background: 'rgba(13,27,42,0.82)', border: `1px solid ${env.ready ? 'rgba(38,208,124,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold" style={{ color: env.ready ? '#26D07C' : '#F59E0B' }}>
          بيئة المحرك: {env.ready ? 'جاهزة' : 'غير جاهزة لتشغيل حقيقي'}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {chip(env.leanCli.present, 'LEAN CLI', env.leanCli.version ?? undefined)}
        {chip(env.docker.present, 'Docker')}
        {chip(env.docker.daemonRunning, 'خدمة Docker')}
        {chip(env.localData.present, 'بيانات محلية', env.localData.dir)}
      </div>
      {env.missingAr.length > 0 && (
        <ul className="text-xs space-y-1 mt-1" style={{ color: '#FCD34D' }}>
          {env.missingAr.map((m, i) => <li key={i}>• {m}</li>)}
        </ul>
      )}
    </section>
  )
}

function SpecCard({ spec }: { spec: StrategySpec }) {
  return (
    <details className="rounded-2xl p-4"
             style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <summary className="text-sm font-bold cursor-pointer" style={{ color: '#C9943A' }}>
        قواعد الاستراتيجية ونموذج التكاليف ({spec.version})
      </summary>
      <div className="mt-3 space-y-2 text-xs" style={{ color: '#CBD5E1' }}>
        <div>{spec.descriptionAr}</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          <Mini label="البوابة" value="خارج المال فقط" />
          <Mini label="سعر الطلب (متوازن)" value={`$${spec.askRange.balanced[0]}–$${spec.askRange.balanced[1]}`} />
          <Mini label="المضاعف" value={String(spec.costModel.contractMultiplier)} />
          <Mini label="العمولة/عقد" value={`$${spec.costModel.commissionPerContract}`} />
          <Mini label="افتراض الفرق" value={`${spec.costModel.fillAssumption} (${spec.costModel.spreadFraction})`} />
          <Mini label="داخل الشمعة" value={spec.costModel.intrabarAssumption === 'stop_first' ? 'الوقف أولًا (محافظ)' : spec.costModel.intrabarAssumption} />
        </div>
        <div className="mt-2">
          <div className="font-bold mb-1" style={{ color: '#93C5FD' }}>نطاقات الانتهاء حسب الأفق:</div>
          <div className="flex flex-wrap gap-2">
            {spec.dteBands.map((b) => (
              <span key={b.horizon} className="px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {b.labelAr}: {b.min}–{b.max} يوم
              </span>
            ))}
          </div>
        </div>
        <div className="mt-2">
          <div className="font-bold mb-1" style={{ color: '#FCA5A5' }}>متطلبات البيانات الحقيقية:</div>
          <ul className="space-y-1">{spec.dataRequirements.map((r, i) => <li key={i}>• {r}</li>)}</ul>
        </div>
      </div>
    </details>
  )
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="text-[10px]" style={{ color: '#64748B' }}>{label}</div>
      <div className="text-xs font-bold mt-0.5" style={{ color: '#E8EDF2' }}>{value}</div>
    </div>
  )
}

function RunRow({ run, open, onToggle }: { run: StrategyRun; open: boolean; onToggle: () => void }) {
  const s = STATUS_META[run.status]
  const lbl = LABEL_META[run.label]
  return (
    <button onClick={onToggle} className="w-full rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-right"
      style={{ background: 'rgba(0,0,0,0.18)', border: `1px solid ${open ? s.color : 'rgba(255,255,255,0.08)'}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: `${s.color}1A`, color: s.color, border: `1px solid ${s.color}40` }}>{s.label}</span>
        <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: `${lbl.color}1A`, color: lbl.color }}>{lbl.label}</span>
        <span className="text-xs font-mono" style={{ color: '#CBD5E1' }}>{run.config.horizon} · {run.config.period.from} → {run.config.period.to}</span>
      </div>
      <span className="text-xs" style={{ color: '#7C8A99' }}>{open ? '▲' : '▼'}</span>
    </button>
  )
}

function RunDetail({ run }: { run: StrategyRun }) {
  return (
    <section className="rounded-2xl p-4 space-y-3"
             style={{ background: 'rgba(13,27,42,0.82)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-bold text-white">تفاصيل التشغيل</div>
        <div className="text-xs font-mono" style={{ color: '#7C8A99' }}>إصدار {run.config.strategyVersion}</div>
      </div>

      {/* بطاقة المصدر/الجودة — تُعرض دائمًا */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Mini label="الأفق" value={run.config.horizon} />
        <Mini label="الانتهاء (DTE)" value={`${run.config.dte.min}–${run.config.dte.max}`} />
        <Mini label="الدقّة" value={run.config.resolution} />
        <Mini label="المصدر" value={run.dataSource.provider} />
      </div>
      <div className="rounded-lg px-3 py-2 text-xs leading-6" style={{ background: 'rgba(255,255,255,0.025)', color: '#94A3B8' }}>
        <div><b style={{ color: '#CBD5E1' }}>ترخيص البيانات:</b> {run.dataSource.licenseAr}</div>
        <div className="mt-1"><b style={{ color: '#CBD5E1' }}>جودة البيانات:</b> {run.dataQuality.realContractPrices ? 'أسعار عقود حقيقية' : 'لا أسعار عقود حقيقية'} ·
          {run.dataQuality.hasBidAsk ? ' bid/ask متوفّر' : ' بلا bid/ask'} ·
          {run.dataQuality.intrabarResolution ? ' دقّة داخل الشمعة' : ' دقّة محدودة'}</div>
        {run.engineAr && <div className="mt-1"><b style={{ color: '#CBD5E1' }}>المحرك:</b> {run.engineAr}</div>}
      </div>

      {/* الحالة غير المكتملة: السبب + المتطلبات (لا أرقام) */}
      {run.status !== 'completed' && (
        <div className="rounded-xl px-4 py-3 space-y-2"
             style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="text-sm font-bold" style={{ color: '#F59E0B' }}>{STATUS_META[run.status].label} — لا نتيجة ملفّقة</div>
          {run.reasonAr && <div className="text-xs" style={{ color: '#FCD34D' }}>{run.reasonAr}</div>}
          {run.requirementsAr.length > 0 && (
            <div>
              <div className="text-xs font-bold mb-1" style={{ color: '#FCD34D' }}>المتطلبات لإتمامه حقيقةً:</div>
              <ul className="text-xs space-y-1" style={{ color: '#E8D5A3' }}>
                {run.requirementsAr.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* النتائج الحقيقية (فقط عند الاكتمال) */}
      {run.status === 'completed' && run.results && <Results r={run.results} />}
    </section>
  )
}

function Results({ r }: { r: RunResults }) {
  const metric = (label: string, value: string, color = '#E8EDF2') => (
    <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px]" style={{ color: '#64748B' }}>{label}</div>
      <div className="text-sm font-black font-mono mt-1" style={{ color }}>{value}</div>
    </div>
  )
  const pnlColor = r.netPnl >= 0 ? '#26D07C' : '#F0435A'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
        {metric('عدد الصفقات', String(r.trades))}
        {metric('نسبة النجاح', `${n(r.winRatePct, 1)}%`)}
        {metric('صافي الربح/الخسارة', `$${n(r.netPnl, 0)}`, pnlColor)}
        {metric('معامل الربح', r.profitFactor == null ? '—' : n(r.profitFactor))}
        {metric('متوسط الرابحة', `$${n(r.avgWin, 0)}`, '#26D07C')}
        {metric('متوسط الخاسرة', `$${n(r.avgLoss, 0)}`, '#F0435A')}
        {metric('العائد المتوقع/صفقة', r.expectancyR == null ? '—' : `${n(r.expectancyR)}R`)}
        {metric('أقصى تراجع', r.maxDrawdownPct == null ? '—' : `${n(r.maxDrawdownPct, 1)}%`, '#F59E0B')}
      </div>

      {/* مقارنة بالمرجع */}
      <div className="rounded-lg px-3 py-2 flex items-center justify-around text-xs"
           style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
        <div className="text-center"><div style={{ color: '#7C8A99' }}>عائد الاستراتيجية</div>
          <div className="font-bold font-mono" style={{ color: pnlColor }}>{r.strategyReturnPct == null ? '—' : `${n(r.strategyReturnPct, 1)}%`}</div></div>
        <div className="text-center"><div style={{ color: '#7C8A99' }}>المرجع (شراء واحتفاظ)</div>
          <div className="font-bold font-mono" style={{ color: '#93C5FD' }}>{r.benchmarkReturnPct == null ? '—' : `${n(r.benchmarkReturnPct, 1)}%`}</div></div>
      </div>

      <EquityCurve points={r.equityCurve} />

      {/* سجل الصفقات */}
      {r.tradeLog.length > 0 && (
        <details className="rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <summary className="text-xs font-bold cursor-pointer px-3 py-2" style={{ color: '#CBD5E1' }}>سجل الصفقات ({r.tradeLog.length})</summary>
          <div className="overflow-x-auto px-3 pb-3">
            <table className="w-full text-xs" style={{ color: '#94A3B8' }}>
              <thead><tr style={{ color: '#64748B' }}>
                <th className="text-right py-1">الدخول</th><th className="text-right">النوع</th><th className="text-right">الستريك</th>
                <th className="text-right">دخول</th><th className="text-right">خروج</th><th className="text-right">صافي</th><th className="text-right">السبب</th>
              </tr></thead>
              <tbody>
                {r.tradeLog.slice(0, 100).map((t, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-1">{t.openedAt?.slice(0, 10)}</td>
                    <td>{t.type === 'call' ? 'صاعد' : 'هابط'}</td>
                    <td className="font-mono">{t.strike}</td>
                    <td className="font-mono">${n(t.entryPrice)}</td>
                    <td className="font-mono">{t.exitPrice == null ? '—' : `$${n(t.exitPrice)}`}</td>
                    <td className="font-mono" style={{ color: t.netPnl >= 0 ? '#26D07C' : '#F0435A' }}>${n(t.netPnl, 0)}</td>
                    <td>{t.exitReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="text-xs" style={{ color: '#5E6E7F' }}>
        النتائج تاريخية لأغراض البحث فقط — لا تُقرأ كتوصية تنفيذ ولا كنسبة ثقة.
      </div>
    </div>
  )
}

function EquityCurve({ points }: { points: RunResults['equityCurve'] }) {
  if (!points || points.length < 2) return null
  const w = 600, h = 160, pad = 8
  const eqs = points.map((p) => p.equity)
  const benches = points.map((p) => p.benchmark).filter((v): v is number => v != null)
  const all = [...eqs, ...benches]
  const min = Math.min(...all), max = Math.max(...all)
  const span = max - min || 1
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - 2 * pad)
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad)
  const line = (sel: (p: RunResults['equityCurve'][number]) => number | null) =>
    points.map((p, i) => { const v = sel(p); return v == null ? null : `${x(i)},${y(v)}` })
      .filter(Boolean).join(' ')
  return (
    <div className="rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-xs mb-1" style={{ color: '#7C8A99' }}>منحنى رأس المال مقابل المرجع</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 160 }}>
        <polyline fill="none" stroke="#26D07C" strokeWidth="2" points={line((p) => p.equity)} />
        {benches.length > 1 && <polyline fill="none" stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="4 3" points={line((p) => p.benchmark)} />}
      </svg>
      <div className="flex gap-4 text-xs mt-1">
        <span style={{ color: '#26D07C' }}>— الاستراتيجية</span>
        {benches.length > 1 && <span style={{ color: '#60A5FA' }}>- - المرجع</span>}
      </div>
    </div>
  )
}
