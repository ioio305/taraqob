'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Spinner, SignalStatusBadge, Alert } from '@/components/ui'
import { STRATEGY_LABELS, MARKET_BIAS_LABELS, RISK_LEVEL_CONFIG } from '@/lib/utils/constants'
import { runDecisionEngine, DECISION_DISPLAY, BLOCKING_RULES } from '@/lib/engine/decisionEngine'
import { QUALITY_CONFIG } from '@/lib/engine/liquidityCalculator'
import toast from 'react-hot-toast'
import type { MarketSession, OptionContract, IndicatorScore } from '@/lib/types'

// ── TYPES ─────────────────────────────────────────────────────

interface ComposerProps {
  sessions: MarketSession[]
  userId: string
  userRole: string
}

type SignalForm = {
  session_id: string
  direction: string
  strategy: string
  market_bias: string
  entry_condition: string
  entry_range_low: string
  entry_range_high: string
  entry_notes_ar: string
  invalidation_level: string
  invalidation_condition_ar: string
  exit_plan_ar: string
  profit_target: string
  max_risk_percent: string
  risk_level: string
  confidence_score: string
  rationale: string
  ai_generated_summary: string
  user_summary_ar: string
  analyst_notes: string
  selected_contract_id: string
  expiry: string
}

const STRATEGIES = [
  { value: 'bull_call_debit_spread', label: 'Bull Call Debit Spread — سبريد شراء صاعد',  dir: 'bullish' },
  { value: 'bear_put_debit_spread',  label: 'Bear Put Debit Spread — سبريد شراء هابط',   dir: 'bearish' },
  { value: 'bull_put_credit_spread', label: 'Bull Put Credit Spread — سبريد بيع صاعد',   dir: 'bullish' },
  { value: 'bear_call_credit_spread',label: 'Bear Call Credit Spread — سبريد بيع هابط',  dir: 'bearish' },
  { value: 'long_call',              label: 'Long Call — شراء خيار صعود',                 dir: 'bullish' },
  { value: 'long_put',               label: 'Long Put — شراء خيار هبوط',                  dir: 'bearish' },
]

// ── SECTION WRAPPER ────────────────────────────────────────────

function Section({ title, subtitle, children, highlight }: {
  title: string; subtitle?: string; children: React.ReactNode; highlight?: boolean
}) {
  return (
    <div className={`card p-5 ${highlight ? 'border-teal-200 bg-teal-50/20' : ''}`}>
      <div className="mb-4">
        <div className="text-sm font-bold text-navy-900">{title}</div>
        {subtitle && <div className="text-xs text-surface-400 mt-0.5">{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="field-label">
      {label}
      {required && <span className="text-red-500 mr-1">*</span>}
    </label>
  )
}

// ── DECISION PANEL ─────────────────────────────────────────────

function DecisionPanel({
  decisionOutput, form, scores, contract
}: {
  decisionOutput: ReturnType<typeof runDecisionEngine> | null
  form: SignalForm
  scores: IndicatorScore[]
  contract: OptionContract | null
}) {
  if (!decisionOutput) {
    return (
      <div className="card bg-navy-900 p-5 text-center">
        <div className="text-xs font-semibold text-gold-400 uppercase tracking-wider mb-3">محرك القرار</div>
        <div className="text-surface-500 text-sm">اختر جلسة وأدخل البيانات لبدء التحليل</div>
      </div>
    )
  }

  const d = decisionOutput
  const display = DECISION_DISPLAY[d.decision as keyof typeof DECISION_DISPLAY]
  const hardBlocks = d.blocking_rules.filter(r => BLOCKING_RULES[r as keyof typeof BLOCKING_RULES]?.hard)
  const softBlocks = d.blocking_rules.filter(r => !BLOCKING_RULES[r as keyof typeof BLOCKING_RULES]?.hard)

  return (
    <div className="card bg-navy-900 p-5 sticky top-5">
      <div className="text-xs font-semibold text-gold-400 uppercase tracking-wider mb-4">
        محرك القرار
      </div>

      {/* Composite Score */}
      <div className="text-center mb-4">
        <div className="text-5xl font-bold font-mono text-white mb-1">
          {d.composite_score}
        </div>
        <div className="text-xs text-surface-400">الدرجة المركبة / 100</div>
        <div className="mt-1.5 text-xs font-medium text-surface-400">
          ثقة: <span className="text-white font-mono">{d.confidence}%</span>
        </div>
      </div>

      {/* Score Bar */}
      <div className="w-full bg-navy-700 rounded-full h-2.5 mb-4 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${
          d.composite_score >= 70 ? 'bg-emerald-500' :
          d.composite_score >= 50 ? 'bg-amber-500' : 'bg-red-500'
        }`} style={{ width: `${d.composite_score}%` }} />
      </div>

      {/* Decision */}
      {display && (
        <div className={`text-center py-2.5 rounded-xl border text-sm font-bold mb-4 ${display.color} ${display.bg} ${display.border}`}>
          {display.ar}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center bg-navy-800 rounded-lg p-2">
          <div className="text-base font-bold font-mono text-white">{scores.filter(s => s.score !== null).length}</div>
          <div className="text-[10px] text-surface-400">مؤشرات</div>
        </div>
        <div className="text-center bg-emerald-500/10 rounded-lg p-2">
          <div className="text-base font-bold font-mono text-emerald-400">{d.supporting_indicators.length}</div>
          <div className="text-[10px] text-surface-400">يدعم</div>
        </div>
        <div className="text-center bg-red-500/10 rounded-lg p-2">
          <div className="text-base font-bold font-mono text-red-400">{d.blocking_rules.length}</div>
          <div className="text-[10px] text-surface-400">حظر</div>
        </div>
      </div>

      {/* Hard Blocks */}
      {hardBlocks.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-3">
          <div className="text-xs font-bold text-red-400 mb-1.5">⛔ موانع إلزامية</div>
          {hardBlocks.map(rule => (
            <div key={rule} className="text-[11px] text-red-300 flex items-start gap-1.5 mb-1">
              <span className="flex-shrink-0">•</span>
              <span>{BLOCKING_RULES[rule as keyof typeof BLOCKING_RULES]?.ar ?? rule}</span>
            </div>
          ))}
        </div>
      )}

      {/* Soft Warnings */}
      {softBlocks.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3">
          <div className="text-xs font-bold text-amber-400 mb-1.5">⚠ تحذيرات</div>
          {softBlocks.map(rule => (
            <div key={rule} className="text-[11px] text-amber-300 flex items-start gap-1.5 mb-1">
              <span className="flex-shrink-0">•</span>
              <span>{BLOCKING_RULES[rule as keyof typeof BLOCKING_RULES]?.ar ?? rule}</span>
            </div>
          ))}
        </div>
      )}

      {/* Conflict Warning */}
      {d.conflict_detected && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3">
          <div className="text-xs font-bold text-amber-400 mb-1">⚡ تعارض بين المؤشرات</div>
          <div className="text-[11px] text-amber-300">
            درجة التعارض: {d.conflict_score}% — يُنصح بمراجعة المؤشرات
          </div>
        </div>
      )}

      {/* Rationale Points */}
      {d.rationale_points_ar.length > 0 && (
        <div className="border-t border-navy-700 pt-3 mt-1">
          <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-2">
            نقاط التحليل
          </div>
          {d.rationale_points_ar.map((point, i) => (
            <div key={i} className="text-[11px] text-surface-400 flex items-start gap-1.5 mb-1.5">
              <span className="text-gold-400 flex-shrink-0 mt-0.5">›</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MAIN COMPOSER ─────────────────────────────────────────────

export default function SignalComposer({ sessions, userId, userRole }: ComposerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedSession = searchParams.get('session')

  const [form, setForm] = useState<SignalForm>({
    session_id:               preselectedSession ?? (sessions[0]?.id ?? ''),
    direction:                '',
    strategy:                 '',
    market_bias:              '',
    entry_condition:          '',
    entry_range_low:          '',
    entry_range_high:         '',
    entry_notes_ar:           '',
    invalidation_level:       '',
    invalidation_condition_ar:'',
    exit_plan_ar:             '',
    profit_target:            '',
    max_risk_percent:         '',
    risk_level:               '',
    confidence_score:         '',
    rationale:                '',
    ai_generated_summary:     '',
    user_summary_ar:          '',
    analyst_notes:            '',
    selected_contract_id:     '',
    expiry:                   '',
  })

  const [scores, setScores] = useState<IndicatorScore[]>([])
  const [contracts, setContracts] = useState<OptionContract[]>([])
  const [selectedContract, setSelectedContract] = useState<OptionContract | null>(null)
  const [decisionOutput, setDecisionOutput] = useState<ReturnType<typeof runDecisionEngine> | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const selectedSession = sessions.find(s => s.id === form.session_id) ?? null

  // Load session data when session changes
  useEffect(() => {
    if (!form.session_id) return
    // Load indicator scores
    fetch(`/api/indicators?session_id=${form.session_id}`)
      .then(r => r.json())
      .then(data => setScores(Array.isArray(data) ? data : []))
      .catch(() => {})
    // Load contracts
    fetch(`/api/contracts?session_id=${form.session_id}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setContracts(data)
          const preSelected = data.find((c: OptionContract) => c.is_selected)
          if (preSelected) {
            setForm(prev => ({ ...prev, selected_contract_id: preSelected.id }))
            setSelectedContract(preSelected)
          }
        }
      })
      .catch(() => {})
  }, [form.session_id])

  // Update selected contract
  useEffect(() => {
    if (form.selected_contract_id) {
      const c = contracts.find(c => c.id === form.selected_contract_id) ?? null
      setSelectedContract(c)
    } else {
      setSelectedContract(null)
    }
  }, [form.selected_contract_id, contracts])

  // Run decision engine on key changes
  useEffect(() => {
    if (scores.length === 0) { setDecisionOutput(null); return }
    const output = runDecisionEngine({
      scores: scores as any,
      contract: selectedContract,
      signal: {
        invalidation_level: parseFloat(form.invalidation_level) || null,
        exit_plan:          form.exit_plan_ar || null,
        risk_level:         form.risk_level || null,
        max_risk_percent:   parseFloat(form.max_risk_percent) || null,
      },
    })
    setDecisionOutput(output)
  }, [scores, selectedContract, form.invalidation_level, form.exit_plan_ar, form.risk_level, form.max_risk_percent])

  function update(field: keyof SignalForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Auto-set direction when strategy changes
  function handleStrategyChange(strategy: string) {
    const s = STRATEGIES.find(st => st.value === strategy)
    setForm(prev => ({
      ...prev,
      strategy,
      direction: s?.dir ?? prev.direction,
      market_bias: s?.dir === 'bullish' ? 'bullish' : s?.dir === 'bearish' ? 'bearish' : prev.market_bias,
    }))
  }

  async function generateAIRationale() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/signal-rationale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionData: selectedSession,
          indicatorScores: scores,
          contract: selectedContract,
          signalDraft: form,
          decisionOutput,
        }),
      })
      const data = await res.json()
      if (data.rationale) {
        setForm(prev => ({
          ...prev,
          rationale:            data.rationale,
          ai_generated_summary: data.risk_assessment,
          user_summary_ar:      data.user_summary_ar,
        }))
        toast.success('تم توليد سبب الإشارة')
      }
    } catch {
      toast.error('فشل توليد السبب')
    } finally {
      setAiLoading(false)
    }
  }

  function buildPayload(status: string) {
    return {
      session_id:                form.session_id || null,
      direction:                 form.direction || null,
      strategy:                  form.strategy || null,
      market_bias:               form.market_bias || null,
      entry_condition:           form.entry_condition || null,
      entry_range_low:           parseFloat(form.entry_range_low) || null,
      entry_range_high:          parseFloat(form.entry_range_high) || null,
      entry_notes_ar:            form.entry_notes_ar || null,
      invalidation_level:        parseFloat(form.invalidation_level) || null,
      invalidation_condition_ar: form.invalidation_condition_ar || null,
      exit_plan:                 form.exit_plan_ar || null,
      exit_plan_ar:              form.exit_plan_ar || null,
      profit_target:             parseFloat(form.profit_target) || null,
      max_risk_percent:          parseFloat(form.max_risk_percent) || null,
      risk_level:                form.risk_level || null,
      confidence_score:          parseInt(form.confidence_score) || null,
      rationale:                 form.rationale || null,
      ai_generated_summary:      form.ai_generated_summary || null,
      user_summary_ar:           form.user_summary_ar || null,
      analyst_notes:             form.analyst_notes || null,
      selected_contract_id:      form.selected_contract_id || null,
      expiry:                    form.expiry || null,
      status,
      decision_state:            decisionOutput?.decision ?? null,
      composite_indicator_score: decisionOutput?.composite_score ?? null,
      decision_engine_output:    decisionOutput ?? {},
      indicator_snapshot:        scores.reduce((acc: any, s: any) => {
        acc[s.indicator?.code ?? s.indicator_id] = {
          score: s.score, status: s.status_ar, supports: s.supports_entry, blocks: s.blocks_entry
        }
        return acc
      }, {}),
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const url    = savedId ? `/api/signals/${savedId}` : '/api/signals'
      const method = savedId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload('draft')),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSavedId(data.id)
      toast.success('تم حفظ المسودة')
    } catch (err: any) {
      toast.error(err.message || 'خطأ في الحفظ')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitForReview() {
    if (!form.strategy || !form.entry_condition || !form.invalidation_level || !form.exit_plan_ar) {
      toast.error('أكمل الحقول المطلوبة: الاستراتيجية، الشرط، الإبطال، والخروج')
      return
    }
    setSubmitting(true)
    try {
      const url    = savedId ? `/api/signals/${savedId}` : '/api/signals'
      const method = savedId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload('pending_review')),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSavedId(data.id)
      toast.success(`تم إرسال الإشارة ${data.signal_ref} للمراجعة`)
      if (userRole === 'admin') {
        router.push(`/admin/signals/${data.id}/review`)
      } else {
        router.push('/analyst')
      }
    } catch (err: any) {
      toast.error(err.message || 'خطأ في الإرسال')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePublish() {
    if (!savedId) { toast.error('احفظ المسودة أولًا'); return }
    if (decisionOutput && decisionOutput.blocking_rules.some(r => BLOCKING_RULES[r as keyof typeof BLOCKING_RULES]?.hard)) {
      toast.error('لا يمكن النشر — توجد موانع إلزامية. راجع محرك القرار.')
      return
    }
    setPublishing(true)
    try {
      const res = await fetch(`/api/signals/${savedId}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (data.fields ?? []).join('، '))
      toast.success(`تم نشر الإشارة ${data.signal_ref} ✓`)
      router.push(`/admin/signals/${data.id}`)
    } catch (err: any) {
      toast.error(err.message || 'خطأ في النشر')
    } finally {
      setPublishing(false)
    }
  }

  const canPublish = userRole === 'admin'
  const hasHardBlock = decisionOutput?.blocking_rules.some(r => BLOCKING_RULES[r as keyof typeof BLOCKING_RULES]?.hard)

  return (
    <div className="p-5 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Signal Composer</h1>
          <p className="text-xs text-surface-400 mt-0.5">
            إنشاء إشارة جديدة — كل الحقول المطلوبة يجب اكتمالها قبل النشر
          </p>
        </div>
        {savedId && (
          <span className="text-xs text-teal-600 font-medium bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            محفوظ كمسودة
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── MAIN FORM (2/3) ─────────────────────────────── */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* 1. Session Selection */}
          <Section title="الجلسة والبيانات" subtitle="اختر جلسة السوق الحالية">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel label="جلسة السوق" required />
                <select
                  value={form.session_id}
                  onChange={e => update('session_id', e.target.value)}
                  className="field-input"
                >
                  <option value="">اختر جلسة...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.session_date).toLocaleDateString('ar-SA', {
                        weekday: 'short', month: 'short', day: 'numeric'
                      })} — SPX {s.spx_close?.toLocaleString('en-US') ?? '?'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Session Mini-Summary */}
              {selectedSession && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l: 'SPX', v: selectedSession.spx_close?.toLocaleString('en-US') },
                    { l: 'VIX', v: selectedSession.vix?.toFixed(2) },
                    { l: 'Bias', v: selectedSession.market_bias
                      ? MARKET_BIAS_LABELS[selectedSession.market_bias]?.label_ar : '—' },
                  ].map(item => (
                    <div key={item.l} className="bg-surface-50 rounded-lg p-2 border border-surface-200 text-center">
                      <div className="text-[10px] font-semibold text-surface-400 uppercase">{item.l}</div>
                      <div className="text-xs font-bold text-navy-900 font-mono mt-0.5">{item.v ?? '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Indicators Mini-Status */}
            {scores.length > 0 && (
              <div className="mt-3 p-3 bg-surface-50 rounded-xl border border-surface-200">
                <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-2">
                  المؤشرات ({scores.filter(s => s.score !== null).length}/7)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scores.map((s: any) => (
                    <span key={s.id} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      s.blocks_entry ? 'bg-red-100 text-red-700' :
                      s.supports_entry ? 'bg-emerald-100 text-emerald-700' :
                      'bg-surface-200 text-surface-600'
                    }`}>
                      {s.indicator?.name_ar?.slice(0, 8) ?? '—'}: {s.score ?? '?'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* 2. Strategy */}
          <Section title="الاستراتيجية والاتجاه" subtitle="اختر استراتيجية من القائمة المعتمدة فقط">
            <div className="flex flex-col gap-3">
              <FieldLabel label="الاستراتيجية" required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STRATEGIES.map(s => (
                  <label
                    key={s.value}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer
                      transition-all duration-150
                      ${form.strategy === s.value
                        ? 'border-teal-400 bg-teal-50'
                        : 'border-surface-200 hover:border-surface-300 bg-white'}`}
                  >
                    <input type="radio" name="strategy" value={s.value}
                      checked={form.strategy === s.value}
                      onChange={() => handleStrategyChange(s.value)}
                      className="sr-only"
                    />
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all ${
                      form.strategy === s.value
                        ? 'border-teal-500 bg-teal-500'
                        : 'border-surface-300'
                    }`} />
                    <div>
                      <div className={`text-xs font-semibold ${form.strategy === s.value ? 'text-teal-700' : 'text-navy-900'}`}>
                        {s.label.split(' — ')[0]}
                      </div>
                      <div className={`text-[11px] ${s.dir === 'bullish' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {s.dir === 'bullish' ? '↑ صاعد' : '↓ هابط'} · {s.label.split(' — ')[1]}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Market Bias */}
              {form.direction && (
                <div>
                  <FieldLabel label="اتجاه السوق" />
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(MARKET_BIAS_LABELS).map(([val, cfg]) => (
                      <label key={val} className={`flex items-center gap-2 px-3 py-2 rounded-xl border
                        text-xs font-medium cursor-pointer transition-all
                        ${form.market_bias === val
                          ? 'border-teal-400 bg-teal-50 text-teal-700'
                          : `border-surface-200 hover:border-surface-300 ${cfg.color}`}`}>
                        <input type="radio" name="market_bias" value={val}
                          checked={form.market_bias === val}
                          onChange={() => update('market_bias', val)}
                          className="sr-only"
                        />
                        {cfg.label_ar}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* 3. Contract */}
          <Section title="العقد المختار" subtitle="حدد العقد من قائمة العقود المراقبة">
            {contracts.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-sm text-surface-400 mb-2">لا توجد عقود لهذه الجلسة</div>
                <a href="/admin/contracts" className="btn-secondary btn-sm">
                  إضافة عقود →
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <FieldLabel label="اختر عقدًا" />
                <div className="flex flex-col gap-2">
                  {contracts.map(c => {
                    const qConf = c.contract_quality ? QUALITY_CONFIG[c.contract_quality] : null
                    const isAvoid = c.contract_quality === 'avoid'
                    const mid = c.bid && c.ask ? ((c.bid + c.ask) / 2).toFixed(3) : '—'
                    return (
                      <label key={c.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border
                        cursor-pointer transition-all duration-150
                        ${isAvoid ? 'opacity-50 cursor-not-allowed bg-surface-50 border-surface-200' :
                          form.selected_contract_id === c.id
                            ? 'border-teal-400 bg-teal-50'
                            : 'border-surface-200 hover:border-surface-300 bg-white'}`}>
                        <input type="radio" name="contract" value={c.id}
                          disabled={isAvoid}
                          checked={form.selected_contract_id === c.id}
                          onChange={() => update('selected_contract_id', c.id)}
                          className="sr-only"
                        />
                        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                          form.selected_contract_id === c.id ? 'border-teal-500 bg-teal-500' : 'border-surface-300'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              c.contract_type === 'call' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {c.contract_type === 'call' ? '↑ Call' : '↓ Put'}
                            </span>
                            <span className="text-sm font-mono font-bold text-navy-900">
                              {c.strike.toLocaleString('en-US')}
                            </span>
                            <span className="text-xs text-surface-400">DTE {c.dte}</span>
                            <span className="text-xs font-mono text-surface-600">Mid: {mid}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {qConf && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border
                                ${qConf.color} ${qConf.bg} ${qConf.border}`}>
                                {qConf.label_ar}
                              </span>
                            )}
                            <span className="text-[10px] text-surface-400 font-mono">
                              {c.liquidity_score ?? '—'}/100
                            </span>
                            {isAvoid && (
                              <span className="text-[10px] text-red-600 font-medium">⛔ محظور</span>
                            )}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </Section>

          {/* 4. Entry Conditions */}
          <Section title="شروط الدخول" subtitle="حدد متى وكيف يتم الدخول">
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel label="شرط الدخول" required />
                <textarea
                  value={form.entry_condition}
                  onChange={e => update('entry_condition', e.target.value)}
                  rows={2}
                  placeholder="مثال: الدخول عند إغلاق SPX فوق مستوى 5,200 بشمعة 5 دقائق..."
                  className="field-input resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel label="نطاق الدخول — أدنى" />
                  <input type="number" step="0.01" value={form.entry_range_low}
                    onChange={e => update('entry_range_low', e.target.value)}
                    placeholder="5190" className="field-input font-mono" dir="ltr" />
                </div>
                <div>
                  <FieldLabel label="نطاق الدخول — أعلى" />
                  <input type="number" step="0.01" value={form.entry_range_high}
                    onChange={e => update('entry_range_high', e.target.value)}
                    placeholder="5210" className="field-input font-mono" dir="ltr" />
                </div>
              </div>
            </div>
          </Section>

          {/* 5. Risk Management */}
          <Section title="إدارة المخاطر" subtitle="لا يمكن النشر بدون اكتمال هذه الحقول" highlight>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel label="نقطة الإبطال (SPX)" required />
                  <input type="number" step="0.5" value={form.invalidation_level}
                    onChange={e => update('invalidation_level', e.target.value)}
                    placeholder="5180" className="field-input font-mono font-bold text-red-700" dir="ltr" />
                  <div className="text-[11px] text-surface-400 mt-1">
                    الإشارة تُلغى عند كسر هذا المستوى
                  </div>
                </div>
                <div>
                  <FieldLabel label="هدف الربح (SPX)" />
                  <input type="number" step="0.5" value={form.profit_target}
                    onChange={e => update('profit_target', e.target.value)}
                    placeholder="5240" className="field-input font-mono font-bold text-emerald-700" dir="ltr" />
                </div>
              </div>

              <div>
                <FieldLabel label="شرط الإبطال (نصي)" required />
                <textarea
                  value={form.invalidation_condition_ar}
                  onChange={e => update('invalidation_condition_ar', e.target.value)}
                  rows={2}
                  placeholder="مثال: الإشارة تُلغى عند إغلاق SPX تحت VWAP أو كسر مستوى الدعم..."
                  className="field-input resize-none"
                />
              </div>

              <div>
                <FieldLabel label="خطة الخروج" required />
                <textarea
                  value={form.exit_plan_ar}
                  onChange={e => update('exit_plan_ar', e.target.value)}
                  rows={2}
                  placeholder="مثال: الخروج عند بلوغ الهدف أو عند تحقق شرط الإبطال..."
                  className="field-input resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel label="المخاطرة القصوى %" required />
                  <input type="number" step="0.5" min="0" max="100"
                    value={form.max_risk_percent}
                    onChange={e => update('max_risk_percent', e.target.value)}
                    placeholder="2" className="field-input font-mono" dir="ltr" />
                </div>
                <div>
                  <FieldLabel label="مستوى المخاطرة" required />
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['low', 'medium', 'high', 'extreme'] as const).map(level => {
                      const cfg = RISK_LEVEL_CONFIG[level]
                      return (
                        <label key={level} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border
                          cursor-pointer text-xs font-medium transition-all
                          ${form.risk_level === level
                            ? `border-2 ${cfg.color} ${cfg.bgColor}`
                            : 'border-surface-200 text-surface-500 hover:border-surface-300'}`}>
                          <input type="radio" name="risk_level" value={level}
                            checked={form.risk_level === level}
                            onChange={() => update('risk_level', level)}
                            className="sr-only"
                          />
                          {cfg.label_ar}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* 6. Scoring & AI */}
          <Section title="التقييم والتحليل" subtitle="درجة الثقة وسبب الإشارة">
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel label="درجة الثقة (0-100)" required />
                <div className="flex items-center gap-3">
                  <input type="number" min="0" max="100" value={form.confidence_score}
                    onChange={e => update('confidence_score', e.target.value)}
                    placeholder="70" className="field-input font-mono font-bold text-xl w-32" dir="ltr" />
                  {form.confidence_score && (
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 bg-surface-200 rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${
                          parseInt(form.confidence_score) >= 75 ? 'bg-emerald-500' :
                          parseInt(form.confidence_score) >= 55 ? 'bg-amber-500' : 'bg-red-500'
                        }`} style={{ width: `${form.confidence_score}%` }} />
                      </div>
                      <span className={`text-sm font-mono font-bold ${
                        parseInt(form.confidence_score) >= 75 ? 'text-emerald-700' :
                        parseInt(form.confidence_score) >= 55 ? 'text-amber-700' : 'text-red-700'
                      }`}>{form.confidence_score}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Rationale Button */}
              <div className="flex items-center justify-between py-2 border-t border-surface-200 border-b">
                <div>
                  <div className="text-xs font-semibold text-navy-900">توليد سبب الإشارة بالذكاء الاصطناعي</div>
                  <div className="text-[11px] text-surface-400">يقرأ المؤشرات ويبني التحليل تلقائيًا</div>
                </div>
                <button type="button" onClick={generateAIRationale}
                  disabled={aiLoading || !form.session_id}
                  className="btn-secondary gap-2">
                  {aiLoading ? <Spinner size="sm" /> : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
                    </svg>
                  )}
                  {aiLoading ? 'جارٍ التوليد...' : 'توليد AI'}
                </button>
              </div>

              <div>
                <FieldLabel label="سبب الإشارة (Rationale)" required />
                <textarea value={form.rationale}
                  onChange={e => update('rationale', e.target.value)}
                  rows={4} placeholder="اشرح لماذا هذه الإشارة مناسبة بناءً على المؤشرات..."
                  className="field-input resize-none text-sm leading-relaxed" />
              </div>

              <div>
                <FieldLabel label="ملخص للمستخدم (ظاهر للـ Beta Users)" required />
                <textarea value={form.user_summary_ar}
                  onChange={e => update('user_summary_ar', e.target.value)}
                  rows={3} placeholder="ملخص مبسط وآمن للمستخدم — يجب أن يذكر أن الإشارة مشروطة..."
                  className="field-input resize-none text-sm" />
                <div className="text-[11px] text-amber-700 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  ⚠ تأكد أن الملخص لا يتضمن ضمانات ربح أو عبارات قطعية
                </div>
              </div>

              <div>
                <FieldLabel label="ملاحظات المحلل (داخلية)" />
                <textarea value={form.analyst_notes}
                  onChange={e => update('analyst_notes', e.target.value)}
                  rows={2} placeholder="ملاحظات داخلية غير مرئية للمستخدمين..."
                  className="field-input resize-none text-sm" />
              </div>
            </div>
          </Section>

          {/* Actions */}
          <div className="card p-5">
            {hasHardBlock && (
              <Alert type="error" title="موانع إلزامية">
                لا يمكن النشر — راجع محرك القرار في اللوحة الجانبية وأصلح الموانع أولًا.
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
              <button type="button" onClick={handleSave} disabled={saving}
                className="btn-secondary w-full sm:w-auto gap-2">
                {saving ? <Spinner size="sm" /> : null}
                حفظ مسودة
              </button>

              <button type="button" onClick={handleSubmitForReview}
                disabled={submitting || !form.strategy}
                className="btn-gold w-full sm:w-auto gap-2">
                {submitting ? <Spinner size="sm" /> : null}
                {userRole === 'admin' ? 'إرسال للمراجعة' : 'إرسال للمدير'}
              </button>

              {canPublish && (
                <button type="button" onClick={handlePublish}
                  disabled={publishing || !savedId || !!hasHardBlock}
                  className="btn-primary w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700">
                  {publishing ? <Spinner size="sm" /> : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  )}
                  نشر الإشارة
                </button>
              )}
            </div>

            <div className="text-[11px] text-surface-400 text-center mt-3">
              بعد النشر لا يمكن تعديل الإشارة — أي تغيير يتم عبر Signal Update مستقل
            </div>
          </div>

        </div>

        {/* ── DECISION PANEL (1/3) ─────────────────────────── */}
        <div className="xl:col-span-1">
          <DecisionPanel
            decisionOutput={decisionOutput}
            form={form}
            scores={scores}
            contract={selectedContract}
          />
        </div>

      </div>
    </div>
  )
}
