// ── عقد المحوّل (AssetAdapter) — قلب رؤية «3 منصات» ─────────────────────────
// كل منصة (SPX · الشركات · الصناديق) = تطبيق لهذا العقد، يتصل بنفس محركات
// القرار المشتركة (strategyEngine · tradeFocus · التصنيف · المعيار الواعي بالتكلفة).
// الفرق بين المنصات ليس واجهة جديدة، بل: مصدر البيانات + كون الرموز + حساب
// الاتجاه + بوابة مخاطر الأحداث + معايرة العتبات.
//
// ملاحظة: هذا العقد هو مصدر الحقيقة للجلسات القادمة (راجع docs/platforms.md).
// SPX هو أول تطبيق مرجعي؛ الشركات والصناديق تطبيقات جديدة معزولة.

export type AssetClass = 'spx' | 'stocks' | 'funds'

export type PlatformStatus = 'available' | 'coming_soon'

// ── وصف المنصة للصفحة التعريفية والتنقل ──────────────────────────────────────
export interface PlatformMeta {
  key:      AssetClass
  label:    string          // الخيارات SPX · الشركات · الصناديق
  tagline:  string          // سطر واحد يشرح المنصة
  icon:     string          // إيموجي للعرض
  route:    string          // /v2 (spx) · /stocks · /funds
  status:   PlatformStatus  // available = مفعّلة · coming_soon = قريباً
  color:    string          // لون الهوية
}

// ── لقطة أصل واحد (رمز) ───────────────────────────────────────────────────────
export interface AssetSnapshot {
  symbol:      string
  price:       number
  prevClose:   number | null
  changePct:   number
  high:        number
  low:         number
  // مقياس التذبذب: للمؤشر = VIX؛ للسهم/الصندوق = التذبذب الضمني (IV) أو ATR%
  volMeasure:  number | null
  volLabel:    string        // «مؤشر الخوف» للمؤشر · «التذبذب» للأسهم/الصناديق
  atrPct:      number | null
  expectedMove: number | null
  source:      string
}

// ── عنصر في كون الرموز (قائمة ما تفحصه/تعرضه المنصة) ─────────────────────────
export interface UniverseItem {
  symbol: string
  name:   string           // الاسم المعروض (Apple · SPY · SPX)
  liquid: boolean          // سائل بما يكفي لخيارات نظيفة
}

// ── اتجاه/انحياز الأصل ────────────────────────────────────────────────────────
export interface AdapterDirection {
  type:   'call' | 'put' | null
  label:  string
  color:  string
  reason: string
}

// ── بوابة مخاطر الأحداث ───────────────────────────────────────────────────────
// SPX: التقويم الاقتصادي (FOMC/CPI/NFP) · الأسهم: الأرباح · الصناديق: اقتصادي + قطاعي
export interface EventRisk {
  active:  boolean
  nameAr:  string
  when:    string
  advice:  string
  impact:  'high' | 'medium' | 'low'
}

// ── إعدادات المعايرة — إلزامية لكل فئة أصول (لا تنتقل من SPX بالتخمين) ────────
// راجع [[project_taraqob_calibration]] و scripts/backtest.ts
export interface CalibrationConfig {
  // عتبة درجة «نفّذ» و«راقب» — مُعايَرة على بيانات تاريخية لهذه الفئة تحديداً
  executeScore: number
  watchScore:   number
  // أدنى عائد/مخاطرة صافٍ بعد فرق السوق للسماح بـ«نفّذ»
  minNetRR:     number
  // هل عُويرت هذه الفئة فعلاً؟ false = لا تُظهر توصيات «نفّذ» بعد
  validated:    boolean
  note:         string
}

// ── العقد الكامل الذي تطبّقه كل منصة ─────────────────────────────────────────
export interface AssetAdapter {
  meta:        PlatformMeta
  calibration: CalibrationConfig

  // كون الرموز التي تفحصها/تعرضها المنصة
  getUniverse(): Promise<UniverseItem[]>
  // لقطة رمز واحد
  getSnapshot(symbol: string): Promise<AssetSnapshot>
  // انتهاءات الخيارات المتاحة لرمز
  getExpirations(symbol: string): Promise<string[]>
  // سلسلة خيارات لرمز + انتهاء
  getChain(symbol: string, expiration: string): Promise<any[]>
  // الاتجاه/الانحياز لرمز (المؤشر: تغيّر+VIX · السهم: زخم/اتجاه على السهم)
  getDirection(symbol: string, snap: AssetSnapshot): AdapterDirection
  // بوابة مخاطر الأحداث (اختياري لكل رمز)
  getEventRisk(symbol: string): Promise<EventRisk | null>
}
