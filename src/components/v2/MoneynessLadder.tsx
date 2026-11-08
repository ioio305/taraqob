'use client'

import type { MoneynessLadder as Ladder } from '@/lib/v2/moneynessLadder'

const TONE: Record<string, { color: string; glow: string }> = {
  in:  { color: '#26D07C', glow: 'rgba(38,208,124,0.12)' },
  at:  { color: '#60A5FA', glow: 'rgba(96,165,250,0.12)' },
  out: { color: '#C9943A', glow: 'rgba(201,148,58,0.14)' },
}

// سلّم الجرأة: داخل/عند/خارج السعر لنفس الفكرة — «خارج السعر» مُبرز وافتراضي.
export function MoneynessLadder({ ladder, horizonLabel }: { ladder: Ladder; horizonLabel?: string | null }) {
  if (!ladder?.rungs?.length) return null
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold" style={{ color: '#E8D5A3' }}>
          اختر درجة الجرأة{horizonLabel ? ` · ${horizonLabel}` : ''}
        </div>
        <div className="text-[10px]" style={{ color: '#55657A' }}>نفس الفكرة بثلاثة عقود</div>
      </div>
      <div className="space-y-1.5">
        {ladder.rungs.map((r) => {
          const tone = TONE[r.kind]
          const recommended = r.kind === ladder.recommended
          return (
            <div
              key={r.kind}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: recommended ? tone.glow : 'rgba(255,255,255,0.015)',
                border: `1px solid ${recommended ? tone.color : 'rgba(255,255,255,0.05)'}`,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {recommended && <span style={{ color: tone.color }}>★</span>}
                  <span className="text-xs font-bold" style={{ color: tone.color }}>{r.labelAr}</span>
                  <span className="text-[10px]" style={{ color: '#6B7B8D' }}>{r.toneAr}</span>
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: '#55657A' }}>
                  ستريك {r.strike.toLocaleString()}
                  {r.probItmPct != null && <> · احتمال ربح ~{r.probItmPct}%</>}
                </div>
              </div>
              <div className="text-sm font-black font-mono" style={{ color: tone.color }}>
                ${r.mid.toFixed(2)}
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                style={{
                  background: r.validated ? 'rgba(38,208,124,0.15)' : 'rgba(201,148,58,0.12)',
                  color: r.validated ? '#26D07C' : '#E8B04A',
                }}
              >
                {r.validated ? 'نفّذ' : 'راقب'}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-2 text-[10px] leading-relaxed" style={{ color: '#55657A' }}>
        «خارج السعر» وحده مُعاير ومؤهّل لـ«نفّذ». «داخل/عند السعر» تحليل فقط («راقب») حتى معايرة فئتهما.
      </div>
    </div>
  )
}
