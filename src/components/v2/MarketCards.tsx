import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MarketHoursBadge } from '@/components/v2/MarketHoursBadge'
import { MARKETS_INFO, type Market } from '@/lib/v2/markets'

// بطاقتا السوقين — تظهران قبل تسجيل الدخول فقط (الصفحة الرئيسية وصفحة الدخول).
// الأولى السوق السعودي، والثانية السوق الأمريكي.

const CARD_CONTENT: Record<Market, { eyebrow: string; description: string; features: string[] }> = {
  saudi: {
    eyebrow: 'تداول · الأسهم السعودية',
    description: 'أسهم السوق السعودي مرتّبة بقوتها الفنية، مع تحليل كامل لكل سهم ومتابعة دوران القطاعات.',
    features: ['خطة اليوم ومزاج السوق', 'تحليل كامل لكل سهم', 'دوران القطاعات', 'المفضّلة لمتابعة أسهمك'],
  },
  us: {
    eyebrow: 'الأوبشن · المؤشرات · الشركات · الصناديق',
    description: 'عقود الخيارات على المؤشرات والشركات والصناديق الأمريكية، بتوصية واضحة وخطة دخول وخروج.',
    features: ['خطة اليوم: توصية واحدة واضحة', 'المؤشرات · الشركات · الصناديق', 'متابعة الصفقة ومساعد الخروج', 'سجل عام شفاف للنتائج'],
  },
}

const ORDER: Market[] = ['saudi', 'us']

export function MarketCards({ mode, next }: { mode: 'landing' | 'login'; next?: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {ORDER.map(market => {
        const info = MARKETS_INFO[market]
        const content = CARD_CONTENT[market]
        const c = info.color
        const loginHref = `/login?market=${market}${next ? `&next=${encodeURIComponent(next)}` : ''}`
        return (
          <article key={market} className="relative flex flex-col overflow-hidden rounded-[26px] p-6 sm:p-7 text-right"
            style={{
              background: `linear-gradient(150deg, ${c}16, rgba(10,22,34,.96) 46%)`,
              border: `1px solid ${c}55`,
              boxShadow: `0 28px 80px ${c}0D`,
            }}>
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
                style={{ background: `${c}15`, border: `1px solid ${c}40` }} aria-hidden>{info.flag}</span>
              <div>
                <div className="text-[11px] font-bold" style={{ color: c }}>{content.eyebrow}</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">{info.label}</h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-7" style={{ color: '#8D9AA8' }}>{content.description}</p>
            <div className="mt-4"><MarketHoursBadge market={market} /></div>

            {mode === 'landing' ? (
              <ul className="mt-5 flex-1 space-y-2.5">
                {content.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs" style={{ color: '#93A0AE' }}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />
                    {f}
                  </li>
                ))}
              </ul>
            ) : <div className="flex-1" />}

            <Link href={loginHref} prefetch={false}
              className="mt-6 flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-black"
              style={{ color: '#060D14', background: c, border: `1px solid ${c}` }}>
              <span>{mode === 'landing' ? `الدخول إلى ${info.label}` : `متابعة إلى ${info.label}`}</span>
              <ArrowLeft size={17} />
            </Link>

            {mode === 'landing' ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <Link href={`/register?market=${market}`} className="font-bold" style={{ color: c }}>
                  حساب جديد — تجربة 7 أيام مجاناً
                </Link>
                {market === 'us' ? (
                  <Link href="/track" style={{ color: '#7F8B99' }}>السجل العام للتوصيات ←</Link>
                ) : null}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
