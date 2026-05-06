import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (!profile || profile.is_active === false) redirect('/login?error=inactive')
    if (['admin', 'moderator'].includes(profile.role)) redirect('/v2/admin')
    redirect('/v2')
  }

  // ── Unauthenticated → Landing Page ────────────────────────────
  return (
    <div className="min-h-screen" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 sm:px-10 h-16"
        style={{ background: 'rgba(6,13,20,0.95)', borderBottom: '1px solid rgba(201,148,58,0.12)', position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>ت</div>
          <div>
            <div className="font-bold text-white text-sm tracking-widest">ترقّب</div>
            <div className="text-xs font-mono hidden sm:block" style={{ color: '#C9943A', letterSpacing: '0.1em' }}>TARAQOB PRO</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/how-it-works" className="text-sm hidden sm:block transition-colors"
            style={{ color: '#4A5568' }}
            onMouseOver={undefined}>كيف يعمل</Link>
          <Link href="/compliance" className="text-sm hidden sm:block transition-colors"
            style={{ color: '#4A5568' }}>الإفصاح</Link>
          <Link href="/login"
            className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            تسجيل الدخول
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-8"
          style={{ background: 'rgba(201,148,58,0.08)', border: '1px solid rgba(201,148,58,0.2)', color: '#C9943A' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          نظام تحليل عقود SPX المطور
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          تداول{' '}
          <span style={{ background: 'linear-gradient(135deg,#C9943A,#F0C060)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SPX Options
          </span>
          {' '}باحترافية
        </h1>

        <p className="text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: '#64748B' }}>
          منصة تحليلية متكاملة تجلب البيانات الحية من Tradier وتحللها بـ 7 محركات ذكية
          لتقديم قرار واضح بدرجة من 100 — للمتداول المحترف في 0DTE و 1DTE
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/login"
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-bold transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            ابدأ التداول الآن ←
          </Link>
          <Link href="/how-it-works"
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}>
            كيف يعمل النظام
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: '⬡',
              title: '7 محركات تحليلية',
              desc: 'اتجاه السوق · الزخم · Expected Move · جودة العقد · السيولة · Theta/Gamma · وضوح التنفيذ — كل محرك بدرجته من 100',
              color: '#C9943A',
            },
            {
              icon: '◈',
              title: 'بيانات Tradier الحية',
              desc: 'أسعار SPX وVIX لحظياً · Greeks دقيقة · VWAP من timesales · Opening Range · سلسلة كاملة OTM',
              color: '#10B981',
            },
            {
              icon: '◐',
              title: 'أهداف ووقف ذكي',
              desc: 'أسعار الدخول المحافظ والمتوازن · 3 أهداف مبنية على Expected Move · وقف خسارة بمستويات SPX واضحة',
              color: '#60A5FA',
            },
            {
              icon: '◉',
              title: '0DTE و 1DTE',
              desc: 'النظام مصمم خصيصاً للتداول اليومي · delta مثالي 0.22–0.32 · premium $0.50–$5.00 · OTM صارم',
              color: '#A78BFA',
            },
            {
              icon: '◫',
              title: 'قائمة مختصرة ذكية',
              desc: 'أفضل 8 عقود من نفس الانتهاء · مرتبة بالجودة · delta وgamma ملوّنان · العقد المحدد مُميَّز',
              color: '#F59E0B',
            },
            {
              icon: '◇',
              title: 'إدارة مخاطر كاملة',
              desc: 'تحذيرات Gamma حاد · Theta مرتفع · Spread واسع · ITM فوري · VIX خطر — كلها قبل التنفيذ',
              color: '#EF4444',
            },
          ].map(f => (
            <div key={f.title} className="rounded-2xl p-6 transition-all"
              style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-2xl mb-4" style={{ color: f.color }}>{f.icon}</div>
              <div className="text-base font-bold text-white mb-2">{f.title}</div>
              <div className="text-sm leading-relaxed" style={{ color: '#4A5568' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="border-y py-10" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(13,27,42,0.4)' }}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { label: 'محركات تحليلية', value: '7' },
            { label: 'نقاط القرار', value: '100' },
            { label: 'مصدر البيانات', value: 'Tradier' },
            { label: 'تركيز التداول', value: '0DTE' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-bold font-mono" style={{ color: '#C9943A' }}>{s.value}</div>
              <div className="text-xs mt-1 font-mono" style={{ color: '#2D3748' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
          جاهز لتداول أكثر احترافية؟
        </h2>
        <p className="text-base mb-8" style={{ color: '#4A5568' }}>
          المنصة تعمل بدعوة فقط — تواصل مع المدير للحصول على وصول
        </p>
        <Link href="/login"
          className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-base font-bold"
          style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
          تسجيل الدخول ←
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t px-6 py-8" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>ت</div>
            <span className="text-sm font-bold text-white">ترقّب</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/how-it-works" className="text-xs transition-colors" style={{ color: '#2D3748' }}>كيف يعمل</Link>
            <Link href="/compliance"   className="text-xs transition-colors" style={{ color: '#2D3748' }}>الإفصاح والمخاطر</Link>
            <Link href="/login"        className="text-xs transition-colors" style={{ color: '#2D3748' }}>تسجيل الدخول</Link>
          </div>
          <div className="text-xs font-mono" style={{ color: '#1A2A3A' }}>
            البيانات من Tradier API · ليست توصيات استثمارية
          </div>
        </div>
      </footer>
    </div>
  )
}
