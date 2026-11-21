'use client'

// أجزاء مشتركة لبطاقات آلة الزمن (السعودي، SPX، الصناديق). لغة مبسّطة بلا «R».

import Link from 'next/link'

export const TM_GREEN = '#16A34A'
export const TM_RED = '#F04760'
export const TM_AMBER = '#F5B301'
export const TM_GRAY = '#64748B'
export const TM_VIOLET = '#A78BFA'

export const tmPct = (v: number) => `${Math.round(v * 100)}%`
export const tmToneColor = (t: 'good' | 'bad' | 'neutral') => (t === 'good' ? TM_GREEN : t === 'bad' ? TM_RED : TM_AMBER)

// متوسط النتيجة بكلام بسيط: نسبة من المبلغ الذي خاطرت به.
export function tmAvgText(avgR: number, afterCosts = true): string {
  const p = Math.round(avgR * 100)
  const tail = afterCosts ? '، بعد التكاليف' : ''
  if (p === 0) return `في المتوسط: لا ربح ولا خسارة تُذكر${tail}`
  return p > 0
    ? `في المتوسط: تربح ${p}% من المبلغ الذي خاطرت به${tail}`
    : `في المتوسط: تخسر ${-p}% من المبلغ الذي خاطرت به${tail}`
}

export function TmBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-300">{label}</span>
        <span className="font-black" style={{ color }}>{tmPct(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.06)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(1, value * 100)}%`, background: color }} />
      </div>
    </div>
  )
}

export function TmVerdict({ text, tone, notes = [] }: { text: string; tone: 'good' | 'bad' | 'neutral'; notes?: string[] }) {
  const c = tmToneColor(tone)
  return (
    <div className="rounded-xl border-2 px-4 py-3" style={{ borderColor: c, background: `${c}12` }}>
      <div className="text-[10px] font-bold text-slate-400">الحكم</div>
      <div className="mt-0.5 text-sm font-black" style={{ color: c }}>{text}</div>
      {notes.map(note => <div key={note} className="mt-1.5 text-[11px] leading-5 text-slate-300">{note}</div>)}
    </div>
  )
}

export function TmLocked({ upgradeHref }: { upgradeHref: string }) {
  return (
    <div className="rounded-2xl border p-5 text-center" style={{ borderColor: `${TM_AMBER}40`, background: `${TM_AMBER}0a` }}>
      <div className="text-2xl">🔒</div>
      <div className="mt-2 text-sm font-black text-white">⏳ آلة الزمن</div>
      <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-slate-400">
        قبل أن تدخل: نعيد الصفقة 10,000 مرة من حركة السوق نفسه، ونريك كم مرة وصلت الهدف وكم مرة ضربت الوقف، وما حدث فعلاً في الأيام السابقة، مع حكم صريح.
      </p>
      <Link href={upgradeHref} className="mt-3 inline-block rounded-lg px-4 py-2 text-xs font-black text-white" style={{ background: TM_GREEN }}>
        متاح في الباقة المتقدمة
      </Link>
    </div>
  )
}

export function TmShell({ sub, children }: { sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-4" style={{ borderColor: 'rgba(167,139,250,.35)', background: 'linear-gradient(135deg, rgba(167,139,250,.08), rgba(255,255,255,.02) 60%)' }}>
      <h3 className="text-sm font-black text-white">⏳ آلة الزمن</h3>
      <p className="mt-0.5 text-[11px] leading-5 text-slate-400">{sub}</p>
      {children}
    </section>
  )
}

export function TmChip({ active, onClick, children, tone = 'violet' }: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: 'violet' | 'green' }) {
  const on = tone === 'green' ? { bg: 'rgba(22,163,74,.22)', fg: '#BBF7D0' } : { bg: 'rgba(167,139,250,.25)', fg: '#E9D5FF' }
  return (
    <button type="button" onClick={onClick} className="rounded-full px-3 py-1 text-xs font-bold transition-colors"
      style={{ background: active ? on.bg : 'rgba(255,255,255,.05)', color: active ? on.fg : '#94A3B8' }}>
      {children}
    </button>
  )
}

export function TmRunButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="mt-4 w-full rounded-xl py-3 text-sm font-black text-white transition-opacity hover:opacity-90"
      style={{ background: 'linear-gradient(90deg, #7C3AED, #A78BFA)' }}>
      شغّل آلة الزمن
    </button>
  )
}

export function TmSpinner() {
  return (
    <div className="mt-4 flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
      <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: TM_VIOLET, borderTopColor: 'transparent' }} />
      نعيد الصفقة 10,000 مرة…
    </div>
  )
}
