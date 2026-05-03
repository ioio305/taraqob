'use client'

import { useState, useRef } from 'react'
import {
  analyzeContract, RISK_PROFILES, PLAN_FEATURES,
  type RiskProfile, type PlanType, type AnalysisResult, type IndicatorResult,
} from '@/lib/engine/contractAnalyzer'

function LockIcon() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
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

// حقل الإدخال مع الشرح
function FieldInput({ label, abbr, desc, value, onChange, placeholder, required, hint }: {
  label: string; abbr?: string; desc: string; value: string
  onChange: (v: string) => void; placeholder: string; required?: boolean; hint?: string
}) {
  const [showDesc, setShowDesc] = useState(false)
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs font-semibold text-navy-900">
          {label} {abbr && <span className="text-surface-400 font-mono text-[10px]">({abbr})</span>}
          {required && <span className="text-red-500 mr-1">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setShowDesc(s => !s)}
          className="w-4 h-4 rounded-full bg-surface-100 text-surface-400 hover:bg-teal-100 hover:text-teal-600 flex items-center justify-center text-[10px] font-bold transition-colors"
        >?</button>
      </div>
      {showDesc && (
        <div className="mb-1.5 text-[11px] text-teal-700 bg-teal-50 rounded-lg px-2.5 py-1.5 border border-teal-100 leading-relaxed">
          {desc}
        </div>
      )}
      <input
        type="number" step="any" value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input"
        dir="ltr"
      />
      {hint && !showDesc && <div className="text-[10px] text-surface-400 mt-0.5">{hint}</div>}
    </div>
  )
}

// رفع الصور
function ImageUploadSection({ onFill }: { onFill: (data: any) => void }) {
  const tableRef  = useRef<HTMLInputElement>(null)
  const detailRef = useRef<HTMLInputElement>(null)
  const [tablePreview,  setTablePreview]  = useState<string | null>(null)
  const [detailPreview, setDetailPreview] = useState<string | null>(null)
  const [tableFile,     setTableFile]     = useState<File | null>(null)
  const [detailFile,    setDetailFile]    = useState<File | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [contracts, setContracts] = useState<any[]>([])
  const [spx, setSpx] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'table' | 'detail'>('table')

  function handleFile(file: File, type: 'table' | 'detail') {
    const reader = new FileReader()
    reader.onload = e => {
      if (type === 'table') { setTablePreview(e.target?.result as string); setTableFile(file) }
      else { setDetailPreview(e.target?.result as string); setDetailFile(file) }
    }
    reader.readAsDataURL(file)
    setContracts([])
    setError('')
  }

  async function extract() {
    setLoading(true); setError(''); setContracts([])
    try {
      const fd = new FormData()
      if (tableFile)  fd.append('tableImage',  tableFile)
      if (detailFile) fd.append('detailImage', detailFile)

      const res  = await fetch('/api/ai/extract-contracts', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setContracts(data.contracts ?? [])
      if (data.spxPrice) setSpx(data.spxPrice)

      // إذا عقد واحد فقط (من صورة التفاصيل) — ملء تلقائي
      if (detailFile && data.contracts?.length === 1) {
        onFill({ ...data.contracts[0], spxPrice: data.spxPrice })
      }
    } catch (e: any) {
      setError(e.message || 'فشل الاستخراج')
    } finally { setLoading(false) }
  }

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📸</span>
        <div>
          <div className="text-sm font-bold text-navy-900">رفع صورة من دراية</div>
          <div className="text-xs text-surface-400">ارفع صورة الجدول أو تفاصيل العقد أو كليهما</div>
        </div>
      </div>

      {/* اختيار طريقة الرفع */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setMode('table')}
          className={`text-xs py-2 px-3 rounded-xl border-2 font-medium transition-all ${mode==='table' ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-surface-200 text-surface-500'}`}>
          📊 جدول الخيارات
        </button>
        <button onClick={() => setMode('detail')}
          className={`text-xs py-2 px-3 rounded-xl border-2 font-medium transition-all ${mode==='detail' ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-surface-200 text-surface-500'}`}>
          📋 تفاصيل العقد
        </button>
      </div>

      {/* منطقة الرفع */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* صورة الجدول */}
        <div>
          <div className="text-[10px] font-semibold text-surface-500 mb-1.5">
            📊 جدول الخيارات <span className="text-surface-400">(اختياري)</span>
          </div>
          <div onClick={() => tableRef.current?.click()}
            className="border-2 border-dashed border-surface-200 rounded-xl p-3 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/20 transition-all min-h-[100px] flex items-center justify-center">
            {tablePreview
              ? <img src={tablePreview} alt="" className="max-h-24 rounded object-contain" />
              : <div className="text-center"><div className="text-2xl mb-1">📊</div><div className="text-[10px] text-surface-400">ارفع الجدول</div></div>
            }
            <input ref={tableRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], 'table')} />
          </div>
        </div>

        {/* صورة التفاصيل */}
        <div>
          <div className="text-[10px] font-semibold text-surface-500 mb-1.5">
            📋 تفاصيل العقد <span className="text-teal-600">(موصى به)</span>
          </div>
          <div onClick={() => detailRef.current?.click()}
            className="border-2 border-dashed border-teal-200 rounded-xl p-3 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all min-h-[100px] flex items-center justify-center">
            {detailPreview
              ? <img src={detailPreview} alt="" className="max-h-24 rounded object-contain" />
              : <div className="text-center"><div className="text-2xl mb-1">📋</div><div className="text-[10px] text-surface-400">ارفع التفاصيل</div></div>
            }
            <input ref={detailRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], 'detail')} />
          </div>
        </div>
      </div>

      <div className="text-[10px] text-surface-400 bg-surface-50 rounded-lg p-2 mb-3 text-center">
        💡 صورة التفاصيل تجلب Delta وTheta وجميع البيانات — جدول الخيارات يعطيك قائمة لتختار منها
      </div>

      <button onClick={extract} disabled={loading || (!tableFile && !detailFile)}
        className="btn-primary w-full justify-center">
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            جارٍ القراءة...
          </span>
        ) : 'استخرج البيانات من الصورة'}
      </button>

      {error && <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-xl p-3">{error}</div>}

      {/* قائمة العقود */}
      {contracts.length > 0 && (
        <div className="mt-4">
          {spx && <div className="text-xs text-surface-400 mb-2">SPX: <span className="font-mono font-bold text-navy-900">{spx.toFixed(2)}</span></div>}
          <div className="text-xs font-semibold text-surface-500 mb-2">اختر العقد:</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {contracts.map((c, i) => (
              <button key={i} onClick={() => onFill({ ...c, spxPrice: spx })}
                className="w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-200 hover:border-teal-400 hover:bg-teal-50 transition-all">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${c.type==='call' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {c.type==='call' ? '▲ Call' : '▼ Put'}
                </span>
                <div className="flex-1 text-right">
                  <div className="text-sm font-bold text-navy-900">Strike {c.strike}</div>
                  <div className="text-xs text-surface-400 font-mono">
                    Bid {c.bid} | Ask {c.ask}
                    {c.delta ? ` | Δ ${c.delta}` : ''}
                    {c.dte ? ` | ${c.dte}d` : ''}
                  </div>
                </div>
                <svg className="w-4 h-4 text-teal-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// حقول مع شرح جميل
const FIELDS = [
  { key:'strike', label:'سعر التنفيذ', abbr:'Strike', desc:'السعر الذي يمنحك الحق في شراء أو بيع SPX عنده. في جدول دراية هو العمود الأوسط.', ph:'7200', req:true },
  { key:'dte',    label:'أيام الانتهاء', abbr:'DTE',    desc:'عدد الأيام المتبقية حتى ينتهي العقد ويصبح لا قيمة له. كلما قل الوقت زاد خطر التآكل.', ph:'14', req:true },
  { key:'bid',    label:'سعر الطلب', abbr:'Bid',    desc:'أعلى سعر يدفعه المشترون الآن. في دراية يظهر بجانب "طلب". ستبيع عنده إذا أردت الخروج سريعاً.', ph:'15.00', req:true },
  { key:'ask',    label:'سعر العرض', abbr:'Ask',    desc:'أدنى سعر يقبله البائعون الآن. في دراية يظهر بجانب "عرض". ستدفعه عند الشراء.', ph:'15.40', req:true },
  { key:'delta',  label:'الحساسية', abbr:'Delta',  desc:'كم يتحرك سعر العقد مقابل كل نقطة في SPX. Call: من 0 إلى 1. Put: من -1 إلى 0. مثال: Delta 0.5 يعني العقد يربح 0.5 دولار لكل نقطة صعود في SPX.', ph:'0.35', req:true },
  { key:'theta',  label:'تآكل الوقت', abbr:'Theta', desc:'كم يخسر العقد يومياً بسبب مرور الوقت فقط، حتى لو لم يتحرك SPX. رقم سالب دائماً. -4.8 يعني خسارة 4.8 دولار يومياً.', ph:'-4.8', req:false },
  { key:'iv',     label:'التذبذب الضمني', abbr:'IV%',    desc:'توقع السوق لمدى تحرك SPX حتى انتهاء العقد. كلما ارتفع IV ارتفع سعر العقد وزاد الخطر. يظهر في دراية كنسبة مئوية.', ph:'12.5', req:false },
  { key:'volume', label:'حجم التداول', abbr:'Volume', desc:'عدد العقود التي تداولت اليوم. كلما ارتفع كانت السيولة أفضل وسهل الدخول والخروج.', ph:'500', req:false },
  { key:'openInterest', label:'العقود المفتوحة', abbr:'OI', desc:'عدد العقود النشطة في السوق لم تُغلق بعد. رقم مرتفع يعني سيولة جيدة واهتمام من المتداولين.', ph:'2000', req:false },
]

export default function AnalyzePage() {
  const [inputMethod, setInputMethod] = useState<'manual'|'image'>('manual')
  const [form, setForm] = useState<Record<string,string>>({
    contractType:'call', strike:'', expiry:'', dte:'',
    bid:'', ask:'', delta:'', theta:'', iv:'', volume:'', openInterest:'',
  })
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('معتدل')
  const [plan, setPlan]               = useState<PlanType>('متقدم')
  const [result, setResult]           = useState<AnalysisResult|null>(null)
  const [loading, setLoading]         = useState(false)
  const [filledFromImage, setFilledFromImage] = useState(false)

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]:v })); setResult(null) }

  function fillFromImage(c: any) {
    setForm(f => ({
      ...f,
      contractType: c.type || 'call',
      strike:  c.strike ? String(c.strike) : '',
      bid:     c.bid    ? String(c.bid)    : '',
      ask:     c.ask    ? String(c.ask)    : '',
      delta:   c.delta  ? String(c.delta)  : '',
      theta:   c.theta  ? String(c.theta)  : '',
      iv:      c.iv     ? String(Math.round(c.iv * 100)) : '',
      dte:     c.dte    ? String(c.dte)    : '',
      expiry:  c.expiry || '',
    }))
    setFilledFromImage(true); setResult(null); setInputMethod('manual')
    setTimeout(() => document.getElementById('analyze-form')?.scrollIntoView({ behavior:'smooth' }), 100)
  }

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
        contractType: form.contractType as 'call'|'put',
        strike: parseFloat(form.strike), expiry: form.expiry, dte: parseInt(form.dte),
        bid: parseFloat(form.bid), ask: parseFloat(form.ask), delta: parseFloat(form.delta),
        iv: form.iv ? parseFloat(form.iv) / 100 : undefined,
        volume: form.volume ? parseInt(form.volume) : undefined,
      }
      const analysis = analyzeContract(contract, market, riskProfile)
      setResult(analysis)
      try {
        await fetch('/api/analyses', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            contractType: contract.contractType, strike: contract.strike,
            expiry: contract.expiry, dte: contract.dte,
            bid: contract.bid, ask: contract.ask, mid: (contract.bid+contract.ask)/2,
            delta: contract.delta, compositeScore: analysis.composite,
            decision: analysis.decision, riskProfile,
            spxPrice: market.spxPrice, vixPrice: market.vixPrice,
            entryZoneLow: analysis.entryZoneLow, entryZoneHigh: analysis.entryZoneHigh,
            target1: analysis.target1, target2: analysis.target2, stopLoss: analysis.stopLoss,
          }),
        })
      } catch {}
    } catch {
      const market = { spxPrice:7230, spxChange:0, spxDirection:'neutral', vixPrice:17, vixLevel:'normal', isFriday:false, isWeekend:false }
      const contract = {
        contractType: form.contractType as 'call'|'put', strike: parseFloat(form.strike),
        expiry: form.expiry, dte: parseInt(form.dte), bid: parseFloat(form.bid),
        ask: parseFloat(form.ask), delta: parseFloat(form.delta),
      }
      setResult(analyzeContract(contract, market, riskProfile))
    } finally { setLoading(false) }
  }

  const mid = form.bid && form.ask ? (parseFloat(form.bid)+parseFloat(form.ask))/2 : 0
  const features = PLAN_FEATURES[plan]
  const visibleIndicators = result ? (plan==='مجاني' ? result.indicators.slice(0,3) : result.indicators) : []
  const canAnalyze = form.strike && form.bid && form.ask && form.delta && form.dte

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-navy-900">تحليل عقد</h1>
        <p className="text-sm text-surface-400 mt-1">أدخل البيانات يدوياً أو ارفع صورة من دراية — اضغط <span className="text-teal-600">؟</span> بجانب أي حقل لشرحه</p>
      </div>

      {/* طريقة الإدخال */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[{k:'manual',icon:'✏️',l:'إدخال يدوي'},{k:'image',icon:'📸',l:'من صورة دراية'}].map(m => (
          <button key={m.k} onClick={() => setInputMethod(m.k as any)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${inputMethod===m.k ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-surface-200 text-surface-500'}`}>
            {m.icon} {m.l}
          </button>
        ))}
      </div>

      {inputMethod==='image' && <ImageUploadSection onFill={fillFromImage} />}

      {filledFromImage && inputMethod==='manual' && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <span>✅</span>
          <span className="text-xs text-teal-700 font-medium">تم ملء البيانات من الصورة — راجعها وحلّل</span>
          <button onClick={() => setFilledFromImage(false)} className="mr-auto text-teal-400 text-sm">✕</button>
        </div>
      )}

      {/* الخطة */}
      <div className="card p-4 mb-4">
        <div className="text-xs font-semibold text-surface-400 mb-2">خطتك</div>
        <div className="grid grid-cols-3 gap-2">
          {(['مجاني','محترف','متقدم'] as PlanType[]).map(p => (
            <button key={p} onClick={() => { setPlan(p); setResult(null) }}
              className={`rounded-xl border-2 p-2 text-center text-sm font-bold transition-all ${plan===p ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-surface-200 text-surface-400'}`}>{p}</button>
          ))}
        </div>
      </div>

      {/* تصنيف المخاطرة */}
      {plan !== 'مجاني' && (
        <div className="card p-4 mb-4">
          <div className="text-xs font-semibold text-surface-400 mb-2">تصنيف المخاطرة</div>
          <div className="grid grid-cols-3 gap-2">
            {(['محافظ','معتدل','مغامر'] as RiskProfile[]).map(r => (
              <button key={r} onClick={() => { setRiskProfile(r); setResult(null) }}
                className={`rounded-xl p-2 text-center border-2 text-sm font-bold transition-all ${riskProfile===r ? r==='محافظ' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : r==='معتدل' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-red-400 bg-red-50 text-red-700' : 'border-surface-200 text-surface-400'}`}>
                {r==='محافظ'?'🟢':r==='معتدل'?'🟡':'🔴'} {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* النموذج */}
      <div id="analyze-form" className="card p-5 mb-4">
        {/* نوع العقد */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-navy-900 mb-2 block">نوع العقد</label>
          <div className="grid grid-cols-2 gap-2">
            {[{val:'call',ar:'📈 Call',sub:'توقع صعود SPX'},{val:'put',ar:'📉 Put',sub:'توقع هبوط SPX'}].map(opt => (
              <button key={opt.val} onClick={() => update('contractType', opt.val)}
                className={`py-3 rounded-xl border-2 transition-all ${form.contractType===opt.val ? opt.val==='call' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-red-50 border-red-400 text-red-700' : 'bg-surface-50 border-surface-200 text-surface-500'}`}>
                <div className="text-sm font-bold">{opt.ar}</div>
                <div className="text-[10px] opacity-70 mt-0.5">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* الحقول */}
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <FieldInput key={f.key}
              label={f.label} abbr={f.abbr} desc={f.desc}
              value={form[f.key] || ''} onChange={v => update(f.key, v)}
              placeholder={f.ph} required={f.req}
            />
          ))}
        </div>

        {mid > 0 && (
          <div className="mt-4 bg-navy-50 rounded-xl p-3 border border-navy-100 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-navy-700">السعر الوسط (Mid)</div>
              <div className="text-[10px] text-navy-400">هذا المبلغ الفعلي الذي ستدفعه عند الشراء</div>
            </div>
            <span className="text-lg font-bold font-mono text-navy-900">${mid.toFixed(2)}</span>
          </div>
        )}

        <button onClick={analyze} disabled={loading || !canAnalyze}
          className="btn-primary w-full justify-center text-base py-3 mt-4">
          {loading ? 'جارٍ التحليل...' : '🔍 حلّل العقد الآن'}
        </button>
        {!canAnalyze && <p className="text-center text-xs text-surface-400 mt-2">الحقول المطلوبة: Strike، DTE، Bid، Ask، Delta</p>}
      </div>

      {/* النتائج */}
      {result && (
        <div className="space-y-4">
          <div className="card overflow-hidden animate-fade-up">
            <div className={`px-5 py-4 ${result.decision==='إشارة نشطة'?'bg-emerald-600':result.decision==='دخول مشروط'?'bg-amber-500':result.decision==='مراقبة فقط'?'bg-blue-600':'bg-surface-700'}`}>
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
                  <div className="h-full bg-white/80 rounded-full" style={{width:`${result.probabilityOfProfit}%`}} />
                </div>
                <span className="text-white text-xs">احتمالية الربح {result.probabilityOfProfit.toFixed(0)}%</span>
              </div>
            </div>

            {/* التبرير البسيط */}
            <div className={`px-5 py-4 border-b border-surface-100 ${
              result.canEnter ? 'bg-white' : 'bg-surface-50'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">
                  {result.decision === 'إشارة نشطة' ? '✅' :
                   result.decision === 'دخول مشروط' ? '⚠️' :
                   result.decision === 'مراقبة فقط' ? '👀' : '🚫'}
                </span>
                <div>
                  <div className="text-sm font-semibold text-navy-900 leading-relaxed mb-2">
                    {result.simpleReason}
                  </div>
                  <div className={`text-xs font-medium px-3 py-1.5 rounded-full inline-block ${
                    result.canEnter
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-surface-100 text-surface-600'
                  }`}>
                    💡 {result.simpleAdvice}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-b border-surface-100">
              <div className="text-xs font-semibold text-surface-400 mb-3">ماذا تفعل؟</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
                  <div className="text-[10px] text-teal-600 font-semibold mb-1">🟢 ادخل عند</div>
                  <div className="text-sm font-bold text-teal-900 font-mono">${result.entryZoneLow.toFixed(2)} — ${result.entryZoneHigh.toFixed(2)}</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <div className="text-[10px] text-emerald-600 font-semibold mb-1">🎯 اخرج بربح عند</div>
                  <div className="text-sm font-bold text-emerald-900 font-mono">${result.target1.toFixed(2)} <span className="text-[10px]">(+{((result.target1/mid-1)*100).toFixed(0)}%)</span></div>
                  <div className="text-[10px] text-emerald-500 mt-0.5">هدف جريء: ${result.target2.toFixed(2)}</div>
                </div>
                <div className={`rounded-xl p-3 border ${features.stopLoss?'bg-red-50 border-red-100':'bg-surface-50 border-surface-200'}`}>
                  <div className="text-[10px] text-red-600 font-semibold mb-1">🔴 اخرج بخسارة عند</div>
                  {features.stopLoss ? <div className="text-sm font-bold text-red-900 font-mono">${result.stopLoss.toFixed(2)}</div>
                    : <div className="flex items-center gap-1 text-xs text-surface-400"><LockIcon /> خطة محترف</div>}
                </div>
                <div className={`rounded-xl p-3 border ${features.holdDays?'bg-blue-50 border-blue-100':'bg-surface-50 border-surface-200'}`}>
                  <div className="text-[10px] text-blue-600 font-semibold mb-1">⏱️ احتفظ به</div>
                  {features.holdDays ? <div className="text-sm font-bold text-blue-900">{result.holdDays}</div>
                    : <div className="flex items-center gap-1 text-xs text-surface-400"><LockIcon /> خطة محترف</div>}
                </div>
              </div>
              <div className="mt-3 bg-navy-50 rounded-xl p-3 border border-navy-100">
                <div className="text-[10px] text-navy-600 font-semibold mb-1">📍 SPX يجب أن يتجاوز (نقطة التعادل)</div>
                <div className="text-sm font-bold text-navy-900 font-mono">{result.breakEvenPrice.toFixed(2)}</div>
              </div>
            </div>

            <div className="px-5 py-4 border-b border-surface-100">
              <div className="text-xs font-semibold text-surface-400 mb-3">💰 كم تشتري؟ (من محفظتك)</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {l:'🟢 محافظ',p:RISK_PROFILES['محافظ'].portfolioPercent,c:'text-emerald-700 bg-emerald-50 border-emerald-200'},
                  {l:'🟡 معتدل',p:RISK_PROFILES['معتدل'].portfolioPercent, c:'text-amber-700 bg-amber-50 border-amber-200'},
                  {l:'🔴 مغامر',p:RISK_PROFILES['مغامر'].portfolioPercent, c:'text-red-700 bg-red-50 border-red-200'},
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

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-navy-900">تفصيل المؤشرات</div>
              {plan==='مجاني' && <span className="text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded-full border border-teal-200">🔒 7 محجوبة</span>}
            </div>
            <div className="space-y-4">
              {visibleIndicators.map(ind => <IndicatorBar key={ind.code} ind={ind} />)}
            </div>
            {plan==='مجاني' && (
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
