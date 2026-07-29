'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Clock3, RefreshCw, ShieldCheck } from 'lucide-react'
import { FundBrief } from '../FundBrief'

type Row = {
  symbol: string; nameAr: string; price: number | null; changePct: number | null; kind: string; watchMode: boolean
  direction: { type: 'call' | 'put' | null; label: string; color: string }
  gamma: { regime: string; status: string } | null
  best: null | { strike: number; type: string; expiration: string; mid: number; score: number; status: string; grade: string; probItmPct: number }
}
type Scan = { results: Row[]; rotation: Array<{ symbol: string; nameAr: string; changePct: number }>; sessionQuality?: { label: string; phase: string } }
type News = { level: string; label: string; reason: string }

export default function FundsDecisionRoomPage() {
  const [scan, setScan] = useState<Scan | null>(null)
  const [news, setNews] = useState<News | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [scanResponse, newsResponse] = await Promise.all([
        fetch('/api/v2/funds/scan?mode=balanced'),
        fetch('/api/v2/news'),
      ])
      const [scanData, newsData] = await Promise.all([scanResponse.json(), newsResponse.json()])
      setScan(scanData); setNews(newsData)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); const id = window.setInterval(load, 60_000); return () => window.clearInterval(id) }, [load])

  const opportunity = scan?.results?.find(row => row.best && !row.watchMode) ?? scan?.results?.find(row => row.best) ?? null
  const strongest = scan?.rotation?.[0] ?? null
  const aligned = Boolean(opportunity && strongest && (opportunity.symbol === strongest.symbol || opportunity.kind === 'index'))
  const checks = useMemo(() => [
    { label: 'الجلسة', ok: !opportunity?.watchMode, value: scan?.sessionQuality?.label ?? 'جاهزة' },
    { label: 'الاتجاه', ok: Boolean(opportunity?.direction.type), value: opportunity?.direction.label ?? 'غير واضح' },
    { label: 'دوران القطاعات', ok: aligned, value: aligned ? 'يدعم القرار' : 'غير مؤكد' },
    { label: 'الأخبار', ok: news?.level !== 'danger', value: news?.label ?? 'هادئة' },
    { label: 'العقد', ok: opportunity?.best?.status === 'execute', value: opportunity?.best?.status === 'execute' ? 'جاهز' : 'تحت المراقبة' },
  ], [opportunity, scan, aligned, news])
  const passed = checks.filter(check => check.ok).length
  const blocked = opportunity?.watchMode || news?.level === 'danger'
  const state = blocked ? { label: 'لا دخول', color: '#F87171' } : passed >= 4 ? { label: 'قريبة من التنفيذ', color: '#34D399' } : { label: 'انتظار التأكيد', color: '#FBBF24' }

  return (
    <div className="min-h-full pb-14" dir="rtl">
      <section className="border-b border-emerald-400/15 px-5 py-8" style={{ background: 'radial-gradient(circle at 10% 0%,rgba(38,208,124,.18),transparent 35%),#091712' }}>
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div><div className="flex items-center gap-2 text-xs font-black text-emerald-300"><ShieldCheck size={15} /> حصري لباقة ألفا</div><h1 className="mt-2 text-3xl font-black text-white md:text-5xl">غرفة قرار الصناديق</h1></div>
          <button onClick={load} disabled={loading} className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-300" aria-label="تحديث"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </section>
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-7">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
          <div className="rounded-3xl border border-white/[.06] bg-[#0B1B15] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold text-slate-600">التوصية الآن</div>
                <div className="mt-2 flex items-center gap-3"><span className="font-mono text-4xl font-black text-white">{opportunity?.symbol ?? '—'}</span><span className="text-sm font-black" style={{ color: opportunity?.direction.color }}>{opportunity?.direction.label}</span></div>
                <div className="mt-2 text-sm text-slate-500">{opportunity?.nameAr} · ${opportunity?.price?.toFixed(2)}</div>
              </div>
              <div className="text-left"><div className="text-2xl font-black" style={{ color: state.color }}>{state.label}</div><div className="mt-1 text-xs text-slate-600">{passed}/5 تأكيدات</div></div>
            </div>
            {opportunity?.best ? <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="العقد" value={`${opportunity.best.type.toUpperCase()} ${opportunity.best.strike}`} /><Metric label="القوة" value={`${opportunity.best.score}/100`} /><Metric label="السعر" value={`$${opportunity.best.mid.toFixed(2)}`} /><Metric label="الاحتمال" value={`${opportunity.best.probItmPct}%`} /></div> : null}
          </div>
          <div className="rounded-3xl border border-white/[.06] bg-[#0B1B15] p-5">
            <div className="text-sm font-black text-white">بوابة التنفيذ</div>
            <div className="mt-4 space-y-2">{checks.map(check => <div key={check.label} className="flex items-start gap-2 rounded-xl bg-black/20 p-3">{check.ok ? <Check size={15} className="text-emerald-400" /> : <Clock3 size={15} className="text-amber-400" />}<div><div className="text-xs font-black text-slate-200">{check.label}</div><div className="mt-1 text-[11px] text-slate-600">{check.value}</div></div></div>)}</div>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[.06] bg-[#0B1B15] p-5"><div className="text-sm font-black text-white">دوران القطاعات</div><div className="mt-3 text-2xl font-black text-emerald-300">{strongest?.symbol ?? '—'}</div><div className="text-xs text-slate-500">{strongest?.nameAr} {strongest ? `${strongest.changePct > 0 ? '+' : ''}${strongest.changePct.toFixed(2)}%` : ''}</div></div>
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.04] p-5"><div className="text-sm font-black text-white">الخطوة التالية</div><div className="mt-2 text-xs text-slate-500">{blocked ? 'ابقَ خارج السوق.' : 'راجع الصندوق والعقد قبل التنفيذ.'}</div><Link href={`/funds/analyze?symbol=${opportunity?.symbol ?? 'SPY'}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-xs font-black text-emerald-950">فتح التحليل <ArrowLeft size={14} /></Link></div>
        </section>
        {opportunity ? <FundBrief symbol={opportunity.symbol} /> : null}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[.05] bg-black/20 p-3"><div className="text-[10px] text-slate-600">{label}</div><div className="mt-1 font-mono font-black text-white">{value}</div></div>
}
