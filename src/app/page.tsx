import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MarketCards } from '@/components/v2/MarketCards'

// ── الصفحة الرئيسية العامة: «ترقّب» بسوقين منفصلين ───────────────────────────
// البطاقتان تظهران هنا قبل الدخول فقط. المسجّل يُوجَّه مباشرة إلى سوقه
// (عبر /auth/market) ولا يرى السوقين معاً.
export default async function RootPage({ searchParams }: { searchParams?: Promise<{ preview?: string }> }) {
  const query = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user && query?.preview !== '1') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_active')
      .eq('id', user.id)
      .single()
    if (!profile || profile.is_active === false) redirect('/login?error=inactive')
    redirect('/auth/market')
  }

  return (
    <div className="min-h-screen overflow-x-hidden" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%', width: '60vw', height: '60vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(22,163,74,0.06) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', left: '-15%', width: '70vw', height: '70vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,148,58,0.05) 0%, transparent 70%)',
        }} />
      </div>

      {/* ── الهيدر ── */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between px-6 sm:px-10"
        style={{ background: 'rgba(6,13,20,0.92)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="ترقّب" width={36} height={36} priority className="h-9 w-9 shrink-0 object-contain" />
          <div className="text-base font-black tracking-widest text-white">ترقّب</div>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/how-it-works" className="hidden text-sm sm:block" style={{ color: '#7C8A99' }}>كيف يعمل</Link>
          <Link href="/compliance" className="hidden text-sm sm:block" style={{ color: '#7C8A99' }}>الإفصاح</Link>
          {user ? (
            <Link href="/auth/market" className="rounded-lg px-5 py-2 text-sm font-bold"
              style={{ background: 'rgba(255,255,255,.08)', color: '#fff' }}>العودة إلى سوقك</Link>
          ) : (
            <a href="#markets" className="rounded-lg px-5 py-2 text-sm font-bold"
              style={{ background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.12)' }}>تسجيل الدخول</a>
          )}
        </nav>
      </header>

      {/* ── البطل ── */}
      <section className="relative mx-auto max-w-5xl px-6 pt-20 pb-10 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#A7B2BF' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#16A34A' }} />
          سوقان · قرار واضح · شفافية كاملة
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#C9943A' }} />
        </div>
        <h1 className="mb-6 text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
          قرارات تداول أوضح
          <span className="mt-2 block" style={{
            background: 'linear-gradient(135deg,#16A34A,#9BE15D,#C9943A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>في السوق الذي تختاره</span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed" style={{ color: '#7C8A99' }}>
          منصّتان مستقلتان: السوق السعودي والسوق الأمريكي. اختر سوقك وادخل إلى أدواته مباشرة.
        </p>
        <a href="#markets" className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold"
          style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', color: '#fff' }}>
          اختر سوقك ↓
        </a>
      </section>

      {/* ── بطاقتا السوقين ── */}
      <section id="markets" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-20">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black text-white sm:text-3xl">اختر السوق</h2>
          <p className="mt-2 text-sm" style={{ color: '#7C8A99' }}>كل سوق منصة مستقلة بأدواته واشتراكه.</p>
        </div>
        <MarketCards mode="landing" />
      </section>

      {/* ── المبادئ ── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(13,27,42,0.4)' }}>
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-12 text-center text-3xl font-black text-white">ما الذي يجمع السوقين</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: '🎯', title: 'القرار أولاً', desc: 'تفتح المنصة فترى الأهم مباشرة، دون البحث بين عشرات الشاشات.' },
              { icon: '📊', title: 'بيانات حقيقية', desc: 'أسعار السوق الفعلية، مع توضيح صريح متى تكون مؤخّرة.' },
              { icon: '🧪', title: 'مختبَرة لا مُدّعاة', desc: 'نختبر أساليبنا على سنوات من البيانات ونعلن النتيجة كما هي.' },
              { icon: '🛡️', title: 'خطة بحدود واضحة', desc: 'لكل فكرة سبب ووقف مقترح، والقرار النهائي لك.' },
            ].map(f => (
              <div key={f.title} className="rounded-2xl p-6" style={{ background: 'rgba(13,27,42,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="mb-4 text-2xl">{f.icon}</div>
                <div className="mb-2 text-base font-bold text-white">{f.title}</div>
                <div className="text-sm leading-relaxed" style={{ color: '#7C8A99' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── كيف تبدأ ── */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <h2 className="mb-14 text-center text-3xl font-black text-white">كيف تبدأ</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { step: '01', title: 'اختر سوقك', desc: 'السوق السعودي أو السوق الأمريكي.' },
            { step: '02', title: 'سجّل دخولك', desc: 'تدخل إلى سوقك وأدواته فقط.' },
            { step: '03', title: 'تابع قرارك اليومي', desc: 'خطة اليوم والتحليل والمتابعة في مكان واحد.' },
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl font-mono text-xl font-bold"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2E8F0' }}>{s.step}</div>
              <div className="mb-2 text-base font-bold text-white">{s.title}</div>
              <div className="text-sm leading-relaxed" style={{ color: '#7C8A99' }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <a href="#markets" className="inline-flex items-center gap-2 rounded-xl px-10 py-4 text-base font-bold"
            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', color: '#fff' }}>
            اختر سوقك وابدأ ↑
          </a>
        </div>
      </section>

      {/* ── التذييل ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ترقّب" width={24} height={24} className="h-6 w-6 object-contain" />
            <span className="text-sm font-bold text-white">ترقّب</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/how-it-works" className="text-xs" style={{ color: '#6B7B8D' }}>كيف يعمل</Link>
            <Link href="/compliance" className="text-xs" style={{ color: '#6B7B8D' }}>الإفصاح والمخاطر</Link>
            <a href="#markets" className="text-xs" style={{ color: '#6B7B8D' }}>تسجيل الدخول</a>
          </div>
          <div className="text-xs" style={{ color: '#55657A' }}>
            أدوات تحليل مساعدة · ليست توصيات استثمارية · البيانات قد تكون مؤخّرة
          </div>
        </div>
      </footer>
    </div>
  )
}
