'use client'

import { useState, useRef } from 'react'
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
          {ind.warning && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">⚠️ {ind.warning}</span>}
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

type ExtractedContract = {
  type: 'call' | 'put'; strike: number; bid: number; ask: number
  delta?: number; expiry?: string; dte?: number
}

function ImageUploadSection({ onSelect }: { onSelect: (c: ExtractedContract) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [contracts, setContracts] = useState<ExtractedContract[]>([])
  const [error, setError] = useState('')
  const [spxFromImage, setSpxFromImage] = useState<number | null>(null)

  async function handleImage(file: File) {
    setError(''); setContracts([])
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/ai/extract-contracts', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContracts(data.contracts ?? [])
      if (data.spxPrice) setSpxFromImage(data.spxPrice)
    } catch (e: any) {
      setError(e.message || 'فشل استخراج البيانات')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📸</span>
        <div>
          <div className="text-sm font-bold text-navy-900">رفع صورة من دراية</div>
          <div className="text-xs text-surface-400">ارفع صورة جدول الخيارات واختر العقد</div>
        </div>
      </div>
      <div onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-surface-200 rounded-xl p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all">
        {preview ? (
          <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
        ) : (
          <div>
            <div className="text-3xl mb-2">📲</div>
            <div className="text-sm font-medium text-surface-600">اضغط لرفع صورة من دراية</div>
            <div className="text-xs text-surface-400 mt-1">JPG أو PNG</div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])} />
      </div>
      {loading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-teal-600">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          جارٍ قراءة العقود من الصورة...
        </div>
      )}
      {error && <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-xl p-3">{error}</div>}
      {contracts.length > 0 && (
        <div className="mt-4">
          {spxFromImage && (
            <div className="text-xs text-surface-400 mb-2">
              SPX: <span className="font-mono font-bold text-navy-900">{spxFromImage.toFixed(2)}</span>
            </div>
          )}
          <div className="text-xs font-semibold text-surface-500 mb-2">اختر العقد:</div>
          <div className="space-y-2">
            {contracts.map((c, i) => (
              <button key={i} onClick={() => onSelect(c)}
                className="w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-200 hover:border-teal-400 hover:bg-teal-50 transition-all">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  c.type === 'call' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>{c.type === 'call' ? '▲ Call' : '▼ Put'}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-navy-900">Strike {c.strike}</div>
                  <div className="text-xs text-surface-400 font-mono">
                    Bid {c.bid} | Ask {c.ask}{c.delta ? ` | Delta ${c.delta}` : ''}{c.dte ? ` | ${c.dte} يوم` : ''}
                  </div>
                </div>
                <svg className="w-4 h-4 text-teal-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AnalyzePage() {
  const [inputMethod, setInputMethod] = useState<'manual' | 'image'>('manual')
  const [form, setForm] = useState({
    contractType: 'call' as 'call' | 'put',
    strike: '', expiry: '', dte: '', bid: '', ask: '', delta: '', iv: '', volume: '', openInterest: '',
  })
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('معتدل')
  const [plan, setPlan] = useState<PlanType>('متقدم')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [filledFromImage, setFilledFromImage] = useState(false)

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); setResult(null) }

  function fillFromImage(c: ExtractedContract) {
    setForm({
      contractType: c.type, strike: String(c.strike), bid: String(c.bid), ask: String(c.ask),
      delta: c.delta ? String(c.delta) : '', dte: c.dte ? String(c.dte) : '',
      expiry: c.expiry || '', iv: '', volume: '', openInterest: '',
    })
    setFilledFromImage(true); setResult(null); setInputMethod('manual')
    setTimeout(() => document.getElementById('analyze-form')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function analyze() {
    if (!form.strike || !form.bid || !form.ask || !form.delta || !form.dte) return
    setLoading(true)
    try {
      const res = await fetch('/api/market/pulse')
      const data = await res.json()
      const market = {
        spxPrice: data.spx?.price ?? 7230, spxChange: data.spx?.change ?? 0,
        spxDirection: data.spx?.direction ?? 'neutral', vixPrice: data.vix?.price ?? 17,
        vixLevel: data.vix?.level ?? 'normal',
        isFriday: data.environment?.isFriday ?? false, isWeekend: data.environment?.isWeekend ?? false,
      }
      const contract = {
        contractType: form.contractType, strike: parseFloat(form.strike), expiry: form.expiry,
        dte: parseInt(form.dte), bid: parseFloat(form.bid), ask: parseFloat(form.ask),
        delta: parseFloat(form.delta), iv: form.iv ? parseFloat(form.iv) / 100 : undefined,
        volume: form.volume ? parseInt(form.volume) : undefined,
      }
      const analysis = analyzeContract(contract, market, riskProfile)
      setResult(analysis)
      try {
        await fetch('/api/analyses', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractType: contract.contractType, strike: contract.strike, expiry: contract.expiry,
            dte: contract.dte, bid: contract.bid, ask: contract.ask,
            mid: (contract.bid + contract.ask) / 2, delta: contract.delta,
            compositeScore: analysis.composite, decision: analysis.decision, riskProfile,
            spxPrice: market.spxPrice, vixPrice: market.vixPrice,
            entryZoneLow: analysis.entryZoneLow, entryZoneHigh: analysis.entryZoneHigh,
            target1: analysis.target1, target2: analysis.target2, stopLoss: analysis.stopLoss,
          }),
        })
      } catch { /* اختياري */ }
    } catch {
      const market = { spxPrice: 7230, spxChange: 0, spxDirection: 'neutral', vixPrice: 17, vixLevel: 'normal', isFriday: false, isWeekend: false }
      const contract = {
        contractType: form.contractType, strike: parseFloat(form.strike), expiry: form.expiry,
        dte: parseInt(form.dte), bid: parseFloat(form.bid), ask: parseFloat(form.ask), delta: parseFloat(form.delta),
      }
      setResult(analyzeContract(contract, market, riskProfile))
    } finally { setLoading(false) }
  }

  const mid = form.bid && form.ask ? (parseFloat(form.bid) + parseFloat(form.ask)) / 2 : 0
  const features = PLAN_FEATURES[plan]
  const visibleIndicators = result ? (plan === 'مجاني' ? result.indicators.slice(0, 3) : result.indicators) : []
  const canAnalyze = form.strike && form.bid && form.ask && form.delta && form.dte

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-navy-900">تحليل عقد</h1>
        <p className="text-sm text-surface-400 mt-1">أدخل البيانات يدوياً أو ارفع صورة من دراية</p>
      </div>

      {/* طريقة الإدخال */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { key: 'manual', icon: '✏️', label: 'إدخال يدوي' },
          { key: 'image',  icon: '📸', label: 'من صورة دراية' },
        ].map(m => (
          <button key={m.key} onClick={() => setInputMethod(m.key as any)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
              inputMethod === m.key ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-surface-200 text-surface-500'
            }`}>
            <span>{m.icon}</span>{m.label}
          </button>
        ))}
      </div>

      {inputMethod === 'image' && <ImageUploadSection onSelect={fillFromImage} />}

      {filledFromImage && inputMethod === 'manual' && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <span>✅</span>
          <span className="text-xs text-teal-700 font-medium">تم ملء البيانات من الصورة — راجعها وحلّل</span>
          <button onClick={() => setFilledFromImage(false)} className="mr-auto text-teal-400">✕</button>
        </div>
      )}

      {/* خطة + مخاطرة */}
      <div className="card p-4 mb-4">
        <div className="text-xs font-semibold text-surface-400 mb-2">خطتك</div>
        <div className="grid grid-cols-3 gap-2">
          {(['مجاني','محترف','متقدم'] as PlanType[]).map(p => (
            <button key={p} onClick={() => { setPlan(p); setResult(null) }}
              className={`rounded-xl border-2 p-2 text-center transition-all text-sm font-bold ${
                plan === p ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-surface-200 text-surface-400'
              }`}>{p}</button>
          ))}
        </div>
      </div>

      {plan !== 'مجاني' && (
        <div className="card p-4 mb-4">
          <div className="text-xs font-semibold text-surface-400 mb-2">تصنيف المخاطرة</div>
          <div className="grid grid-cols-3 gap-2">
            {(['محافظ','معتدل','مغامر'] as RiskProfile[]).map(r => (
              <button key={r} onClick={() => { setRiskProfile(r); setResult(null) }}
                className={`rounded-xl p-2 text-center border-2 transition-all text-sm font-bold ${
                  riskProfile === r
                    ? r==='محافظ' ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : r==='معتدل' ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-red-400 bg-red-50 text-red-700'
                    : 'border-surface-200 text-surface-400'
                }`}>
                {r==='محافظ'?'🟢':r==='معتدل'?'🟡':'🔴'} {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* النموذج */}
      <div id="analyze-form" className="card p-5 mb-4">
        <div className="mb-4">
          <label className="field-label">نوع العقد</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[{val:'call',ar:'📈 Call — توقع صعود'},{val:'put',ar:'📉 Put — توقع هبوط'}].map(opt => (
              <button key={opt.val} onClick={() => update('contractType', opt.val)}
                className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                  form.contractType === opt.val
                    ? opt.val==='call' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-red-50 border-red-400 text-red-700'
                    : 'bg-surface-50 border-surface-200 text-surface-500'
                }`}>{opt.ar}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { key:'strike', label:'سعر التنفيذ (Strike)', ph:'7200', req:true },
            { key:'dte',    label:'أيام الانتهاء',        ph:'14',   req:true },
            { key:'bid',    label:'سعر الطلب (Bid)',       ph:'15.00',req:true },
            { key:'ask',    label:'سعر العرض (Ask)',       ph:'15.40',req:true },
            { key:'delta',  label:'الحساسية (Delta)',      ph:'0.35', req:true },
            { key:'iv',     label:'التذبذب IV%',           ph:'12.5', req:false },
            { key:'volume', label:'حجم التداول',           ph:'500',  req:false },
            { key:'openInterest', label:'العقود المفتوحة', ph:'2000', req:false },
          ].map(f => (
            <div key={f.key}>
              <label className="field-label">{f.label} {f.req && <span className="text-red-500">*</span>}</label>
              <input type="number" step="any"
                value={form[f.key as keyof typeof form]}
                onChange={e => update(f.key, e.target.value)}
                placeholder={f.ph} className="field-input" dir="ltr" />
            </div>
          ))}
        </div>

        {mid > 0 && (
          <div className="bg-navy-50 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-xs text-navy-600">السعر الوسط (ما ستدفعه فعلياً)</span>
            <span className="text-sm font-bold font-mono text-navy-900">${mid.toFixed(2)}</span>
          </div>
        )}

        <button onClick={analyze} disabled={loading || !canAnalyze} className="btn-primary w-full justify-center text-base py-3">
          {loading ? 'جارٍ التحليل...' : '🔍 حلّل العقد الآن'}
        </button>
      </div>

      {/* النتائج */}
      {result && (
        <div className="space-y-4">
          {/* بطاقة القرار */}
          <div className="card overflow-hidden animate-fade-up">
            <div className={`px-5 py-4 ${
              result.decision==='إشارة نشطة' ? 'bg-emerald-600' :
              result.decision==='دخول مشروط' ? 'bg-amber-500' :
              result.decision==='مراقبة فقط' ? 'bg-blue-600' : 'bg-surface-700'
            }`}>
              <div className="flex justify-between">
                <div>
                  <div className="text-white/70 text-xs mb-1">القرار النهائي</div>
                  <div className="text-white text-2xl font-bold">{result.decision}</div>
                </div>
                <div className="text-left">
                  <div className="text-white/70 text-xs mb-1">الدرجة</div>
                  <div className="text-white text-4xl font-bold font-mono">{result.composite}</div>
                  <div className="text-white/60 text-xs">من 100</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/80 rounded-full" style={{ width: `${result.probabilityOfProfit}%` }} />
                </div>
                <span className="text-white text-xs">احتمالية الربح {result.probabilityOfProfit.toFixed(0)}%</span>
              </div>
            </div>

            {/* ماذا تفعل؟ */}
            <div className="px-5 py-4 border-b border-surface-100">
              <div className="text-xs font-semibold text-surface-400 mb-3">ماذا تفعل؟</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
                  <div className="text-[10px] text-teal-600 font-semibold mb-1">🟢 ادخل عند</div>
                  <div className="text-sm font-bold text-teal-900 font-mono">${result.entryZoneLow.toFixed(2)} — ${result.entryZoneHigh.toFixed(2)}</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <div className="text-[10px] text-emerald-600 font-semibold mb-1">🎯 اخرج بربح عند</div>
                  <div className="text-sm font-bold text-emerald-900 font-mono">
                    ${result.target1.toFixed(2)}
                    <span className="text-[10px] mr-1">(+{((result.target1/mid-1)*100).toFixed(0)}%)</span>
                  </div>
                </div>
                <div className={`rounded-xl p-3 border ${features.stopLoss ? 'bg-red-50 border-red-100' : 'bg-surface-50 border-surface-200'}`}>
                  <div className="text-[10px] text-red-600 font-semibold mb-1">🔴 اخرج بخسارة عند</div>
                  {features.stopLoss
                    ? <div className="text-sm font-bold text-red-900 font-mono">${result.stopLoss.toFixed(2)}</div>
                    : <div className="flex items-center gap-1 text-xs text-surface-400"><LockIcon /> خطة محترف</div>}
                </div>
                <div className={`rounded-xl p-3 border ${features.holdDays ? 'bg-blue-50 border-blue-100' : 'bg-surface-50 border-surface-200'}`}>
                  <div className="text-[10px] text-blue-600 font-semibold mb-1">⏱️ احتفظ به</div>
                  {features.holdDays
                    ? <div className="text-sm font-bold text-blue-900">{result.holdDays}</div>
                    : <div className="flex items-center gap-1 text-xs text-surface-400"><LockIcon /> خطة محترف</div>}
                </div>
              </div>
              <div className="mt-3 bg-navy-50 rounded-xl p-3 border border-navy-100">
                <div className="text-[10px] text-navy-600 font-semibold mb-1">📍 SPX يجب أن يتجاوز</div>
                <div className="text-sm font-bold text-navy-900 font-mono">{result.breakEvenPrice.toFixed(2)}</div>
              </div>
            </div>

            {/* كم تشتري */}
            <div className="px-5 py-4 border-b border-surface-100">
              <div className="text-xs font-semibold text-surface-400 mb-3">💰 كم تشتري؟ (من محفظتك)</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {l:'🟢 محافظ', p:RISK_PROFILES['محافظ'].portfolioPercent, c:'text-emerald-700 bg-emerald-50 border-emerald-200'},
                  {l:'🟡 معتدل', p:RISK_PROFILES['معتدل'].portfolioPercent,  c:'text-amber-700 bg-amber-50 border-amber-200'},
                  {l:'🔴 مغامر', p:RISK_PROFILES['مغامر'].portfolioPercent,  c:'text-red-700 bg-red-50 border-red-200'},
                ].map(i => (
                  <div key={i.l} className={`rounded-xl p-2.5 border text-center ${i.c}`}>
                    <div className="text-lg font-bold font-mono">{i.p}%</div>
                    <div className="text-[10px]">{i.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <span className="font-bold">تنبيه:</span> هذا تحليل آلي للاسترشاد فقط — لا يُعدّ توصية ملزمة.
              </div>
            </div>
          </div>

          {/* المؤشرات */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-navy-900">تفصيل المؤشرات</div>
              {plan === 'مجاني' && <span className="text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded-full border border-teal-200">🔒 7 محجوبة</span>}
            </div>
            <div className="space-y-4">
              {visibleIndicators.map(ind => <IndicatorBar key={ind.code} ind={ind} />)}
            </div>
            {plan === 'مجاني' && (
              <div className="mt-4 bg-gradient-to-l from-teal-50 to-navy-50 rounded-xl p-4 border border-teal-200">
                <div className="text-sm font-bold text-navy-900 mb-1">🚀 اكتشف التحليل الكامل</div>
                <div className="text-xs text-surface-500 mb-3">7 مؤشرات إضافية للتحليل الدقيق</div>
                <button className="btn-primary btn-sm w-full justify-center">ترقية إلى محترف</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
