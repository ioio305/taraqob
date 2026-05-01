'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner, Alert } from '@/components/ui'
import toast from 'react-hot-toast'
import type { MarketSession } from '@/lib/types'

interface SessionFormProps {
  session?: MarketSession
  mode: 'create' | 'edit'
  redirectTo?: string
}

type FormData = {
  session_date: string
  spx_open: string
  spx_high: string
  spx_low: string
  spx_close: string
  spx_previous_close: string
  vix: string
  vwap_level: string
  vwap_status: string
  opening_range_high: string
  opening_range_low: string
  expected_move_upper: string
  expected_move_lower: string
  economic_event_risk: string
  market_bias: string
  notes: string
}

const EVENT_RISK_OPTIONS = [
  { value: 'clear',     label: 'آمن — لا أحداث',           color: 'text-emerald-700' },
  { value: 'caution',   label: 'تحذير — أحداث متوسطة',     color: 'text-amber-700'   },
  { value: 'high_risk', label: 'خطر مرتفع — أحداث كبيرة',  color: 'text-orange-700'  },
  { value: 'block',     label: 'حظر تام — لا تداول',        color: 'text-red-700'     },
]

const MARKET_BIAS_OPTIONS = [
  { value: 'bullish',  label: 'صاعد',           color: 'text-emerald-700' },
  { value: 'bearish',  label: 'هابط',           color: 'text-red-700'     },
  { value: 'neutral',  label: 'محايد',          color: 'text-surface-600' },
  { value: 'mixed',    label: 'متضارب',         color: 'text-amber-700'   },
  { value: 'risk_off', label: 'تجنب المخاطر',  color: 'text-red-700'     },
]

const VWAP_OPTIONS = [
  { value: 'above', label: 'فوق VWAP' },
  { value: 'below', label: 'تحت VWAP' },
  { value: 'at',    label: 'عند VWAP' },
]

function FieldGroup({ label, children, hint }: {
  label: string; children: React.ReactNode; hint?: string
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-surface-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function MarketSessionForm({ session, mode, redirectTo }: SessionFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState(session?.ai_summary_ar ?? '')
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<FormData>({
    session_date:        session?.session_date        ?? today,
    spx_open:            session?.spx_open?.toString()            ?? '',
    spx_high:            session?.spx_high?.toString()            ?? '',
    spx_low:             session?.spx_low?.toString()             ?? '',
    spx_close:           session?.spx_close?.toString()           ?? '',
    spx_previous_close:  session?.spx_previous_close?.toString()  ?? '',
    vix:                 session?.vix?.toString()                  ?? '',
    vwap_level:          session?.vwap_level?.toString()           ?? '',
    vwap_status:         session?.vwap_status                     ?? 'above',
    opening_range_high:  session?.opening_range_high?.toString()  ?? '',
    opening_range_low:   session?.opening_range_low?.toString()   ?? '',
    expected_move_upper: session?.expected_move_upper?.toString() ?? '',
    expected_move_lower: session?.expected_move_lower?.toString() ?? '',
    economic_event_risk: session?.economic_event_risk             ?? 'clear',
    market_bias:         session?.market_bias                     ?? 'neutral',
    notes:               session?.notes                           ?? '',
  })

  function update(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function parseNum(val: string): number | null {
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  async function generateAISummary() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/market-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionData: form }),
      })
      const data = await res.json()
      if (data.summary) {
        setAiSummary(data.summary)
        toast.success('تم توليد الملخص')
      }
    } catch {
      toast.error('فشل توليد الملخص')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const payload = {
      session_date:        form.session_date,
      spx_open:            parseNum(form.spx_open),
      spx_high:            parseNum(form.spx_high),
      spx_low:             parseNum(form.spx_low),
      spx_close:           parseNum(form.spx_close),
      spx_previous_close:  parseNum(form.spx_previous_close),
      spx_change_percent:  form.spx_close && form.spx_previous_close
        ? ((parseNum(form.spx_close)! - parseNum(form.spx_previous_close)!) / parseNum(form.spx_previous_close)! * 100)
        : null,
      vix:                 parseNum(form.vix),
      vwap_level:          parseNum(form.vwap_level),
      vwap_status:         form.vwap_status || null,
      opening_range_high:  parseNum(form.opening_range_high),
      opening_range_low:   parseNum(form.opening_range_low),
      expected_move_upper: parseNum(form.expected_move_upper),
      expected_move_lower: parseNum(form.expected_move_lower),
      expected_move_points: form.expected_move_upper && form.expected_move_lower
        ? parseNum(form.expected_move_upper)! - parseNum(form.expected_move_lower)!
        : null,
      economic_event_risk: form.economic_event_risk,
      market_bias:         form.market_bias || null,
      notes:               form.notes || null,
      ai_summary_ar:       aiSummary || null,
    }

    try {
      const url = mode === 'create' ? '/api/sessions' : `/api/sessions/${session!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'حدث خطأ')
        return
      }
      toast.success(mode === 'create' ? 'تم إنشاء الجلسة' : 'تم حفظ التعديلات')
      router.push(redirectTo || `/admin/sessions/${data.id}`)
      router.refresh()
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  const spxChange = form.spx_close && form.spx_previous_close
    ? ((parseNum(form.spx_close)! - parseNum(form.spx_previous_close)!) / parseNum(form.spx_previous_close)! * 100)
    : null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {error && <Alert type="error">{error}</Alert>}

      {/* Section: Date */}
      <div className="card p-5">
        <div className="section-title">معلومات الجلسة</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup label="تاريخ الجلسة" hint="يجب أن يكون يوم تداول">
            <input
              type="date"
              value={form.session_date}
              onChange={e => update('session_date', e.target.value)}
              required
              className="field-input"
              dir="ltr"
            />
          </FieldGroup>

          <FieldGroup label="مخاطر الأحداث الاقتصادية">
            <div className="grid grid-cols-2 gap-2">
              {EVENT_RISK_OPTIONS.map(opt => (
                <label key={opt.value}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer
                    transition-all duration-150 text-sm
                    ${form.economic_event_risk === opt.value
                      ? 'border-teal-400 bg-teal-50'
                      : 'border-surface-200 hover:border-surface-300'
                    }`}
                >
                  <input type="radio" name="event_risk" value={opt.value}
                    checked={form.economic_event_risk === opt.value}
                    onChange={() => update('economic_event_risk', opt.value)}
                    className="sr-only"
                  />
                  <span className={`font-medium text-xs ${
                    form.economic_event_risk === opt.value ? 'text-teal-700' : opt.color
                  }`}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </FieldGroup>
        </div>
      </div>

      {/* Section: SPX Data */}
      <div className="card p-5">
        <div className="section-title">بيانات SPX</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'الإغلاق السابق', field: 'spx_previous_close' as keyof FormData },
            { label: 'الافتتاح',        field: 'spx_open'           as keyof FormData },
            { label: 'الأعلى',          field: 'spx_high'           as keyof FormData },
            { label: 'الأدنى',          field: 'spx_low'            as keyof FormData },
            { label: 'الإغلاق',         field: 'spx_close'          as keyof FormData },
          ].map(item => (
            <FieldGroup key={item.field} label={item.label}>
              <input
                type="number"
                step="0.01"
                value={form[item.field]}
                onChange={e => update(item.field, e.target.value)}
                placeholder="0.00"
                className="field-input font-mono"
                dir="ltr"
              />
            </FieldGroup>
          ))}

          {/* Live Change Preview */}
          <div className="flex flex-col justify-end">
            <label className="field-label">التغيير اليومي</label>
            <div className={`px-4 py-2.5 rounded-lg border font-mono font-bold text-sm
              ${spxChange === null ? 'bg-surface-50 border-surface-200 text-surface-400' :
                spxChange >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                'bg-red-50 border-red-200 text-red-700'}`}>
              {spxChange !== null
                ? `${spxChange >= 0 ? '+' : ''}${spxChange.toFixed(2)}%`
                : '—'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Section: Volatility & Intraday */}
      <div className="card p-5">
        <div className="section-title">التذبذب والزخم اللحظي</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <FieldGroup label="VIX" hint="مؤشر الخوف">
            <input type="number" step="0.01" value={form.vix}
              onChange={e => update('vix', e.target.value)}
              placeholder="0.00" className="field-input font-mono" dir="ltr" />
          </FieldGroup>

          <FieldGroup label="مستوى VWAP">
            <input type="number" step="0.01" value={form.vwap_level}
              onChange={e => update('vwap_level', e.target.value)}
              placeholder="0.00" className="field-input font-mono" dir="ltr" />
          </FieldGroup>

          <FieldGroup label="حالة VWAP">
            <select value={form.vwap_status}
              onChange={e => update('vwap_status', e.target.value)}
              className="field-input">
              {VWAP_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup label="أعلى نطاق الافتتاح">
            <input type="number" step="0.01" value={form.opening_range_high}
              onChange={e => update('opening_range_high', e.target.value)}
              placeholder="0.00" className="field-input font-mono" dir="ltr" />
          </FieldGroup>

          <FieldGroup label="أدنى نطاق الافتتاح">
            <input type="number" step="0.01" value={form.opening_range_low}
              onChange={e => update('opening_range_low', e.target.value)}
              placeholder="0.00" className="field-input font-mono" dir="ltr" />
          </FieldGroup>
        </div>
      </div>

      {/* Section: Expected Move */}
      <div className="card p-5">
        <div className="section-title">النطاق المتوقع</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <FieldGroup label="الحد الأعلى المتوقع">
            <input type="number" step="0.01" value={form.expected_move_upper}
              onChange={e => update('expected_move_upper', e.target.value)}
              placeholder="0.00" className="field-input font-mono" dir="ltr" />
          </FieldGroup>

          <FieldGroup label="الحد الأدنى المتوقع">
            <input type="number" step="0.01" value={form.expected_move_lower}
              onChange={e => update('expected_move_lower', e.target.value)}
              placeholder="0.00" className="field-input font-mono" dir="ltr" />
          </FieldGroup>

          {/* Range Preview */}
          {form.expected_move_upper && form.expected_move_lower && (
            <div className="flex flex-col justify-end">
              <label className="field-label">حجم النطاق</label>
              <div className="px-4 py-2.5 rounded-lg border border-teal-200 bg-teal-50
                font-mono font-bold text-sm text-teal-700">
                {(parseNum(form.expected_move_upper)! - parseNum(form.expected_move_lower)!).toFixed(2)} نقطة
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section: Market Assessment */}
      <div className="card p-5">
        <div className="section-title">تقييم السوق</div>
        <div className="flex flex-col gap-4">
          <FieldGroup label="اتجاه السوق">
            <div className="flex flex-wrap gap-2">
              {MARKET_BIAS_OPTIONS.map(opt => (
                <label key={opt.value}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer
                    transition-all duration-150 text-sm font-medium
                    ${form.market_bias === opt.value
                      ? 'border-teal-400 bg-teal-50 text-teal-700'
                      : `border-surface-200 hover:border-surface-300 ${opt.color}`
                    }`}
                >
                  <input type="radio" name="market_bias" value={opt.value}
                    checked={form.market_bias === opt.value}
                    onChange={() => update('market_bias', opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </FieldGroup>

          <FieldGroup label="ملاحظات المحلل">
            <textarea value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={3}
              placeholder="ملاحظات تحليلية إضافية..."
              className="field-input resize-none"
            />
          </FieldGroup>
        </div>
      </div>

      {/* Section: AI Summary */}
      <div className="card p-5 border-teal-200/60 bg-teal-50/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-navy-900">ملخص الذكاء الاصطناعي</div>
            <div className="text-xs text-surface-400 mt-0.5">
              يُولَّد تلقائيًا من بيانات الجلسة — يمكن تعديله
            </div>
          </div>
          <button
            type="button"
            onClick={generateAISummary}
            disabled={aiLoading || !form.spx_close}
            className="btn-secondary btn-sm gap-2"
          >
            {aiLoading ? <Spinner size="sm" /> : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            )}
            توليد الملخص
          </button>
        </div>
        <textarea
          value={aiSummary}
          onChange={e => setAiSummary(e.target.value)}
          rows={4}
          placeholder="سيظهر ملخص الذكاء الاصطناعي هنا بعد الضغط على 'توليد الملخص'..."
          className="field-input resize-none text-sm leading-relaxed"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={() => router.back()} className="btn-ghost">
          إلغاء
        </button>
        <button type="submit" disabled={loading} className="btn-primary gap-2">
          {loading ? <Spinner size="sm" /> : null}
          {mode === 'create' ? 'إنشاء الجلسة' : 'حفظ التعديلات'}
        </button>
      </div>

    </form>
  )
}
