import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Globe2,
  Landmark,
  Layers3,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react'
import { getV2Viewer } from '@/lib/v2/access'
import type { PlatformKey } from '@/lib/v2/accessRules'
import { PLATFORM_CATALOG } from '@/lib/v2/productCatalog'
import { MarketHoursBadge } from '@/components/v2/MarketHoursBadge'
import { SaudiMoodLine } from '@/components/v2/SaudiMoodLine'

export const metadata = {
  title: 'اختر السوق — ترقّب',
}

const SAUDI_COLOR = '#16A34A'
const OPTIONS_COLOR = '#C9943A'

const OPTIONS_PLATFORMS: Array<{
  key: Exclude<PlatformKey, 'saudi'>
  name: string
  hint: string
  route: string
  color: string
  Icon: typeof BarChart3
}> = [
  { key: 'spx', name: 'المؤشرات', hint: 'SPX وNDX — قرار اليوم وخطة العقد', route: '/v2', color: '#C9943A', Icon: BarChart3 },
  { key: 'stocks', name: 'الشركات', hint: 'ماسح الشركات الأمريكية وعقودها', route: '/stocks', color: '#60A5FA', Icon: Building2 },
  { key: 'funds', name: 'الصناديق', hint: 'صناديق القطاعات ودوران الأموال', route: '/funds', color: '#26D07C', Icon: Layers3 },
]

const SAUDI_FEATURES = [
  'خطة اليوم: مزاج السوق والأسهم مرتّبة بقوتها',
  'تحليل كامل لكل سهم: الاتجاه والقوة النسبية والوقف المقترح',
  'دوران القطاعات: أين تتجه السيولة اليوم',
  'المفضّلة لمتابعة أسهمك',
]

function AccessPill({ allowed }: { allowed: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{
        color: allowed ? '#8CE0B0' : '#A1AAB5',
        background: allowed ? 'rgba(38,208,124,.08)' : 'rgba(255,255,255,.04)',
        border: `1px solid ${allowed ? 'rgba(38,208,124,.24)' : 'rgba(255,255,255,.08)'}`,
      }}>
      {allowed ? <CheckCircle2 size={12} /> : <LockKeyhole size={12} />}
      {allowed ? 'مشمول في اشتراكك' : 'يحتاج اشتراكاً'}
    </div>
  )
}

export default async function PlatformsPage({
  searchParams,
}: {
  searchParams?: Promise<{ locked?: string }>
}) {
  const viewer = await getV2Viewer()
  if (!viewer) redirect('/login?next=/platforms')
  if (!viewer.profile || viewer.profile.is_active === false) redirect('/login?error=inactive')

  const query = await searchParams
  const access = viewer.platformAccess
  const saudiOk = access.saudi
  const optionsAllowed = OPTIONS_PLATFORMS.filter(p => access[p.key])
  const optionsOk = optionsAllowed.length > 0
  const markets = (saudiOk ? 1 : 0) + (optionsOk ? 1 : 0)
  const accessLabel = markets === 2 ? 'السوقان' : markets === 1 ? 'سوق واحد' : 'بدون اشتراك'
  const lockedName = PLATFORM_CATALOG.find(p => p.key === query?.locked)?.label

  return (
    <main className="min-h-screen overflow-hidden px-5 py-7 sm:px-8 lg:px-12" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 85% 0%, rgba(22,163,74,.10), transparent 30%), radial-gradient(circle at 15% 85%, rgba(201,148,58,.09), transparent 32%)',
        }} />

      <div className="relative max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-10">
          <Link href="/?preview=1" className="flex items-center gap-3">
            <Image src="/logo.png" alt="ترقّب" width={42} height={42} priority className="w-11 h-11 object-contain" />
            <div>
              <div className="text-white font-black tracking-wider">ترقّب</div>
              <div className="text-[11px] font-mono tracking-[.18em]" style={{ color: '#C9943A' }}>اختر السوق</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
              style={{ color: '#A7B2BF', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.025)' }}>
              <ShieldCheck size={14} color="#26D07C" />
              اشتراكك: {accessLabel}
            </div>
            <Link href="/auth/signout" className="text-xs px-3 py-2 rounded-lg"
              style={{ color: '#8492A2', border: '1px solid rgba(255,255,255,.07)' }}>
              خروج
            </Link>
          </div>
        </header>

        <section className="mb-8">
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
            أهلاً {viewer.displayName.split(' ')[0]}
            <span className="block mt-2" style={{ color: '#8D9AA8' }}>أي سوق تتابع اليوم؟</span>
          </h1>
        </section>

        {lockedName ? (
          <div className="mb-6 rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
            style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.28)', color: '#F3C76A' }}>
            <LockKeyhole size={17} />
            منصة {lockedName} ليست ضمن اشتراكك الحالي — يمكنك إضافتها من صفحة الباقات.
          </div>
        ) : null}

        <section className="grid lg:grid-cols-2 gap-5">
          {/* ── البطاقة الأولى: السوق السعودي (سهم 305) ── */}
          <article className="relative rounded-[26px] p-6 sm:p-7 flex flex-col overflow-hidden"
            style={{
              background: saudiOk
                ? `linear-gradient(150deg, ${SAUDI_COLOR}16, rgba(10,22,34,.96) 45%)`
                : 'linear-gradient(150deg, rgba(255,255,255,.025), rgba(8,16,26,.96))',
              border: `1px solid ${saudiOk ? `${SAUDI_COLOR}60` : 'rgba(255,255,255,.08)'}`,
              boxShadow: saudiOk ? `0 28px 80px ${SAUDI_COLOR}10` : 'none',
            }}>
            <div className="flex items-start justify-between gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ color: SAUDI_COLOR, background: `${SAUDI_COLOR}15`, border: `1px solid ${SAUDI_COLOR}40` }}>
                <Landmark size={26} />
              </div>
              <AccessPill allowed={saudiOk} />
            </div>

            <div className="mt-6">
              <div className="text-[11px] font-mono tracking-[.16em] mb-2" style={{ color: SAUDI_COLOR }}>سهم 305 · تداول 🇸🇦</div>
              <h2 className="text-3xl font-black text-white mb-3">السوق السعودي</h2>
              <p className="text-sm leading-7" style={{ color: saudiOk ? '#8D9AA8' : '#6E7884' }}>
                أسهم تداول مرتّبة بقوتها الفنية بأسلوب كبار المتداولين، مع تحليل كامل لكل سهم.
              </p>
            </div>

            <div className="mt-5"><MarketHoursBadge market="saudi" /></div>
            {saudiOk ? <div className="mt-3"><SaudiMoodLine /></div> : null}

            <ul className="mt-5 space-y-2.5 flex-1">
              {SAUDI_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2 text-xs" style={{ color: '#93A0AE' }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SAUDI_COLOR }} />
                  {f}
                </li>
              ))}
            </ul>

            <Link href={saudiOk ? '/saudi' : '/v2/upgrade?platform=saudi'} prefetch={false}
              className="mt-7 flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-black"
              style={{ color: saudiOk ? '#04140A' : SAUDI_COLOR, background: saudiOk ? SAUDI_COLOR : `${SAUDI_COLOR}14`, border: `1px solid ${SAUDI_COLOR}45` }}>
              <span>{saudiOk ? 'دخول السوق السعودي' : 'أضِف السوق السعودي لاشتراكك'}</span>
              {saudiOk ? <ArrowLeft size={17} /> : <LockKeyhole size={16} />}
            </Link>
          </article>

          {/* ── البطاقة الثانية: الأوبشن الأمريكي ── */}
          <article className="relative rounded-[26px] p-6 sm:p-7 flex flex-col overflow-hidden"
            style={{
              background: optionsOk
                ? `linear-gradient(150deg, ${OPTIONS_COLOR}14, rgba(10,22,34,.96) 45%)`
                : 'linear-gradient(150deg, rgba(255,255,255,.025), rgba(8,16,26,.96))',
              border: `1px solid ${optionsOk ? `${OPTIONS_COLOR}55` : 'rgba(255,255,255,.08)'}`,
              boxShadow: optionsOk ? `0 28px 80px ${OPTIONS_COLOR}0D` : 'none',
            }}>
            <div className="flex items-start justify-between gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ color: OPTIONS_COLOR, background: `${OPTIONS_COLOR}15`, border: `1px solid ${OPTIONS_COLOR}40` }}>
                <Globe2 size={26} />
              </div>
              <AccessPill allowed={optionsOk} />
            </div>

            <div className="mt-6">
              <div className="text-[11px] font-mono tracking-[.16em] mb-2" style={{ color: OPTIONS_COLOR }}>ترقّب · خيارات أمريكية 🇺🇸</div>
              <h2 className="text-3xl font-black text-white mb-3">الأوبشن الأمريكي</h2>
              <p className="text-sm leading-7" style={{ color: optionsOk ? '#8D9AA8' : '#6E7884' }}>
                عقود الخيارات على المؤشرات والشركات والصناديق الأمريكية، بتوصية واضحة وخطة دخول وخروج.
              </p>
            </div>

            <div className="mt-5"><MarketHoursBadge market="us" /></div>

            <div className="mt-5 space-y-2 flex-1">
              {OPTIONS_PLATFORMS.map(({ key, name, hint, route, color, Icon }) => {
                const ok = access[key]
                return (
                  <Link key={key} href={ok ? route : `/v2/upgrade?platform=${key}`} prefetch={false}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[.04]"
                    style={{ border: '1px solid rgba(255,255,255,.06)', opacity: ok ? 1 : 0.55 }}>
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ color, background: `${color}14` }}><Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">{name}</span>
                      <span className="block text-[11px] truncate" style={{ color: '#7F8B99' }}>{hint}</span>
                    </span>
                    {ok ? <ArrowLeft size={15} color="#7F8B99" /> : <LockKeyhole size={14} color="#7F8B99" />}
                  </Link>
                )
              })}
            </div>

            <Link href={optionsAllowed[0]?.route ?? '/v2/upgrade?platform=spx'} prefetch={false}
              className="mt-7 flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-black"
              style={{ color: optionsOk ? '#120C02' : OPTIONS_COLOR, background: optionsOk ? OPTIONS_COLOR : `${OPTIONS_COLOR}14`, border: `1px solid ${OPTIONS_COLOR}45` }}>
              <span>{optionsOk ? 'دخول الأوبشن الأمريكي' : 'أضِف الأوبشن الأمريكي لاشتراكك'}</span>
              {optionsOk ? <ArrowLeft size={17} /> : <LockKeyhole size={16} />}
            </Link>
          </article>
        </section>

        {markets < 2 ? (
          <section className="mt-7 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{ background: 'rgba(167,139,250,.055)', border: '1px solid rgba(167,139,250,.18)' }}>
            <div>
              <div className="text-sm font-black text-white">تريد السوقين معاً؟</div>
              <div className="text-xs mt-1" style={{ color: '#7F8B99' }}>
                باقة «احترافية» تفتح السوق السعودي والأوبشن الأمريكي في اشتراك واحد.
              </div>
            </div>
            <Link href="/v2/upgrade" className="rounded-xl px-5 py-2.5 text-xs font-black"
              style={{ color: '#CFC4FF', background: 'rgba(167,139,250,.12)', border: '1px solid rgba(167,139,250,.35)' }}>
              استعرض الباقات
            </Link>
          </section>
        ) : null}
      </div>
    </main>
  )
}
