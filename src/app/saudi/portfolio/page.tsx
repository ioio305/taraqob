'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { SAUDI_STOCKS } from '@/lib/v2/saudiStocks'
import { STATUS_LABEL, type HoldingAssessment, type HoldingStatus } from '@/lib/v2/saudiPortfolio'
import { showBrowserNotificationOnce } from '@/lib/v2/browserNotifications'

const ACCENT = '#16A34A'
const RED = '#F04760'
const REFRESH_SEC = 60

type HoldingView = {
  id: string; symbol: string; name: string; sector?: string
  qty: number; buy_price: number; buy_date: string | null; stop_price: number | null; target_price: number | null; note: string | null
  quote: { price: number; change: number; techScore: number; techSignal: string; flow: string } | null
  assessment: HoldingAssessment | null
}
type PortfolioData = {
  asOf: string | null
  totals: { cost: number; value: number; pnl: number; pnlPct: number; dayPnl: number }
  holdings: HoldingView[]
  error?: string
}
type Form = { symbol: string; qty: string; buy_price: string; buy_date: string; stop_price: string; target_price: string; note: string }
const EMPTY: Form = { symbol: '', qty: '', buy_price: '', buy_date: '', stop_price: '', target_price: '', note: '' }
const ALERT_STATUSES: HoldingStatus[] = ['stop_hit', 'target_hit', 'near_stop', 'near_target']

function n(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function signed(v: number, d = 2) {
  return `${v > 0 ? '+' : ''}${n(v, d)}`
}
const pnlColor = (v: number) => (v > 0 ? ACCENT : v < 0 ? RED : '#94A3B8')

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] text-slate-500">{label}</span>
      {children}
    </label>
  )
}
const inputCls = 'mt-0.5 w-full rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-2 text-base text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none sm:text-sm'

export default function SaudiPortfolio() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState<Form>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [notifyState, setNotifyState] = useState<NotificationPermission | 'unsupported'>('default')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/saudi/portfolio', { cache: 'no-store' })
      const json = (await res.json()) as PortfolioData
      if (!res.ok || json.error) { setErr(json.error ?? 'تعذّر تحميل المحفظة'); return }
      setData(json); setErr('')
      for (const h of json.holdings) {
        const a = h.assessment
        if (a && ALERT_STATUSES.includes(a.status)) {
          showBrowserNotificationOnce(`ترقّب · ${h.name}: ${STATUS_LABEL[a.status].label}`, a.headline)
        }
      }
    } catch { setErr('تعذّر الاتصال') }
  }, [])

  useEffect(() => {
    setNotifyState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
    load()
    const t = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(t)
  }, [load])

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return
    setNotifyState(await Notification.requestPermission())
  }

  function startEdit(h: HoldingView) {
    setEditId(h.id)
    setForm({
      symbol: h.symbol, qty: String(h.qty), buy_price: String(h.buy_price), buy_date: h.buy_date ?? '',
      stop_price: h.stop_price != null ? String(h.stop_price) : '', target_price: h.target_price != null ? String(h.target_price) : '', note: h.note ?? '',
    })
    setFormErr(''); setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setFormErr('')
    try {
      const res = await fetch(editId ? `/api/v2/saudi/portfolio?id=${encodeURIComponent(editId)}` : '/api/v2/saudi/portfolio', {
        method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setFormErr(json.error ?? 'تعذّر الحفظ'); return }
      setForm(EMPTY); setEditId(null); setOpen(false)
      await load()
    } finally { setSaving(false) }
  }

  async function remove(h: HoldingView) {
    if (!window.confirm(`حذف مركز ${h.name} من محفظتك؟`)) return
    await fetch(`/api/v2/saudi/portfolio?id=${encodeURIComponent(h.id)}`, { method: 'DELETE' })
    await load()
  }

  const t = data?.totals
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">💼 محفظتي وصفقاتي — السوق السعودي</h1>
        <button type="button" onClick={() => { setEditId(null); setForm(EMPTY); setFormErr(''); setOpen(v => !v) }}
          className="rounded-lg px-3 py-1.5 text-xs font-black text-white" style={{ background: ACCENT }}>
          {open && !editId ? 'إغلاق' : '+ أضف سهماً'}
        </button>
      </div>

      {open ? (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="text-xs font-black text-white">{editId ? 'تعديل المركز' : 'مركز جديد'}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="رمز السهم">
              <input list="saudi-symbols" required inputMode="numeric" value={form.symbol} disabled={!!editId}
                onChange={e => setForm({ ...form, symbol: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="مثل 2222" className={inputCls} />
              <datalist id="saudi-symbols">
                {SAUDI_STOCKS.map(s => <option key={s.symbol} value={s.symbol.replace('.SR', '')}>{s.name}</option>)}
              </datalist>
            </Field>
            <Field label="الكمية (سهم)">
              <input required inputMode="decimal" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} className={inputCls} />
            </Field>
            <Field label="سعر الشراء">
              <input required inputMode="decimal" value={form.buy_price} onChange={e => setForm({ ...form, buy_price: e.target.value })} className={inputCls} />
            </Field>
            <Field label="وقف الخسارة (اختياري)">
              <input inputMode="decimal" value={form.stop_price} onChange={e => setForm({ ...form, stop_price: e.target.value })} placeholder="يُحسب تلقائياً" className={inputCls} />
            </Field>
            <Field label="الهدف (اختياري)">
              <input inputMode="decimal" value={form.target_price} onChange={e => setForm({ ...form, target_price: e.target.value })} placeholder="يُحسب تلقائياً" className={inputCls} />
            </Field>
            <Field label="تاريخ الشراء (اختياري)">
              <input type="date" value={form.buy_date} onChange={e => setForm({ ...form, buy_date: e.target.value })} className={inputCls} />
            </Field>
          </div>
          {form.symbol.length === 4 ? (
            <div className="text-[11px] text-slate-400">{SAUDI_STOCKS.find(s => s.symbol === `${form.symbol}.SR`)?.name ?? 'رمز غير موجود في السوق الرئيسية'}</div>
          ) : null}
          {formErr ? <div className="text-xs font-bold" style={{ color: RED }}>{formErr}</div> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-xs font-black text-white disabled:opacity-60" style={{ background: ACCENT }}>
              {saving ? 'يحفظ…' : 'حفظ'}
            </button>
            {editId ? <button type="button" onClick={() => { setEditId(null); setForm(EMPTY); setOpen(false) }} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300">إلغاء</button> : null}
          </div>
        </form>
      ) : null}

      {notifyState === 'default' ? (
        <button type="button" onClick={enableNotifications}
          className="w-full rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2.5 text-right text-xs text-amber-200">
          🔔 فعّل تنبيهات المتصفح لتصلك رسالة حين يقترب سهم من وقفه أو هدفه أثناء فتح المنصة
        </button>
      ) : null}

      {!data && !err ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
        </div>
      ) : err && !data ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-500">{err}</div>
      ) : data!.holdings.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-8 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="text-2xl">💼</div>
          <div className="mt-2 text-sm font-bold text-slate-300">محفظتك فارغة</div>
          <div className="mt-1 text-xs leading-6 text-slate-500">أضف الأسهم التي تملكها: الرمز والكمية وسعر الشراء. نحسب لك الربح والخسارة، ونقترح وقفاً وهدفاً، وننبّهك عند الاقتراب منهما.</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'قيمة المحفظة', value: `${n(t!.value)} ر.س` },
              { label: 'التكلفة', value: `${n(t!.cost)} ر.س` },
              { label: 'الربح/الخسارة', value: `${signed(t!.pnl)} (${signed(t!.pnlPct)}%)`, color: pnlColor(t!.pnl) },
              { label: 'تغيّر اليوم', value: `${signed(t!.dayPnl)} ر.س`, color: pnlColor(t!.dayPnl) },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-white/8 px-3 py-2.5" style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="text-[10px] text-slate-500">{c.label}</div>
                <div className="mt-0.5 text-sm font-black tabular-nums" style={{ color: c.color ?? '#E2E8F0' }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {data!.holdings.map(h => {
              const a = h.assessment
              const st = a ? STATUS_LABEL[a.status] : null
              return (
                <div key={h.id} className="rounded-2xl border p-4" style={{ borderColor: st ? `${st.color}40` : 'rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/saudi/stock/${h.symbol}`} className="truncate text-base font-black text-white hover:underline">{h.name}</Link>
                        <span className="text-[10px] text-slate-500">{h.symbol}</span>
                        {st ? <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: st.color, background: `${st.color}1e` }}>{st.label}</span> : null}
                      </div>
                      <div className="text-[11px] tabular-nums text-slate-500">{n(h.qty, 0)} سهم × {n(h.buy_price)}{h.buy_date ? ` · ${h.buy_date}` : ''}</div>
                    </div>
                    {a && h.quote ? (
                      <div className="shrink-0 text-left">
                        <div className="text-base font-black tabular-nums text-white">{n(h.quote.price)}</div>
                        <div className="text-[11px] font-bold tabular-nums" style={{ color: pnlColor(a.pnl) }}>{signed(a.pnl)} ر.س ({signed(a.pnlPct)}%)</div>
                      </div>
                    ) : <div className="text-[11px] text-slate-500">لا سعر متاح الآن</div>}
                  </div>

                  {a ? (
                    <>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg px-2 py-1.5" style={{ background: `${RED}0d` }}>
                          <div className="text-[10px] text-slate-500">الوقف{a.stopIsDefault ? ' (محسوب)' : ''}</div>
                          <div className="text-xs font-black tabular-nums" style={{ color: RED }}>{n(a.stop)}</div>
                        </div>
                        <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,.04)' }}>
                          <div className="text-[10px] text-slate-500">وقف متحرّك</div>
                          <div className="text-xs font-black tabular-nums text-slate-200">{a.trailingStop != null ? n(a.trailingStop) : '—'}</div>
                        </div>
                        <div className="rounded-lg px-2 py-1.5" style={{ background: `${ACCENT}0d` }}>
                          <div className="text-[10px] text-slate-500">الهدف{a.targetIsDefault ? ' (محسوب)' : ''}</div>
                          <div className="text-xs font-black tabular-nums" style={{ color: ACCENT }}>{n(a.target)}</div>
                        </div>
                      </div>
                      <div className="mt-3 rounded-xl px-3 py-2 text-xs leading-6" style={{ background: 'rgba(255,255,255,.03)' }}>
                        <div className="font-black" style={{ color: st?.color }}>🚪 مساعد الخروج: {a.headline}</div>
                        {a.advice.map(x => <div key={x} className="text-slate-300">• {x}</div>)}
                        {h.quote ? <div className="text-[10px] text-slate-500">التقييم الفني الآن: {h.quote.techSignal} ({h.quote.techScore}) · السيولة: {h.quote.flow}</div> : null}
                      </div>
                    </>
                  ) : null}

                  <div className="mt-2 flex gap-3 text-[11px]">
                    <button type="button" onClick={() => startEdit(h)} className="text-slate-400 hover:text-white">تعديل</button>
                    <button type="button" onClick={() => remove(h)} className="text-red-300/70 hover:text-red-300">حذف</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        الأسعار من ياهو مؤخّرة نحو 15 دقيقة وتتحدّث كل دقيقة أثناء فتح الصفحة. مساعد الخروج يقيّم خطتك أنت (الوقف والهدف) ولا يضمن نتيجة، والقرار النهائي لك.
      </div>
    </div>
  )
}
