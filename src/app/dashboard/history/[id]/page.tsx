'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Analysis = {
  id: string; contract_type: string; ticker: string | null
  strike: number; dte: number; bid: number | null; ask: number | null
  mid: number | null; delta: number | null; composite_score: number | null
  decision: string | null; risk_profile: string | null
  spx_price: number | null; vix_price: number | null
  entry_zone_low: number | null; entry_zone_high: number | null
  target1: number | null; target2: number | null; stop_loss: number | null
  created_at: string
}

export default function AnalysisDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [a, setA]             = useState<Analysis | null>(null)
  const [liveSpx, setLiveSpx] = useState<number | null>(null)
  const [liveVix, setLiveVix] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('user_analyses').select('*').eq('id', id).single()
      if (data) setA(data)
      setLoading(false)
      try {
        const res = await fetch('/api/market/pulse')
        const json = await res.json()
        if (json.spx?.price) setLiveSpx(json.spx.price)
        if (json.vix?.price) setLiveVix(json.vix.price)
      } catch {}
    }
    load()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
    </div>
  )
  if (!a) return (
    <div className="p-6 text-center" dir="rtl">
      <div className="text-4xl mb-3">❌</div>
      <div className="text-sm text-surface-500">التحليل غير موجود</div>
      <Link href="/dashboard/history" className="btn-primary btn-sm mt-4 mx-auto">العودة للسجل</Link>
    </div>
  )

  const mid = a.mid ?? ((a.bid ?? 0) + (a.ask ?? 0)) / 2
  const isPut = a.contract_type === 'put'
  const score = a.composite_score ?? 0
  const spxAtAnalysis = a.spx_price ?? 0
  const spxNow = liveSpx ?? 0
  const spxDiff = spxNow - spxAtAnalysis
  const spxDiffPct = spxAtAnalysis > 0 ? Math.abs((spxDiff / spxAtAnalysis) * 100) : 0

  const validity = !liveSpx
    ? { label:'السوق مغلق', color:'bg-surface-100 text-surface-600', desc:'البيانات الحية غير متاحة' }
    : spxDiffPct > 1.5
    ? { label:'⚠️ تغير كبير — أعد التحليل', color:'bg-red-50 text-red-700', desc:`SPX تحرك ${spxDiff > 0 ? '+' : ''}${spxDiff.toFixed(0)} نقطة منذ التحليل` }
    : spxDiffPct > 0.5
    ? { label:'تغير ملحوظ — راجع الأهداف', color:'bg-amber-50 text-amber-700', desc:`SPX تحرك ${spxDiff > 0 ? '+' : ''}${spxDiff.toFixed(0)} نقطة` }
    : { label:'✅ التحليل لا يزال صالحاً', color:'bg-emerald-50 text-emerald-700', desc:`SPX لم يتغير كثيراً — الأهداف معقولة` }

  const decisionBg = a.decision === 'إشارة نشطة' ? 'bg-emerald-600'
    : a.decision === 'دخول مشروط' ? 'bg-amber-500'
    : a.decision === 'مراقبة فقط' ? 'bg-blue-600' : 'bg-surface-700'

  const reParams = new URLSearchParams({
    contractType: a.contract_type ?? 'call',
    strike: String(a.strike ?? ''), dte: String(a.dte ?? ''),
    bid: String(a.bid ?? ''), ask: String(a.ask ?? ''), delta: String(a.delta ?? ''),
  }).toString()

  const formatDate = (s: string) => new Date(s).toLocaleString('ar-SA', {
    year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
  })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-surface-400 hover:text-navy-900 p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-navy-900">
            {a.ticker && a.ticker !== 'SPX' ? a.ticker : 'SPX'} {isPut ? '▼ Put' : '▲ Call'} {a.strike}
          </h1>
          <p className="text-xs text-surface-400">{formatDate(a.created_at)}</p>
        </div>
        <Link href={`/dashboard/analyze?${reParams}`} className="btn-primary btn-sm">🔄 أعد التحليل</Link>
      </div>

      {/* صلاحية التحليل */}
      <div className={`rounded-2xl p-4 mb-4 border ${validity.color}`}>
        <div className="font-bold text-sm mb-0.5">{validity.label}</div>
        <div className="text-xs opacity-80">{validity.desc}</div>
      </div>

      {/* القرار */}
      <div className={`rounded-2xl px-5 py-4 mb-4 ${decisionBg}`}>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-white/70 text-xs mb-1">القرار</div>
            <div className="text-white text-2xl font-bold">{a.decision}</div>
            <div className="text-white/60 text-xs mt-1">{a.risk_profile ?? 'معتدل'}</div>
          </div>
          <div className="text-left">
            <div className="text-white/70 text-xs mb-1">الدرجة</div>
            <div className="text-white text-4xl font-bold font-mono">{score}</div>
            <div className="text-white/60 text-xs">من 100</div>
          </div>
        </div>
      </div>

      {/* بطاقة التداول */}
      <div className="card p-5 mb-4">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">بطاقة التداول</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
            <div className="text-[10px] text-teal-600 font-semibold mb-1">🟢 ادخل عند</div>
            <div className="text-sm font-bold text-teal-900 font-mono">${(a.entry_zone_low ?? 0).toFixed(2)} — ${(a.entry_zone_high ?? 0).toFixed(2)}</div>
            <div className="text-[10px] text-teal-500 mt-0.5">Mid: ${mid.toFixed(2)}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <div className="text-[10px] text-emerald-600 font-semibold mb-1">🎯 الهدف</div>
            <div className="text-sm font-bold text-emerald-900 font-mono">${a.target1?.toFixed(2) ?? '--'}</div>
            {mid > 0 && a.target1 && (
              <div className="text-[10px] text-emerald-500 mt-0.5">+{((a.target1/mid-1)*100).toFixed(0)}% ربح</div>
            )}
          </div>
          {a.stop_loss && (
            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
              <div className="text-[10px] text-red-600 font-semibold mb-1">🔴 وقف الخسارة</div>
              <div className="text-sm font-bold text-red-900 font-mono">${a.stop_loss.toFixed(2)}</div>
              {mid > 0 && <div className="text-[10px] text-red-400 mt-0.5">-{((1-a.stop_loss/mid)*100).toFixed(0)}%</div>}
            </div>
          )}
          <div className="bg-navy-50 rounded-xl p-3 border border-navy-100">
            <div className="text-[10px] text-navy-600 font-semibold mb-1">📊 SPX</div>
            <div className="text-sm font-bold text-navy-900 font-mono">{a.spx_price?.toFixed(2) ?? '--'}</div>
            {liveSpx && <div className={`text-[10px] mt-0.5 font-mono ${spxDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              الآن: {liveSpx.toFixed(2)} ({spxDiff >= 0 ? '+' : ''}{spxDiff.toFixed(0)})
            </div>}
          </div>
        </div>
      </div>

      {/* بيانات العقد */}
      <div className="card p-5 mb-4">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">بيانات العقد</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { l:'Strike', v: String(a.strike ?? '--') },
            { l:'DTE',    v: a.dte ? `${a.dte}d` : '--' },
            { l:'Mid',    v: mid ? `$${mid.toFixed(2)}` : '--' },
            { l:'Bid',    v: a.bid ? `$${a.bid}` : '--' },
            { l:'Ask',    v: a.ask ? `$${a.ask}` : '--' },
            { l:'Delta',  v: String(a.delta ?? '--') },
          ].map(f => (
            <div key={f.l} className="bg-surface-50 rounded-xl p-2.5 text-center">
              <div className="text-[9px] text-surface-400 mb-0.5">{f.l}</div>
              <div className="text-xs font-bold text-navy-900 font-mono">{f.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* VIX */}
      {(a.vix_price || liveVix) && (
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-surface-400">VIX</div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-[9px] text-surface-400">وقت التحليل</div>
                <div className="text-sm font-bold font-mono text-navy-900">{a.vix_price?.toFixed(2) ?? '--'}</div>
              </div>
              {liveVix && <>
                <svg className="w-4 h-4 text-surface-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                <div className="text-center">
                  <div className="text-[9px] text-surface-400">الآن</div>
                  <div className={`text-sm font-bold font-mono ${liveVix > (a.vix_price ?? 0) ? 'text-red-600' : 'text-emerald-600'}`}>{liveVix.toFixed(2)}</div>
                </div>
              </>}
            </div>
          </div>
        </div>
      )}

      {/* أزرار */}
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/dashboard/analyze?${reParams}`} className="card p-4 text-center hover:border-teal-300 transition-all border-2 border-transparent">
          <div className="text-xl mb-1">🔄</div>
          <div className="text-xs font-bold text-navy-900">أعد التحليل</div>
          <div className="text-[10px] text-surface-400">بنفس البيانات</div>
        </Link>
        <Link href="/dashboard/analyze" className="card p-4 text-center hover:border-teal-300 transition-all border-2 border-transparent">
          <div className="text-xl mb-1">🔍</div>
          <div className="text-xs font-bold text-navy-900">تحليل جديد</div>
          <div className="text-[10px] text-surface-400">عقد مختلف</div>
        </Link>
      </div>
    </div>
  )
}
