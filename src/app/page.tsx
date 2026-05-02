'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

// ── ICONS ──────────────────────────────────────────────────

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IconBarChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  )
}

function IconTarget() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function IconLayers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function IconCheckCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

// ── COUNTER HOOK ───────────────────────────────────────────

function useCounter(target: number, duration: number, start: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

// ── MAIN COMPONENT ─────────────────────────────────────────

export default function LandingPage() {
  const [visible, setVisible] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsVisible, setStatsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  const c1 = useCounter(7,  1200, statsVisible)
  const c2 = useCounter(10, 1400, statsVisible)
  const c3 = useCounter(7,  1600, statsVisible)

  const indicators = [
    { code: '01', name_ar: 'حالة السوق',       name_en: 'Market Regime',       score: 74, status: 'صاعد' },
    { code: '02', name_ar: 'ضغط التذبذب',      name_en: 'Volatility Pressure', score: 58, status: 'طبيعي' },
    { code: '03', name_ar: 'الحركة المتوقعة',  name_en: 'Expected Move',       score: 62, status: 'نطاق محدد' },
    { code: '04', name_ar: 'الزخم اللحظي',     name_en: 'Intraday Momentum',   score: 68, status: 'فوق VWAP' },
    { code: '05', name_ar: 'جودة السيولة',      name_en: 'Options Liquidity',   score: 71, status: 'مقبول' },
    { code: '06', name_ar: 'تآكل الوقت',        name_en: 'Theta Burn',          score: 45, status: 'متوسط' },
    { code: '07', name_ar: 'الأحداث الكلية',   name_en: 'Macro Events',        score: 85, status: 'آمن' },
  ]

  const features = [
    {
      icon: <IconLayers />,
      title: 'محرك مؤشرات سبع طبقات',
      desc: 'كل إشارة مبنية على سبعة مؤشرات مستقلة تقيس حالة السوق، التذبذب، الزخم، جودة العقد، ومخاطر الأحداث.',
    },
    {
      icon: <IconTarget />,
      title: 'دورة إشارة كاملة',
      desc: 'من الرصد إلى القرار: شرط الدخول، نقطة الإبطال، خطة الخروج، وتوثيق النتيجة — كل شيء موثق وقابل للقياس.',
    },
    {
      icon: <IconBarChart />,
      title: 'سجل أداء شفاف',
      desc: 'كل إشارة منشورة محفوظة في سجل عام لا يمكن تعديله. الأداء حقيقي، مرئي، وقابل للتحقق.',
    },
    {
      icon: <IconShield />,
      title: 'انضباط منهجي صارم',
      desc: '10 قواعد تمنع إصدار الإشارة عند غياب أي شرط جوهري. لا إشارة بدون نقطة إبطال أو خطة خروج.',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-arabic" dir="rtl">

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav className="fixed top-0 right-0 left-0 z-50 bg-white/80 backdrop-blur-xl border-b border-surface-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ترقّب" className="w-10 h-10 object-contain" />
            <div>
              <div className="text-navy-900 font-bold text-base leading-none">ترقّب</div>
              <div className="text-surface-400 text-[10px] font-medium tracking-wide leading-none mt-0.5">
                TARAQOB
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-sm text-surface-500">
            <a href="#how-it-works" className="hover:text-navy-900 transition-colors">كيف يعمل</a>
            <a href="#indicators"   className="hover:text-navy-900 transition-colors">المؤشرات</a>
            <a href="#framework"    className="hover:text-navy-900 transition-colors">إطار القرار</a>
            <Link href="/how-it-works" className="hover:text-navy-900 transition-colors font-medium text-teal-600">
              دليل الاستخدام
            </Link>
            <a href="#compliance"   className="hover:text-navy-900 transition-colors">الإفصاح</a>
          </div>

          {/* CTA */}
          <Link
            href="/login"
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <IconLock />
            <span>تسجيل الدخول</span>
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 overflow-hidden">

        {/* Background mesh */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full
            bg-teal-500/5 blur-3xl transform translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full
            bg-gold-400/8 blur-3xl transform -translate-x-1/3 translate-y-1/3" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: 'linear-gradient(#0D1B2A 1px, transparent 1px), linear-gradient(90deg, #0D1B2A 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">

            {/* Beta Badge */}
            <div
              className={`inline-flex items-center gap-2 bg-navy-900/5 border border-navy-900/10
                rounded-full px-4 py-1.5 mb-8 text-xs font-medium text-navy-700
                transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
              نسخة Beta مغلقة — الدخول بالدعوة فقط
            </div>

            {/* Main Title */}
            <h1
              className={`text-5xl md:text-6xl font-bold text-navy-900 leading-tight mb-6
                transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            >
              ترقّب الإشارة
              <br />
              <span className="text-teal-500 font-serif italic">قبل القرار</span>
            </h1>

            {/* Subtitle */}
            <p
              className={`text-lg text-surface-500 leading-relaxed mb-10 max-w-2xl mx-auto
                transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            >
              منصة دعم قرار لعقود <span className="text-navy-900 font-semibold font-mono">SPX Options</span>،
              ترصد حركة السوق، تقرأ المؤشرات، وتصدر إشارات موثقة عند اكتمال شروط الدخول والخروج والمخاطرة.
            </p>

            {/* CTA */}
            <div
              className={`flex items-center justify-center gap-3
                transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            >
              <Link href="/login" className="btn-primary btn-lg gap-2">
                <IconLock />
                دخول المنصة
              </Link>
              <a href="#how-it-works" className="btn-secondary btn-lg gap-1">
                تعرف أكثر
                <IconChevronLeft />
              </a>
            </div>

            {/* Disclaimer micro */}
            <p className="text-[11px] text-surface-400 mt-6">
              المنصة تقدم تحليلات عامة ودعم قرار فقط — لا ضمان ربح، لا إدارة أموال، لا توصية شخصية ملزمة.
            </p>
          </div>
        </div>
      </section>

      {/* ── SIGNAL CARD PREVIEW ─────────────────────────── */}
      <section className="py-16 bg-white border-y border-surface-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-2">
              نموذج بطاقة الإشارة
            </p>
            <h2 className="text-2xl font-bold text-navy-900">
              كل إشارة وثيقة تحليلية كاملة
            </h2>
          </div>

          {/* Mock Signal Card */}
          <div className="max-w-2xl mx-auto">
            <div className="card overflow-hidden">
              {/* Card Header */}
              <div className="bg-navy-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-white font-bold text-sm font-mono">TRQ-2024-001</span>
                  </div>
                  <span className="bg-amber-500/20 text-amber-300 text-xs font-medium
                    px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    دخول مشروط
                  </span>
                </div>
                <div className="text-surface-400 text-xs font-mono">SPX</div>
              </div>

              {/* Card Body */}
              <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-4">
                {[
                  { label: 'الاستراتيجية',   value: 'Bull Call Debit Spread', mono: true },
                  { label: 'اتجاه السوق',    value: 'صاعد مع حذر',            mono: false },
                  { label: 'شرط الدخول',    value: 'إغلاق فوق المستوى المحدد بشمعة 5 دقائق', mono: false },
                  { label: 'نقطة الإبطال',  value: 'كسر الدعم تحت VWAP',    mono: false },
                  { label: 'مستوى المخاطرة', value: 'عالية',                  mono: false, red: true },
                  { label: 'درجة الثقة',     value: '78 / 100',               mono: true },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="field-label">{item.label}</div>
                    <div className={`text-sm font-medium ${
                      item.red ? 'text-red-600' :
                      item.mono ? 'text-navy-900 font-mono' : 'text-navy-900'
                    }`}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rationale */}
              <div className="px-6 pb-4">
                <div className="field-label">سبب الإشارة</div>
                <div className="bg-surface-50 rounded-lg p-3 text-xs text-surface-600 leading-relaxed">
                  حالة السوق تدعم الاستمرارية الصاعدة. الزخم اللحظي يؤكد القوة فوق VWAP.
                  التذبذب مستقر. سيولة العقد مقبولة. درع الأحداث الكلية واضح.
                </div>
              </div>

              {/* User Summary */}
              <div className="px-6 pb-5">
                <div className="compliance-banner">
                  <span className="font-semibold">ملاحظة للمستخدم: </span>
                  الإشارة مشروطة وليست دخولًا مباشرًا. تُفعَّل فقط عند تحقق شرط الدخول،
                  وتُلغى إذا تحقق مستوى الإبطال المحدد.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────── */}
      <section ref={statsRef} className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { value: c1, suffix: '', label: 'مؤشرات تحليلية',    desc: 'طبقات مستقلة' },
              { value: c2, suffix: '', label: 'قاعدة منع إشارة',   desc: 'انضباط صارم' },
              { value: c3, suffix: '', label: 'حالات قرار واضحة',  desc: 'لا غموض' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-5xl font-bold text-navy-900 font-mono mb-1">
                  {stat.value}
                </div>
                <div className="text-sm font-semibold text-navy-900 mb-0.5">{stat.label}</div>
                <div className="text-xs text-surface-400">{stat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INDICATORS PREVIEW ──────────────────────────── */}
      <section id="indicators" className="py-16 bg-navy-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-gold-400 uppercase tracking-widest mb-2">
              محرك المؤشرات
            </p>
            <h2 className="text-2xl font-bold text-white mb-3">
              سبع طبقات تحليلية مستقلة
            </h2>
            <p className="text-surface-400 text-sm max-w-lg mx-auto">
              كل إشارة تمر عبر سبعة مؤشرات مستقلة. لا تصدر الإشارة إلا عند اكتمال الشروط في كل طبقة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {indicators.map((ind, i) => (
              <div
                key={ind.code}
                className="bg-navy-800 border border-navy-700 rounded-xl p-4
                  hover:border-teal-500/30 transition-all duration-200
                  animate-fade-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-gold-400">{ind.code}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    ind.score >= 70 ? 'text-emerald-400 bg-emerald-500/10' :
                    ind.score >= 50 ? 'text-amber-400 bg-amber-500/10' :
                    'text-red-400 bg-red-500/10'
                  }`}>
                    {ind.status}
                  </span>
                </div>
                <div className="text-sm font-semibold text-white mb-1">{ind.name_ar}</div>
                <div className="text-xs text-surface-400 mb-3">{ind.name_en}</div>

                {/* Score Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-navy-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        ind.score >= 70 ? 'bg-emerald-500' :
                        ind.score >= 50 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${statsVisible ? ind.score : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-surface-400 w-8 text-left">
                    {ind.score}
                  </span>
                </div>
              </div>
            ))}

            {/* Last card — decision output */}
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4
              flex flex-col justify-between">
              <div className="text-xs font-mono text-teal-400 mb-2">محرك القرار</div>
              <div className="text-lg font-bold text-white mb-1">دخول مشروط</div>
              <div className="text-xs text-teal-300 mb-3">
                الدرجة المركبة: <span className="font-mono font-bold">67/100</span>
              </div>
              <div className="text-[11px] text-surface-400">
                بناءً على مجموع أوزان المؤشرات السبعة
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────── */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-2">
              كيف يعمل
            </p>
            <h2 className="text-2xl font-bold text-navy-900">
              من بيانات السوق إلى إشارة موثقة
            </h2>
          </div>

          {/* Flow */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            {[
              { step: '01', label: 'بيانات السوق',      desc: 'SPX · VIX · Greeks · Events' },
              { step: '02', label: 'المؤشرات السبعة',   desc: '7 طبقات تحليلية مستقلة' },
              { step: '03', label: 'محرك القرار',        desc: 'درجة مركبة + قواعد منع' },
              { step: '04', label: 'مراجعة وموافقة',    desc: 'Admin يعتمد قبل النشر' },
              { step: '05', label: 'إشارة منشورة',      desc: 'موثقة · محدودة · مقيدة' },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-navy-900 flex items-center justify-center
                    text-gold-400 font-bold text-sm font-mono mx-auto mb-2">
                    {item.step}
                  </div>
                  <div className="text-xs font-semibold text-navy-900 mb-0.5">{item.label}</div>
                  <div className="text-[11px] text-surface-400">{item.desc}</div>
                </div>
                {i < 4 && (
                  <div className="hidden md:block w-8 h-px bg-surface-200 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div key={i} className="card p-6 hover:shadow-card-md transition-shadow duration-200">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600
                  flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-navy-900 mb-2">{f.title}</h3>
                <p className="text-sm text-surface-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DECISION FRAMEWORK ──────────────────────────── */}
      <section id="framework" className="py-20 bg-white border-t border-surface-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-2">
              إطار القرار
            </p>
            <h2 className="text-2xl font-bold text-navy-900 mb-3">
              سبع حالات قرار — لا غموض
            </h2>
            <p className="text-sm text-surface-500 max-w-lg mx-auto">
              كل إشارة في حالة واضحة ومحددة. لا توجيه ضمني، لا توصية مبهمة.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 max-w-4xl mx-auto">
            {[
              { status: 'لا تداول',    color: 'bg-surface-100 text-surface-600 border-surface-200' },
              { status: 'مراقبة',      color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { status: 'مشروط',       color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { status: 'نشط',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { status: 'خروج',        color: 'bg-purple-50 text-purple-700 border-purple-200' },
              { status: 'ملغاة',       color: 'bg-red-50 text-red-700 border-red-200' },
              { status: 'مغلقة',       color: 'bg-surface-200 text-surface-700 border-surface-300' },
            ].map((item, i) => (
              <div
                key={i}
                className={`${item.color} border rounded-xl p-3 text-center text-sm font-semibold`}
              >
                {item.status}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RISK FIRST ──────────────────────────────────── */}
      <section className="py-16 bg-navy-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold text-gold-400 uppercase tracking-widest mb-3">
            المخاطرة أولًا
          </p>
          <h2 className="text-2xl font-bold text-white mb-6">
            لا إشارة بدون خطة خروج ونقطة إبطال
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-right">
            {[
              'لا إشارة عند حدث كلي عالي الخطر',
              'لا إشارة بدون نقطة إبطال محددة',
              'لا إشارة بدون خطة خروج واضحة',
              'لا إشارة عند سيولة ضعيفة للعقد',
              'لا إشارة عند تضارب المؤشرات',
              'لا إشارة بدون مخاطرة محددة',
            ].map((rule, i) => (
              <div
                key={i}
                className="bg-navy-800 border border-navy-700 rounded-xl p-4
                  flex items-start gap-3"
              >
                <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <IconCheckCircle />
                </div>
                <span className="text-sm text-surface-300 leading-relaxed">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPLIANCE ──────────────────────────────────── */}
      <section id="compliance" className="py-16 bg-surface-50">
        <div className="max-w-3xl mx-auto px-6">
          <div className="compliance-banner text-center">
            <div className="font-bold text-amber-900 mb-3 text-sm">إفصاح قانوني مهم</div>
            <p className="leading-loose text-xs text-amber-800">
              ترقّب منصة تحليلات عامة ودعم قرار فقط. <strong>لا تقدم ضمان ربح</strong>، ولا تدير أموال المستخدمين،
              ولا تقدم توصية شخصية ملزمة. عقود الخيارات عالية المخاطر وقد يخسر المستخدم
              كامل رأس المال المخصص للتداول. الأداء السابق لا يضمن النتائج المستقبلية.
              المستخدم مسؤول مسؤولية كاملة عن قراراته.
            </p>
            <Link href="/compliance" className="inline-block mt-3 text-xs text-amber-700 underline hover:text-amber-900">
              قراءة صفحة الإفصاح الكاملة ←
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="bg-navy-900 border-t border-navy-800 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Logo & Description */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <img src="/logo.png" alt="ترقّب" className="w-10 h-10 object-contain" />
                <div>
                  <div className="text-white font-bold text-sm">ترقّب — Taraqob</div>
                  <div className="text-surface-500 text-[10px]">منصة دعم قرار لعقود SPX Options</div>
                </div>
              </div>
              <p className="text-surface-500 text-xs leading-relaxed">
                منصة تحليلات عامة ودعم قرار. لا تقدم ضمان ربح أو إدارة أموال.
              </p>
            </div>

            {/* Links */}
            <div>
              <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-widest mb-3">
                روابط سريعة
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { href: '/how-it-works', label: 'طريقة الاستخدام' },
                  { href: '/compliance',   label: 'الإفصاح القانوني' },
                  { href: '/login',        label: 'تسجيل الدخول' },
                ].map(link => (
                  <Link key={link.href} href={link.href}
                    className="text-xs text-surface-500 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Copyright */}
            <div>
              <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-widest mb-3">
                حقوق النشر
              </div>
              <div className="text-xs text-surface-400 leading-relaxed">
                <div className="text-white font-medium mb-1">نايف الشهراني</div>
                <div className="font-mono mb-2">0568122221</div>
                <div className="text-surface-500">
                  © {new Date().getFullYear()} جميع الحقوق محفوظة
                </div>
                <div className="text-surface-600 text-[11px] mt-2">
                  نسخة Beta مغلقة — الدخول بالدعوة فقط
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-navy-800 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-[11px] text-surface-600">
              ترقّب منصة دعم قرار — لا توصية شخصية، لا ضمان ربح، لا إدارة أموال.
            </div>
            <div className="text-[11px] text-surface-600">
              Taraqob Beta · SPX Options Decision Support Platform
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
