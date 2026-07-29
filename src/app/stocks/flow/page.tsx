'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

const ACCENT = '#60A5FA'

type Anomaly = { symbol: string; name: string; type: 'call' | 'put'; strike: number; expiration: string; volume: number; oi: number; ratio: number; mid: number; moneyM: number; noteAr: string }
type Data = { success: boolean; asOf?: string; callMoneyM?: number; putMoneyM?: number; callShare?: number; summaryAr?: string; count?: number; anomalies: Anomaly[]; honestyAr?: string; error?: string }

export default function StockFlowRadar() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await (await fetch('/api/v2/stocks/flow')).json()) } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t) }, [load])

  const callShare = data?.callShare ?? 50

  return (
    <div className="min-h-full p-4 pb-10 space-y-4 max-w-3xl mx-auto" style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(13,27,42,0.82)', border: `1px solid ${ACCENT}25` }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-lg">📡</span>
            <div>
              <div className="text-base font-bold text-white">رادار التدفقات غير المعتادة</div>
              <div className="text-xs mt-0.5" style={{ color: '#5E6E7F' }}>أين تتحرك أموال المؤسسات في خيارات الأسهم الآن</div>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748B' }}>
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
          </button>
        </div>

        {/* شريط توازن كول/بوت */}
        {data?.success && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span style={{ color: '#26D07C' }}>كول ${data.callMoneyM}M</span>
              <span style={{ color: '#F0435A' }}>بوت ${data.putMoneyM}M</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div style={{ width: `${callShare}%`, background: '#26D07C' }} />
              <div style={{ width: `${100 - callShare}%`, background: '#F0435A' }} />
            </div>
            <div className="text-xs mt-2" style={{ color: '#94A3B8' }}>{data.summaryAr}</div>
          </div>
        )}
      </div>

      {loading && !data && <div className="rounded-2xl h-40 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />}

      {!loading && data && (!data.anomalies || data.anomalies.length === 0) && (
        <div className="py-12 text-center">
          <div className="text-4xl mb-3 opacity-25">🔍</div>
          <div className="text-sm" style={{ color: '#5E6E7F' }}>{data.error ?? 'لا تدفقات غير معتادة الآن — السوق هادئ أو مغلق.'}</div>
        </div>
      )}

      {data?.anomalies && data.anomalies.length > 0 && (
        <div className="space-y-2">
          {data.anomalies.map((a, i) => {
            const isCall = a.type === 'call'
            return (
              <Link key={`${a.symbol}-${a.strike}-${a.type}-${i}`} href={`/stocks/analyze?symbol=${a.symbol}`}
                    className="block rounded-xl px-4 py-3" style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-black font-mono text-white">{a.symbol}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: isCall ? 'rgba(38,208,124,0.14)' : 'rgba(240,67,90,0.14)', color: isCall ? '#26D07C' : '#F0435A' }}>
                      {isCall ? '▲ كول' : '▼ بوت'} {a.strike}
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: '#5E6E7F' }}>{a.expiration}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>الحجم {a.volume.toLocaleString()} · مفتوح {a.oi.toLocaleString()}</span>
                    <span className="text-sm font-black font-mono px-2 py-0.5 rounded" style={{ background: `${ACCENT}14`, color: ACCENT }}>×{a.ratio}</span>
                    <span className="text-sm font-black font-mono" style={{ color: '#E8D5A3' }}>${a.moneyM}M</span>
                  </div>
                </div>
                <div className="text-[11px] mt-1.5" style={{ color: '#5E6E7F' }}>{a.noteAr}</div>
              </Link>
            )
          })}
        </div>
      )}

      {data?.honestyAr && (
        <div className="text-xs rounded-lg px-3 py-2 leading-relaxed" style={{ background: 'rgba(255,255,255,0.03)', color: '#64748B', border: '1px solid rgba(255,255,255,0.06)' }}>
          🔍 {data.honestyAr}
        </div>
      )}
    </div>
  )
}
