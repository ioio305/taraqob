import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HomepageNewsBar } from '@/components/HomepageNewsBar'

export default async function RootPage({ searchParams }: { searchParams?: { preview?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ?preview=1 يسمح للمسجّلين برؤية الصفحة التعريفية دون إعادة توجيه
  if (user && searchParams?.preview !== '1') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()
    if (!profile || profile.is_active === false) redirect('/login?error=inactive')
    if (['admin', 'moderator'].includes(profile.role)) redirect('/v2/admin')
    redirect('/v2')
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
          <img src="/logo.png" alt="ترقّب" className="w-9 h-9 object-contain shrink-0" />
          <div>
            <div className="font-bold text-white text-sm tracking-widest">ترقّب</div>
            <div className="text-xs font-mono hidden sm:block"
              style={{ color: '#C9943A', letterSpacing: '0.12em' }}>TARAQOB PRO</div>
          </div>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/how-it-works"
            className="text-sm transition-colors hidden sm:block"
            style={{ color: '#4A5568' }}>
            كيف يعمل
          </Link>
          <Link href="/compliance"
            className="text-sm transition-colors hidden sm:block"
            style={{ color: '#4A5568' }}>
            الإفصاح
          </Link>
          <Link href="/login"
            className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            تسجيل الدخول
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
          نظام تحليل عقود SPX المطوّر · بيانات Tradier الحية
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          تداول
          {' '}
          <span style={{
            background: 'linear-gradient(135deg,#C9943A,#F0C060,#C9943A)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundSize: '200% 100%',
          }}>
            SPX Options
          </span>
          {' '}
          كالمحترفين
        </h1>

        <p className="text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
          style={{ color: '#64748B' }}>
          منصة تحليلية متكاملة تجلب بيانات Tradier الحية وتحللها بـ 7 محركات ذكية
          لتقديم قرار واضح بدرجة من 100 — مصممة خصيصاً للمحترفين في 0DTE و 1DTE
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-20">
          <Link href="/login"
            className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold transition-all"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            ابدأ التداول ←
          </Link>
          <Link href="/how-it-works"
            className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94A3B8',
            }}>
            كيف يعمل النظام
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
              <span className="text-xs font-mono mx-auto" style={{ color: '#2D3748' }}>
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
                <span style={{ color: '#2D3748' }}>·</span>
                <span style={{ color: '#4A5568' }}>SPX <span style={{ color: 'white' }}>7,376</span></span>
                <span style={{ color: '#4A5568' }}>VIX <span style={{ color: '#10B981' }}>17.2</span></span>
                <span style={{ color: '#4A5568' }}>EM <span style={{ color: '#C9943A' }}>±80</span></span>
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
                    <span style={{ color: '#4A5568' }}>0DTE · Spread 7.4%</span>
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
                        <div className="text-xs mb-1 font-mono" style={{ color: '#2D3748' }}>{b.l}</div>
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
                <span style={{ color: '#4A5568' }}>Decision Score</span>
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

      {/* ── Market News Status ── */}
      <section className="max-w-4xl mx-auto px-6 pb-8">
        <div className="text-xs font-mono mb-2 text-center" style={{ color: '#2D3748' }}>
          حالة السوق الآن
        </div>
        <HomepageNewsBar />
      </section>

      {/* ── Stats Bar ── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(13,27,42,0.5)' }}>
        <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { v: '7',       l: 'محركات تحليلية' },
            { v: '100',     l: 'نقطة قرار'       },
            { v: 'Tradier', l: 'مصدر البيانات'   },
            { v: '0DTE',    l: 'تركيز التداول'   },
          ].map(s => (
            <div key={s.l}>
              <div className="text-3xl font-bold font-mono mb-1" style={{ color: '#C9943A' }}>{s.v}</div>
              <div className="text-xs font-mono" style={{ color: '#2D3748' }}>{s.l}</div>
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
            كل ما يحتاجه المحترف في مكان واحد
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: '⬡', color: '#C9943A',
              title: '7 محركات تحليلية',
              desc: 'اتجاه السوق · الزخم وVWAP · Expected Move · جودة العقد · السيولة · Theta/Gamma · وضوح التنفيذ — كل محرك بدرجته الخاصة من 100',
            },
            {
              icon: '◈', color: '#10B981',
              title: 'بيانات Tradier الحية',
              desc: 'أسعار SPX وVIX لحظياً · Greeks دقيقة · VWAP من timesales · Opening Range · سلسلة كاملة OTM',
            },
            {
              icon: '◐', color: '#60A5FA',
              title: 'أهداف ووقف ذكي',
              desc: 'أهداف ثلاثة مبنية على Expected Move بمستويات SPX واضحة · وقف خسارة بنقاط محددة · لا تخمين',
            },
            {
              icon: '◉', color: '#A78BFA',
              title: '0DTE و 1DTE',
              desc: 'مصمم خصيصاً للتداول اليومي · delta مثالي 0.22–0.32 · premium $5–$500 · OTM صارم بالكامل',
            },
            {
              icon: '◫', color: '#F59E0B',
              title: 'قائمة مختصرة ذكية',
              desc: 'أفضل 8 عقود من نفس الانتهاء · مرتبة بالجودة · تحليل كامل بنقرة واحدة · العقد المحدد مُميَّز',
            },
            {
              icon: '◇', color: '#EF4444',
              title: 'إدارة مخاطر كاملة',
              desc: 'تحذيرات Gamma حاد · Theta مرتفع · Spread واسع · ITM فوري · VIX خطر — كل التحذيرات قبل التنفيذ',
            },
          ].map(f => (
            <div key={f.title} className="rounded-2xl p-6 transition-all group"
              style={{
                background: 'rgba(13,27,42,0.7)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
              <div className="text-2xl mb-4" style={{ color: f.color }}>{f.icon}</div>
              <div className="text-base font-bold text-white mb-2 leading-tight">{f.title}</div>
              <div className="text-sm leading-relaxed" style={{ color: '#4A5568' }}>{f.desc}</div>
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
                title: 'جلب البيانات الحية',
                desc: 'SPX · VIX · VWAP · Opening Range · سلسلة العقود · Greeks — مصادر بيانات متعددة مع بديل تلقائي',
                color: '#C9943A',
              },
              {
                step: '02',
                title: '7 محركات تعمل معاً',
                desc: 'كل محرك يحلل جانباً مختلفاً ويعطي درجة · المجموع يُكوّن Decision Score من 100',
                color: '#60A5FA',
              },
              {
                step: '03',
                title: 'قرار واضح + أهداف',
                desc: 'نفّذ / مشروط / مراقبة / رُفض — مع أسعار دخول واضحة وأهداف SPX محددة',
                color: '#10B981',
              },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center text-xl font-bold font-mono mb-5"
                  style={{ background: `${s.color}12`, border: `1px solid ${s.color}30`, color: s.color }}>
                  {s.step}
                </div>
                <div className="text-base font-bold text-white mb-2">{s.title}</div>
                <div className="text-sm leading-relaxed" style={{ color: '#4A5568' }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section id="plans" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <div className="text-xs font-mono tracking-widest mb-3" style={{ color: '#C9943A' }}>الباقات</div>
          <h2 className="text-3xl font-bold text-white mb-3">اختر ما يناسبك</h2>
          <p className="text-sm" style={{ color: '#4A5568' }}>كل الأرقام حقيقية · كل الإشارات موثّقة · لا وعود فارغة</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              key: 'radar', label: 'رادار', price: 'مجاني', period: '',
              color: '#4A5568',
              desc: 'للمبتدئين — الداشبورد وتحليل العقود',
              features: ['داشبورد SPX الحي', 'تحليل العقد الفوري', 'قائمة مختصرة', 'درجة القرار'],
            },
            {
              key: 'signal', label: 'سيجنال', price: '$29', period: '/شهر',
              color: '#60A5FA',
              desc: 'إشارات موثّقة وأدوات تحليل متقدمة',
              features: ['إشارات موثّقة بدخول وخروج', 'صفحة الأداء التاريخي', 'كونسول العقود', 'كل ميزات رادار'],
            },
            {
              key: 'edge', label: 'إيدج', price: '$79', period: '/شهر',
              color: '#C9943A', badge: 'الأكثر شعبية',
              desc: 'تحليل معمّق وأدوات الشارت الكاملة',
              features: ['الشارت المتقدم', 'تحليل معمّق للاستراتيجيات', 'وصول مبكر للميزات', 'كل ميزات سيجنال'],
            },
            {
              key: 'alpha', label: 'ألفا', price: '$199', period: '/شهر',
              color: '#A78BFA',
              desc: 'وصول كامل غير محدود + أولوية الدعم',
              features: ['وصول كامل لكل الميزات', 'أولوية في الدعم', 'تقارير مخصصة', 'كل ميزات إيدج'],
            },
          ].map(tier => (
            <div key={tier.key} className="rounded-2xl p-5 flex flex-col relative"
              style={{
                background: `linear-gradient(160deg, ${tier.color}06 0%, rgba(13,27,42,0.9) 100%)`,
                border: `1px solid ${tier.color}25`,
              }}>
              {(tier as any).badge && (
                <div className="absolute -top-3 right-4 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold"
                  style={{ background: tier.color, color: '#060D14' }}>
                  {(tier as any).badge}
                </div>
              )}
              <div className="mb-4">
                <div className="text-xs font-mono mb-1" style={{ color: tier.color }}>{tier.label}</div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold font-mono text-white">{tier.price}</span>
                  {tier.period && <span className="text-xs" style={{ color: '#4A5568' }}>{tier.period}</span>}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#4A5568' }}>{tier.desc}</p>
              </div>
              <ul className="space-y-2 flex-1 mb-5">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 shrink-0" style={{ color: tier.color }}>✓</span>
                    <span style={{ color: '#64748B' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={tier.key === 'radar' ? '/login' : `/login?plan=${tier.key}`}
                className="block text-center py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: tier.key === 'radar' ? 'rgba(255,255,255,0.04)' : `${tier.color}18`,
                  border: `1px solid ${tier.color}30`,
                  color: tier.key === 'radar' ? '#4A5568' : tier.color,
                }}>
                {tier.key === 'radar' ? 'ابدأ مجاناً' : 'اشترك الآن'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-6"
          style={{ background: 'rgba(201,148,58,0.08)', border: '1px solid rgba(201,148,58,0.2)', color: '#C9943A' }}>
          بالدعوة فقط
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
          جاهز لتداول أكثر احترافية؟
        </h2>
        <p className="text-base mb-10 max-w-sm mx-auto" style={{ color: '#4A5568' }}>
          المنصة تعمل بالدعوة فقط — تواصل مع المدير للحصول على وصول
        </p>
        <Link href="/login"
          className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-base font-bold transition-all"
          style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
          تسجيل الدخول ←
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="ترقّب" className="w-6 h-6 object-contain" />
            <span className="text-sm font-bold text-white">ترقّب</span>
            <span className="text-xs font-mono" style={{ color: '#1A2A3A' }}>TARAQOB PRO</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/how-it-works" className="text-xs" style={{ color: '#2D3748' }}>كيف يعمل</Link>
            <Link href="/compliance"   className="text-xs" style={{ color: '#2D3748' }}>الإفصاح والمخاطر</Link>
            <Link href="/login"        className="text-xs" style={{ color: '#2D3748' }}>تسجيل الدخول</Link>
          </div>
          <div className="text-xs font-mono" style={{ color: '#1A2A3A' }}>
            بيانات السوق قد تكون مؤخرة أو تقديرية · ليست توصيات استثمارية
          </div>
        </div>
      </footer>
    </div>
  )
}
