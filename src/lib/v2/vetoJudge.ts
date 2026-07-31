// ── قاضي الفيتو — يعمل بصمت خلف التوصيات ──────────────────────────────────────
// لا قسم في الواجهة ولا شرح للمستخدم. حكمه الوحيد الظاهر: لا عقود حين الخطر.
// حكماه:
//   1) أرباح وشيكة للشركة → فيتو (المفاجأة أقوى من أي تحليل)
//   2) عاصفة أخبار حديثة ضد اتجاه الصفقة → فيتو (لا نصطاد السكين)
// تدهور آمن: غياب بيانات الأخبار لا يوقف شيئًا.

import type { EventRisk } from './adapters/types'
import type { StockNewsItem } from './stockNews'

export interface VetoVerdict {
  veto: boolean
  reasonAr: string | null
}

const NO_VETO: VetoVerdict = { veto: false, reasonAr: null }
const FRESH_HOURS = 24

function hoursAgo(iso: string): number {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return Infinity
  return (Date.now() - t) / 3_600_000
}

export function judgeVeto(input: {
  eventRisk: EventRisk | null
  news: StockNewsItem[]
  directionType: 'call' | 'put' | null
}): VetoVerdict {
  // الحكم الأول: الأرباح الوشيكة — فيتو مطلق
  if (input.eventRisk?.active) {
    return { veto: true, reasonAr: 'ظروف غير مناسبة الآن — راقب' }
  }

  // الحكم الثاني: عاصفة أخبار (خبران سلبيان حديثان على الأقل) ضد اتجاه الصفقة
  const fresh = input.news.filter(n => hoursAgo(n.publishedAt) <= FRESH_HOURS && n.sentiment)
  const negatives = fresh.filter(n => n.sentiment === 'negative').length
  const positives = fresh.filter(n => n.sentiment === 'positive').length

  if (input.directionType !== 'put' && negatives >= 2) {
    return { veto: true, reasonAr: 'ظروف غير مناسبة الآن — راقب' }
  }
  if (input.directionType === 'put' && positives >= 2) {
    return { veto: true, reasonAr: 'ظروف غير مناسبة الآن — راقب' }
  }

  return NO_VETO
}
