import { describe, expect, it } from 'vitest'
import type { Candle } from './saudiSignals'
import { VALIDATED, buildEntryPicks, firedSignals } from './saudiEntry'

describe('فرص الدخول المبنية على الدراسة', () => {
  it('المعتمد في الصاعد له عيّنة كافية وصافٍ موجب ومعامل ربح ≥ 1.2', () => {
    expect(VALIDATED.bull.length).toBeGreaterThan(0)
    for (const v of [...VALIDATED.bull, ...VALIDATED.bear]) {
      expect(v.stats.n).toBeGreaterThanOrEqual(100)
      expect(v.stats.avgNetPct).toBeGreaterThan(0)
      expect(v.stats.profitFactor ?? 0).toBeGreaterThanOrEqual(1.2)
    }
  })

  it('حال السوق من عائد 3 أشهر: موجب صاعد، وإلا هابط', () => {
    const s = { symbol: 'X', name: 'X', sector: 'البنوك', price: 100, change: 1, atr: 2, chandelier: 95, entrySignals: [{ key: VALIDATED.bull[0].key, daysAgo: 0, signalPrice: 100 }] }
    const bull = buildEntryPicks([s], 0.05)
    expect(bull.regime).toBe('bull')
    expect(bull.picks).toHaveLength(1)
    expect(bull.picks[0].stop).toBe(96)
    expect(bull.picks[0].fresh).toBe(true)
    const bear = buildEntryPicks([s], -0.1)
    expect(bear.regime).toBe('bear')
    // في الهابط لا يُعرض «ادخل» إلا لما اعتُمد في الهابط.
    expect(bear.picks.length + bear.unproven.length).toBe(1)
    if (!VALIDATED.bear.some(v => v.key === s.entrySignals[0].key)) expect(bear.unproven).toHaveLength(1)
  })

  it('يرصد التقاطع الذهبي في آخر الجلسات', () => {
    const closes = [...Array.from({ length: 200 }, (_, i) => 200 - i * 0.5), ...Array.from({ length: 160 }, (_, i) => 100 + i * 0.9)]
    const c: Candle[] = closes.map((x, i) => ({ t: 1_700_000_000 + i * 86400, o: x, h: x + 0.5, l: x - 0.5, c: x, v: 1000 }))
    // ابحث عن يوم التقاطع ثم اقطع السلسلة عنده.
    for (let end = 250; end < c.length; end++) {
      const got = firedSignals(c.slice(0, end), 0.2, ['golden_cross_trail'], 1)
      if (got.length) { expect(got[0].daysAgo).toBe(0); return }
    }
    throw new Error('لم يُرصد التقاطع')
  })
})
