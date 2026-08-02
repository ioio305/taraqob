import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Layers3,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react'
import { getV2Viewer } from '@/lib/v2/access'
import { accessPackageLabel, type PlatformKey } from '@/lib/v2/accessRules'

export const metadata = {
  title: 'منصّاتي — ترقّب',
}

const PLATFORM_CARDS: Array<{
  key: PlatformKey
  name: string
  eyebrow: string
  description: string
  route: string
  color: string
  Icon: typeof BarChart3
  features: string[]
}> = [
  {
    key: 'spx',
    name: 'المؤشرات',
    eyebrow: 'SPX · NDX · SPY · QQQ',
    description: 'توصية مركّزة على المؤشرات الكبرى، مع خطة دخول وأهداف ووقف ومتابعة للعقد.',
    route: '/v2',
    color: '#C9943A',
    Icon: BarChart3,
    features: ['قرار اليوم', 'الشارت الذكي', 'الإشارات ومساعد الخروج'],
  },
  {
    key: 'stocks',
    name: 'الشركات',
    eyebrow: 'فرص الشركات',
    description: 'ماسح للشركات الأمريكية وتحليل فني وأخبار وأرباح واختيار عقودها.',
    route: '/stocks',
    color: '#60A5FA',
    Icon: Building2,
    features: ['ماسح الشركات', 'تحليل الشركة', 'الأرباح والتدفقات'],
  },
  {
    key: 'funds',
    name: 'الصناديق',
    eyebrow: 'القطاعات والتنويع',
    description: 'خيارات صناديق القطاعات والأسواق مع رصد دوران الأموال والقوة النسبية.',
    route: '/funds',
    color: '#26D07C',
    Icon: Layers3,
    features: ['فرص ETF', 'دوران القطاعات', 'تحليل عقود الصندوق'],
  },
]

export default async function PlatformsPage({
  searchParams,
}: {
  searchParams?: Promise<{ locked?: string }>
}) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login?next=/platforms')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')

  const query = await searchParams
  const packageLabel = accessPackageLabel(viewer.platformAccess)
  const lockedName = PLATFORM_CARDS.find(item => item.key === query?.locked)?.name

  return (
    <main className="min-h-screen overflow-hidden px-5 py-7 sm:px-8 lg:px-12" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 85% 0%, rgba(201,148,58,.10), transparent 28%), radial-gradient(circle at 15% 85%, rgba(96,165,250,.08), transparent 30%)',
        }} />

      <div className="relative max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-12">
          <Link href="/?preview=1" className="flex items-center gap-3">
            <Image src="/logo.png" alt="ترقّب" width={42} height={42} priority className="w-11 h-11 object-contain" />
            <div>
              <div className="text-white font-black tracking-wider">ترقّب</div>
              <div className="text-[11px] font-mono tracking-[.18em]" style={{ color: '#C9943A' }}>منصّاتي</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
              style={{ color: '#A7B2BF', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.025)' }}>
              <ShieldCheck size={14} color="#26D07C" />
              اشتراكك: {packageLabel}
            </div>
            <Link href="/auth/signout" className="text-xs px-3 py-2 rounded-lg"
              style={{ color: '#8492A2', border: '1px solid rgba(255,255,255,.07)' }}>
              خروج
            </Link>
          </div>
        </header>

        <section className="mb-9">
          <div className="text-xs font-mono mb-3 tracking-[.2em]" style={{ color: '#C9943A' }}>بوابة القرار</div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
                أهلاً {viewer.displayName.split(' ')[0]}
                <span className="block mt-2" style={{ color: '#8D9AA8' }}>اختر السوق الذي تريد متابعته اليوم</span>
              </h1>
            </div>
            <p className="text-sm leading-7 max-w-md" style={{ color: '#718093' }}>
              كل منصة منتج مستقل باشتراكه وأدواته. تبقى المنصات الأخرى أمامك لتعرف ما يمكن فتحه
              عند إضافة منصة ثانية أو الترقية إلى الباقة الشاملة.
            </p>
          </div>
        </section>

        {lockedName ? (
          <div className="mb-6 rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
            style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.28)', color: '#F3C76A' }}>
            <LockKeyhole size={17} />
            منصة {lockedName} ليست ضمن اشتراكك الحالي. يمكنك إضافتها منفردة أو اختيار اشتراك منصتين أو الشامل.
          </div>
        ) : null}

        <section className="grid lg:grid-cols-3 gap-5">
          {PLATFORM_CARDS.map(({ key, name, eyebrow, description, route, color, Icon, features }) => {
            const allowed = viewer.platformAccess[key]
            return (
              <article key={key} className="relative rounded-[24px] p-6 min-h-[410px] flex flex-col overflow-hidden"
                style={{
                  background: allowed
                    ? `linear-gradient(150deg, ${color}12, rgba(10,22,34,.96) 42%)`
                    : 'linear-gradient(150deg, rgba(255,255,255,.025), rgba(8,16,26,.96))',
                  border: `1px solid ${allowed ? `${color}55` : 'rgba(255,255,255,.08)'}`,
                  boxShadow: allowed ? `0 28px 80px ${color}0D` : 'none',
                }}>
                {!allowed ? (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: 'rgba(4,9,14,.34)', backdropFilter: 'grayscale(1)' }} />
                ) : null}

                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ color, background: `${color}13`, border: `1px solid ${color}35` }}>
                    <Icon size={24} />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      color: allowed ? '#8CE0B0' : '#A1AAB5',
                      background: allowed ? 'rgba(38,208,124,.08)' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${allowed ? 'rgba(38,208,124,.24)' : 'rgba(255,255,255,.08)'}`,
                    }}>
                    {allowed ? <CheckCircle2 size={12} /> : <LockKeyhole size={12} />}
                    {allowed ? 'مشمولة في اشتراكك' : 'تحتاج اشتراكًا'}
                  </div>
                </div>

                <div className="relative z-10 mt-7">
                  <div className="text-[11px] font-mono tracking-[.16em] mb-2" style={{ color }}>{eyebrow}</div>
                  <h2 className="text-2xl font-black text-white mb-3">{name}</h2>
                  <p className="text-sm leading-7 min-h-[84px]" style={{ color: allowed ? '#8D9AA8' : '#6E7884' }}>
                    {description}
                  </p>
                </div>

                <ul className="relative z-10 mt-6 space-y-3 flex-1">
                  {features.map(feature => (
                    <li key={feature} className="flex items-center gap-2 text-xs" style={{ color: '#93A0AE' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href={allowed ? route : `/v2/upgrade?platform=${key}`}
                  prefetch={false}
                  aria-label={allowed ? `دخول منصة ${name}` : `اشترك لفتح منصة ${name}`}
                  className="relative z-10 mt-7 flex items-center justify-between rounded-xl px-4 py-3 text-sm font-black"
                  style={{
                    color: allowed ? '#071018' : color,
                    background: allowed ? color : `${color}12`,
                    border: `1px solid ${color}40`,
                  }}>
                  <span>{allowed ? 'دخول المنصة' : 'أضفها إلى اشتراكك'}</span>
                  {allowed ? <ArrowLeft size={17} /> : <LockKeyhole size={16} />}
                </Link>
              </article>
            )
          })}
        </section>

        <section className="mt-7 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ background: 'rgba(167,139,250,.055)', border: '1px solid rgba(167,139,250,.18)' }}>
          <div>
            <div className="text-sm font-black text-white">تريد رؤية السوق كاملًا؟</div>
            <div className="text-xs mt-1" style={{ color: '#7F8B99' }}>
              اختر أي منصتين معًا، أو افتح الشامل للوصول إلى المنصات الثلاث وذكاء الربط بينها.
            </div>
          </div>
          <Link href="/v2/upgrade?bundle=all" className="rounded-xl px-5 py-2.5 text-xs font-black"
            style={{ color: '#CFC4FF', background: 'rgba(167,139,250,.12)', border: '1px solid rgba(167,139,250,.35)' }}>
            استعرض الاشتراكات
          </Link>
        </section>
      </div>
    </main>
  )
}
