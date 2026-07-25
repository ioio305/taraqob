import { describe, it, expect } from 'vitest'
import { enrichContracts, type ScoredContract, type EnrichContext } from './recommendCore'

// عقد اصطناعي عالي الجودة (يمرّ بكل البوابات ويحقق عائد/مخاطرة صافياً > 1.3)
function qualifyingContract(): ScoredContract {
  return {
    symbol: 'TEST', type: 'call', strike: 6020, expiration: '2026-07-31', dte: 5,
    bid: 9.95, ask: 10.05, mid: 10, last: 10, volume: 1500, openInterest: 1500,
    delta: 0.35, gamma: 0.001, theta: -0.1, vega: 0.2, iv: 0.15, _score: 95,
  }
}

// سياق «سوق مفتوح مثالي» — لا موانع، تذبذب هادئ، اتجاه واضح
function baseContext(overrides: Partial<EnrichContext>): EnrichContext {
  return {
    underlyingPrice: 6000, emUpper: 6030, emLower: 5970, chgPct: 0.7,
    volValue: 16, volExtreme: false, volExtremeReason: '', volCalmForEdge: true,
    hasDirection: true, recMode: 'balanced', usedChain: [], gammaEx: null,
    guard: { active: false, reasons: [] },
    blocked: false, blockedReason: '', closedWatchlist: false,
    watchMode: false, watchModeReason: '',
    executeScore: 80, watchScore: 74, minNetRR: 1.3, validated: true,
    notCalibratedReason: 'تحت المعايرة',
    newsRisk: null, marketReaction: null, session: null,
    ...overrides,
  }
}

describe('recommendCore.enrichContracts', () => {
  it('SPX المُعايَر: عقد مؤهّل قوي يُصنّف «نفّذ»', () => {
    const [c] = enrichContracts([qualifyingContract()], baseContext({ validated: true }))
    expect(c.status).toBe('execute')
    expect(c.score).toBe(95)
  })

  it('قاعدة رؤية 3 منصات: فئة غير مُعايَرة (validated:false) لا تُصدر «نفّذ» أبداً', () => {
    const notCal = 'منصة الشركات تحت المعايرة — راقب فقط'
    const [c] = enrichContracts(
      [qualifyingContract()],
      baseContext({ validated: false, notCalibratedReason: notCal }),
    )
    expect(c.status).toBe('watch')          // خُفِّض من «نفّذ» إلى «راقب»
    expect(c.reason).toBe(notCal)           // السبب: تحت المعايرة
  })

  it('حارس الانهيارات يمنع «نفّذ» حتى لو كانت الفئة مُعايَرة', () => {
    const [c] = enrichContracts(
      [qualifyingContract()],
      baseContext({ validated: true, guard: { active: true, reasons: ['هبوط يومي عنيف'] } }),
    )
    expect(c.status).toBe('watch')
  })

  it('السوق المغلق: قائمة استعداد «راقب» لا «لا تدخل»', () => {
    const [c] = enrichContracts([qualifyingContract()], baseContext({ closedWatchlist: true }))
    expect(c.status).toBe('watch')
  })
})
