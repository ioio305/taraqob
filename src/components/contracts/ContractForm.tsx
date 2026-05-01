'use client'

import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui'
import { calculateLiquidity, QUALITY_CONFIG, EXEC_RISK_CONFIG } from '@/lib/engine/liquidityCalculator'
import type { LiquidityResult } from '@/lib/engine/liquidityCalculator'
import toast from 'react-hot-toast'
import type { MarketSession } from '@/lib/types'

interface ContractFormProps {
  session: MarketSession
  onSaved?: () => void
}

export default function ContractForm({ session, onSaved }: ContractFormProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    contract_type:  'call' as 'call' | 'put',
    expiry:         '',
    dte:            '',
    strike:         '',
    bid:            '',
    ask:            '',
    delta:          '',
    gamma:          '',
    theta:          '',
    vega:           '',
    iv:             '',
    iv_rank:        '',
    volume:         '',
    open_interest:  '',
    notes:          '',
  })

  const [liqResult, setLiqResult] = useState<LiquidityResult | null>(null)

  // Recalculate liquidity on every change
  useEffect(() => {
    const result = calculateLiquidity({
      bid:           parseFloat(form.bid)          || null,
      ask:           parseFloat(form.ask)          || null,
      delta:         parseFloat(form.delta)        || null,
      gamma:         parseFloat(form.gamma)        || null,
      theta:         parseFloat(form.theta)        || null,
      iv:            parseFloat(form.iv)           || null,
      volume:        parseInt(form.volume)         || null,
      open_interest: parseInt(form.open_interest)  || null,
      dte:           parseInt(form.dte)            || null,
      strike:        parseFloat(form.strike)       || null,
      spx_close:     session.spx_close,
    })
    if (form.bid || form.ask || form.volume || form.delta) {
      setLiqResult(result)
    } else {
      setLiqResult(null)
    }
  }, [form, session.spx_close])

  // Auto-calculate DTE from expiry
  useEffect(() => {
    if (form.expiry) {
      const exp = new Date(form.expiry)
      const today = new Date()
      const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (diff >= 0) setForm(prev => ({ ...prev, dte: diff.toString() }))
    }
  }, [form.expiry])

  function update(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.strike || !form.expiry) {
      toast.error('Strike والتاريخ مطلوبان')
      return
    }
    setLoading(true)
    try {
      const payload = {
        session_id:      session.id,
        contract_type:   form.contract_type,
        expiry:          form.expiry,
        dte:             parseInt(form.dte) || null,
        strike:          parseFloat(form.strike),
        bid:             parseFloat(form.bid)          || null,
        ask:             parseFloat(form.ask)          || null,
        mid:             liqResult?.mid                || null,
        delta:           parseFloat(form.delta)        || null,
        gamma:           parseFloat(form.gamma)        || null,
        theta:           parseFloat(form.theta)        || null,
        vega:            parseFloat(form.vega)         || null,
        iv:              parseFloat(form.iv)           || null,
        iv_rank:         parseFloat(form.iv_rank)      || null,
        volume:          parseInt(form.volume)         || null,
        open_interest:   parseInt(form.open_interest)  || null,
        liquidity_score: liqResult?.liquidity_score    ?? null,
        contract_quality: liqResult?.contract_quality  ?? null,
        execution_risk:  liqResult?.execution_risk     ?? null,
        notes:           form.notes                    || null,
      }

      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('تم حفظ العقد')
      // Reset form (keep session and type)
      setForm(prev => ({
        ...prev,
        expiry: '', dte: '', strike: '',
        bid: '', ask: '', delta: '', gamma: '', theta: '',
        vega: '', iv: '', iv_rank: '', volume: '', open_interest: '', notes: '',
      }))
      setLiqResult(null)
      onSaved?.()
    } catch (err: any) {
      toast.error(err.message || 'خطأ في الحفظ')
    } finally {
      setLoading(false)
    }
  }

  const qConfig = liqResult ? QUALITY_CONFIG[liqResult.contract_quality] : null
  const spxClose = session.spx_close

  return (
    <div className="flex flex-col gap-5">

      {/* Contract Type + Basic Info */}
      <div className="card p-5">
        <div className="section-title">تفاصيل العقد</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

          {/* Type Toggle */}
          <div className="col-span-2 sm:col-span-1">
            <label className="field-label">نوع العقد</label>
            <div className="flex rounded-xl overflow-hidden border border-surface-200">
              {(['call', 'put'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update('contract_type', t)}
                  className={`flex-1 py-2.5 text-sm font-bold transition-all duration-150 ${
                    form.contract_type === t
                      ? t === 'call'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                      : 'bg-white text-surface-500 hover:bg-surface-50'
                  }`}
                >
                  {t === 'call' ? 'Call ↑' : 'Put ↓'}
                </button>
              ))}
            </div>
          </div>

          {/* Strike */}
          <div>
            <label className="field-label">
              Strike
              {spxClose && (
                <span className="mr-1 text-surface-400 normal-case">
                  (SPX: {spxClose.toLocaleString('en-US')})
                </span>
              )}
            </label>
            <input
              type="number" step="5" value={form.strike}
              onChange={e => update('strike', e.target.value)}
              placeholder="5200" className="field-input font-mono font-bold" dir="ltr"
            />
            {/* ATM indicator */}
            {form.strike && spxClose && (
              <div className="text-[11px] mt-1 font-medium">
                {Math.abs(parseFloat(form.strike) - spxClose) <= 10 ? (
                  <span className="text-teal-600">✓ قريب من ATM</span>
                ) : Math.abs(parseFloat(form.strike) - spxClose) <= 25 ? (
                  <span className="text-amber-600">OTM قريب</span>
                ) : (
                  <span className="text-red-600">OTM بعيد</span>
                )}
              </div>
            )}
          </div>

          {/* Expiry */}
          <div>
            <label className="field-label">تاريخ الانتهاء</label>
            <input
              type="date" value={form.expiry}
              onChange={e => update('expiry', e.target.value)}
              className="field-input" dir="ltr"
            />
          </div>

          {/* DTE */}
          <div>
            <label className="field-label">DTE (أيام)</label>
            <input
              type="number" value={form.dte}
              onChange={e => update('dte', e.target.value)}
              placeholder="0" className={`field-input font-mono font-bold ${
                parseInt(form.dte) < 3 && form.dte ? 'text-red-700 bg-red-50 border-red-200' :
                parseInt(form.dte) <= 21 && form.dte ? 'text-emerald-700' : ''
              }`} dir="ltr"
            />
            {form.dte && parseInt(form.dte) < 1 && (
              <div className="text-[11px] text-red-600 mt-1 font-medium">⛔ 0DTE محظور في البيتا</div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="card p-5">
        <div className="section-title">التسعير</div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
          {[
            { label: 'Bid', field: 'bid' as const, placeholder: '2.50' },
            { label: 'Ask', field: 'ask' as const, placeholder: '2.65' },
            { label: 'IV %', field: 'iv' as const, placeholder: '18.5' },
            { label: 'IV Rank', field: 'iv_rank' as const, placeholder: '45' },
          ].map(item => (
            <div key={item.field}>
              <label className="field-label">{item.label}</label>
              <input
                type="number" step="any" value={form[item.field]}
                onChange={e => update(item.field, e.target.value)}
                placeholder={item.placeholder} className="field-input font-mono" dir="ltr"
              />
            </div>
          ))}

          {/* Mid (calculated) */}
          <div>
            <label className="field-label">Mid (محسوب)</label>
            <div className={`px-4 py-2.5 rounded-lg border font-mono font-bold text-sm ${
              liqResult?.mid ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-surface-50 border-surface-200 text-surface-400'
            }`}>
              {liqResult?.mid ? liqResult.mid.toFixed(3) : '—'}
            </div>
            {liqResult?.spread_percent !== null && liqResult?.spread_percent !== undefined && (
              <div className={`text-[11px] mt-1 font-medium ${
                liqResult.spread_percent > 15 ? 'text-red-600' :
                liqResult.spread_percent > 8 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                Spread: {liqResult.spread_percent}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Greeks */}
      <div className="card p-5">
        <div className="section-title">Greeks</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Delta', field: 'delta' as const, hint: '0.30 – 0.50 مثالي', placeholder: '0.40' },
            { label: 'Gamma', field: 'gamma' as const, placeholder: '0.025' },
            { label: 'Theta', field: 'theta' as const, hint: 'سالب عادةً', placeholder: '-0.08' },
            { label: 'Vega',  field: 'vega'  as const, placeholder: '0.15' },
          ].map(item => (
            <div key={item.field}>
              <label className="field-label">{item.label}</label>
              <input
                type="number" step="any" value={form[item.field]}
                onChange={e => update(item.field, e.target.value)}
                placeholder={item.placeholder} className="field-input font-mono" dir="ltr"
              />
              {item.hint && <div className="text-[11px] text-surface-400 mt-1">{item.hint}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Volume & OI */}
      <div className="card p-5">
        <div className="section-title">الحجم والاهتمام المفتوح</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Volume (حجم اليوم)</label>
            <input
              type="number" value={form.volume}
              onChange={e => update('volume', e.target.value)}
              placeholder="5000" className="field-input font-mono" dir="ltr"
            />
            {form.volume && parseInt(form.volume) < 100 && (
              <div className="text-[11px] text-red-600 mt-1">⚠ حجم منخفض جدًا</div>
            )}
          </div>
          <div>
            <label className="field-label">Open Interest</label>
            <input
              type="number" value={form.open_interest}
              onChange={e => update('open_interest', e.target.value)}
              placeholder="15000" className="field-input font-mono" dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card p-5">
        <label className="field-label">ملاحظات</label>
        <textarea
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          rows={2} placeholder="ملاحظات اختيارية..."
          className="field-input resize-none text-sm"
        />
      </div>

      {/* ── LIVE LIQUIDITY SCORE ────────────────────────────── */}
      {liqResult && (
        <div className={`card p-5 ${
          liqResult.contract_quality === 'avoid' ? 'border-red-200 bg-red-50/30' :
          liqResult.contract_quality === 'good'  ? 'border-emerald-200 bg-emerald-50/20' :
          ''
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-navy-900">تقييم الجودة — مباشر</div>
            {qConfig && (
              <span className={`text-sm font-bold px-3 py-1.5 rounded-xl border ${qConfig.color} ${qConfig.bg} ${qConfig.border}`}>
                {qConfig.ar}
              </span>
            )}
          </div>

          {/* Score Bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl font-bold font-mono text-navy-900">
              {liqResult.liquidity_score}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-surface-400 mb-1">
                <span>Liquidity Score</span>
                <span>{EXEC_RISK_CONFIG[liqResult.execution_risk].ar} المخاطر</span>
              </div>
              <div className="w-full bg-surface-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    liqResult.liquidity_score >= 75 ? 'bg-emerald-500' :
                    liqResult.liquidity_score >= 55 ? 'bg-amber-500' :
                    liqResult.liquidity_score >= 35 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${liqResult.liquidity_score}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl p-3 border border-surface-200 text-center">
              <div className="text-[10px] font-semibold text-surface-400 uppercase mb-1">Spread %</div>
              <div className={`text-base font-bold font-mono ${
                liqResult.spread_percent === null ? 'text-surface-400' :
                liqResult.spread_percent <= 5 ? 'text-emerald-700' :
                liqResult.spread_percent <= 12 ? 'text-amber-700' : 'text-red-700'
              }`}>
                {liqResult.spread_percent !== null ? `${liqResult.spread_percent}%` : '—'}
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-surface-200 text-center">
              <div className="text-[10px] font-semibold text-surface-400 uppercase mb-1">Moneyness</div>
              <div className="text-xs font-bold text-navy-900">
                {liqResult.moneyness === 'atm' ? 'ATM' :
                 liqResult.moneyness === 'otm_near' ? 'OTM قريب' :
                 liqResult.moneyness === 'otm_far'  ? 'OTM بعيد' : 'ITM'}
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-surface-200 text-center">
              <div className="text-[10px] font-semibold text-surface-400 uppercase mb-1">DTE Status</div>
              <div className={`text-xs font-bold ${
                liqResult.dte_status === 'ideal'      ? 'text-emerald-700' :
                liqResult.dte_status === 'acceptable' ? 'text-amber-700'   :
                'text-red-700'
              }`}>
                {liqResult.dte_status === 'ideal'      ? 'مثالي' :
                 liqResult.dte_status === 'acceptable' ? 'مقبول' :
                 liqResult.dte_status === 'short'      ? 'قصير'  : 'قصير جدًا'}
              </div>
            </div>
          </div>

          {/* Blocking Flags */}
          {liqResult.blocking_flags.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
              <div className="text-xs font-bold text-red-700 mb-1.5">⛔ موانع الإشارة</div>
              {liqResult.blocking_flags.map((flag, i) => (
                <div key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                  <span className="flex-shrink-0 mt-0.5">•</span>
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {liqResult.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="text-xs font-bold text-amber-700 mb-1.5">⚠ تحذيرات</div>
              {liqResult.warnings.map((w, i) => (
                <div key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="flex-shrink-0 mt-0.5">•</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={loading || !form.strike || !form.expiry}
        className="btn-primary w-full justify-center gap-2 py-3 text-base"
      >
        {loading ? <Spinner size="sm" /> : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
          </svg>
        )}
        إضافة العقد للقائمة
      </button>

    </div>
  )
}
