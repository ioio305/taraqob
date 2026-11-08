'use client'

import { useState } from 'react'
import { useRiskSettings } from './PositionSizing'
import { entryGate, sizeExecutionTicket, type EntryGate, type TicketContract, type TicketScenario } from '@/lib/v2/executionTicket'
import { quoteIsCurrent, type LiveQuote } from '@/lib/v2/quoteQuality'

type Props = {
  loading: boolean
  error?: string | null
  contract?: TicketContract | null
  scenario?: TicketScenario | null
  validUntil?: string | null
  issuedAt?: string | null
  gate?: EntryGate
  marketOpen?: boolean
  marketClosed?: boolean
  quotes: Record<string, LiveQuote | null>
  now: number
}

const amount = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ExecutionTicket(props: Props) {
  const { settings, update } = useRiskSettings()
  const [commission, setCommission] = useState(0)
  const [copiedFor, setCopiedFor] = useState('')
  const c = props.contract
  const quote = c ? props.quotes[c.symbol] : null
  const underlying = props.quotes.SPX
  const gate = props.gate?.ready ? entryGate({
    marketOpen: props.marketOpen === true, marketClosed: props.marketClosed,
    contract: c, scenario: props.scenario, validUntil: props.validUntil,
    issuedAt: props.issuedAt, underlying, option: quote,
  }, props.now) : props.gate
  const sizing = c?.execution ? sizeExecutionTicket(settings.balance, settings.riskPct,
    c.execution.entryHigh, c.execution.hardProtectionPrice, commission) : null
  const ready = !props.error && !props.loading && gate?.ready && (sizing?.quantity ?? 0) > 0
  const reason = props.error ? 'تعذر تحديث التوصية — الدخول متوقف'
    : props.loading ? 'جارٍ التحقق من فرصة الدخول'
    : !gate?.ready ? gate?.reason ?? 'انتظر اكتمال التحقق من الأسعار والخطة'
    : !sizing ? 'أدخل رأس المال وحد المخاطرة لحساب الكمية'
    : sizing.quantity < 1 ? 'حد المخاطرة أو الرصيد لا يسمح بشراء عقد واحد'
    : gate.reason
  const time = underlying?.asOf ? new Date(underlying.asOf).toLocaleString('ar-SA', {
    timeZone: 'Asia/Riyadh', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) : 'غير متاح'

  async function copy() {
    if (!ready || !c || !props.scenario || !sizing) return
    const x = c.execution!
    try {
      await navigator.clipboard.writeText(`${c.symbol}\nانتهاء: ${c.expiration}\nشراء محدد: $${amount(x.entryLow)}–$${amount(x.entryHigh)}\nالكمية: ${sizing.quantity} عقد\nالتكلفة حتى: $${amount(sizing.cost)}\nالخروج عند SPX: ${amount(props.scenario.target1.value)}\nوقف العقد: $${amount(x.hardProtectionPrice)} أو وصول SPX إلى ${amount(props.scenario.invalidation.value)}، أيهما أولًا\nصالح للدخول حتى: ${props.validUntil}`)
      setCopiedFor(`${c.symbol}:${props.issuedAt}`)
    } catch { setCopiedFor('') }
  }

  return (
    <section aria-label="خطة المضاربة" className="overflow-hidden rounded-2xl border border-[#C9943A]/30 bg-[#0D1B2A]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div>
          <h1 className="text-xl font-black text-white">قرار المضاربة الآن</h1>
          <p role="status" className={`mt-1 text-sm font-bold ${ready ? 'text-emerald-300' : 'text-amber-200'}`}>{reason}</p>
        </div>
        <span className={`rounded-lg px-3 py-1 text-xs font-black ${ready ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}>
          {ready ? 'دخول متاح' : 'لا دخول الآن'}
        </span>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <label className="text-xs text-slate-400">رأس المال المتاح ($)
            <input type="number" min="0" max="10000000" value={settings.balance || ''}
              onChange={e => { update({ balance: Math.max(0, Number(e.target.value)) }); setCopiedFor('') }}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-[#09121C] px-3 py-2 font-mono text-base text-white" />
          </label>
          <label className="text-xs text-slate-400">حد الخسارة المخطط (%)
            <input type="number" min="0.1" max="5" step="0.1" value={settings.riskPct || ''}
              onChange={e => { update({ riskPct: Math.min(5, Math.max(0, Number(e.target.value))) }); setCopiedFor('') }}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-[#09121C] px-3 py-2 font-mono text-base text-white" />
          </label>
          <label className="col-span-2 text-xs text-slate-400 md:col-span-1">عمولة وسيطك للعقد / لكل طرف ($)
            <input type="number" min="0" max="100" step="0.01" value={commission}
              onChange={e => { setCommission(Math.max(0, Number(e.target.value))); setCopiedFor('') }}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-[#09121C] px-3 py-2 font-mono text-base text-white" />
          </label>
        </div>

        {c && props.scenario ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 px-4 py-3">
              <div><span className={`font-black ${c.type === 'call' ? 'text-emerald-300' : 'text-rose-300'}`}>{c.type === 'call' ? 'شراء CALL' : 'شراء PUT'}</span>
                <span className="mr-3 font-mono text-lg font-bold text-white">SPXW {c.strike}</span></div>
              <span className="text-xs text-slate-400">الانتهاء <b dir="ltr" className="font-mono text-slate-200">{c.expiration}</b></span>
              <code className="w-full break-all text-xs text-slate-400" dir="ltr">{c.symbol}</code>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Cell label="شراء محدد — سعر الوحدة" value={c.execution ? `$${amount(c.execution.entryLow)}–${amount(c.execution.entryHigh)}` : '—'} color="text-amber-200" />
              <Cell label="عدد العقود" value={ready ? `${sizing!.quantity}` : '—'} color="text-white" />
              <Cell label="الخروج عند وصول SPX" value={amount(props.scenario.target1.value)} color="text-emerald-300" />
              <Cell label="وقف سعر العقد" value={c.execution ? `$${amount(c.execution.hardProtectionPrice)}` : '—'} color="text-rose-300" />
            </div>
            <p className="text-xs text-slate-300">أغلق عند الهدف، أو وقف العقد، أو وصول SPX إلى <b className="font-mono text-rose-300">{amount(props.scenario.invalidation.value)}</b>؛ أيهما أولًا.</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <span className="text-slate-400">تكلفة الشراء حتى <b className="font-mono text-white">{ready ? `$${amount(sizing!.cost)}` : '—'}</b></span>
              <span className="text-slate-400">خسارة الوقف المخططة <b className="font-mono text-rose-300">{ready ? `$${amount(sizing!.plannedLoss)}` : '—'}</b></span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
              <span className="text-xs text-slate-400">صلاحية الدخول حتى {props.validUntil ? new Date(props.validUntil).toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh' }) : '—'} الرياض</span>
              <button onClick={copy} disabled={!ready} className="rounded-lg bg-[#C9943A] px-4 py-2 text-sm font-black text-[#09121C] disabled:cursor-not-allowed disabled:opacity-30">
                {copiedFor === `${c.symbol}:${props.issuedAt}` ? 'تم نسخ الخطة' : 'نسخ خطة الصفقة'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">سعر الوحدة × 100 للعقد. قد يتجاوز تنفيذ الوقف المبلغ المخطط؛ أقصى خسارة للعقد المشترى كامل قيمته. أدخل عمولة وسيطك لحساب التكلفة.</p>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="بانتظار فرصة صالحة">
            {['العقد', 'الدخول', 'الخروج', 'الكمية'].map(label => <Cell key={label} label={label} value="—" color="text-slate-500" />)}
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2 border-t border-white/5 pt-3 text-xs text-slate-400">
          <span>مصدر SPX: {underlying?.source === 'tradier' ? 'Tradier' : underlying?.source === 'yahoo' ? 'Yahoo · غير معتمد للدخول' : 'غير متاح'}</span>
          <span>{quoteIsCurrent(underlying, props.now) ? 'سعر حديث' : 'سعر غير صالح للدخول'} · وقت المصدر: {time} الرياض</span>
          {quote?.asOf && <span>وقت عرض العقد: {new Date(quote.asOf).toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh' })} الرياض</span>}
        </div>
      </div>
    </section>
  )
}

function Cell({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="rounded-xl border border-white/5 bg-black/15 p-3"><div className="text-xs text-slate-400">{label}</div><div dir="ltr" className={`mt-2 break-words text-right font-mono text-lg font-black ${color}`}>{value}</div></div>
}
