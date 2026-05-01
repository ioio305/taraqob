'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Spinner, ScoreCircle, Alert } from '@/components/ui'
import { formatDate } from '@/lib/utils/constants'
import toast from 'react-hot-toast'
import type { MarketSession, IndicatorDefinition } from '@/lib/types'

// ── INDICATOR INPUT SCHEMAS ───────────────────────────────────

const INDICATOR_INPUTS: Record<string, {
  label: string
  fields: { key: string; label: string; type: 'number' | 'select' | 'text'; options?: string[]; placeholder?: string }[]
  statusOptions: string[]
  statusOptionsAr: string[]
}> = {
  market_regime: {
    label: 'حالة السوق',
    fields: [
      { key: 'spx_trend',   label: 'اتجاه SPX',       type: 'select', options: ['uptrend', 'downtrend', 'sideways'] },
      { key: 'ma_position', label: 'موقع المتوسطات',   type: 'select', options: ['above_all', 'below_all', 'mixed'] },
      { key: 'spy_qqq',     label: 'SPY/QQQ',           type: 'select', options: ['aligned', 'divergent']            },
      { key: 'daily_vs_intraday', label: 'اليومي vs اللحظي', type: 'select', options: ['aligned', 'divergent'] },
    ],
    statusOptions:   ['Bullish', 'Bearish', 'Neutral', 'Mixed', 'Risk-Off'],
    statusOptionsAr: ['صاعد',    'هابط',    'محايد',   'متضارب', 'تجنب المخاطر'],
  },
  volatility_pressure: {
    label: 'ضغط التذبذب',
    fields: [
      { key: 'vix_level',       label: 'مستوى VIX',       type: 'number', placeholder: '18.5'  },
      { key: 'iv_rank',         label: 'IV Rank',          type: 'number', placeholder: '45'    },
      { key: 'iv_percentile',   label: 'IV Percentile',    type: 'number', placeholder: '60'    },
      { key: 'vol_expanding',   label: 'توسع التذبذب',     type: 'select', options: ['expanding', 'contracting', 'stable'] },
    ],
    statusOptions:   ['Low Volatility', 'Normal Volatility', 'Elevated Volatility', 'High Risk Volatility'],
    statusOptionsAr: ['تذبذب منخفض',    'تذبذب طبيعي',       'تذبذب مرتفع',         'تذبذب عالي الخطر'],
  },
  expected_move: {
    label: 'الحركة المتوقعة',
    fields: [
      { key: 'em_upper',     label: 'الحد الأعلى',          type: 'number', placeholder: '5250' },
      { key: 'em_lower',     label: 'الحد الأدنى',          type: 'number', placeholder: '5150' },
      { key: 'avg_5d',       label: 'متوسط آخر 5 جلسات',    type: 'number', placeholder: '25'   },
      { key: 'avg_20d',      label: 'متوسط آخر 20 جلسة',   type: 'number', placeholder: '22'   },
      { key: 'price_zone',   label: 'منطقة السعر',           type: 'select',
        options: ['middle', 'near_upper', 'near_lower', 'exhaustion_upper', 'exhaustion_lower'] },
    ],
    statusOptions:   ['Entry Zone', 'Danger Zone', 'Exhaustion Zone', 'Middle Zone'],
    statusOptionsAr: ['منطقة دخول', 'منطقة خطر', 'منطقة استنفاد', 'المنتصف'],
  },
  intraday_momentum: {
    label: 'الزخم اللحظي',
    fields: [
      { key: 'vwap_relation', label: 'موقع من VWAP',    type: 'select', options: ['above', 'below', 'at'] },
      { key: 'or_breakout',   label: 'كسر نطاق الافتتاح', type: 'select', options: ['bullish_break', 'bearish_break', 'inside', 'failed'] },
      { key: 'rsi_short',     label: 'RSI قصير المدى',  type: 'number', placeholder: '55'  },
      { key: 'volume_qual',   label: 'جودة الحجم',       type: 'select', options: ['high', 'normal', 'low'] },
      { key: 'momentum_cont', label: 'استمرارية الزخم',  type: 'select', options: ['strong', 'moderate', 'weak', 'fading'] },
    ],
    statusOptions:   ['Strong Bullish', 'Moderate Bullish', 'Neutral', 'Moderate Bearish', 'Strong Bearish'],
    statusOptionsAr: ['زخم صاعد قوي', 'زخم صاعد معتدل', 'محايد', 'زخم هابط معتدل', 'زخم هابط قوي'],
  },
  options_liquidity: {
    label: 'جودة السيولة',
    fields: [
      { key: 'bid_ask_spread', label: 'Bid-Ask Spread',  type: 'number', placeholder: '0.15' },
      { key: 'delta',          label: 'Delta',            type: 'number', placeholder: '0.40' },
      { key: 'volume',         label: 'Volume',           type: 'number', placeholder: '5000' },
      { key: 'open_interest',  label: 'Open Interest',    type: 'number', placeholder: '15000'},
      { key: 'iv_contract',    label: 'IV العقد',         type: 'number', placeholder: '18.5' },
    ],
    statusOptions:   ['Good', 'Acceptable', 'Weak', 'Avoid'],
    statusOptionsAr: ['جيد', 'مقبول',     'ضعيف', 'تجنب'],
  },
  theta_burn: {
    label: 'تآكل الوقت',
    fields: [
      { key: 'dte',          label: 'DTE (أيام للانتهاء)', type: 'number', placeholder: '7'    },
      { key: 'theta_daily',  label: 'Theta اليومي',        type: 'number', placeholder: '-0.12'},
      { key: 'strategy_type',label: 'نوع الاستراتيجية',   type: 'select', options: ['long_premium', 'spread', 'credit'] },
      { key: 'session_timing', label: 'توقيت الجلسة',     type: 'select', options: ['early', 'midday', 'near_close'] },
    ],
    statusOptions:   ['Low', 'Medium', 'High', 'Extreme'],
    statusOptionsAr: ['منخفض', 'متوسط', 'مرتفع', 'قصوى'],
  },
  macro_event: {
    label: 'الأحداث الكلية',
    fields: [
      { key: 'has_fomc',      label: 'FOMC / Powell',      type: 'select', options: ['yes', 'no'] },
      { key: 'has_cpi_ppi',   label: 'CPI / PPI',          type: 'select', options: ['yes', 'no'] },
      { key: 'has_jobs',      label: 'تقرير الوظائف',       type: 'select', options: ['yes', 'no'] },
      { key: 'event_timing',  label: 'توقيت الحدث',        type: 'select', options: ['pre_market', 'during_session', 'after_market', 'none'] },
      { key: 'reversal_risk', label: 'احتمال الانعكاس',    type: 'select', options: ['high', 'medium', 'low', 'none'] },
    ],
    statusOptions:   ['Clear', 'Caution', 'High Risk', 'Block Trade'],
    statusOptionsAr: ['آمن',  'تحذير',   'خطر مرتفع', 'حظر التداول'],
  },
}

// ── TYPES ─────────────────────────────────────────────────────

interface IndicatorState {
  score: string
  status: string
  status_ar: string
  inputs: Record<string, string>
  interpretation: string
  interpretation_ar: string
  supports_entry: boolean | null
  blocks_entry: boolean
  analyst_notes: string
  ai_explanation: string
  ai_explanation_ar: string
  isSaving: boolean
  isSaved: boolean
  isGeneratingAI: boolean
}

// ── INDICATOR CARD ────────────────────────────────────────────

function IndicatorCard({
  definition,
  state,
  sessionData,
  onChange,
  onSave,
  onGenerateAI,
}: {
  definition: IndicatorDefinition
  state: IndicatorState
  sessionData: MarketSession
  onChange: (field: keyof IndicatorState, value: any) => void
  onSave: () => void
  onGenerateAI: () => void
}) {
  const schema = INDICATOR_INPUTS[definition.code]
  if (!schema) return null

  const scoreNum = parseFloat(state.score)
  const isValid = !isNaN(scoreNum) && scoreNum >= 0 && scoreNum <= 100
  const scoreColor = !isValid ? 'text-surface-400'
    : scoreNum >= 70 ? 'text-emerald-600' : scoreNum >= 50 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className={`card overflow-hidden transition-all duration-200 ${
      state.blocks_entry ? 'border-red-200 shadow-none' :
      state.supports_entry ? 'border-emerald-200' : ''
    }`}>
      {/* Card Header */}
      <div className={`px-5 py-4 border-b border-surface-100 flex items-center justify-between ${
        state.blocks_entry ? 'bg-red-50' :
        state.supports_entry ? 'bg-emerald-50/50' : 'bg-white'
      }`}>
        <div className="flex items-center gap-3">
          <ScoreCircle score={isValid ? scoreNum : null} size="md" />
          <div>
            <div className="text-sm font-bold text-navy-900">{definition.name_ar}</div>
            <div className="text-xs text-surface-400">{definition.name_en}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state.blocks_entry && (
            <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full border border-red-200">
              ⛔ يمنع الدخول
            </span>
          )}
          {state.supports_entry && !state.blocks_entry && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
              ✓ يدعم الدخول
            </span>
          )}
          {state.isSaved && !state.isSaving && (
            <span className="text-xs text-teal-600 flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              محفوظ
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex flex-col gap-4">

        {/* Score + Status Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">الدرجة (0 - 100)</label>
            <input
              type="number" min="0" max="100" step="1"
              value={state.score}
              onChange={e => onChange('score', e.target.value)}
              placeholder="0"
              className={`field-input font-mono text-lg font-bold ${scoreColor}`}
              dir="ltr"
            />
          </div>
          <div>
            <label className="field-label">الحالة</label>
            <select
              value={state.status}
              onChange={e => {
                const idx = schema.statusOptions.indexOf(e.target.value)
                onChange('status', e.target.value)
                if (idx >= 0) onChange('status_ar', schema.statusOptionsAr[idx])
              }}
              className="field-input"
            >
              <option value="">اختر الحالة...</option>
              {schema.statusOptions.map((opt, i) => (
                <option key={opt} value={opt}>{schema.statusOptionsAr[i]} — {opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-2 gap-3">
          {schema.fields.map(field => (
            <div key={field.key}>
              <label className="field-label">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={state.inputs[field.key] ?? ''}
                  onChange={e => onChange('inputs', { ...state.inputs, [field.key]: e.target.value })}
                  className="field-input text-xs"
                >
                  <option value="">—</option>
                  {(field.options ?? []).map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  step="any"
                  value={state.inputs[field.key] ?? ''}
                  onChange={e => onChange('inputs', { ...state.inputs, [field.key]: e.target.value })}
                  placeholder={field.placeholder ?? ''}
                  className="field-input font-mono text-xs"
                  dir="ltr"
                />
              )}
            </div>
          ))}
        </div>

        {/* Entry Support Flags */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.supports_entry === true}
              onChange={e => onChange('supports_entry', e.target.checked ? true : null)}
              className="w-4 h-4 rounded accent-emerald-600"
            />
            <span className="text-sm text-emerald-700 font-medium">يدعم الدخول</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.blocks_entry}
              onChange={e => onChange('blocks_entry', e.target.checked)}
              className="w-4 h-4 rounded accent-red-600"
            />
            <span className="text-sm text-red-700 font-medium">يمنع الدخول</span>
          </label>
        </div>

        {/* Interpretation */}
        <div>
          <label className="field-label">التفسير</label>
          <textarea
            value={state.interpretation_ar}
            onChange={e => onChange('interpretation_ar', e.target.value)}
            rows={2}
            placeholder="تفسير نتيجة هذا المؤشر..."
            className="field-input resize-none text-sm"
          />
        </div>

        {/* Analyst Notes */}
        <div>
          <label className="field-label">ملاحظات المحلل</label>
          <textarea
            value={state.analyst_notes}
            onChange={e => onChange('analyst_notes', e.target.value)}
            rows={2}
            placeholder="ملاحظات إضافية..."
            className="field-input resize-none text-sm"
          />
        </div>

        {/* AI Explanation */}
        <div className="bg-teal-50/40 border border-teal-200/60 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
              تفسير الذكاء الاصطناعي
            </label>
            <button
              type="button"
              onClick={onGenerateAI}
              disabled={state.isGeneratingAI || !isValid}
              className="btn-secondary btn-sm gap-1.5 text-xs py-1"
            >
              {state.isGeneratingAI ? <Spinner size="sm" /> : (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                </svg>
              )}
              توليد
            </button>
          </div>
          <textarea
            value={state.ai_explanation_ar}
            onChange={e => onChange('ai_explanation_ar', e.target.value)}
            rows={2}
            placeholder="سيظهر التفسير التلقائي هنا..."
            className="w-full bg-transparent text-xs text-teal-800 leading-relaxed
              resize-none outline-none placeholder-teal-400"
          />
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={onSave}
          disabled={state.isSaving || !isValid || !state.status}
          className="btn-primary w-full justify-center gap-2"
        >
          {state.isSaving ? <Spinner size="sm" /> : null}
          {state.isSaving ? 'جارٍ الحفظ...' : 'حفظ المؤشر'}
        </button>

      </div>
    </div>
  )
}

// ── DECISION SUMMARY ──────────────────────────────────────────

function DecisionSummary({ states, definitions }: {
  states: Record<string, IndicatorState>
  definitions: IndicatorDefinition[]
}) {
  const scores = definitions.map(d => ({
    code: d.code,
    score: parseFloat(states[d.id]?.score ?? ''),
    weight: d.default_weight,
    blocks: states[d.id]?.blocks_entry,
    supports: states[d.id]?.supports_entry,
  })).filter(s => !isNaN(s.score))

  if (scores.length === 0) return null

  const composite = scores.reduce((sum, s) => sum + s.score * s.weight, 0)
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0)
  const compositeScore = totalWeight > 0 ? composite / totalWeight : 0
  const blockingCount = scores.filter(s => s.blocks).length
  const supportCount  = scores.filter(s => s.supports && !s.blocks).length

  const decision = blockingCount > 0 ? 'no_trade'
    : compositeScore >= 75 ? 'active'
    : compositeScore >= 60 ? 'conditional'
    : compositeScore >= 45 ? 'watch'
    : 'no_trade'

  const decisionConfig = {
    no_trade:    { label: 'لا تداول',      color: 'text-surface-600 bg-surface-100 border-surface-200' },
    watch:       { label: 'مراقبة',        color: 'text-blue-700 bg-blue-50 border-blue-200'          },
    conditional: { label: 'دخول مشروط',   color: 'text-amber-700 bg-amber-50 border-amber-200'        },
    active:      { label: 'إشارة نشطة',   color: 'text-emerald-700 bg-emerald-50 border-emerald-200'  },
  }[decision]

  return (
    <div className="card p-5 border-navy-200 bg-navy-900 sticky top-5">
      <div className="text-xs font-semibold text-gold-400 uppercase tracking-wider mb-4">
        محرك القرار
      </div>

      {/* Composite Score */}
      <div className="text-center mb-4">
        <div className="text-5xl font-bold font-mono text-white mb-1">
          {compositeScore.toFixed(0)}
        </div>
        <div className="text-xs text-surface-400">الدرجة المركبة / 100</div>
      </div>

      {/* Score Bar */}
      <div className="w-full bg-navy-700 rounded-full h-2 mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            compositeScore >= 70 ? 'bg-emerald-500' :
            compositeScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${compositeScore}%` }}
        />
      </div>

      {/* Decision Badge */}
      {decisionConfig && (
        <div className={`text-center py-2.5 rounded-xl border text-sm font-bold mb-4 ${decisionConfig.color}`}>
          {decisionConfig.label}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center bg-navy-800 rounded-lg p-2">
          <div className="text-lg font-bold font-mono text-white">{scores.length}</div>
          <div className="text-[10px] text-surface-400">مكتمل</div>
        </div>
        <div className="text-center bg-emerald-500/10 rounded-lg p-2">
          <div className="text-lg font-bold font-mono text-emerald-400">{supportCount}</div>
          <div className="text-[10px] text-surface-400">يدعم</div>
        </div>
        <div className="text-center bg-red-500/10 rounded-lg p-2">
          <div className="text-lg font-bold font-mono text-red-400">{blockingCount}</div>
          <div className="text-[10px] text-surface-400">يمنع</div>
        </div>
      </div>

      {/* Blocking Alert */}
      {blockingCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-3">
          <div className="text-xs font-bold text-red-400 mb-1">⛔ قواعد حظر مفعّلة</div>
          <div className="text-[11px] text-red-300">
            {blockingCount} مؤشر يمنع إصدار الإشارة في هذه الجلسة
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="text-[11px] text-surface-500 text-center">
        {scores.length}/7 مؤشر مكتمل
      </div>
    </div>
  )
}

// ── MAIN CLIENT COMPONENT ─────────────────────────────────────

export default function IndicatorEngineClient({
  session,
  definitions,
  existingScores,
  userId,
}: {
  session: MarketSession
  definitions: IndicatorDefinition[]
  existingScores: any[]
  userId: string
}) {
  // Initialize state from existing scores
  const initState = (): Record<string, IndicatorState> => {
    const map: Record<string, IndicatorState> = {}
    definitions.forEach(def => {
      const existing = existingScores.find(s => s.indicator_id === def.id)
      map[def.id] = {
        score:              existing?.score?.toString()    ?? '',
        status:             existing?.status              ?? '',
        status_ar:          existing?.status_ar           ?? '',
        inputs:             existing?.inputs              ?? {},
        interpretation:     existing?.interpretation      ?? '',
        interpretation_ar:  existing?.interpretation_ar   ?? '',
        supports_entry:     existing?.supports_entry      ?? null,
        blocks_entry:       existing?.blocks_entry        ?? false,
        analyst_notes:      existing?.analyst_notes       ?? '',
        ai_explanation:     existing?.ai_explanation      ?? '',
        ai_explanation_ar:  existing?.ai_explanation_ar   ?? '',
        isSaving:           false,
        isSaved:            !!existing,
        isGeneratingAI:     false,
      }
    })
    return map
  }

  const [states, setStates] = useState<Record<string, IndicatorState>>(initState)

  const updateIndicator = useCallback((defId: string, field: keyof IndicatorState, value: any) => {
    setStates(prev => ({
      ...prev,
      [defId]: { ...prev[defId], [field]: value, isSaved: false },
    }))
  }, [])

  const saveIndicator = useCallback(async (def: IndicatorDefinition) => {
    const state = states[def.id]
    const score = parseFloat(state.score)
    if (isNaN(score)) { toast.error('أدخل درجة صحيحة'); return }

    setStates(prev => ({ ...prev, [def.id]: { ...prev[def.id], isSaving: true } }))

    try {
      const res = await fetch('/api/indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id:       session.id,
          indicator_id:     def.id,
          score,
          status:           state.status,
          status_ar:        state.status_ar,
          inputs:           state.inputs,
          interpretation:   state.interpretation,
          interpretation_ar: state.interpretation_ar,
          supports_entry:   state.supports_entry,
          blocks_entry:     state.blocks_entry,
          analyst_notes:    state.analyst_notes,
          ai_explanation:   state.ai_explanation,
          ai_explanation_ar: state.ai_explanation_ar,
          last_updated_by:  userId,
        }),
      })
      if (res.ok) {
        setStates(prev => ({ ...prev, [def.id]: { ...prev[def.id], isSaving: false, isSaved: true } }))
        toast.success(`تم حفظ ${def.name_ar}`)
      } else {
        const d = await res.json()
        toast.error(d.error || 'خطأ في الحفظ')
        setStates(prev => ({ ...prev, [def.id]: { ...prev[def.id], isSaving: false } }))
      }
    } catch {
      toast.error('خطأ في الاتصال')
      setStates(prev => ({ ...prev, [def.id]: { ...prev[def.id], isSaving: false } }))
    }
  }, [states, session.id, userId])

  const generateAI = useCallback(async (def: IndicatorDefinition) => {
    const state = states[def.id]
    setStates(prev => ({ ...prev, [def.id]: { ...prev[def.id], isGeneratingAI: true } }))
    try {
      const res = await fetch('/api/ai/indicator-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indicatorCode: def.code,
          indicatorName: def.name_ar,
          score: state.score,
          status: state.status_ar || state.status,
          inputs: state.inputs,
          sessionData: {
            spx: session.spx_close,
            vix: session.vix,
            bias: session.market_bias,
            eventRisk: session.economic_event_risk,
          },
        }),
      })
      const data = await res.json()
      if (data.explanation) {
        setStates(prev => ({
          ...prev,
          [def.id]: {
            ...prev[def.id],
            ai_explanation_ar: data.explanation,
            isGeneratingAI: false,
            isSaved: false,
          },
        }))
        toast.success('تم توليد التفسير')
      }
    } catch {
      toast.error('فشل توليد التفسير')
      setStates(prev => ({ ...prev, [def.id]: { ...prev[def.id], isGeneratingAI: false } }))
    }
  }, [states, session])

  const completedCount = definitions.filter(d => states[d.id]?.isSaved).length

  return (
    <div className="p-5 md:p-6 animate-fade-in" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/sessions/${session.id}`}
          className="text-surface-400 hover:text-navy-900 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy-900">محرك المؤشرات السبعة</h1>
          <p className="text-xs text-surface-400 mt-0.5">
            جلسة {formatDate(session.session_date)} ·{' '}
            <span className={completedCount === 7 ? 'text-emerald-600 font-medium' : ''}>
              {completedCount}/7 مكتمل
            </span>
          </p>
        </div>
        {completedCount === 7 && (
          <Link
            href={`/admin/signals/new?session=${session.id}`}
            className="btn-gold gap-1.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            إنشاء إشارة
          </Link>
        )}
      </div>

      {/* Layout: Indicators + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Indicators Grid */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {definitions.map(def => (
            <IndicatorCard
              key={def.id}
              definition={def}
              state={states[def.id]}
              sessionData={session}
              onChange={(field, value) => updateIndicator(def.id, field, value)}
              onSave={() => saveIndicator(def)}
              onGenerateAI={() => generateAI(def)}
            />
          ))}
        </div>

        {/* Decision Summary Sidebar */}
        <div className="xl:col-span-1">
          <DecisionSummary states={states} definitions={definitions} />
        </div>

      </div>
    </div>
  )
}
