import { describe, it, expect } from 'vitest'
import {
  HORIZONS,
  horizonList,
  horizonSpec,
  matchHorizonByDte,
  normalizeHorizon,
} from './traderHorizon'

describe('traderHorizon', () => {
  it('يعيد الافتراضي (مغامر) للقيم غير الصالحة', () => {
    expect(normalizeHorizon('xyz')).toBe('aggressive')
    expect(normalizeHorizon(null)).toBe('aggressive')
    expect(normalizeHorizon(undefined)).toBe('aggressive')
  })

  it('يقبل القيم الصالحة كما هي', () => {
    expect(normalizeHorizon('moderate')).toBe('moderate')
    expect(normalizeHorizon('conservative')).toBe('conservative')
  })

  it('نطاقات الأيام متدرّجة ولا تتراكب', () => {
    expect(HORIZONS.aggressive.dte.max).toBeLessThan(HORIZONS.moderate.dte.min)
    expect(HORIZONS.moderate.dte.max).toBeLessThan(HORIZONS.conservative.dte.min)
  })

  it('horizonSpec يعيد المواصفة الصحيحة', () => {
    expect(horizonSpec('conservative').labelAr).toBe('محافظ')
    expect(horizonSpec('بلا').key).toBe('aggressive')
  })

  it('horizonList بالترتيب الثلاثي', () => {
    expect(horizonList().map((h) => h.key)).toEqual([
      'aggressive',
      'moderate',
      'conservative',
    ])
  })

  it('matchHorizonByDte يصنّف الأيام', () => {
    expect(matchHorizonByDte(0)).toBe('aggressive')
    expect(matchHorizonByDte(1)).toBe('aggressive')
    expect(matchHorizonByDte(3)).toBe('moderate')
    expect(matchHorizonByDte(5)).toBe('moderate')
    expect(matchHorizonByDte(10)).toBe('conservative')
  })
})
