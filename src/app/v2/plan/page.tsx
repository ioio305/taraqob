'use client'

// ── خطة اليوم — ترقب يتخذ موقفاً واحداً واضحاً كل صباح ──────────────────────
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLiveQuote } from '@/lib/v2/useLiveQuotes'
import { DecisionCouncilCard } from '@/components/v2/DecisionCouncilCard'
import type { DecisionCouncil } from '@/lib/v2/decisionCouncil'
import type { OpportunityWindow, UnderlyingScenario } from '@/lib/v2/opportunityModel'

interface Plan {
  success: boolean; error?: string
  dayAr: string
  market: { spx: number; vix: number; source: string; priorClose: number; priorHigh: number; priorLow: number }
  bias: string; score: number; decision: string
  stance: string; entryZone: string
  targets: { t1: number | null; t2: number | null }
  stop: number | null
  cancel: string
  expectedMove: { points: number; upper: number; lower: number }
  gamma: { regime: string; flipLevel: number | null; callWall: number | null; putWall: number | null; note: string } | null
  levels: { label: string; value: number; tone: 'res' | 'mid' | 'sup' }[]
  priorLevels?: { label: string; value: number; tone: 'res' | 'mid' | 'sup' }[]
  crashGuard: { active: boolean; reasons: string[] }
  econToday: { nameAr: string; when: string; advice: string } | null
  preMarketNote: string | null
  upcoming: { nameAr: string; inDays: number; advice: string; impact: string }[]
  bullCase: string[]; bearCase: string[]
}

const TONE = { res: '#F0435A', mid: '#C9943A', sup: '#26D07C' }

type CentralRecommendation = {
  decisionCouncil?: DecisionCouncil | null
  scenario?: UnderlyingScenario | null
  opportunityWindow?: OpportunityWindow | null
}

export default function PlanPage() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [err, setErr] = useState('')
  const [central, setCentral] = useState<CentralRecommendation | null>(null)
  const { quote: liveSpx } = useLiveQuote('SPX')

  useEffect(() => {
    fetch('/api/v2/gameplan').then(response => response.json())
      .then(dayPlan => {
        if (dayPlan.success) setPlan(dayPlan)
        else setErr(dayPlan.error ?? 'تعذر بناء الخطة')
      })
      .catch(() => setErr('فشل الاتصال'))
  }, [])

  useEffect(() => {
    let active = true
    const refresh = () => fetch(`/api/v2/recommend?mode=balanced&_=${Date.now()}`, { cache: 'no-store' })
      .then(response => response.json())
      .then(recommendation => { if (active) setCentral(recommendation) })
      .catch(() => {})
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 15_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  const centralAction = central?.decisionCouncil?.action
  const centralActive = centralAction === 'call' || centralAction === 'put' || centralAction === 'manage'
  const centralBias = centralAction === 'call' ? 'صاعد' : centralAction === 'put' ? 'هابط' : 'محايد'
  const biasColor = centralBias === 'صاعد' ? '#26D07C' : centralBias === 'هابط' ? '#F0435A' : '#C9943A'

  return (
    <div className="min-h-screen p-4 space-y-4 max-w-3xl mx-auto" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#E8D5A3]">📋 خطة اليوم</h1>
          <p className="text-xs text-gray-500 mt-0.5">{plan?.dayAr ?? '...'} — موقف ترقب الواحد الواضح قبل الجرس</p>
        </div>
        <Link href="/v2" className="text-xs text-gray-500 hover:text-white">→ الداشبورد</Link>
      </div>

      {err && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 text-sm">{err}</div>}
      {!plan && !err && (
        <div className="space-y-3">{[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
        ))}</div>
      )}

      {plan && (
        <>
          {central?.decisionCouncil ? (
            <DecisionCouncilCard council={central.decisionCouncil} scenario={central.scenario} window={central.opportunityWindow} />
          ) : null}
          {/* حدث اليوم قبل الافتتاح */}
          {plan.preMarketNote && (
            <div className="rounded-xl px-4 py-3 text-sm font-bold"
              style={{ background: 'rgba(240,67,90,0.08)', border: '1px solid rgba(240,67,90,0.4)', color: '#F0888A' }}>
              {plan.preMarketNote}
            </div>
          )}

          {/* الموقف */}
          <div className="rounded-2xl p-5"
            style={{ background: `linear-gradient(135deg, ${biasColor}0D, rgba(13,27,42,0.9))`, border: `1px solid ${biasColor}40` }}>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="text-2xl font-black" style={{ color: biasColor }}>
                {centralBias === 'صاعد' ? '▲ صاعد' : centralBias === 'هابط' ? '▼ هابط' : '↔ انتظار'}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8' }}>
                الدرجة {central?.decisionCouncil?.opportunityScore ?? plan.score}/100
              </span>
              <span className="text-xs font-mono text-gray-500">SPX {(liveSpx?.price ?? plan.market.spx).toFixed(0)} · خوف {plan.market.vix.toFixed(1)}</span>
            </div>
            <p className="text-base leading-relaxed text-white font-semibold">{central?.decisionCouncil?.explanation ?? plan.stance}</p>
            <div className="mt-3 text-sm" style={{ color: '#E8D5A3' }}>
              {centralActive && central?.scenario ? `الدخول على الأصل قرب ${central.scenario.entry.toFixed(0)}` : 'لا دخول قبل اكتمال القرار المركزي'}
            </div>
          </div>

          {/* الأهداف والوقف والإلغاء */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'الهدف الأول', value: centralActive ? central?.scenario?.target1.value.toFixed(0) ?? '—' : '—', color: '#26D07C' },
              { label: 'الهدف الثاني', value: centralActive ? central?.scenario?.target2.value.toFixed(0) ?? '—' : '—', color: '#60A5FA' },
              { label: 'إلغاء السيناريو', value: centralActive ? central?.scenario?.invalidation.value.toFixed(0) ?? '—' : '—', color: '#F0435A' },
              { label: 'الحركة المتوقعة', value: `±${plan.expectedMove.points}`, color: '#C9943A' },
            ].map(x => (
              <div key={x.label} className="bg-[#0a1929] border border-[#1e3a50] rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">{x.label}</div>
                <div className="text-xl font-black font-mono mt-1" style={{ color: x.color }}>{x.value}</div>
              </div>
            ))}
          </div>

          {/* ما يلغي الخطة */}
          <div className="rounded-xl px-4 py-3 text-sm"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <span className="font-bold" style={{ color: '#F59E0B' }}>⚠ تُلغى الخطة إذا: </span>
            <span className="text-gray-300">{centralActive ? central?.scenario?.invalidation.source ?? '—' : 'لا توجد خطة دخول نشطة حالياً'}</span>
          </div>

          {/* الجاما */}
          {plan.gamma && (
            <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
              style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <span>🧲</span>
              <span className="text-gray-300">{plan.gamma.note}
                {plan.gamma.flipLevel && <> · نقطة الانقلاب <b className="font-mono">{Math.round(plan.gamma.flipLevel)}</b></>}
              </span>
            </div>
          )}

          {/* سلم المستويات */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0a1929', border: '1px solid #1e3a50' }}>
            <div className="px-4 py-2.5 text-sm font-bold text-[#E8D5A3]" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              🪜 سلّم مستويات اليوم
            </div>
            {plan.levels.map((l, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2 text-sm"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-gray-400">{l.label}</span>
                <span className="font-mono font-bold" style={{ color: TONE[l.tone] }}>{Math.round(l.value).toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* مستويات الأمس المرجعية — منفصلة بعنوانها الصحيح */}
          {(plan.priorLevels?.length ?? 0) > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0a1929', border: '1px solid #1e3a50' }}>
              <div className="px-4 py-2.5 text-sm font-bold text-gray-400" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                📆 مستويات الأمس (مرجعية)
              </div>
              {plan.priorLevels!.map((l, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 text-sm"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span className="text-gray-400">{l.label}</span>
                  <span className="font-mono font-bold" style={{ color: TONE[l.tone] }}>{Math.round(l.value).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* أدلة الصعود والهبوط */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl p-4" style={{ background: 'rgba(38,208,124,0.04)', border: '1px solid rgba(38,208,124,0.2)' }}>
              <div className="text-sm font-bold mb-2" style={{ color: '#26D07C' }}>مع الصعود</div>
              {plan.bullCase.map((b, i) => <div key={i} className="text-xs text-gray-400 mb-1.5">• {b}</div>)}
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(240,67,90,0.04)', border: '1px solid rgba(240,67,90,0.2)' }}>
              <div className="text-sm font-bold mb-2" style={{ color: '#F0435A' }}>مع الهبوط</div>
              {plan.bearCase.map((b, i) => <div key={i} className="text-xs text-gray-400 mb-1.5">• {b}</div>)}
            </div>
          </div>

          {/* الأحداث القادمة */}
          {plan.upcoming.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {plan.upcoming.map(e => (
                <span key={e.nameAr + e.inDays} className="text-xs px-2.5 py-1 rounded-lg font-mono cursor-help" title={e.advice}
                  style={{
                    background: e.impact === 'high' ? 'rgba(240,67,90,0.08)' : 'rgba(96,165,250,0.08)',
                    border: `1px solid ${e.impact === 'high' ? 'rgba(240,67,90,0.3)' : 'rgba(96,165,250,0.25)'}`,
                    color: e.impact === 'high' ? '#F0888A' : '#93B8E8',
                  }}>
                  📅 {e.nameAr} · {e.inDays === 0 ? 'اليوم' : e.inDays === 1 ? 'غداً' : `بعد ${e.inDays} أيام`}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Link href="/v2" className="flex-1 text-center py-3 rounded-xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
              شاهد العقود المرشحة ←
            </Link>
            <Link href="/v2/chart" className="px-5 py-3 rounded-xl text-sm font-bold text-gray-300"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              الشارت المتقدم
            </Link>
          </div>

          <p className="text-xs text-gray-600 text-center leading-relaxed">
            الخطة تُبنى آلياً من محركات ترقب المثبتة — وهي إطار قرار لا وعد ربح. القرار النهائي قرارك.
          </p>
        </>
      )}
    </div>
  )
}
