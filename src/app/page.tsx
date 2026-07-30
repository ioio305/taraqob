import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { HomepageNewsBar } from '@/components/HomepageNewsBar'
import { LiveTeaser } from '@/components/LiveTeaser'
import { AssistantWidget } from '@/components/v2/AssistantWidget'
import { NewsletterBox } from '@/components/NewsletterBox'
import { PLATFORMS } from '@/lib/v2/adapters/registry'
import { SUBSCRIPTION_BUNDLES } from '@/lib/v2/subscriptionBundles'

export default async function RootPage({ searchParams }: { searchParams?: Promise<{ preview?: string }> }) {
  const query = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ?preview=1 يسمح للمسجّلين برؤية الصفحة التعريفية دون إعادة توجيه
  if (user && query?.preview !== '1') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()
    if (!profile || profile.is_active === false) redirect('/login?error=inactive')
    redirect('/platforms')
  }

  return (
    <div className="min-h-screen overflow-x-hidden" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* ── Ambient glow background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: '60vw', height: '60vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,148,58,0.04) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', left: '-15%',
          width: '70vw', height: '70vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(96,165,250,0.03) 0%, transparent 70%)',
        }} />
      </div>

      {/* ── Header ── */}
      <header className="relative z-50 flex items-center justify-between px-6 sm:px-10 h-16"
        style={{
          background: 'rgba(6,13,20,0.92)',
          borderBottom: '1px solid rgba(201,148,58,0.1)',
          backdropFilter: 'blur(16px)',
          position: 'sticky', top: 0,
        }}>
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="ترقّب" width={36} height={36} priority className="w-9 h-9 object-contain shrink-0" />
          <div>
            <div className="font-bold text-white text-sm tracking-widest">ترقّب</div>
            <div className="text-xs font-mono hidden sm:block"
              style={{ color: '#C9943A', letterSpacing: '0.12em' }}>TARAQOB PRO</div>
          </div>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/how-it-works"
            className="text-sm transition-colors hidden sm:block"
            style={{ color: '#7C8A99' }}>
            كيف يعمل
          </Link>
          <Link href="/compliance"
            className="text-sm transition-colors hidden sm:block"
            style={{ color: '#7C8A99' }}>
            الإفصاح
          </Link>
          <Link href={user ? '/platforms' : '/login'}
            className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {user ? 'منصّاتي' : 'تسجيل الدخول'}
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">

        {/* Platform badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono mb-8"
          style={{
            background: 'rgba(201,148,58,0.08)',
            border: '1px solid rgba(201,148,58,0.2)',
            color: '#C9943A',
          }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#C9943A' }} />
          بيانات فعلية · سجل عام مفتوح · لا تنفيذ بلا تحقق
        </div>

        {/* شريط حيّ — إثبات أن المنصة تعمل بأسعار فعلية الآن */}
        <div><LiveTeaser /></div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          قرارات أوضح في
          {' '}
          <span style={{
            background: 'linear-gradient(135deg,#C9943A,#F0C060,#C9943A)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundSize: '200% 100%',
          }}>
            سوقك الذي تختاره
          </span>
        </h1>

        <p className="text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
          style={{ color: '#64748B' }}>
          توصية واضحة أولاً، ثم التحليل وخطة الدخول والهدف والوقف.
          اختر منصة SPX أو الشركات أو الصناديق، وادفع فقط مقابل ما تستخدمه.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-20">
          <Link href={user ? '/platforms' : '/register'}
            className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold transition-all"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {user ? 'افتح بوابة منصّاتك ←' : 'ابدأ واختر منصتك ←'}
          </Link>
          <Link href="/track"
            className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-medium transition-all"
            style={{
              background: 'rgba(38,208,124,0.06)',
              border: '1px solid rgba(38,208,124,0.25)',
              color: '#26D07C',
            }}>
            📜 شاهد السجل العام — بلا تسجيل
          </Link>
        </div>

        {/* ── Terminal Preview ── */}
        <div className="max-w-3xl mx-auto text-right" dir="ltr">
          <div className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(8,16,26,0.95)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,148,58,0.05)',
            }}>
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3"
              style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="w-3 h-3 rounded-full" style={{ background: '#FF5F57' }} />
              <span className="w-3 h-3 rounded-full" style={{ background: '#FEBC2E' }} />
              <span className="w-3 h-3 rounded-full" style={{ background: '#28C840' }} />
              <span className="text-xs font-mono mx-auto" style={{ color: '#6B7B8D' }}>
                TARAQOB PRO — الداشبورد
              </span>
            </div>

            {/* Mock dashboard content */}
            <div className="p-5 space-y-4">

              {/* Status bar */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
                  <span style={{ color: '#10B981' }}>▲ صاعد — Call فقط</span>
                </div>
                <span style={{ color: '#6B7B8D' }}>·</span>
                <span style={{ color: '#7C8A99' }}>SPX <span style={{ color: 'white' }}>7,376</span></span>
                <span style={{ color: '#7C8A99' }}>VIX <span style={{ color: '#10B981' }}>17.2</span></span>
                <span style={{ color: '#7C8A99' }}>EM <span style={{ color: '#C9943A' }}>±80</span></span>
              </div>

              {/* Mock contract card */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(201,148,58,0.25)' }}>
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: 'rgba(201,148,58,0.08)', borderBottom: '1px solid rgba(201,148,58,0.15)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(201,148,58,0.2)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.4)' }}>
                      الأفضل
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                      ▲ CALL OTM
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-mono">
                    <span style={{ color: '#7C8A99' }}>0DTE · Spread 7.4%</span>
                    <span className="text-white font-bold">7,460</span>
                  </div>
                </div>
                <div className="p-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { l: 'Bid', v: '$3.90', hl: false },
                      { l: 'Mid', v: '$4.20', hl: true },
                      { l: 'Ask', v: '$4.50', hl: false },
                    ].map(b => (
                      <div key={b.l} className="rounded-lg p-2.5 text-center"
                        style={b.hl
                          ? { background: 'rgba(201,148,58,0.1)', border: '1px solid rgba(201,148,58,0.3)' }
                          : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="text-xs mb-1 font-mono" style={{ color: '#6B7B8D' }}>{b.l}</div>
                        <div className="font-bold font-mono" style={{ color: b.hl ? '#C9943A' : 'white' }}>{b.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { l: '◎ هدف ١ — EM ×33%', v: 'SPX 7,402', c: '#10B981', bg: 'rgba(16,185,129,0.08)' },
                      { l: '◎ هدف ٢ — EM ×50%', v: 'SPX 7,416', c: '#C9943A', bg: 'rgba(201,148,58,0.08)' },
                      { l: '◎ هدف ٣ — EM كامل', v: 'SPX 7,456', c: '#60A5FA', bg: 'rgba(96,165,250,0.08)' },
                      { l: '⊘ وقف الخسارة',      v: 'SPX 7,340', c: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
                    ].map(t => (
                      <div key={t.l} className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{ background: t.bg, border: `1px solid ${t.c}25` }}>
                        <span className="text-xs font-semibold font-mono" style={{ color: t.c }}>{t.l}</span>
                        <span className="text-xs font-bold font-mono" style={{ color: t.c }}>{t.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mock score bar */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <span style={{ color: '#7C8A99' }}>Decision Score</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full rounded-full" style={{ width: '76%', background: 'linear-gradient(90deg,#C9943A,#10B981)' }} />
                </div>
                <span className="font-bold" style={{ color: '#10B981' }}>76/100</span>
                <span className="px-2 py-0.5 rounded font-bold"
                  style={{ background: 'rgba(201,148,58,0.1)', color: '#C9943A', border: '1px solid rgba(201,148,58,0.2)' }}>
                  فرصة مشروطة
                </span>
              </div>
            </div>
          </div>
          {/* Glass reflection */}
          <div className="h-12 rounded-b-2xl mx-8"
            style={{
              background: 'linear-gradient(180deg, rgba(8,16,26,0.15) 0%, transparent 100%)',
              transform: 'scaleY(-1) scaleX(0.96)',
              opacity: 0.3,
              marginTop: -2,
              filter: 'blur(4px)',
            }} />
        </div>
      </section>

      {/* ── منصات ترقّب الثلاث ── */}
      <section className="max-w-5xl mx-auto px-6 pb-4">
        <div className="text-center mb-8">
          <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#C9943A' }}>منصّات ترقّب</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">ثلاث منصّات مستقلة · حساب واحد</h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: '#7C8A99' }}>
            اشترك فيما تحتاجه فقط، واجمع أي منصتين، أو اختر الشامل للوصول إلى السوق كاملًا.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLATFORMS.map(p => {
            const available = p.status === 'available'
            const card = (
              <div className="rounded-2xl p-6 h-full flex flex-col transition-all"
                style={{
                  background: `linear-gradient(160deg, ${p.color}08 0%, rgba(13,27,42,0.9) 100%)`,
                  border: `1px solid ${p.color}${available ? '35' : '18'}`,
                  opacity: available ? 1 : 0.75,
                }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{p.icon}</span>
                  {available ? (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full font-bold"
                      style={{ background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}40` }}>
                      {p.key === 'spx' ? 'موثّقة ومُعايرة' : 'متاحة للمراقبة'}
                    </span>
                  ) : (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.04)', color: '#7C8A99', border: '1px solid rgba(255,255,255,0.08)' }}>
                      قريباً
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold text-white mb-2 leading-tight">{p.label}</div>
                <div className="text-sm leading-relaxed flex-1" style={{ color: '#7C8A99' }}>{p.tagline}</div>
                <div className="mt-4 text-sm font-bold flex items-center gap-1"
                  style={{ color: available ? p.color : '#6B7B8D' }}>
                  {available ? 'ادخل المنصة ←' : 'قيد التطوير'}
                </div>
              </div>
            )
            return available
              ? <Link key={p.key} href={user ? '/platforms' : `/register?platform=${p.key}`}>{card}</Link>
              : <div key={p.key}>{card}</div>
          })}
        </div>
      </section>

      {/* ── Market News Status ── */}
      <section className="max-w-4xl mx-auto px-6 pb-8">
        <div className="text-xs font-mono mb-2 text-center" style={{ color: '#6B7B8D' }}>
          حالة السوق الآن
        </div>
        <HomepageNewsBar />
      </section>

      {/* ── Stats Bar ── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(13,27,42,0.5)' }}>
        <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { v: '3',    l: 'منصات مستقلة بحساب واحد' },
            { v: '1',    l: 'توصية رئيسية واضحة' },
            { v: '100%', l: 'من الخطط لها هدف ووقف' },
            { v: '7',    l: 'أيام تجربة كاملة' },
          ].map(s => (
            <div key={s.l}>
              <div className="text-3xl font-bold font-mono mb-1" style={{ color: '#C9943A' }}>{s.v}</div>
              <div className="text-xs font-mono" style={{ color: '#6B7B8D' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#C9943A' }}>
            الميزات الأساسية
          </div>
          <h2 className="text-3xl font-bold text-white">
            من التوصية إلى إدارة الصفقة
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: '📋', color: '#C9943A',
              title: 'التوصية أولاً',
              desc: 'افتح المنصة فترى القرار الأقوى مباشرة، دون البحث بين عشرات الشاشات.',
            },
            {
              icon: '🛡️', color: '#10B981',
              title: 'بوابات حماية',
              desc: 'السوق المغلق والبيانات الضعيفة والأخبار والأرباح القريبة تمنع التوصية من التحول إلى دخول.',
            },
            {
              icon: '🟢', color: '#60A5FA',
              title: 'خطة قابلة للتنفيذ',
              desc: 'العقد والدخول والهدف والوقف وحجم المخاطرة في عرض واحد واضح.',
            },
            {
              icon: '📜', color: '#26D07C',
              title: 'سجل عام شفاف',
              desc: 'راجع نتائج الإشارات المفتوحة والمغلقة دون تسجيل، واحكم بالأرقام.',
            },
            {
              icon: '📡', color: '#A78BFA',
              title: 'رصد متكامل',
              desc: 'السوق والقطاع والسهم والعقد تُقرأ معًا قبل ترتيب الفرص.',
            },
            {
              icon: '🎮', color: '#C9943A',
              title: 'تجربة قبل المخاطرة',
              desc: 'اختبر الخطة بالمحفظة التجريبية وسجل الصفقات قبل استخدام مال حقيقي.',
            },
          ].map(f => (
            <div key={f.title} className="rounded-2xl p-6 transition-all group"
              style={{
                background: 'rgba(13,27,42,0.7)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
              <div className="text-2xl mb-4" style={{ color: f.color }}>{f.icon}</div>
              <div className="text-base font-bold text-white mb-2 leading-tight">{f.title}</div>
              <div className="text-sm leading-relaxed" style={{ color: '#7C8A99' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: 'rgba(13,27,42,0.4)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-4xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#C9943A' }}>آلية العمل</div>
            <h2 className="text-3xl font-bold text-white">من البيانات إلى القرار في ثوانٍ</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'نرصد السوق',
                desc: 'نجمع السعر والاتجاه والتذبذب والأحداث وجودة العقود.',
                color: '#C9943A',
              },
              {
                step: '02',
                title: 'نستبعد الضعيف',
                desc: 'تُرفض البيانات المتأخرة والعقود الرديئة والفرص عالية المخاطرة.',
                color: '#60A5FA',
              },
              {
                step: '03',
                title: 'نعرض القرار',
                desc: 'توصية واحدة مع العقد والدخول والهدف والوقف وسبب القرار.',
                color: '#10B981',
              },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center text-xl font-bold font-mono mb-5"
                  style={{ background: `${s.color}12`, border: `1px solid ${s.color}30`, color: s.color }}>
                  {s.step}
                </div>
                <div className="text-base font-bold text-white mb-2">{s.title}</div>
                <div className="text-sm leading-relaxed" style={{ color: '#7C8A99' }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── الباقات الواضحة ── */}
      <section id="plans" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#C9943A' }}>الباقات</div>
          <h2 className="text-3xl font-bold text-white mb-3">اشتراكك على مقاس تداولك</h2>
          <p className="text-sm" style={{ color: '#7C8A99' }}>أربع باقات مباشرة. اختر ما يناسب تداولك.</p>
          <p className="text-sm mt-2 font-bold" style={{ color: '#26D07C' }}>
            🎁 كل حساب جديد يبدأ بتجربة 7 أيام كاملة الميزات — وكل صديق تدعوه يهديك أسبوعاً إضافياً
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SUBSCRIPTION_BUNDLES.map(bundle => (
            <div key={bundle.key} className="rounded-2xl p-5 flex flex-col relative"
              style={{
                background: `linear-gradient(150deg, ${bundle.color}0D, rgba(13,27,42,.9) 55%)`,
                border: `1px solid ${bundle.color}35`,
              }}>
              {bundle.badge && (
                <div className="absolute -top-3 right-4 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold"
                  style={{ background: bundle.color, color: '#060D14' }}>
                  {bundle.badge}
                </div>
              )}
              <div className="text-xs font-mono mb-2" style={{ color: bundle.color }}>{bundle.label}</div>
              <h3 className="text-xl font-black text-white">{bundle.platformCount === 3 ? 'المنصات الثلاث' : bundle.platformCount === 2 ? 'أي منصتين' : 'منصة واحدة'}</h3>
              <p className="mt-2 min-h-[58px] text-xs leading-6" style={{ color: '#7C8A99' }}>{bundle.description}</p>
              <ul className="mt-4 space-y-2 flex-1 mb-5">
                {bundle.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 shrink-0" style={{ color: bundle.color }}>✓</span>
                    <span style={{ color: '#64748B' }}>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href={user ? `/v2/upgrade?plan=${bundle.key}` : `/register?plan=${bundle.key}`}
                className="block text-center py-2.5 rounded-xl text-sm font-bold"
                style={{ background: `${bundle.color}14`, border: `1px solid ${bundle.color}30`, color: bundle.color }}>
                {bundle.key === 'radar' ? 'ابدأ مجانًا' : 'اختر الباقة'}
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-5 text-center text-xs" style={{ color: '#55657A' }}>الدفع مؤجل حاليًا. ستظهر الأسعار بالريال شاملة الضريبة قبل تفعيل الفوترة.</div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-6"
          style={{ background: 'rgba(38,208,124,0.08)', border: '1px solid rgba(38,208,124,0.25)', color: '#26D07C' }}>
          🎁 7 أيام كاملة الميزات — مجاناً
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
          جرّبها بنفسك — والسجل العام حَكَمنا
        </h2>
        <p className="text-base mb-10 max-w-md mx-auto" style={{ color: '#7C8A99' }}>
          اختر منصتك، تابع التوصية بالمحفظة التجريبية، وقارن النتيجة بالسجل العام.
        </p>
        <Link href={user ? '/platforms' : '/register'}
          className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-base font-bold transition-all"
          style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
          {user ? 'العودة إلى منصتك ←' : 'ابدأ تجربتك المجانية ←'}
        </Link>
      </section>

      {/* ── النشرة الأسبوعية ── */}
      {!user && <NewsletterBox />}

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ترقّب" width={24} height={24} className="w-6 h-6 object-contain" />
            <span className="text-sm font-bold text-white">ترقّب</span>
            <span className="text-xs font-mono" style={{ color: '#55657A' }}>TARAQOB PRO</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/track"        className="text-xs" style={{ color: '#6B7B8D' }}>السجل العام</Link>
            <Link href="/how-it-works" className="text-xs" style={{ color: '#6B7B8D' }}>كيف يعمل</Link>
            <Link href="/compliance"   className="text-xs" style={{ color: '#6B7B8D' }}>الإفصاح والمخاطر</Link>
            <Link href="/login"        className="text-xs" style={{ color: '#6B7B8D' }}>تسجيل الدخول</Link>
          </div>
          <div className="text-xs font-mono" style={{ color: '#55657A' }}>
            بيانات السوق قد تكون مؤخرة أو تقديرية · ليست توصيات استثمارية
          </div>
        </div>
      </footer>

      {/* مساعد ترقّب: محادثة ذكية تعرّف بالقيمة وتصطاد المهتمين بلطف */}
      <AssistantWidget context="visitor" />
    </div>
  )
}
