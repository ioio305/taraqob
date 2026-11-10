'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { SAUDI_STOCKS } from '@/lib/v2/saudiStocks'
import { describeAlert } from '@/lib/v2/saudiAlerts'
import { showBrowserNotificationOnce } from '@/lib/v2/browserNotifications'

const ACCENT = '#16A34A'
const RED = '#F04760'
const AMBER = '#F5B301'
const REFRESH_SEC = 60

type AlertView = {
  id: string; symbol: string; name: string
  direction: 'above' | 'below'; price: number; note: string | null
  created_at: string; triggered_at: string | null; triggered_price: number | null
  current: number | null; distancePct: number | null
}
type AlertsData = { asOf: string | null; alerts: AlertView[]; fresh: string[]; error?: string }
type Form = { symbol: string; price: string; direction: '' | 'above' | 'below'; note: string }
const EMPTY: Form = { symbol: '', price: '', direction: '', note: '' }

function n(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function day(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' })
}
const inputCls = 'mt-0.5 w-full rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-2 text-base text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none sm:text-sm'
const stockName = (symbol: string) => SAUDI_STOCKS.find(s => s.symbol === `${symbol}.SR`)?.name

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] text-slate-500">{label}</span>
      {children}
    </label>
  )
}

export default function SaudiAlerts() {
  const [data, setData] = useState<AlertsData | null>(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState<Form>(EMPTY)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [notifyState, setNotifyState] = useState<NotificationPermission | 'unsupported'>('default')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/saudi/alerts', { cache: 'no-store' })
      const json = (await res.json()) as AlertsData
      if (!res.ok || json.error) { setErr(json.error ?? 'تعذّر تحميل التنبيهات'); return }
      setData(json); setErr('')
      for (const a of json.alerts) {
        if (json.fresh.includes(a.id)) showBrowserNotificationOnce(`ترقّب · تحقّق تنبيه ${a.name}`, `${describeAlert(a)} — آخر سعر ${n(a.triggered_price)}`)
      }
    } catch { setErr('تعذّر الاتصال') }
  }, [])

  useEffect(() => {
    setNotifyState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
    // فتح الصفحة من زر 🔔 في صفحة السهم يملأ الرمز مسبقاً.
    const q = new URLSearchParams(window.location.search)
    const symbol = (q.get('symbol') ?? '').replace(/\D/g, '').slice(0, 4)
    if (symbol.length === 4) { setForm({ ...EMPTY, symbol }); setOpen(true) }
    load()
    const t = setInterval(load, REFRESH_SEC * 1000)
    return () => clearInterval(t)
  }, [load])

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return
    setNotifyState(await Notification.requestPermission())
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setFormErr('')
    try {
      const res = await fetch('/api/v2/saudi/alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, direction: form.direction || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setFormErr(json.error ?? 'تعذّر الحفظ'); return }
      setForm(EMPTY); setOpen(false)
      await load()
    } finally { setSaving(false) }
  }

  async function remove(a: AlertView) {
    if (!window.confirm(`حذف تنبيه ${a.name} (${describeAlert(a)})؟`)) return
    await fetch(`/api/v2/saudi/alerts?id=${encodeURIComponent(a.id)}`, { method: 'DELETE' })
    await load()
  }

  const active = data?.alerts.filter(a => !a.triggered_at) ?? []
  const done = data?.alerts.filter(a => a.triggered_at) ?? []
  const current = data?.alerts.find(a => a.symbol === form.symbol)?.current

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-black text-white">🔔 تنبيهاتي السعرية — السوق السعودي</h1>
        <button type="button" onClick={() => { setForm(EMPTY); setFormErr(''); setOpen(v => !v) }}
          className="rounded-lg px-3 py-1.5 text-xs font-black text-white" style={{ background: ACCENT }}>
          {open ? 'إغلاق' : '+ تنبيه جديد'}
        </button>
      </div>

      {open ? (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-white/10 p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="text-xs font-black text-white">تنبيه جديد</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="رمز السهم">
              <input list="saudi-symbols" required inputMode="numeric" value={form.symbol}
                onChange={e => setForm({ ...form, symbol: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="مثل 2222" className={inputCls} />
              <datalist id="saudi-symbols">
                {SAUDI_STOCKS.map(s => <option key={s.symbol} value={s.symbol.replace('.SR', '')}>{s.name}</option>)}
              </datalist>
            </Field>
            <Field label="السعر الذي تنتظره">
              <input required inputMode="decimal" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className={inputCls} />
            </Field>
            <Field label="نبّهني حين">
              <select value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value as Form['direction'] })} className={inputCls}>
                <option value="">تلقائي حسب السعر الحالي</option>
                <option value="above">يصعد إليه أو أعلى</option>
                <option value="below">ينزل إليه أو أدنى</option>
              </select>
            </Field>
          </div>
          <Field label="ملاحظة لنفسك (اختياري)">
            <input value={form.note} maxLength={120} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="مثلاً: أشتري عند الدعم" className={inputCls} />
          </Field>
          {form.symbol.length === 4 ? (
            <div className="text-[11px] text-slate-400">
              {stockName(form.symbol) ?? 'رمز غير موجود في السوق الرئيسية'}
              {current != null ? ` · السعر الآن ${n(current)}` : ''}
            </div>
          ) : null}
          {formErr ? <div className="text-xs font-bold" style={{ color: RED }}>{formErr}</div> : null}
          <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-xs font-black text-white disabled:opacity-60" style={{ background: ACCENT }}>
            {saving ? 'يحفظ…' : 'حفظ التنبيه'}
          </button>
        </form>
      ) : null}

      {notifyState === 'default' ? (
        <button type="button" onClick={enableNotifications}
          className="w-full rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2.5 text-right text-xs text-amber-200">
          🔔 فعّل تنبيهات المتصفح لتصلك رسالة فور تحقّق التنبيه أثناء فتح المنصة
        </button>
      ) : null}

      {!data && !err ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
        </div>
      ) : err && !data ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-500">{err}</div>
      ) : data!.alerts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-8 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="text-2xl">🔔</div>
          <div className="mt-2 text-sm font-bold text-slate-300">لا توجد تنبيهات بعد</div>
          <div className="mt-1 text-xs leading-6 text-slate-500">اختر سهماً وسعراً تنتظره. ننبّهك حين يصل إليه، في المتصفح وبالبريد بعد إغلاق السوق.</div>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="text-xs font-black text-slate-300">تنتظر ({active.length})</div>
            {active.length === 0 ? <div className="text-xs text-slate-500">لا تنبيهات مفتوحة.</div> : active.map(a => {
              const near = a.distancePct != null && Math.abs(a.distancePct) <= 2
              return (
                <div key={a.id} className="rounded-2xl border p-4" style={{ borderColor: near ? `${AMBER}40` : 'rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/saudi/stock/${a.symbol}`} className="truncate text-base font-black text-white hover:underline">{a.name}</Link>
                        <span className="text-[10px] text-slate-500">{a.symbol}</span>
                        {near ? <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: AMBER, background: `${AMBER}1e` }}>قريب</span> : null}
                      </div>
                      <div className="mt-0.5 text-xs font-bold" style={{ color: a.direction === 'above' ? ACCENT : RED }}>
                        {a.direction === 'above' ? '▲' : '▼'} {describeAlert(a)}
                      </div>
                      {a.note ? <div className="mt-0.5 text-[11px] text-slate-400">{a.note}</div> : null}
                    </div>
                    <div className="shrink-0 text-left">
                      <div className="text-base font-black tabular-nums text-white">{n(a.current)}</div>
                      <div className="text-[11px] tabular-nums text-slate-500">
                        {a.distancePct != null ? `يبعد ${n(Math.abs(a.distancePct))}%` : 'لا سعر الآن'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">أُضيف {day(a.created_at)}</span>
                    <button type="button" onClick={() => remove(a)} className="text-red-300/70 hover:text-red-300">حذف</button>
                  </div>
                </div>
              )
            })}
          </section>

          {done.length ? (
            <section className="space-y-2">
              <div className="text-xs font-black text-slate-300">تحقّقت ({done.length})</div>
              {done.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 px-4 py-3" style={{ background: 'rgba(255,255,255,.015)' }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: ACCENT }}>✓</span>
                      <Link href={`/saudi/stock/${a.symbol}`} className="truncate text-sm font-bold text-slate-200 hover:underline">{a.name}</Link>
                      <span className="text-[10px] text-slate-500">{describeAlert(a)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">تحقّق {day(a.triggered_at)} عند {n(a.triggered_price)}</div>
                  </div>
                  <button type="button" onClick={() => remove(a)} className="shrink-0 text-[11px] text-slate-500 hover:text-red-300">حذف</button>
                </div>
              ))}
            </section>
          ) : null}
        </>
      )}

      <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
        الأسعار من ياهو مؤخّرة نحو 15 دقيقة. نفحص تنبيهاتك كل دقيقة أثناء فتح الصفحة، وبعد إغلاق كل جلسة نفحص أعلى وأدنى سعر في اليوم ونرسل لك بريداً بما تحقّق. الحد 50 تنبيهاً مفتوحاً.
      </div>
    </div>
  )
}
