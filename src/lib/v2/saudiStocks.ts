// قائمة أسهم السوق السعودي المشمولة (تداول) — مشتركة بين ماسح السوق وتحليل السهم المفرد.
export type SaudiStockMeta = { symbol: string; name: string; sector: string }

export const SAUDI_STOCKS: SaudiStockMeta[] = [
  { symbol: '2010.SR', name: 'سابك', sector: 'البتروكيماويات' },
  { symbol: '1120.SR', name: 'مصرف الراجحي', sector: 'البنوك' },
  { symbol: '2350.SR', name: 'المصافي', sector: 'الطاقة' },
  { symbol: '2380.SR', name: 'بترو رابغ', sector: 'البتروكيماويات' },
  { symbol: '2160.SR', name: 'ينساب', sector: 'البتروكيماويات' },
  { symbol: '1020.SR', name: 'بنك الرياض', sector: 'البنوك' },
  { symbol: '1810.SR', name: 'سبكيم', sector: 'البتروكيماويات' },
  { symbol: '2060.SR', name: 'عجلان وإخوانه', sector: 'التجزئة' },
  { symbol: '1211.SR', name: 'معادن', sector: 'التعدين' },
  { symbol: '4261.SR', name: 'أبو عرابي للإيجار', sector: 'الخدمات' },
  { symbol: '1140.SR', name: 'البنك الأهلي التجاري', sector: 'البنوك' },
  { symbol: '7010.SR', name: 'الاتصالات السعودية STC', sector: 'الاتصالات' },
  { symbol: '4190.SR', name: 'دله الحكمة الطبية', sector: 'الرعاية الصحية' },
  { symbol: '2300.SR', name: 'صافولا', sector: 'الأغذية' },
  { symbol: '4280.SR', name: 'الأنماء للخدمات المالية', sector: 'الخدمات المالية' },
  { symbol: '2050.SR', name: 'صدارة للكيماويات', sector: 'البتروكيماويات' },
  { symbol: '4002.SR', name: 'هرفي للأغذية', sector: 'الأغذية' },
  { symbol: '2222.SR', name: 'أرامكو السعودية', sector: 'الطاقة' },
  { symbol: '2280.SR', name: 'المراعي', sector: 'الأغذية' },
  { symbol: '6010.SR', name: 'نادك', sector: 'الأغذية' },
  { symbol: '1150.SR', name: 'مصرف الإنماء', sector: 'البنوك' },
  { symbol: '1050.SR', name: 'البنك السعودي الفرنسي', sector: 'البنوك' },
  { symbol: '1060.SR', name: 'البنك السعودي للاستثمار', sector: 'البنوك' },
  { symbol: '7020.SR', name: 'اتحاد اتصالات (موبايلي)', sector: 'الاتصالات' },
  { symbol: '7030.SR', name: 'زين السعودية', sector: 'الاتصالات' },
  { symbol: '4013.SR', name: 'د. سليمان الحبيب', sector: 'الرعاية الصحية' },
  { symbol: '4030.SR', name: 'البحري', sector: 'النقل' },
  { symbol: '2020.SR', name: 'سابك للمغذيات الزراعية', sector: 'البتروكيماويات' },
]

// بحث سريع بالرمز المجرّد (بدون .SR) → الاسم والقطاع.
export const SAUDI_NAME: Record<string, { name: string; sector: string }> = Object.fromEntries(
  SAUDI_STOCKS.map(s => [s.symbol.replace('.SR', ''), { name: s.name, sector: s.sector }]),
)
