'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type ContractRec = {
  type: 'call'|'put'; strike: number; estPrice: number
  target1: number; target2: number; target3: number
  stopLoss: number; entryLow: number; entryHigh: number
  risk: 'آمن'|'متوسط'|'مغامر'; why: string; dte: number
}

function estimatePrice(spx:number,strike:number,vix:number,dte:number):number {
  const iv=vix/100; const T=Math.max(dte,0.5)/365
  const d=Math.abs(strike-spx); const expMove=spx*iv*Math.sqrt(T)
  const otm=d/expMove; const base=expMove*Math.exp(-otm*1.2)
  return Math.max(0.5,Math.round(base*100)/100)
}

function generate(spx:number,vix:number,dir:string):ContractRec[] {
  const step=5; const atm=Math.round(spx/step)*step
  const isPut=dir==='bearish'; const t=isPut?'put':'call'
  const s1=isPut?atm-5:atm+5; const p1=estimatePrice(spx,s1,vix,7)
  const s2=isPut?atm-10:atm+10; const p2=estimatePrice(spx,s2,vix,3)
  const s3=isPut?atm-15:atm+15; const p3=estimatePrice(spx,s3,vix,0)
  return [
    { type:t,strike:s1,estPrice:p1,target1:p1*1.4,target2:p1*1.75,target3:p1*2.2,stopLoss:p1*0.55,entryLow:p1*0.95,entryHigh:p1*1.05,risk:'آمن',why:`${isPut?'السوق هابط':'السوق صاعد'} — ادخل ${t==='call'?'Call':'Put'} ${s1} بـ $${p1.toFixed(2)}`,dte:7 },
    { type:t,strike:s2,estPrice:p2,target1:p2*1.5,target2:p2*2.0,target3:p2*3.0,stopLoss:p2*0.50,entryLow:p2*0.95,entryHigh:p2*1.10,risk:'متوسط',why:`أكثر مكافأة — ادخل ${t==='call'?'Call':'Put'} ${s2} بـ $${p2.toFixed(2)}`,dte:3 },
    { type:t,strike:s3,estPrice:p3,target1:p3*1.3,target2:p3*2.0,target3:p3*4.0,stopLoss:p3*0.40,entryLow:p3*0.90,entryHigh:p3*1.10,risk:'مغامر',why:`0DTE — ربح سريع — ادخل ${t==='call'?'Call':'Put'} ${s3} بـ $${p3.toFixed(2)}`,dte:0 },
  ]
}

const RS = {
  'آمن':   {badge:'bg-emerald-100 text-emerald-700 border-emerald-200',icon:'🟢'},
  'متوسط': {badge:'bg-amber-100 text-amber-700 border-amber-200',      icon:'🟡'},
  'مغامر': {badge:'bg-red-100 text-red-700 border-red-200',            icon:'🔴'},
}

export default function SmartDashboard({analyses}:{analyses:any[]}) {
  const [spxInput,setSpxInput]=useState('')
  const [contracts,setContracts]=useState<ContractRec[]>([])
  const [liveSpx,setLiveSpx]=useState<number|null>(null)
  const [liveVix,setLiveVix]=useState<number|null>(null)
  const [dir,setDir]=useState('bullish')
  const [selected,setSelected]=useState<ContractRec|null>(null)
  const [ready,setReady]=useState(false)

  useEffect(()=>{
    fetch('/api/market/pulse').then(r=>r.json()).then(d=>{
      if(d.spx?.price){setLiveSpx(d.spx.price);setSpxInput(d.spx.price.toFixed(2));setDir(d.spx.direction??'bullish')}
      if(d.vix?.price) setLiveVix(d.vix.price)
      setReady(true)
    }).catch(()=>setReady(true))
  },[])

  function analyze(){
    const spx=parseFloat(spxInput); const vix=liveVix??18
    if(!spx||spx<1000) return
    setContracts(generate(spx,vix,dir)); setSelected(null)
  }

  return (
    <div className="space-y-4">

      {/* إدخال سريع */}
      <div className="card p-5">
        <div className="text-sm font-bold text-navy-900 mb-1">🎯 ما أفضل عقد الآن؟</div>
        <div className="text-xs text-surface-400 mb-4">
          ترقّب يقترح رقم العقد تلقائياً — أو عدّله حسب ما تراه في دراية
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <div className="text-[10px] text-surface-500 font-semibold mb-1">
              سعر SPX الآن
              {liveSpx && <span className="text-teal-600 mr-2">(تلقائي ✅)</span>}
            </div>
            <input type="number" step="0.01" value={spxInput}
              onChange={e=>{setSpxInput(e.target.value);setContracts([])}}
              placeholder="مثال: 7192" className="field-input text-left font-mono text-lg font-bold" dir="ltr"/>
          </div>
          <button onClick={analyze} disabled={!spxInput||parseFloat(spxInput)<1000}
            className="btn-primary px-6 self-end">أوصِ ←</button>
        </div>

        {/* اتجاه */}
        <div className="flex gap-2">
          {[
            {val:'bullish',label:'📈 صاعد',c:'border-emerald-400 bg-emerald-50 text-emerald-700'},
            {val:'neutral', label:'↔️ محايد',c:'border-surface-300 bg-surface-50 text-surface-600'},
            {val:'bearish', label:'📉 هابط', c:'border-red-400 bg-red-50 text-red-700'},
          ].map(d=>(
            <button key={d.val} onClick={()=>{setDir(d.val);setContracts([])}}
              className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${dir===d.val?d.c:'border-surface-200 text-surface-400'}`}>
              {d.label}
            </button>
          ))}
        </div>

        {liveVix&&(
          <div className="mt-2 text-[10px] text-surface-400 text-center">
            VIX: <span className={`font-mono font-bold ${liveVix<20?'text-emerald-600':liveVix<25?'text-amber-600':'text-red-600'}`}>{liveVix.toFixed(2)}</span>
            {' '} — {liveVix<15?'هادئ جداً':liveVix<20?'طبيعي':liveVix<25?'مرتفع':'خطر'}
          </div>
        )}
      </div>

      {/* التوصيات */}
      {contracts.length>0&&(
        <div className="space-y-3">
          {contracts.map((c,i)=>{
            const st=RS[c.risk]
            const isSel=selected?.strike===c.strike&&selected?.type===c.type
            const rp=new URLSearchParams({contractType:c.type,strike:String(c.strike),bid:String((c.estPrice*0.97).toFixed(2)),ask:String((c.estPrice*1.03).toFixed(2)),delta:c.type==='call'?'0.35':'-0.35',dte:String(c.dte)}).toString()
            return (
              <div key={i} className={`card overflow-hidden transition-all ${isSel?'border-2 border-teal-400':''}`}>
                <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${st.badge}`}>{st.icon} {c.risk}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.type==='call'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>
                      {c.type==='call'?'▲ Call':'▼ Put'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-navy-900 font-mono">{c.strike}</span>
                    <span className="text-xs text-surface-400 mr-2">≈ ${c.estPrice.toFixed(2)}</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-sm font-semibold text-navy-900 mb-3">{c.why}</div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      {n:'هدف ١',v:c.target1,cl:'bg-emerald-50 text-emerald-800 border border-emerald-200'},
                      {n:'هدف ٢',v:c.target2,cl:'bg-teal-50 text-teal-800 border border-teal-200'},
                      {n:'هدف ٣',v:c.target3,cl:'bg-navy-50 text-navy-800 border border-navy-200'},
                    ].map((t,j)=>(
                      <div key={j} className={`rounded-xl p-2 text-center ${t.cl}`}>
                        <div className="text-[9px] font-semibold mb-0.5">🎯 {t.n}</div>
                        <div className="text-xs font-bold font-mono">${t.v.toFixed(2)}</div>
                        <div className="text-[9px] opacity-70">+{((t.v/c.estPrice-1)*100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-teal-50 rounded-xl p-2.5 border border-teal-100">
                      <div className="text-[9px] text-teal-600 font-bold">🟢 ادخل بين</div>
                      <div className="text-xs font-bold text-teal-900 font-mono">${c.entryLow.toFixed(2)} — ${c.entryHigh.toFixed(2)}</div>
                    </div>
                    <div className="bg-red-50 rounded-xl p-2.5 border border-red-100">
                      <div className="text-[9px] text-red-600 font-bold">🔴 اخرج عند</div>
                      <div className="text-xs font-bold text-red-900 font-mono">${c.stopLoss.toFixed(2)} <span className="text-[9px] opacity-60">(-{((1-c.stopLoss/c.estPrice)*100).toFixed(0)}%)</span></div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>setSelected(isSel?null:c)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${isSel?'bg-teal-600 border-teal-600 text-white':'border-surface-200 text-surface-600 hover:border-teal-300'}`}>
                      {isSel?'✅ مختار':'اختر هذا العقد'}
                    </button>
                    <Link href={`/dashboard/analyze?${rp}`}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-navy-900 text-white text-center hover:bg-navy-800 transition-colors">
                      تحليل مفصل ←
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}

          {selected&&(
            <div className="bg-navy-900 rounded-2xl p-5">
              <div className="text-white font-bold text-sm mb-4">📊 بطاقة المتابعة — {selected.type==='call'?'Call':'Put'} {selected.strike}</div>
              <div className="space-y-2.5">
                {[
                  {l:'💰 ادخل بين',v:`$${selected.entryLow.toFixed(2)} — $${selected.entryHigh.toFixed(2)}`,c:'text-white'},
                  {l:'🎯 اخرج بربح هدف ١',v:`$${selected.target1.toFixed(2)} (+${((selected.target1/selected.estPrice-1)*100).toFixed(0)}%)`,c:'text-emerald-400'},
                  {l:'🎯 اخرج بربح هدف ٢',v:`$${selected.target2.toFixed(2)} (+${((selected.target2/selected.estPrice-1)*100).toFixed(0)}%)`,c:'text-teal-400'},
                  {l:'🚀 اخرج بربح هدف ٣',v:`$${selected.target3.toFixed(2)} (+${((selected.target3/selected.estPrice-1)*100).toFixed(0)}%)`,c:'text-amber-400'},
                  {l:'🔴 اخرج بخسارة عند',v:`$${selected.stopLoss.toFixed(2)} (-${((1-selected.stopLoss/selected.estPrice)*100).toFixed(0)}%)`,c:'text-red-400'},
                ].map((r,i)=>(
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-white/60 text-xs">{r.l}</span>
                    <span className={`text-sm font-bold font-mono ${r.c}`}>{r.v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-white/30 text-center">
                تحقق من السعر الفعلي في دراية قبل الدخول
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kill Zones */}
      <div className="bg-gradient-to-l from-navy-900 to-navy-800 rounded-2xl p-4">
        <div className="text-white text-xs font-bold mb-3">⏰ Kill Zones اليوم (توقيت الرياض)</div>
        <div className="space-y-2">
          {[
            {time:'11:00 ص — 1:00 م',label:'London Kill Zone',icon:'🇬🇧',best:false},
            {time:'5:30 م — 7:00 م', label:'NY Open Kill Zone',icon:'🔥',best:true},
            {time:'10:00 م — 11:30 م',label:'NY Close Kill Zone',icon:'🇺🇸',best:false},
          ].map(k=>(
            <div key={k.label} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${k.best?'bg-amber-500/20 border border-amber-400/30':'bg-white/5'}`}>
              <span>{k.icon}</span>
              <span className={`text-xs font-medium flex-1 ${k.best?'text-amber-200':'text-white/70'}`}>{k.label}</span>
              <span className="text-white/50 text-[10px] font-mono">{k.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* آخر التحليلات */}
      {analyses.slice(0,3).length>0&&(
        <div className="card">
          <div className="px-5 pt-4 pb-3 border-b border-surface-100 flex items-center justify-between">
            <div className="text-sm font-bold text-navy-900">آخر تحليلاتك</div>
            <Link href="/dashboard/history" className="text-xs text-teal-600 hover:underline">الكل ←</Link>
          </div>
          <div className="divide-y divide-surface-100">
            {analyses.slice(0,3).map((a:any)=>{
              const sc=a.composite_score??0
              const bg=sc>=70?'bg-emerald-600':sc>=50?'bg-amber-500':'bg-surface-600'
              return (
                <Link key={a.id} href={`/dashboard/history/${a.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${bg}`}>{sc||'--'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${a.contract_type==='call'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{a.contract_type==='call'?'▲':'▼'}</span>
                      <span className="text-sm font-bold text-navy-900">SPX {a.strike}</span>
                      <span className="text-[10px] text-surface-400">{a.dte}d</span>
                    </div>
                    <div className="text-xs text-surface-400 truncate">{a.decision}</div>
                  </div>
                  <svg className="w-4 h-4 text-surface-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/analyze" className="card p-4 flex items-center gap-3 hover:border-teal-300 transition-all border-2 border-transparent">
          <span className="text-2xl">🔍</span>
          <div><div className="text-sm font-bold text-navy-900">تحليل عقد</div><div className="text-[10px] text-surface-400">تفصيلي من دراية</div></div>
        </Link>
        <Link href="/dashboard/history" className="card p-4 flex items-center gap-3 hover:border-teal-300 transition-all border-2 border-transparent">
          <span className="text-2xl">📊</span>
          <div><div className="text-sm font-bold text-navy-900">سجل التحليلات</div><div className="text-[10px] text-surface-400">Call / Put / SPX</div></div>
        </Link>
      </div>
    </div>
  )
}
