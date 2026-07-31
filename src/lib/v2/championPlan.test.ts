import { describe, it, expect } from 'vitest'
import {
  CHAMPION_PLAN, CHAMPION_EXCLUDED, CHAMPION_STATS,
  championEntryFor, championExclusionFor,
} from './championPlan'

describe('النظام البطل لمنصة الشركات', () => {
  it('يغطي 11 شركة معتمدة ولكل واحدة وصفة', () => {
    expect(Object.keys(CHAMPION_PLAN)).toHaveLength(11)
    for (const entry of Object.values(CHAMPION_PLAN)) {
      expect(entry.methodAr.length).toBeGreaterThan(0)
    }
  })

  it('يستبعد META صراحة بسبب واضح', () => {
    expect(CHAMPION_EXCLUDED.META).toContain('خارج التغطية')
    expect(championExclusionFor('meta')).toBe(CHAMPION_EXCLUDED.META)
  })

  it('يعيد وصفة الشركات المعتمدة ولا يستبعدها', () => {
    expect(championEntryFor('MSFT')?.method).toBe('breakout')
    expect(championEntryFor('msft')?.methodAr).toBe('اختراق مع اتجاه')
    expect(championExclusionFor('MSFT')).toBeNull()
  })

  it('الشركات غير المعروفة بلا وصفة وبلا استبعاد صريح', () => {
    expect(championEntryFor('UNKNOWN')).toBeNull()
    expect(championExclusionFor('UNKNOWN')).toBeNull()
  })

  it('إحصاءات التحقق موثقة وموجبة', () => {
    expect(CHAMPION_STATS.expectancyR).toBeGreaterThan(0)
    expect(CHAMPION_STATS.profitFactor).toBeGreaterThan(1)
    expect(CHAMPION_STATS.experiments).toBe(8)
  })
})
