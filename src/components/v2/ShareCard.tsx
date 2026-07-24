'use client'

// ── بطاقة القرار القابلة للمشاركة ────────────────────────────────────────────
// صورة أنيقة بعلامة ترقّب (الاتجاه/الدرجة/المستويات) — يشاركها المستخدم فتسوّق
// المنصة عضوياً. تُرسم على canvas (بلا اعتماد خارجي) وتُحفظ/تُشارك.

import { useState } from 'react'

type Props = {
  dir: 'call' | 'put' | null
  score: number
  decisionText: string
  spot: number
  entry: number | null
  target: number | null
  stop: number | null
  strike: number
}

function drawCard(p: Props): Promise<Blob | null> {
  return new Promise(resolve => {
    const W = 1080, H = 1080
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return resolve(null)

    const dirColor = p.dir === 'call' ? '#26D07C' : p.dir === 'put' ? '#A78BFA' : '#8A97A6'
    const dirText  = p.dir === 'call' ? '▲ كول' : p.dir === 'put' ? '▼ بوت' : '— محايد'

    // خلفية
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#0B1826'); g.addColorStop(1, '#060D14')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

    // إطار بلون الاتجاه
    ctx.strokeStyle = dirColor; ctx.lineWidth = 10
    ctx.strokeRect(36, 36, W - 72, H - 72)
    ctx.direction = 'rtl'

    // العلامة
    ctx.textAlign = 'right'
    ctx.fillStyle = '#E8D5A3'; ctx.font = 'bold 70px system-ui, sans-serif'
    ctx.fillText('ترقّب', W - 90, 170)
    ctx.fillStyle = '#C9943A'; ctx.font = '30px monospace'
    ctx.fillText('TARAQOB · SPX', W - 90, 220)

    // الاتجاه الكبير
    ctx.textAlign = 'center'
    ctx.fillStyle = dirColor; ctx.font = 'bold 150px system-ui, sans-serif'
    ctx.fillText(dirText, W / 2, 470)

    // الدرجة
    ctx.fillStyle = '#8A97A6'; ctx.font = '38px system-ui, sans-serif'
    ctx.fillText('قوة القرار', W / 2, 560)
    ctx.fillStyle = '#E8D5A3'; ctx.font = 'bold 90px monospace'
    ctx.fillText(`${p.score}/100`, W / 2, 660)

    // نص القرار
    ctx.fillStyle = '#B8C4D4'; ctx.font = '34px system-ui, sans-serif'
    ctx.fillText(p.decisionText.slice(0, 46), W / 2, 730)

    // المستويات
    const levels: [string, number | null, string][] = [
      ['الدخول', p.entry, '#E8D5A3'],
      ['الهدف', p.target, '#26D07C'],
      ['الوقف', p.stop, '#F0435A'],
    ]
    const boxW = 280, gap = 24, totalW = boxW * 3 + gap * 2, startX = (W - totalW) / 2
    levels.forEach(([lab, val, col], i) => {
      const x = startX + i * (boxW + gap)
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(x, 800, boxW, 130)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2
      ctx.strokeRect(x, 800, boxW, 130)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#6E7E8F'; ctx.font = '28px system-ui, sans-serif'
      ctx.fillText(lab, x + boxW / 2, 850)
      ctx.fillStyle = col; ctx.font = 'bold 52px monospace'
      ctx.fillText(val != null ? Math.round(val).toLocaleString() : '—', x + boxW / 2, 905)
    })

    // التذييل
    ctx.fillStyle = '#5E6E7F'; ctx.font = '30px monospace'
    ctx.fillText('trqob.com · قرار لا كومة بيانات', W / 2, 1010)

    canvas.toBlob(b => resolve(b), 'image/png')
  })
}

export function ShareCard(p: Props) {
  const [busy, setBusy] = useState(false)
  const dirColor = p.dir === 'call' ? '#26D07C' : p.dir === 'put' ? '#A78BFA' : '#8A97A6'

  async function share() {
    setBusy(true)
    try {
      const blob = await drawCard(p)
      if (!blob) return
      const file = new File([blob], 'taraqob-decision.png', { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (d?: unknown) => boolean }
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'قرار ترقّب', text: 'قرار SPX من ترقّب · trqob.com' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'taraqob-decision.png'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch { /* تجاهل */ } finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap"
      style={{ background: `linear-gradient(135deg, ${dirColor}0E, rgba(13,27,42,0.9))`, border: `1px solid ${dirColor}30` }}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">📸</span>
        <div>
          <div className="text-sm font-bold" style={{ color: '#E8D5A3' }}>شارك بطاقة القرار</div>
          <div className="text-xs" style={{ color: '#8A97A6' }}>صورة أنيقة بعلامتك — {p.dir === 'call' ? 'كول' : p.dir === 'put' ? 'بوت' : 'محايد'} {p.strike}</div>
        </div>
      </div>
      <button onClick={share} disabled={busy}
        className="px-5 py-2.5 rounded-xl text-sm font-bold transition-transform hover:scale-105 disabled:opacity-50"
        style={{ background: `linear-gradient(135deg, ${dirColor}, ${dirColor}CC)`, color: '#060D14' }}>
        {busy ? 'جارٍ التجهيز…' : 'حفظ / مشاركة ←'}
      </button>
    </div>
  )
}
