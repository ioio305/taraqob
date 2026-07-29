import { Activity, Layers3, ShieldAlert, Target } from 'lucide-react'
import type { ReactNode } from 'react'

type Profile = {
  title: string
  tracks: string
  exposure: string
  behavior: string
  risk: string
}

const PROFILES: Record<string, Profile> = {
  SPY: { title: 'السوق الأمريكي الكبير', tracks: 'يتتبع مؤشر S&P 500', exposure: 'أكبر الشركات الأمريكية عبر قطاعات متعددة', behavior: 'متوازن وعالي السيولة', risk: 'يتأثر بالفائدة والبيانات الاقتصادية وحركة السوق العامة' },
  QQQ: { title: 'كبرى شركات التقنية والنمو', tracks: 'يتتبع مؤشر Nasdaq 100', exposure: 'التقنية والاتصالات والاستهلاك الرقمي', behavior: 'أسرع حركة من السوق العام', risk: 'حساس للفائدة وتقييمات شركات النمو' },
  IWM: { title: 'الشركات الأمريكية الصغيرة', tracks: 'يتتبع مؤشر Russell 2000', exposure: 'شركات محلية صغيرة ومتوسطة', behavior: 'متقلب وحساس للنمو الاقتصادي', risk: 'يتأثر بتكاليف التمويل والسيولة' },
  DIA: { title: 'الشركات الصناعية الكبرى', tracks: 'يتتبع مؤشر Dow Jones', exposure: 'شركات أمريكية راسخة وقيادية', behavior: 'أهدأ نسبيًا من صناديق النمو', risk: 'تركيزه أقل تنوعًا من السوق الواسع' },
  XLF: { title: 'قطاع المال', tracks: 'شركات المال الأمريكية الكبرى', exposure: 'البنوك والتأمين والخدمات المالية', behavior: 'يتفاعل مع الفائدة ومنحنى العائد', risk: 'حساس للائتمان والسياسة النقدية' },
  XLE: { title: 'قطاع الطاقة', tracks: 'شركات الطاقة الأمريكية الكبرى', exposure: 'النفط والغاز وخدمات الطاقة', behavior: 'يرتبط بأسعار النفط', risk: 'حساس لتقلب السلع والأحداث الجيوسياسية' },
  XLK: { title: 'قطاع التقنية', tracks: 'شركات التقنية الأمريكية الكبرى', exposure: 'البرمجيات والرقائق والأجهزة', behavior: 'نمو مرتفع وحركة نشطة', risk: 'حساس للفائدة وتقييمات النمو' },
  XLV: { title: 'قطاع الصحة', tracks: 'شركات الرعاية الصحية الأمريكية', exposure: 'الأدوية والمعدات والخدمات الصحية', behavior: 'دفاعي نسبيًا', risk: 'حساس للتشريعات ونتائج التجارب الدوائية' },
  XLI: { title: 'قطاع الصناعة', tracks: 'شركات الصناعة الأمريكية', exposure: 'النقل والمعدات والدفاع والخدمات الصناعية', behavior: 'يتحسن مع توسع الاقتصاد', risk: 'حساس لدورة الاقتصاد وتكاليف المدخلات' },
  XLY: { title: 'الاستهلاك الكمالي', tracks: 'شركات الإنفاق غير الأساسي', exposure: 'التجزئة والسيارات والترفيه', behavior: 'ينشط مع قوة المستهلك', risk: 'حساس للدخل والفائدة وثقة المستهلك' },
  XLP: { title: 'الاستهلاك الأساسي', tracks: 'شركات السلع اليومية', exposure: 'الغذاء والمشروبات والمنتجات المنزلية', behavior: 'دفاعي وأهدأ نسبيًا', risk: 'يتأثر بالتضخم وهوامش الشركات' },
  XLU: { title: 'قطاع المرافق', tracks: 'شركات الكهرباء والمياه والغاز', exposure: 'خدمات المرافق المنظمة', behavior: 'دفاعي وحساس للعوائد', risk: 'يتراجع غالبًا عند ارتفاع عوائد السندات' },
  XLB: { title: 'قطاع المواد', tracks: 'شركات المواد الخام الأمريكية', exposure: 'الكيماويات والمعادن ومواد البناء', behavior: 'دوري ويرتبط بالنمو العالمي', risk: 'حساس للسلع والدولار والطلب الصناعي' },
  XLRE: { title: 'قطاع العقار', tracks: 'شركات وصناديق العقار الأمريكية', exposure: 'العقارات المدرة للدخل', behavior: 'حساس للفائدة والعوائد', risk: 'ارتفاع التمويل وضعف الإشغال يضغطان عليه' },
  XLC: { title: 'قطاع الاتصالات', tracks: 'شركات الاتصال والإعلام الرقمي', exposure: 'المنصات الرقمية والإعلام والاتصالات', behavior: 'مزيج بين النمو والدفاع', risk: 'حساس للإعلانات والتنظيم والمنافسة' },
}

export function FundBrief({ symbol }: { symbol: string }) {
  const profile = PROFILES[symbol.toUpperCase()]
  if (!profile) return null

  return (
    <section className="rounded-2xl border border-emerald-300/15 bg-[#0B1B15] p-5" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black text-emerald-400">نبذة عن الصندوق المختار</div>
          <h2 className="mt-1 text-xl font-black text-white">{symbol.toUpperCase()} · {profile.title}</h2>
        </div>
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 font-mono text-sm font-black text-emerald-300">{symbol.toUpperCase()}</div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Item icon={<Target size={15} />} label="ماذا يتتبع؟" value={profile.tracks} />
        <Item icon={<Layers3 size={15} />} label="أين يستثمر؟" value={profile.exposure} />
        <Item icon={<Activity size={15} />} label="طبيعة الحركة" value={profile.behavior} />
        <Item icon={<ShieldAlert size={15} />} label="أهم المخاطر" value={profile.risk} danger />
      </div>
    </section>
  )
}

function Item({ icon, label, value, danger = false }: { icon: ReactNode; label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/[.05] bg-black/20 p-3">
      <span className={danger ? 'text-amber-400' : 'text-emerald-400'}>{icon}</span>
      <div><div className="text-[10px] font-bold text-slate-600">{label}</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-300">{value}</div></div>
    </div>
  )
}
