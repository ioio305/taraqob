import { describe, expect, it } from 'vitest'
import { buildEntryNotification, buildExitNotification } from './notificationEvents'

const fixedTime = new Date('2026-07-21T19:35:00.000Z')

describe('notification events', () => {
  it('builds a complete entry notification', () => {
    const notice = buildEntryNotification({
      symbol: 'SPXW260722C07535000',
      type: 'call',
      strike: 7535,
      expiration: '2026-07-22',
      grade: 'A+',
      mid: 5.35,
      strategy: { entryBalanced: 5.36, t1Price: 8.01, t2Price: 10.68, stopPrice: 3.47 },
      scenario: {
        target1: { value: 7545 }, target2: { value: 7560 }, invalidation: { value: 7522 },
      },
      opportunityWindow: { label: '30 إلى 90 دقيقة' },
    }, fixedTime)

    expect(notice.title).toContain('كول 7535')
    expect(notice.body).toContain('الدخول $5.36')
    expect(notice.body).toContain('هدف الأصل الأول 7,545')
    expect(notice.body).toContain('هدف الأصل الثاني 7,560')
    expect(notice.body).toContain('إلغاء السيناريو 7,522')
    expect(notice.body).toContain('30 إلى 90 دقيقة')
    expect(notice.body).toContain('بتوقيت الرياض')
    expect(notice.url).toContain('SPXW260722C07535000')
  })

  it('builds a complete exit notification', () => {
    const notice = buildExitNotification({
      strike: 7535,
      type: 'call',
      entry: 5.36,
      expiry: '2026-07-22',
    }, {
      verdictText: 'اخرج فوراً — وصل الوقف',
      contract: { mid: 3.42 },
      pnl: { pct: -36.2 },
    }, 'exit', fixedTime)

    expect(notice.title).toContain('قرار خروج')
    expect(notice.body).toContain('السعر الآن $3.42')
    expect(notice.body).toContain('النتيجة -36.2%')
    expect(notice.body).toContain('بتوقيت الرياض')
    expect(notice.url).toContain('strike=7535')
    expect(notice.url).toContain('entry=5.36')
  })
})
