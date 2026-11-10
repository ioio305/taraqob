import { describe, expect, it } from 'vitest'
import { saudiPathIsPremium, saudiTierAllows } from './saudiNavigation'

describe('بوابات منصة السوق السعودي', () => {
  it('الأقسام المجانية مفتوحة للجميع', () => {
    for (const p of ['/saudi', '/saudi/sectors', '/saudi/watchlist', '/saudi/stock/2222', '/api/v2/saudi/market', '/api/v2/saudi/stock/2222']) {
      expect(saudiPathIsPremium(p)).toBe(false)
      expect(saudiTierAllows('radar', p)).toBe(true)
    }
  })
  it('الأدوات الاحترافية وواجهاتها للباقة المدفوعة فقط', () => {
    for (const p of ['/saudi/scanner', '/api/v2/saudi/scanner', '/saudi/plan', '/api/v2/saudi/portfolio', '/saudi/liquidity']) {
      expect(saudiPathIsPremium(p)).toBe(true)
      expect(saudiTierAllows('radar', p)).toBe(false)
      expect(saudiTierAllows(null, p)).toBe(false)
      expect(saudiTierAllows('edge', p)).toBe(true)
      expect(saudiTierAllows('signal', p)).toBe(true)
    }
  })
  it('لا يخلط مسارات متشابهة الأوّل', () => {
    expect(saudiPathIsPremium('/saudi/planner')).toBe(false)
  })
})
