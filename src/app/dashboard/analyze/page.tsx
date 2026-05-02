'use client'

import { useState } from 'react'

type AnalysisResult = {
  scores: {
    market_regime:       number
    volatility_pressure: number
    expected_move:       number
    intraday_momentum:   number
    options_liquidity:   number
    theta_burn:          number
    macro_event:         number
  }
  composite: number
  decision:  string
  decisionAr: string
  decisionColor: string
  rationale: string
  warnings: string[]
  canEnter: boolean
}

const INDICATORS = [
  { key: 'market_regime',       ar: 'حالة السوق',        weight: 0.25 },
  { key: 'volatility_pressure', ar: 'ضغط التذبذب',       weight: 0.15 },
  { key: 'expected_move',       ar: 'الحركة المتوقعة',   weight: 0.15 },
  { key: 'intraday_momentum',   ar: 'الزخم اللحظي',      weight: 0.20 },
  { key: 'options_liquidity',   ar: 'جودة السيولة',       weight: 0.10 },
  { key: 'theta_burn',          ar: 'تآكل الوقت',         weight: 0.05 },
  { key: 'macro_event',         ar: 'الأحداث الكلية',    weight: 0.10 },
]

function analyzeContract(form: any, pulse: any): AnalysisResult {
  const vix      = pulse?.vix?.price ?? 20
  const spxDir   = pulse?.spx?.direction ?? 'neutral'
  const spxChg   = Math.abs(pulse?.spx?.change ?? 0)
  const dte      = parseInt(form.dte) || 0
  const delta    = parseFloat(form.delta) || 0
  const spread   = parseFloat(form.ask) - parseFloat(form.bid)
  const mid      = (parseFloat(form.ask) + parseFloat(form.bid)) / 2
  const spreadPct = mid > 0 ? (spread / mid) * 100 : 100

  const warnings: string[] = []

  // 1. Market Regime
  const marketScore = spxDir === 'bullish' && form.contractType === 'call'
    ? 80
    : spxDir === 'bearish' && form.contractType === 'put'
    ? 80
    : spxDir === 'neutral'
    ? 50
    : 30

  // 2. Volatility Pressure
  let volScore = 70
  if (vix > 30) { volScore = 20; warnings.push('VIX مرتفع جداً — خطر عالٍ') }
  else if (vix > 20) { volScore = 45 }
  else if (vix < 15) { volScore = 85 }

  // 3. Expected Move
  let emScore = 65
  if (spxChg > 2) { emScore = 25; warnings.push('تحرك حاد في SPX') }
  else if (spxChg > 1) { emScore = 45 }
  else if (spxChg < 0.3) { emScore = 80 }

  // 4. Intraday Momentum
  const momentumScore = spxDir === 'bullish'
    ? form.contractType === 'call' ? 75 : 35
    : spxDir === 'bearish'
    ? form.contractType === 'put' ? 75 : 35
    : 50

  // 5. Options Liquidity
  let liqScore = 70
  if (spreadPct > 20) { liqScore = 15; warnings.push('فارق سعر واسع جداً — سيولة ضعيفة') }
  else if (spreadPct > 10) { liqScore = 40; warnings.push('فارق سعر مرتفع') }
  else if (spreadPct < 3) { liqScore = 90 }

  // 6. Theta Burn
  let thetaScore = 70
  if (dte < 3)  { thetaScore = 10; warnings.push('أيام منتهاء الصلاحية قليلة جداً') }
  else if (dte < 7)  { thetaScore = 35 }
  else if (dte > 30) { thetaScore = 85 }

  // 7. Macro Event
  const macroScore = 75 // افتراضي — يمكن تطوير لاحقاً

  const scores = {
    market_regime:       marketScore,
    volatility_pressure: volScore,
    expected_move:       emScore,
    intraday_momentum:   momentumScore,
    options_liquidity:   liqScore,
    theta_burn:          thetaScore,
    macro_event:         macroScore,
  }

  // الدرجة المركبة
  const composite = Math.round(
    INDICATORS.reduce((sum, ind) => sum + scores[ind.key as keyof typeof scores] * ind.weight, 0)
  )

  // منع الإشارة إذا سيولة ضعيفة جداً أو dte أقل من 3
  const hardBlock = liqScore < 20 || thetaScore < 15

  // القرار
  let decision = '', decisionAr = '', decisionColor = '', rationale = ''
  const canEnter = !hardBlock

  if (hardBlock) {
    decision = 'no_trade'; decisionAr = 'لا تداول'; decisionColor = 'text-surface-500'
    rationale = 'يوجد شرط منع أساسي — ' + warnings[0]
  } else if (composite >= 70) {
    decision = 'active'; decisionAr = 'إشارة نشطة'; decisionColor = 'text-emerald-600'
    rationale = 'المؤشرات تدعم الدخول بشكل قوي. البيئة مناسبة والعقد ذو جودة جيدة.'
  } else if (composite >= 55) {
    decision = 'conditional'; decisionAr = 'دخول مشروط'; decisionColor = 'text-amber-600'
    rationale = 'المؤشرات مقبولة مع الحذر. تأكد من شرط الدخول قبل الإقدام.'
  } else if (composite >= 40) {
    decision = 'watch'; decisionAr = 'مراقبة فقط'; decisionColor = 'text-blue-600'
    rationale = 'البيئة غير مثالية. راقب العقد وانتظر تحسن المؤشرات.'
  } else {
    decision = 'no_trade'; decisionAr = 'لا تداول'; decisionColor = 'text-red-600'
    rationale = 'المؤشرات لا تدعم الدخول في الوقت الحالي.'
  }

  return { scores, composite, decision, decisionAr, decisionColor, rationale, warnings, canEnter }
}

export default function AnalyzePage() {
  const [form, setForm] = useState({
    contractType: 'call',
    strike: '',
    expiry: '',
    dte: '',
    bid: '',
    ask: '',
    delta: '',
  })
  const [pulse, setPulse]     = useState<any>(null)
  const [result, setResult]   = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)

  function update(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setResult(null)
  }

  async function analyze() {
    if (!form.strike || !form.bid || !form.ask) return
    setLoading(true)
    try {
      const res  = await fetch('/api/market/pulse')
      const data = await res.json()
      setPulse(data)
      const analysis = analyzeContract(form, data)
      setResult(analysis)
    } catch {
      // تحليل بدون بيانات لحظية
      const analysis = analyzeContract(form, null)
      setResult(analysis)
    } finally {
      setLoading(false)
    }
  }

  const composite = result?.composite ?? 0
  const scoreColor = composite >= 70
    ? 'text-emerald-600'
    : composite >= 55
    ? 'text-amber-600'
    : composite >= 40
    ? 'text-blue-600'
    : 'text-red-600'

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in" dir="rtl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy-900">تحليل عقد</h1>
        <p className="text-sm text-surface-400 mt-1">
          أدخل بيانات العقد وستحلله المنصة فوراً بناءً على المؤشرات السبعة وبيانات السوق اللحظية
        </p>
      </div>

      {/* Form */}
      <div className="card p-5 mb-4">

        {/* نوع العقد */}
        <div className="mb-4">
          <label className="field-label">نوع العقد</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[
              { val: 'call', ar: 'Call — صعود', color: 'emerald' },
              { val: 'put',  ar: 'Put — هبوط',  color: 'red' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => update('contractType', opt.val)}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  form.contractType === opt.val
                    ? opt.val === 'call'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-surface-50 border-surface-200 text-surface-500'
                }`}
              >
                {opt.ar}
              </button>
            ))}
          </div>
        </div>

        {/* بيانات العقد */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="field-label">Strike Price</label>
            <input
              type="number"
              value={form.strike}
              onChange={e => update('strike', e.target.value)}
              placeholder="5500"
              className="field-input"
              dir="ltr"
            />
          </div>
          <div>
            <label className="field-label">أيام الانتهاء (DTE)</label>
            <input
              type="number"
              value={form.dte}
              onChange={e => update('dte', e.target.value)}
              placeholder="14"
              className="field-input"
              dir="ltr"
            />
          </div>
          <div>
            <label className="field-label">Bid</label>
            <input
              type="number"
              step="0.01"
              value={form.bid}
              onChange={e => update('bid', e.target.value)}
              placeholder="2.50"
              className="field-input"
              dir="ltr"
            />
          </div>
          <div>
            <label className="field-label">Ask</label>
            <input
              type="number"
              step="0.01"
              value={form.ask}
              onChange={e => update('ask', e.target.value)}
              placeholder="2.70"
              className="field-input"
              dir="ltr"
            />
          </div>
          <div>
            <label className="field-label">Delta</label>
            <input
              type="number"
              step="0.01"
              value={form.delta}
              onChange={e => update('delta', e.target.value)}
              placeholder="0.45"
              className="field-input"
              dir="ltr"
            />
          </div>
          <div>
            <label className="field-label">تاريخ الانتهاء</label>
            <input
              type="date"
              value={form.expiry}
              onChange={e => update('expiry', e.target.value)}
              className="field-input"
              dir="ltr"
            />
          </div>
        </div>

        <button
          onClick={analyze}
          disabled={loading || !form.strike || !form.bid || !form.ask}
          className="btn-primary w-full justify-center"
        >
          {loading ? 'جارٍ التحليل...' : 'حلّل العقد'}
        </button>
      </div>

      {/* النتيجة */}
      {result && (
        <div className="card overflow-hidden animate-fade-up">

          {/* Header النتيجة */}
          <div className={`px-5 py-4 flex items-center justify-between ${
            result.decision === 'active'      ? 'bg-emerald-600' :
            result.decision === 'conditional' ? 'bg-amber-500' :
            result.decision === 'watch'       ? 'bg-blue-600' :
            'bg-surface-700'
          }`}>
            <div>
              <div className="text-white text-xs font-medium mb-0.5">القرار</div>
              <div className="text-white text-xl font-bold">{result.decisionAr}</div>
            </div>
            <div className="text-left">
              <div className="text-white/70 text-xs mb-0.5">الدرجة المركبة</div>
              <div className="text-white text-3xl font-bold font-mono">{result.composite}</div>
            </div>
          </div>

          {/* التفسير */}
          <div className="px-5 py-4 border-b border-surface-100">
            <p className="text-sm text-navy-900 leading-relaxed">{result.rationale}</p>
            {result.warnings.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
                    <span>⚠️</span>
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* المؤشرات السبعة */}
          <div className="px-5 py-4">
            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
              تفصيل المؤشرات
            </div>
            <div className="space-y-2.5">
              {INDICATORS.map(ind => {
                const score = result.scores[ind.key as keyof typeof result.scores]
                const barColor = score >= 70
                  ? 'bg-emerald-500'
                  : score >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
                return (
                  <div key={ind.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-surface-600">{ind.ar}</span>
                      <span className={`text-xs font-mono font-bold ${
                        score >= 70 ? 'text-emerald-600' :
                        score >= 50 ? 'text-amber-600' : 'text-red-600'
                      }`}>{score}</span>
                    </div>
                    <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* تحذير قانوني */}
          <div className="px-5 pb-4">
            <div className="compliance-banner text-xs">
              هذا التحليل للاسترشاد فقط — لا يُعدّ توصية شخصية ملزمة. المستخدم مسؤول عن قراراته كاملاً.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
