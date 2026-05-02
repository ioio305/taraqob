'use client'

import { useState } from 'react'
import {
  analyzeContract,
  RISK_PROFILES,
  PLAN_FEATURES,
  type RiskProfile,
  type PlanType,
  type AnalysisResult,
  type IndicatorResult,
} from '@/lib/engine/contractAnalyzer'

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function IndicatorBar({ ind }: { ind: IndicatorResult }) {
  const color = ind.score >= 70 ? 'bg-emerald-500' : ind.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = ind.score >= 70 ? 'text-emerald-600' : ind.score >= 50 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-navy-900">{ind.nameAr}</span>
          {ind.warning && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">⚠️ {ind.warning}</span>
          )}
        </div>
        <span className={`text-xs font-bold font-mono ${textColor}`}>{ind.score}</span>
      </div>
      <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${ind.score}%` }} />
      </div>
      <p className="text-[11px] text-surface-400">{ind.detail}</p>
    </div>
  )
}

function ContractCard({ result, plan, mid, riskProfile }: {
  result: AnalysisResult; plan: PlanType; mid: number; riskProfile: RiskProfile
}) {
  const features = PLAN_FEATURES[plan]
  const decisionBg =
    result.decision === 'إشارة نشطة' ? 'bg-emerald-600' :
    result.decision === 'دخول مشروط' ? 'bg-amber-500' :
    result.decision === 'مراقبة فقط' ? 'bg-blue-600' : 'bg-surface-700'

  return (
    <div className="card overflow-hidden animate-fade-up">
      {/* Header */}
      <div className={`px-5 py-4 ${decisionBg}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-white/70 text-xs mb-1">القرار النهائي</div>
            <div className="text-white text-2xl font-bold">{result.decision}</div>
            {result.hardBlockReason && (
              <div className="text-white/80 text-xs mt-1">⛔ {result.hardBlockReason}</div>
            )}
          </div>
          <div className="text-left">
            <div className="text-white/70 text-xs mb-1">الدرجة المركبة</div>
            <div className="text-white text-4xl font-bold font-mono">{result.composite}</div>
            <div className="text-white/60 text-xs">من 100</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white/80 rounded-full" style={{ width: `${result.probabilityOfProfit}%` }} />
          </div>
          <span className="text-white text-xs font-mono">احتمالية الربح {result.probabilityOfProfit.toFixed(0)}%</span>
        </div>
      </div>

      {/* تصنيف المخاطرة */}
      <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between">
        <span className="text-xs text-surface-500">تصنيف المخاطرة</span>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
          riskProfile === 'محافظ' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
          riskProfile === 'معتدل' ? 'text-amber-700 bg-amber-50 border-amber-200' :
          'text-red-700 bg-red-50 border-red-200'
        }`}>
          {riskProfile === 'محافظ' ? '🟢' : riskProfile === 'معتدل' ? '🟡' : '🔴'} {riskProfile}
        </span>
      </div>

      {/* بطاقة التداول */}
      <div className="px-5 py-4 border-b border-surface-100">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">بطاقة التداول</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
            <div className="text-[10px] text-teal-600 font-semibold mb-1">منطقة الدخول</div>
            <div className="text-sm font-bold text-teal-900 font-mono">
              ${result.entryZoneLow.toFixed(2)} — ${result.entryZoneHigh.toFixed(2)}
            </div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <div className="text-[10px] text-emerald-600 font-semibold mb-1">هدف الخروج</div>
            <div className="text-sm font-bold text-emerald-900 font-mono">
              ${result.target1.toFixed(2)}
              <span className="text-[10px] text-emerald-600 mr-1">(+{((result.target1/mid-1)*100).toFixed(0)}%)</span>
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">جريء: ${result.target2.toFixed(2)}</div>
          </div>

          <div className={`rounded-xl p-3 border ${features.stopLoss ? 'bg-red-50 border-red-100' : 'bg-surface-50 border-surface-200'}`}>
            <div className="text-[10px] font-semibold mb-1 text-red-600">وقف الخسارة</div>
            {features.stopLoss ? (
              <div className="text-sm font-bold text-red-900 font-mono">
                ${result.stopLoss.toFixed(2)}
                <span className="text-[10px] text-red-500 mr-1">(-{((1-result.stopLoss/mid)*100).toFixed(0)}%)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-surface-400"><LockIcon /><span>خطة محترف</span></div>
            )}
          </div>

          <div className={`rounded-xl p-3 border ${features.holdDays ? 'bg-blue-50 border-blue-100' : 'bg-surface-50 border-surface-200'}`}>
            <div className="text-[10px] font-semibold mb-1 text-blue-600">مدة الاحتفاظ</div>
            {features.holdDays ? (
              <div className="text-sm font-bold text-blue-900">{result.holdDays}</div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-surface-400"><LockIcon /><span>خطة محترف</span></div>
            )}
          </div>
        </div>

        <div className="mt-3 bg-navy-50 rounded-xl p-3 border border-navy-100">
          <div className="text-[10px] text-navy-600 font-semibold mb-1">نقطة تعادل SPX</div>
          <div className="text-sm font-bold text-navy-900 font-mono">{result.breakEvenPrice.toFixed(2)}</div>
          <div className="text-[10px] text-navy-500 mt-0.5">يحتاج SPX تجاوز هذا المستوى لتحقيق ربح</div>
        </div>
      </div>

      {/* حجم المركز */}
      <div className="px-5 py-4 border-b border-surface-100">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">حجم المركز الموصى به</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'محافظ 🟢', pct: RISK_PROFILES['محافظ'].portfolioPercent, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { label: 'معتدل 🟡', pct: RISK_PROFILES['معتدل'].portfolioPercent,  color: 'text-amber-700 bg-amber-50 border-amber-200' },
            { label: 'مغامر 🔴', pct: RISK_PROFILES['مغامر'].portfolioPercent,  color: 'text-red-700 bg-red-50 border-red-200' },
          ].map(item => (
            <div key={item.label} className={`rounded-xl p-2.5 border text-center ${item.color}`}>
              <div className="text-lg font-bold font-mono">{item.pct}%</div>
              <div className="text-[10px] font-medium">{item.label}</div>
              <div className="text-[10px] opacity-70">من المحفظة</div>
            </div>
          ))}
        </div>
      </div>

      {/* معادلة التعادل */}
      <div className="px-5 py-4 border-b border-surface-100">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">معادلة التعادل</div>
        {features.breakEven ? (
          <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
            <div className="text-sm text-navy-900 leading-relaxed">
              إذا خسرت عقداً واحداً — تحتاج{' '}
              <span className="font-bold text-teal-600 font-mono text-base">{result.breakEvenContracts}</span>{' '}
              عقد رابح للوصول لنقطة التعادل
            </div>
          </div>
        ) : (
          <div className="bg-surface-50 rounded-xl p-3 border border-surface-200 flex items-center gap-2">
            <LockIcon />
            <span className="text-xs text-surface-400">متاح في خطة متقدم فقط</span>
            <span className="text-xs text-teal-600 font-semibold mr-auto">ترقية ←</span>
          </div>
        )}
      </div>

      {/* تحذير */}
      <div className="px-5 py-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
          <span className="font-bold">تنبيه:</span> هذا تحليل آلي للاسترشاد فقط — لا يُعدّ توصية شخصية ملزمة. المستخدم مسؤول عن قراراته كاملاً.
        </div>
      </div>
    </div>
  )
}

export default function AnalyzePage() {
  const [form, setForm] = useState({
    contractType: 'call' as 'call' | 'put',
    strike: '', expiry: '', dte: '',
    bid: '', ask: '', delta: '',
    iv: '', volume: '', openInterest: '',
  })
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('معتدل')
  const [plan, setPlan]               = useState<PlanType>('متقدم')
  const [result, setResult]           = useState<AnalysisResult | null>(null)
  const [loading, setLoading]         = useState(false)

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); setResult(null) }

  async function analyze() {
    if (!form.strike || !form.bid || !form.ask || !form.delta || !form.dte) return
    setLoading(true)
    try {
      const res  = await fetch('/api/market/pulse')
      const data = await res.json()
      const market = {
        spxPrice: data.spx?.price ?? 7230, spxChange: data.spx?.change ?? 0,
        spxDirection: data.spx?.direction ?? 'neutral', vixPrice: data.vix?.price ?? 17,
        vixLevel: data.vix?.level ?? 'normal',
        isFriday: data.environment?.isFriday ?? false, isWeekend: data.environment?.isWeekend ?? false,
      }
      const contract = {
        contractType: form.contractType, strike: parseFloat(form.strike),
        expiry: form.expiry, dte: parseInt(form.dte),
        bid: parseFloat(form.bid), ask: parseFloat(form.ask), delta: parseFloat(form.delta),
        iv: form.iv ? parseFloat(form.iv) / 100 : undefined,
        volume: form.volume ? parseInt(form.volume) : undefined,
        openInterest: form.openInterest ? parseInt(form.openInterest) : undefined,
      }
      setResult(analyzeContract(contract, market, riskProfile))
    } catch {
      const market = { spxPrice: 7230, spxChange: 0, spxDirection: 'neutral', vixPrice: 17, vixLevel: 'normal', isFriday: false, isWeekend: false }
      const contract = {
        contractType: form.contractType, strike: parseFloat(form.strike), expiry: form.expiry,
        dte: parseInt(form.dte), bid: parseFloat(form.bid), ask: parseFloat(form.ask),
        delta: parseFloat(form.delta), iv: form.iv ? parseFloat(form.iv) / 100 : undefined,
        volume: form.volume ? parseInt(form.volume) : undefined,
      }
      setResult(analyzeContract(contract, market, riskProfile))
    } finally { setLoading(false) }
  }

  const mid = form.bid && form.ask ? (parseFloat(form.bid) + parseFloat(form.ask)) / 2 : 0
  const visibleIndicators = result ? (plan === 'مجاني' ? result.indicators.slice(0, 3) : result.indicators) : []

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-navy-900">تحليل عقد</h1>
        <p className="text-sm text-surface-400 mt-1">أدخل بيانات العقد واحصل على تحليل كامل بالمؤشرات العشرة</p>
      </div>

      {/* خطة الاشتراك */}
      <div className="card p-4 mb-4">
        <div className="text-xs font-semibold text-surface-400 mb-2">خطتك الحالية</div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'مجاني' as PlanType, desc: '3 مؤشرات', color: 'border-surface-300' },
            { key: 'محترف' as PlanType, desc: '10 مؤشرات', color: 'border-teal-400' },
            { key: 'متقدم' as PlanType, desc: 'كل المميزات', color: 'border-gold-500' },
          ]).map(p => (
            <button key={p.key} onClick={() => { setPlan(p.key); setResult(null) }}
              className={`rounded-xl border-2 p-2.5 text-center transition-all ${plan === p.key ? p.color + ' bg-teal-50' : 'border-surface-200 text-surface-400'}`}>
              <div className="text-sm font-bold text-navy-900">{p.key}</div>
              <div className="text-[10px] text-surface-400 mt-0.5">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* تصنيف المخاطرة */}
      {plan !== 'مجاني' && (
        <div className="card p-4 mb-4">
          <div className="text-xs font-semibold text-surface-400 mb-2">تصنيف المخاطرة</div>
          <div className="grid grid-cols-3 gap-2">
            {(['محافظ', 'معتدل', 'مغامر'] as RiskProfile[]).map(r => (
              <button key={r} onClick={() => { setRiskProfile(r); setResult(null) }}
                className={`rounded-xl p-2.5 text-center border-2 transition-all text-sm font-bold ${
                  riskProfile === r
                    ? r === 'محافظ' ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : r === 'معتدل' ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-red-400 bg-red-50 text-red-700'
                    : 'border-surface-200 text-surface-400'
                }`}>
                {r === 'محافظ' ? '🟢' : r === 'معتدل' ? '🟡' : '🔴'} {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* النموذج */}
      <div className="card p-5 mb-4">
        <div className="mb-4">
          <label className="field-label">نوع العقد</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[{ val: 'call', ar: '📈 Call — توقع صعود' }, { val: 'put', ar: '📉 Put — توقع هبوط' }].map(opt => (
              <button key={opt.val} onClick={() => update('contractType', opt.val)}
                className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                  form.contractType === opt.val
                    ? opt.val === 'call' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-red-50 border-red-400 text-red-700'
                    : 'bg-surface-50 border-surface-200 text-surface-500'
                }`}>{opt.ar}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { key: 'strike', label: 'Strike Price', placeholder: '7250', required: true },
            { key: 'dte',    label: 'DTE (أيام الانتهاء)', placeholder: '14', required: true },
            { key: 'bid',    label: 'Bid', placeholder: '61.70', required: true },
            { key: 'ask',    label: 'Ask', placeholder: '62.60', required: true },
            { key: 'delta',  label: 'Delta', placeholder: '0.48', required: true },
            { key: 'iv',     label: 'IV%', placeholder: '12.35', required: false },
            { key: 'volume', label: 'Volume', placeholder: '1326', required: false },
            { key: 'openInterest', label: 'Open Interest', placeholder: '2193', required: false },
          ].map(f => (
            <div key={f.key}>
              <label className="field-label">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              <input type="number" step="any"
                value={form[f.key as keyof typeof form]}
                onChange={e => update(f.key, e.target.value)}
                placeholder={f.placeholder} className="field-input" dir="ltr" />
            </div>
          ))}
        </div>

        {mid > 0 && (
          <div className="bg-navy-50 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-xs text-navy-600">السعر الوسط (Mid)</span>
            <span className="text-sm font-bold font-mono text-navy-900">${mid.toFixed(2)}</span>
          </div>
        )}

        <button onClick={analyze}
          disabled={loading || !form.strike || !form.bid || !form.ask || !form.delta || !form.dte}
          className="btn-primary w-full justify-center text-base py-3">
          {loading ? 'جارٍ التحليل...' : '🔍 حلّل العقد الآن'}
        </button>
      </div>

      {/* النتائج */}
      {result && (
        <div className="space-y-4">
          <ContractCard result={result} plan={plan} mid={mid} riskProfile={riskProfile} />

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-navy-900">
                المؤشرات {plan === 'مجاني' && <span className="text-xs text-surface-400 font-normal">(3 من 10)</span>}
              </div>
              {plan === 'مجاني' && (
                <span className="text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded-full border border-teal-200">🔒 7 مؤشرات محجوبة</span>
              )}
            </div>
            <div className="space-y-4">
              {visibleIndicators.map(ind => <IndicatorBar key={ind.code} ind={ind} />)}
            </div>
            {plan === 'مجاني' && (
              <div className="mt-4 bg-gradient-to-l from-teal-50 to-navy-50 rounded-xl p-4 border border-teal-200">
                <div className="text-sm font-bold text-navy-900 mb-1">🚀 اكتشف التحليل الكامل</div>
                <div className="text-xs text-surface-500 mb-3">7 مؤشرات إضافية تشمل Gamma Risk واحتمالية الربح وقيمة العقد</div>
                <button className="btn-primary btn-sm w-full justify-center">ترقية إلى محترف</button>
              </div>
            )}
          </div>

          {/* مقارنة الخطط للمجاني */}
          {plan === 'مجاني' && (
            <div className="card p-5">
              <div className="text-sm font-bold text-navy-900 mb-4">مقارنة الخطط</div>
              <div className="space-y-2 text-xs">
                {[
                  { feature: '3 مؤشرات تحليلية',       free: true,  pro: true,  adv: true  },
                  { feature: '10 مؤشرات كاملة',         free: false, pro: true,  adv: true  },
                  { feature: 'منطقة الدخول والهدف',     free: true,  pro: true,  adv: true  },
                  { feature: 'وقف الخسارة',             free: false, pro: true,  adv: true  },
                  { feature: 'مدة الاحتفاظ',           free: false, pro: true,  adv: true  },
                  { feature: 'تصنيف المخاطرة الثلاثي', free: false, pro: true,  adv: true  },
                  { feature: 'معادلة التعادل',         free: false, pro: false, adv: true  },
                  { feature: 'تحليلات غير محدودة',     free: false, pro: true,  adv: true  },
                  { feature: 'غرف التحليل المشترك',    free: false, pro: false, adv: true  },
                ].map((row, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 py-2 border-b border-surface-100 last:border-0 items-center">
                    <div className="col-span-1 text-surface-600">{row.feature}</div>
                    {[row.free, row.pro, row.adv].map((val, j) => (
                      <div key={j} className="text-center">
                        {val ? <span className="text-emerald-600">✅</span> : <span className="text-surface-300">—</span>}
                      </div>
                    ))}
                  </div>
                ))}
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <div />
                  {['مجاني', 'محترف', 'متقدم'].map(p => (
                    <div key={p} className="text-center font-bold text-navy-900 text-xs">{p}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
