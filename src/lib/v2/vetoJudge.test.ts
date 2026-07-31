import { describe, it, expect } from 'vitest'
import { judgeVeto } from './vetoJudge'
import type { StockNewsItem } from './stockNews'

function news(sentiment: 'positive' | 'negative' | 'neutral', hoursAgo: number): StockNewsItem {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'خبر',
    source: 'اختبار',
    publishedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    url: null,
    sentiment,
  }
}

describe('قاضي الفيتو الخفي', () => {
  it('يوقف عند الأرباح الوشيكة مهما كانت الأخبار', () => {
    const v = judgeVeto({
      eventRisk: { active: true, nameAr: 'أرباح', when: 'غدًا', advice: '', impact: 'high' } as any,
      news: [],
      directionType: 'call',
    })
    expect(v.veto).toBe(true)
    expect(v.reasonAr).not.toContain('أرباح') // بلا شرح للمستخدم
  })

  it('يوقف صفقة الشراء عند عاصفة أخبار سلبية حديثة', () => {
    const v = judgeVeto({
      eventRisk: null,
      news: [news('negative', 2), news('negative', 5)],
      directionType: 'call',
    })
    expect(v.veto).toBe(true)
  })

  it('يتجاهل الأخبار القديمة والمحايدة', () => {
    const v = judgeVeto({
      eventRisk: null,
      news: [news('negative', 30), news('neutral', 1)],
      directionType: 'call',
    })
    expect(v.veto).toBe(false)
  })

  it('خبر سلبي واحد لا يكفي للفيتو', () => {
    const v = judgeVeto({
      eventRisk: null,
      news: [news('negative', 3)],
      directionType: 'call',
    })
    expect(v.veto).toBe(false)
  })

  it('يوقف صفقة البيع عند عاصفة إيجابية', () => {
    const v = judgeVeto({
      eventRisk: null,
      news: [news('positive', 1), news('positive', 4)],
      directionType: 'put',
    })
    expect(v.veto).toBe(true)
  })

  it('غياب بيانات الأخبار لا يوقف شيئًا (تدهور آمن)', () => {
    expect(judgeVeto({ eventRisk: null, news: [], directionType: 'call' }).veto).toBe(false)
  })
})
