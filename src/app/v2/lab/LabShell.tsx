'use client'
import { useCallback, useEffect, useState } from 'react'
import type { StrategyRun, RunResults, LabHorizon } from '@/lib/v2/lab/types'
import type { StrategySpec } from '@/lib/v2/lab/strategySpec'
type Environment = { ready:boolean; storageReady:boolean; workerReady:boolean; missingAr:string[]; checkedAt:string }
const statuses = { pending:'في الانتظار',running:'قيد التشغيل',completed:'مكتمل',failed:'تعذّر إكمال الاختبار',insufficient_data:'بيانات غير كافية' }
const input = 'w-full rounded-lg border border-white/15 bg-[#101d2b] px-3 py-2 text-sm text-white'
const panel = 'rounded-xl border border-white/10 bg-[#0d1b2a]/80 p-4 space-y-3'
function n(value:number|null|undefined,d=2) {
  return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})
}
async function json(response:Response) {
  try { return await response.json() } catch { throw new Error('تعذّر قراءة رد الخدمة. أعد التحقق من الجاهزية.') }
}
export default function LabShell() {
  const [spec,setSpec]=useState<StrategySpec|null>(null), [runs,setRuns]=useState<StrategyRun[]>([])
  const [environment,setEnvironment]=useState<Environment|null>(null)
  const [selected,setSelected]=useState<string|null>(null), [loading,setLoading]=useState(true)
  const [sending,setSending]=useState(false),[error,setError]=useState<string|null>(null)
  const [horizon,setHorizon]=useState<LabHorizon>('moderate')
  const [from,setFrom]=useState('2023-01-01'),[to,setTo]=useState('2023-06-30')
  const [capital,setCapital]=useState(10000),[risk,setRisk]=useState(1)
  const load=useCallback(async()=>{
    try {
      const [listResponse,envResponse]=await Promise.all([fetch('/api/v2/lab',{cache:'no-store'}),fetch('/api/v2/lab/environment',{cache:'no-store'})])
      const [list,env]=await Promise.all([json(listResponse),json(envResponse)])
      if(!listResponse.ok||!envResponse.ok)throw new Error(list.error??env.error??'تعذّر تحميل المختبر.')
      setSpec(list.spec);setRuns(list.runs??[]);setEnvironment(env.environment)
    } catch(e){setError(e instanceof Error?e.message:'تعذّر الاتصال بالمختبر.')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{void load()},[load])
  const active=runs.some(r=>r.status==='pending'||r.status==='running')
  useEffect(()=>{
    if(!active)return
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},5000)
    return()=>window.clearInterval(timer)
  },[active,load])
  async function submit(){
    setSending(true);setError(null)
    try{
      const response=await fetch('/api/v2/lab',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({horizon,from,to,resolution:'minute',initialCapital:capital,riskPct:risk})})
      const body=await json(response)
      if(body.environment)setEnvironment(body.environment)
      if(!response.ok)throw new Error(body.error??'تعذّر إرسال الطلب.')
      if(body.warning)setError(body.warning)
      if(body.run){setRuns(prev=>[body.run,...prev.filter(r=>r.id!==body.run.id)]);setSelected(body.run.id)}
    }catch(e){setError(e instanceof Error?e.message:'تعذّر إرسال الطلب.')}
    finally{setSending(false)}
  }
  const band=spec?.dteBands.find(b=>b.horizon===horizon)
  const current=runs.find(r=>r.id===selected)
  const pending=runs.some(r=>r.status==='pending')
  return <div className="min-h-full max-w-5xl mx-auto p-4 pb-12 space-y-4 text-slate-200" dir="rtl">
    <header className="space-y-2">
      <h1 className="text-xl font-bold text-white">مختبر الاستراتيجيات</h1>
      <p className="text-sm text-slate-400">إعادة اختبار قرارات SPX المحفوظة وخطة الهدف الأول والوقف، باستخدام LEAN وبيانات عقود تاريخية.</p>
      <p className="text-xs leading-6 text-amber-100 border border-amber-400/30 rounded-lg p-3">
        النتائج هنا تاريخية للبحث، ولا تمثل توصية تنفيذ أو أداءً حقيقيًا للحساب. لا تُعرض أرقام أداء قبل نجاح المحرك والتحقق من بياناته.
      </p>
    </header>
    <section className={panel} aria-label="جاهزية المختبر">
      <h2 className="font-bold text-amber-200">{loading?'جارٍ التحقق من الجاهزية…':environment?.ready?'المختبر جاهز لاستقبال اختبار':'التشغيل لم يُفعّل بعد'}</h2>
      {environment&&<p className="text-sm">سجل حسابك: {environment.storageReady?'جاهز':'غير جاهز'} · خدمة الاختبار: {environment.workerReady?'جاهزة':'غير جاهزة'}</p>}
      {environment?.missingAr.map(reason=><p className="text-sm text-amber-100" key={reason}>{reason}</p>)}
      <p className="text-xs text-slate-400">يلزم ربط خدمة LEAN وبيانات العقود وأرشيف القرارات المؤرخة. لا يعني شراء البيانات وحده اكتمال الإعداد.</p>
      <button type="button" disabled={loading} className="text-sm underline text-amber-300 disabled:opacity-40"
        onClick={()=>{setError(null);setLoading(true);void load()}}>التحقق من الجاهزية</button>
    </section>
    {error&&<div role="alert" className="p-3 rounded-lg border border-red-400/40 text-red-200 text-sm">{error}</div>}
    {spec&&<details className={panel}>
      <summary className="cursor-pointer text-sm font-bold text-amber-200">القواعد وافتراضات الاختبار</summary>
      <p className="text-sm leading-7">{spec.descriptionAr}</p>
      <p className="text-xs text-slate-400" dir="ltr">{spec.version}</p>
      <p className="text-sm">شراء عند الطلب وبيع عند العرض؛ عمولة مفترضة {n(spec.costModel.commissionPerContract)} دولار لكل عقد ولكل جانب،
        وانزلاق إضافي {n(spec.costModel.slippagePct*100)}%. هذه افتراضات بحثية تحتاج مراجعة وفق مزود التنفيذ.</p>
      <p className="text-sm">الوقف والهدف يُفحصان على عرض نهاية الدقيقة؛ لا نفترض ترتيب لمس المستويات داخل الشمعة.</p>
      <ul className="text-xs leading-6 text-slate-400">{spec.dataRequirements.map(x=><li key={x}>{x}</li>)}</ul>
    </details>}
    <section className={panel}>
      <h2 className="font-bold text-amber-200">إعداد اختبار تاريخي</h2>
      <label className="block text-sm" htmlFor="lab-horizon">المدة المتبقية لانتهاء العقد</label>
      <select id="lab-horizon" value={horizon} onChange={e=>setHorizon(e.target.value as LabHorizon)} className={input}>
        {(spec?.dteBands??[]).map(b=><option key={b.horizon} value={b.horizon}>{b.labelAr}: {b.min}–{b.max} يوم</option>)}
      </select>
      {band&&<p className="text-xs text-slate-400">نطاق الانتهاء {band.min}–{band.max} يوم؛ مدة الاحتفاظ تختلف عن تاريخ انتهاء العقد.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">من تاريخ<input aria-label="من تاريخ" className={input} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label className="text-sm">إلى تاريخ<input aria-label="إلى تاريخ" className={input} type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
        <label className="text-sm">رأس المال التجريبي بالدولار<input aria-label="رأس المال التجريبي بالدولار" className={input} type="number" min="100" max="10000000" value={capital} onChange={e=>setCapital(Number(e.target.value))}/></label>
        <label className="text-sm">المخاطرة المخططة لكل صفقة %<input aria-label="المخاطرة المخططة لكل صفقة %" className={input} type="number" min="0.1" max="5" step="0.1" value={risk} onChange={e=>setRisk(Number(e.target.value))}/></label>
      </div>
      <p className="text-xs text-slate-400">دقة الاختبار: دقيقة. العقود الصباحية والأسهم والصناديق ليست ضمن هذا الإصدار.</p>
      <button type="button" onClick={()=>void submit()} disabled={sending||!environment?.ready||active}
        className="w-full py-3 rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-200 font-bold text-sm disabled:opacity-40">
        {sending?'جارٍ إرسال الطلب…':active?'لديك تشغيل قيد المعالجة':!environment?.ready?'التشغيل متوقف حتى اكتمال الجاهزية':'شغّل الاختبار عبر LEAN'}
      </button>
      {pending&&environment?.ready&&<button className="text-sm underline" onClick={()=>void submit()} disabled={sending}>إعادة إرسال طلب الانتظار دون إنشاء نسخة أخرى</button>}
    </section>
    <section className={panel}>
      <h2 className="font-bold">تشغيلات حسابك ({runs.length})</h2>
      {!runs.length&&<p className="text-sm text-slate-400">لا اختبارات محفوظة في حسابك حتى الآن.</p>}
      {runs.map(run=><button type="button" key={run.id} onClick={()=>setSelected(run.id)}
        className="block w-full rounded-lg border border-white/10 p-3 text-right text-sm">
        {statuses[run.status]} · تاريخي · {run.config.period.from} — {run.config.period.to}
      </button>)}
    </section>
    {current&&<section className={panel} aria-label="تفاصيل التشغيل">
      <h2 className="font-bold">{statuses[current.status]} — اختبار تاريخي</h2>
      {current.reasonAr&&<p className="text-sm text-amber-100">{current.reasonAr}</p>}
      {current.requirementsAr.map(x=><p key={x} className="text-xs">{x}</p>)}
      <p className="text-xs text-slate-400">{current.dataSource.provider} · {current.dataSource.coverageAr}</p>
      {current.dataQuality.notesAr.map(x=><p key={x} className="text-xs text-slate-400">{x}</p>)}
      {current.status==='completed'&&current.results&&<Results r={current.results}/>}
    </section>}
  </div>
}
function Results({r}:{r:RunResults}){
  const metrics:[string,string][]=[
    ['الصفقات المغلقة',String(r.trades)],['نسبة النجاح',n(r.winRatePct,1)+'%'],['صافي الربح/الخسارة بالدولار',n(r.netPnl)],
    ['متوسط الرابحة بالدولار',n(r.avgWin)],['متوسط الخاسرة بالدولار',n(r.avgLoss)],['معامل الربح',n(r.profitFactor)],
    ['أقصى تراجع',r.maxDrawdownPct==null?'—':n(r.maxDrawdownPct)+'%'],['العائد',n(r.strategyReturnPct)+'%'],
  ]
  return <div className="space-y-3">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{metrics.map(([label,value])=><div key={label} className="p-3 bg-white/5 rounded-lg">
      <p className="text-xs text-slate-400">{label}</p><p className="font-mono text-lg" dir="ltr">{value}</p>
    </div>)}</div>
    <p className="text-xs text-slate-400">المرجع: تغير المؤشر {n(r.benchmarkReturnPct)}%، للسياق فقط؛ ليس محفظة خيارات مكافئة.</p>
    {r.trades===0&&<p className="text-sm">لم تُنفذ صفقات في الفترة؛ لا توجد عينة لتقييم نسبة نجاح استراتيجية.</p>}
    <Curve points={r.equityCurve}/>
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-right"><thead><tr>{['الدخول','العقد','سعر الدخول','سعر الخروج','الكمية','الصافي بالدولار'].map(x=><th className="p-2" key={x}>{x}</th>)}</tr></thead>
        <tbody>{r.tradeLog.map((t,i)=><tr key={i} className="border-t border-white/10">
          <td className="p-2">{t.openedAt}</td><td>{t.type??'—'} {t.strike??'—'} · {t.expiration??'—'}</td>
          <td>{n(t.entryPrice)}</td><td>{n(t.exitPrice)}</td><td>{t.quantity}</td><td>{n(t.netPnl)}</td>
        </tr>)}</tbody></table>
    </div>
  </div>
}
function Curve({points}:{points:RunResults['equityCurve']}){
  if(points.length<2)return null
  const values=points.flatMap(p=>p.benchmark===null?[p.equity]:[p.equity,p.benchmark])
  const low=Math.min(...values),span=Math.max(...values)-low||1
  const line=(benchmark:boolean)=>points.map((p,i)=>{
    const value=benchmark?p.benchmark:p.equity
    return value===null?null:((i/(points.length-1))*580+10)+','+(150-(value-low)/span*140)
  }).filter(Boolean).join(' ')
  return <figure><figcaption className="text-xs text-slate-400">رأس المال مقابل مرجع موحّد لنفس رأس المال الابتدائي</figcaption>
    <svg role="img" aria-label="منحنى رأس المال التاريخي" viewBox="0 0 600 160" className="w-full h-44">
      <polyline points={line(false)} fill="none" stroke="#26D07C" strokeWidth="2"/>
      <polyline points={line(true)} fill="none" stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="4 3"/>
    </svg></figure>
}
