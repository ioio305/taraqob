import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { computeStrategy } from '@/lib/v2/strategyEngine'

export const dynamic = 'force-dynamic'

const TRADIER_KEY = process.env.TRADIER_API_KEY
const BASE = 'https://api.tradier.com/v1'

async function tGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TRADIER_KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Tradier ${res.status}`)
  return res.json()
}

function normalCDF(x: number): number {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911
  const sign = x < 0 ? -1 : 1
  const t = 1/(1+p*Math.abs(x))
  return 0.5*(1+sign*(1-t*(a1+t*(a2+t*(a3+t*(a4+t*a5))))*Math.exp(-x*x/2)))
}
function normalPDF(x: number): number { return Math.exp(-x*x/2)/Math.sqrt(2*Math.PI) }

function blackScholes(S:number,K:number,T:number,r:number,sigma:number,type:'call'|'put') {
  if (T<=0) {
    const intr = type==='call' ? Math.max(0,S-K) : Math.max(0,K-S)
    return { price:intr, delta: type==='call'?(S>K?1:0):(K>S?-1:0), gamma:0, theta:0, vega:0 }
  }
  const d1 = (Math.log(S/K)+(r+sigma*sigma/2)*T)/(sigma*Math.sqrt(T))
  const d2 = d1 - sigma*Math.sqrt(T)
  const Nd1=normalCDF(d1), Nd2=normalCDF(d2), Nnd1=normalCDF(-d1), Nnd2=normalCDF(-d2)
  const price = type==='call' ? S*Nd1-K*Math.exp(-r*T)*Nd2 : K*Math.exp(-r*T)*Nnd2-S*Nnd1
  const delta = type==='call' ? Nd1 : Nd1-1
  const gamma = normalPDF(d1)/(S*sigma*Math.sqrt(T))
  const theta = type==='call'
    ? (-(S*normalPDF(d1)*sigma)/(2*Math.sqrt(T))-r*K*Math.exp(-r*T)*Nd2)/365
    : (-(S*normalPDF(d1)*sigma)/(2*Math.sqrt(T))+r*K*Math.exp(-r*T)*Nnd2)/365
  const vega = S*normalPDF(d1)*Math.sqrt(T)/100
  return { price:Math.round(price*100)/100, delta, gamma, theta, vega }
}

function parseOCC(symbol: string) {
  const m = symbol.toUpperCase().trim().match(/^(SPXW|SPX)(\d{6})([CP])(\d{8})$/)
  if (!m) return null
  const [,root,dateStr,cp] = m
  const yy=2000+parseInt(dateStr.slice(0,2)), mm=parseInt(dateStr.slice(2,4)), dd=parseInt(dateStr.slice(4,6))
  const expStr = `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`
  const strike = parseInt(m[4])/1000
  const type = cp==='C' ? 'call' : 'put'
  const today=new Date(); today.setHours(0,0,0,0)
  const expDate=new Date(yy,mm-1,dd); expDate.setHours(0,0,0,0)
  const dte = Math.max(0, Math.round((expDate.getTime()-today.getTime())/86400000))
  return { root, expStr, strike, type: type as 'call'|'put', dte }
}

function roundStrike(v: number) { return Math.round(v/5)*5 }
function todayET() { return new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'}) }

async function strikeToSymbol(strike: number, type: 'call'|'put') {
  const cp = type==='call'?'C':'P'
  const pad = String(Math.round(strike*1000)).padStart(8,'0')
  const today = todayET()
  for (const sym of ['SPXW','SPX']) {
    try {
      const d = await tGet(`/markets/options/expirations?symbol=${sym}&includeAllRoots=true&strikes=false`)
      const dates: string[] = Array.isArray(d?.expirations?.date) ? d.expirations.date : [d?.expirations?.date].filter(Boolean)
      const nearest = dates.find(e=>e>=today)
      if (!nearest) continue
      const [y,mo,da] = nearest.split('-')
      return `${sym}${y.slice(2)}${mo}${da}${cp}${pad}`
    } catch { continue }
  }
  const [y,mo,da] = today.split('-')
  return `SPXW${y.slice(2)}${mo}${da}${cp}${pad}`
}

function computeVWAP(data: any) {
  const series: any[] = data?.series?.data
  if (!Array.isArray(series)||series.length===0) return { vwap:null, orHigh:null, orLow:null }
  let sumPV=0, sumV=0
  for (const c of series) {
    const p=((c.high??c.close)+(c.low??c.close)+c.close)/3
    sumPV+=p*(c.volume??0); sumV+=c.volume??0
  }
  const vwap = sumV>0 ? Math.round(sumPV/sumV*10*100)/100 : null
  const or = series.slice(0,30)
  return {
    vwap,
    orHigh: or.length ? Math.round(Math.max(...or.map((c:any)=>c.high))*10*100)/100 : null,
    orLow:  or.length ? Math.round(Math.min(...or.map((c:any)=>c.low)) *10*100)/100 : null,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  let symbolRaw = (searchParams.get('symbol')??(searchParams.get('occ')??'')).trim().toUpperCase()

  // Strike-based lookup
  if (!symbolRaw) {
    const strikeParam = searchParams.get('strike')
    const typeParam   = (searchParams.get('type')?? 'call') as 'call'|'put'
    if (strikeParam && /^\d+(\.\d+)?$/.test(strikeParam)) {
      symbolRaw = await strikeToSymbol(roundStrike(parseFloat(strikeParam)), typeParam)
    }
  }
  if (!symbolRaw) return NextResponse.json({ error: 'أدخل رقم الستريك أو رمز العقد' }, { status: 400 })

  const parsed = parseOCC(symbolRaw)
  if (!parsed) return NextResponse.json({ error: `صيغة الرمز غير صحيحة: "${symbolRaw}"` }, { status: 400 })

  const { root, expStr, strike, type, dte } = parsed

  const [mktRes, contractRes, tsRes] = await Promise.allSettled([
    tGet('/markets/quotes?symbols=$SPX.X,$VIX.X,VIX,SPY,VIXY&greeks=false'),
    tGet(`/markets/quotes?symbols=${encodeURIComponent(symbolRaw)}&greeks=true`),
    tGet('/markets/timesales?symbol=SPY&interval=1min&session_filter=open'),
  ])

  if (mktRes.status==='rejected') return NextResponse.json({ error: 'تعذر جلب بيانات السوق' }, { status: 502 })
  const mkt = mktRes.value
  const qs: any[] = Array.isArray(mkt?.quotes?.quote) ? mkt.quotes.quote : [mkt?.quotes?.quote].filter(Boolean)
  let spxQ = qs.find((q:any)=>q.symbol==='$SPX.X'||q.symbol==='SPX')??null
  let vixQ = qs.find((q:any)=>q.symbol==='$VIX.X'||q.symbol==='VIX')??null
  if (!spxQ?.last) { const spy=qs.find((q:any)=>q.symbol==='SPY'); if (spy?.last) spxQ={...spy,last:spy.last*10,prevclose:(spy.prevclose??spy.last)*10} }
  if (!vixQ?.last) { const vixy=qs.find((q:any)=>q.symbol==='VIXY'); if (vixy?.last) vixQ={last:Math.round(vixy.last*3.5*10)/10} }
  const spxPrice = spxQ?.last ?? 0
  const spxPrev  = spxQ?.prevclose ?? spxPrice
  const spxChgPct = spxPrev>0 ? (spxPrice-spxPrev)/spxPrev*100 : 0
  const vixPrice  = vixQ?.last ?? 17

  let cq: any = null, isEstimated = false
  if (contractRes.status==='fulfilled') {
    const cd = contractRes.value
    cq = Array.isArray(cd?.quotes?.quote) ? cd.quotes.quote[0] : cd?.quotes?.quote
  }
  if (!cq) {
    const sigma=vixPrice/100, T=Math.max(dte,0)/365, r=0.05
    const bs = blackScholes(spxPrice,strike,T,r,sigma,type)
    const mid = Math.max(bs.price,0.05)
    cq = {
      bid:  Math.round(mid*0.92*100)/100,
      ask:  Math.round(mid*1.08*100)/100,
      last: mid,
      greeks: { delta:Math.round(bs.delta*1000)/1000, gamma:Math.round(bs.gamma*10000)/10000,
                theta:Math.round(bs.theta*100)/100, vega:Math.round(bs.vega*100)/100, mid_iv:sigma },
      volume:0, open_interest:0,
    }
    isEstimated = true
  }

  const bid      = cq.bid??0, ask=cq.ask??0
  const mid      = bid&&ask ? Math.round((bid+ask)/2*100)/100 : (cq.last??0)
  const spreadAbs = Math.round((ask-bid)*100)/100
  const spreadPct = mid>0 ? (ask-bid)/mid : 0.10
  const delta = cq.greeks?.delta??null, gamma=cq.greeks?.gamma??null
  const theta  = cq.greeks?.theta??null, vega=cq.greeks?.vega??null
  const iv     = cq.greeks?.mid_iv??cq.greeks?.smv_vol??null
  const volume = cq.volume??0, oi=cq.open_interest??0

  const { vwap, orHigh, orLow } = tsRes.status==='fulfilled'
    ? computeVWAP(tsRes.value) : { vwap:null, orHigh:null, orLow:null }

  const emIntraday = spxPrice*(vixPrice/100)*Math.sqrt(1/252)
  const emUpper = Math.round(spxPrice+emIntraday)
  const emLower = Math.round(spxPrice-emIntraday)

  const isITM        = type==='call' ? strike<=spxPrice : strike>=spxPrice
  const distFromATM  = Math.abs(strike-spxPrice)
  const distRatio    = emIntraday>0 ? distFromATM/emIntraday : 0
  const callAligned  = type==='call'
  const mktAligned   = callAligned ? spxChgPct>=0.2 : spxChgPct<=-0.2
  const mktOpposed   = callAligned ? spxChgPct<=-0.5 : spxChgPct>=0.5
  const aboveVWAP    = vwap ? spxPrice>vwap : null
  const abovOR       = orHigh ? spxPrice>orHigh : null
  const belowOR      = orLow  ? spxPrice<orLow  : null

  // 7-engine score (same as /analyze)
  let e1=7
  if (vixPrice>28) e1=0
  else if (mktOpposed) e1=2
  else if (Math.abs(spxChgPct)>=1.0&&mktAligned) e1=15
  else if (Math.abs(spxChgPct)>=0.5&&mktAligned) e1=13
  else if (Math.abs(spxChgPct)>=0.2&&mktAligned) e1=10

  let e2=7
  if (aboveVWAP!==null) {
    e2 = (callAligned?aboveVWAP:!aboveVWAP) ? 11 : 5
    if (abovOR!==null||belowOR!==null) {
      const orAligned = callAligned ? abovOR===true : belowOR===true
      const orOpposed = callAligned ? belowOR===true : abovOR===true
      if (orAligned) e2=Math.min(15,e2+4)
      if (orOpposed) e2=Math.max(0,e2-3)
    }
  } else {
    e2 = Math.abs(spxChgPct)>0.5&&mktAligned ? 10 : Math.abs(spxChgPct)>0.5 ? 4 : 7
  }
  e2=Math.max(0,Math.min(15,e2))

  let e3=7
  if (isITM) { e3=2 } else {
    const idealMax=dte===0?0.80:1.00
    if (distRatio>=0.30&&distRatio<=idealMax) e3=14
    else if (distRatio>idealMax&&distRatio<=idealMax*1.4) e3=10
    else if (distRatio<0.30) e3=8
    else e3=4
  }
  e3=Math.max(0,Math.min(15,e3))

  let e4=0
  const absDelta=Math.abs(delta??0), absGamma=Math.abs(gamma??0), absTheta=Math.abs(theta??0)
  const dIdealMin=dte===0?0.22:0.25, dIdealMax=dte===0?0.32:0.35
  const dRangeMin=dte===0?0.18:0.20, dRangeMax=dte===0?0.35:0.38
  if (absDelta>=dIdealMin&&absDelta<=dIdealMax) e4+=12
  else if (absDelta>=dRangeMin&&absDelta<=dRangeMax) e4+=8
  else if (absDelta>=0.10&&absDelta<dRangeMin) e4+=3
  else if (absDelta>dRangeMax&&absDelta<=0.50) e4+=4
  const midInEM=mid/(emIntraday>0?emIntraday:1)
  if (midInEM>=0.05&&midInEM<=0.35) e4+=8
  else if (midInEM>0.35&&midInEM<=0.60) e4+=5
  else if (midInEM>0.60&&midInEM<=1.00) e4+=3
  else if (midInEM>0.00&&midInEM<0.05) e4+=2
  if (isITM) e4=Math.max(0,e4-8)
  e4=Math.max(0,Math.min(20,e4))

  let e5=0
  if (volume>=1000) e5+=7; else if (volume>=500) e5+=5; else if (volume>=100) e5+=3; else if (volume>=20) e5+=1
  if (oi>=5000) e5+=3; else if (oi>=1000) e5+=2; else if (oi>=100) e5+=1
  if (spreadPct<0.05) e5+=5; else if (spreadPct<0.10) e5+=4; else if (spreadPct<0.20) e5+=2; else if (spreadPct<0.35) e5+=1; else e5-=2
  if (isEstimated) e5=Math.max(e5,5)
  e5=Math.max(0,Math.min(15,e5))

  const riskFlags: string[] = []
  let e6=10
  if (isEstimated) riskFlags.push('⚡ بيانات تقديرية — السوق مغلق أو العقد غير متداول بعد')
  if (isITM) { riskFlags.push(`⚠ العقد ITM — Strike ${strike}`); e6-=4 }
  if (dte===0) {
    if (absGamma>0.015) { riskFlags.push(`⚠ Gamma حاد 0DTE (${absGamma.toFixed(4)})`); e6-=4 }
    else { riskFlags.push('0DTE — Theta يتسارع بعد الساعة 2 ظ'); e6-=1 }
  } else if (dte===1&&absTheta>3) { riskFlags.push(`⚠ Theta مرتفع (${absTheta.toFixed(2)})`); e6-=2 }
  if (spreadPct>0.30) { riskFlags.push(`⚠ Spread واسع (${(spreadPct*100).toFixed(0)}%)`); e6-=2 }
  if (vixPrice>30) { riskFlags.push(`⚠ VIX مرتفع (${vixPrice.toFixed(1)})`); e6-=3 }
  if (ask>5.00) riskFlags.push('⚠ خارج نطاق السعر المفضل ($0.50–$5.00)')
  e6=Math.max(0,Math.min(10,e6))

  let e7=0
  if (!isEstimated&&bid>0&&ask>0) e7+=4
  if (mid>=1.0&&mid<=50.0) e7+=3
  if (spreadPct<0.15) e7+=3
  e7=Math.max(0,Math.min(10,e7))

  const total = e1+e2+e3+e4+e5+e6+e7
  const decision: 'execute'|'conditional'|'watch'|'reject' =
    total>=80 ? 'execute' : total>=65 ? 'conditional' : total>=50 ? 'watch' : 'reject'

  const dirAr  = spxChgPct>=0.3 ? 'صاعد' : spxChgPct<=-0.3 ? 'هابط' : 'محايد'
  const vwapAr = vwap ? (spxPrice>vwap ? '، فوق VWAP' : '، تحت VWAP') : ''
  const decisionReason = isEstimated
    ? `تحليل تقديري — السوق مغلق، بيانات BS بناءً على SPX ${spxPrice.toFixed(0)} و VIX ${vixPrice.toFixed(1)}`
    : decision==='reject'    ? `رُفض — ${riskFlags.find(f=>f.startsWith('⚠'))??'الدرجة أقل من 50'}`
    : decision==='watch'     ? `مراقبة — السوق ${dirAr}${vwapAr}، انتظر تأكيداً`
    : decision==='conditional'? `مشروط — السوق ${dirAr}${vwapAr}، الدخول بحذر`
    : `نفّذ — السوق ${dirAr}${vwapAr}، الشروط مكتملة`

  const strategy = computeStrategy({
    score:total, dte, iv, bid, ask, mid, delta, gamma,
    spxPrice, emUpper, emLower, type, chgPct:spxChgPct, vixPrice,
  })

  // Liquidity reading
  const liquidityLabel = (volume>=500&&oi>=1000&&spreadPct<0.10) ? 'جيدة'
    : (volume>=100||oi>=500) ? 'متوسطة' : 'ضعيفة'
  const spreadLabel = spreadPct<0.10 ? 'مقبول' : spreadPct<0.25 ? 'مرتفع' : 'خطر'

  return NextResponse.json({
    symbol: symbolRaw, root, type, strike, expiration: expStr, dte,
    is_estimated: isEstimated,
    bid, ask, mid, last: cq.last??null,
    spread_abs: spreadAbs,
    spread_pct: Math.round(spreadPct*10000)/100,
    volume, open_interest: oi,
    delta, gamma, theta, vega, iv,
    spx_price: spxPrice,
    spx_change_pct: Math.round(spxChgPct*100)/100,
    vix: vixPrice,
    vwap,
    em_upper: emUpper, em_lower: emLower,
    em_intraday: Math.round(emIntraday*100)/100,
    is_itm: isITM,
    total_score: total,
    decision,
    decision_reason: decisionReason,
    liquidity_label: liquidityLabel,
    spread_label: spreadLabel,
    risk_flags: riskFlags,
    strategy,
    ts: Date.now(),
  })
}
