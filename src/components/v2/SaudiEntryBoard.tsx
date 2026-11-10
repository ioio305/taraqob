'use client'

import Link from 'next/link'
import type { EntryPick, Regime, ValidatedSetup } from '@/lib/v2/saudiEntry'

const ACCENT = '#16A34A'
const RED = '#F04760'
const AMBER = '#F5B301'

function n(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const when = (d: number) => (d === 0 ? 'اليوم' : d === 1 ? 'أمس' : 'قبل جلستين')
const signed = (v: number) => `${v > 0 ? '+' : ''}${n(v)}`

function PickRow({ p, proven }: { p: EntryPick; proven: boolean }) {
  const col = proven ? ACCENT : AMBER
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: `${col}40`, background: `${col}0a` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md px-2 py-0.5 text-[11px] font-black text-white" style={{ background: col }}>{proven ? 'ادخل' : 'مخاطرة عالية'}</span>
            <Link href={`/saudi/stock/${p.symbol}`} className="truncate text-sm font-black text-white hover:underline">{p.name}</Link>
            <span className="text-[10px] text-slate-500">{p.symbol}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">{p.setupLabel} · {when(p.daysAgo)}{p.fresh ? '' : ' · السعر ابتعد عن نقطة الإشارة'}</div>
        </div>
        <div className="shrink-0 text-left">
          <div className="text-sm font-black tabular-nums text-white">{n(p.price)}</div>
          <div className="text-[11px] font-bold tabular-nums" style={{ color: p.change >= 0 ? ACCENT : RED }}>{signed(p.change)}%</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
        <div className="rounded-lg bg-white/[.04] px-1 py-1.5"><div className="text-slate-500">الدخول</div><div className="font-black tabular-nums text-white">{n(p.entry)}</div></div>
        <div className="rounded-lg px-1 py-1.5" style={{ background: `${RED}12` }}><div className="text-slate-500">الوقف</div><div className="font-black tabular-nums" style={{ color: RED }}>{n(p.stop)}</div><div className="text-[10px] text-slate-500">−{p.riskPct}%</div></div>
        <div className="rounded-lg bg-white/[.04] px-1 py-1.5"><div className="text-slate-500">اخرج عند إغلاق تحت</div><div className="font-black tabular-nums text-white">{n(p.trail != null && p.trail > p.stop ? p.trail : p.stop)}</div><div className="text-[10px] text-slate-500">يرتفع مع السعر</div></div>
      </div>
      {p.stats.n ? (
        <div className="mt-2 text-[10px] text-slate-500">
          تاريخياً في نفس حال السوق منذ ٢٠٢٣: {p.stats.n} صفقة · متوسط صافٍ <span className="font-bold" style={{ color: p.stats.avgNetPct > 0 ? ACCENT : RED }}>{signed(p.stats.avgNetPct)}%</span> · معامل الربح {n(p.stats.profitFactor)} · مدة {n(p.stats.avgDays, 0)} جلسة
        </div>
      ) : null}
    </div>
  )
}

// فرص الدخول اليوم (الخطة الاحترافية): «ادخل» فقط لما ربح تاريخياً بعد التكاليف في نفس حال السوق.
export function SaudiEntryBoard({ entry, marketReturn3m }: {
  entry: { regime: Regime; validated: ValidatedSetup[]; picks: EntryPick[]; unproven: EntryPick[] }
  marketReturn3m: number | null
}) {
  const bull = entry.regime === 'bull'
  return (
    <section className="space-y-2 rounded-2xl border-2 p-4" style={{ borderColor: bull ? `${ACCENT}55` : `${RED}55`, background: 'rgba(255,255,255,.02)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-black text-white">🎯 فرص الدخول اليوم</h2>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-black" style={{ color: bull ? ACCENT : RED, background: bull ? `${ACCENT}1a` : `${RED}1a` }}>
          السوق {bull ? 'صاعد' : 'هابط'} · {marketReturn3m != null ? `${signed(marketReturn3m)}% في ٣ أشهر` : ''}
        </span>
      </div>

      {entry.picks.length ? (
        <div className="space-y-2">{entry.picks.map(p => <PickRow key={p.symbol} p={p} proven />)}</div>
      ) : (
        <div className="rounded-xl px-3 py-2.5 text-xs leading-6" style={{ background: bull ? 'rgba(255,255,255,.03)' : `${RED}0d`, color: bull ? '#CBD5E1' : '#FECACA' }}>
          {bull
            ? 'لا إشارة دخول مثبتة اليوم. تظهر هنا فور ظهورها.'
            : 'لا دخول مثبت اليوم: في السوق الهابط خسرت كل إشارات الشراء التي اختبرناها على ١٠ سنوات بعد التكاليف. تعود إشارات «ادخل» عندما يصبح عائد السوق في ٣ أشهر موجباً.'}
        </div>
      )}

      {entry.unproven.length ? (
        <details className="group" open={!entry.picks.length}>
          <summary className="cursor-pointer text-[11px] font-bold text-amber-300/90">
            إشارات ظهرت لكنها غير مثبتة في هذا الوضع ({entry.unproven.length}) — على مسؤوليتك
          </summary>
          <div className="mt-2 space-y-2">{entry.unproven.slice(0, 10).map(p => <PickRow key={p.symbol} p={p} proven={false} />)}</div>
        </details>
      ) : null}

      <div className="text-[10px] leading-5 text-slate-500">
        الإشارات المعتمدة في {bull ? 'السوق الصاعد' : 'السوق الهابط'}: {entry.validated.length ? entry.validated.map(v => `${v.label} (${signed(v.stats.avgNetPct)}%)`).join('، ') : 'لا شيء'}.
        {' '}الخروج بوقف متحرّك: إغلاق تحت أعلى قمة ٢٢ جلسة ناقص ٣ أضعاف التذبذب.
      </div>
    </section>
  )
}
