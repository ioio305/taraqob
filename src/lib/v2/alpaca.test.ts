import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bsGreeks, buildAlpacaChain, getAlpacaChain, getAlpacaExpirations, hasAlpaca, solveIv,
  type AlpacaContract, type AlpacaSnapshot,
} from './alpaca'

const NOW = new Date('2026-11-23T15:00:00Z') // الاثنين 10:00 بتوقيت نيويورك
const EXP = '2026-11-25'

describe('Alpaca — بناء السلسلة (دالة صافية)', () => {
  it('يحسب التذبذب من منتصف السعر حين لا يعطيه المورّد (عقود المؤشر)، ثم الإغريق', () => {
    const S = 6900, K = 6900
    const T = (Date.parse('2026-11-25T21:00:00Z') - NOW.getTime()) / (365 * 24 * 3600_000)
    const fair = bsGreeks(S, K, T, 0.18, 'call').price
    const contracts: AlpacaContract[] = [{ symbol: 'SPXW261125C06900000', expiration_date: EXP, strike_price: '6900', type: 'call', open_interest: '1234' }]
    const snaps: Record<string, AlpacaSnapshot> = { SPXW261125C06900000: { latestQuote: { bp: fair - 0.5, ap: fair + 0.5 } } }
    const [o] = buildAlpacaChain(contracts, snaps, S, EXP, NOW)
    expect(o.open_interest).toBe(1234)
    expect(o.greeks.mid_iv).toBeCloseTo(0.18, 2)
    expect(o.greeks.delta).toBeGreaterThan(0.4)
    expect(o.greeks.delta).toBeLessThan(0.6)
    expect(o.greeks.gamma).toBeGreaterThan(0)
  })

  it('يستخدم تذبذب المورّد وإغريقه حين تكون صالحة', () => {
    const contracts: AlpacaContract[] = [{ symbol: 'SPY261125P00680000', expiration_date: EXP, strike_price: 680, type: 'put', open_interest: null }]
    const snaps = { SPY261125P00680000: { latestQuote: { bp: 2, ap: 2.1 }, impliedVolatility: 0.22, greeks: { delta: -0.35, gamma: 0.03, theta: -0.4, vega: 0.2 } } }
    const [o] = buildAlpacaChain(contracts, snaps, 690, EXP, NOW)
    expect(o.greeks).toMatchObject({ delta: -0.35, gamma: 0.03, mid_iv: 0.22 })
    expect(o.open_interest).toBe(0) // null من Alpaca = لا عقود مفتوحة
  })

  it('يستبعد عقداً بلا أي سعر ولا يخلط تواريخ الانتهاء', () => {
    const contracts: AlpacaContract[] = [
      { symbol: 'A', expiration_date: EXP, strike_price: 100, type: 'call', open_interest: 5 },
      { symbol: 'B', expiration_date: '2026-12-18', strike_price: 100, type: 'call', open_interest: 5, close_price: 3 },
    ]
    expect(buildAlpacaChain(contracts, {}, 100, EXP, NOW)).toEqual([])
  })

  it('لا يحسب تذبذباً لسعر تحت القيمة الذاتية', () => {
    expect(solveIv(5, 110, 100, 0.01, 'call')).toBeNull()
  })
})

describe('Alpaca — بلا مفاتيح', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

  it('لا يُرسل أي طلب ويعيد فارغاً', async () => {
    vi.stubEnv('APCA_API_KEY_ID', '')
    vi.stubEnv('APCA_API_SECRET_KEY', '')
    const spy = vi.spyOn(globalThis, 'fetch')
    expect(hasAlpaca()).toBe(false)
    expect(await getAlpacaChain('SPX', EXP, 6900)).toEqual([])
    expect(await getAlpacaExpirations('SPX', 6900)).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('مع المفاتيح: يطلب العقود من الحساب التجريبي واللقطات لجذري SPX، ويرسل المفاتيح في الترويسة فقط', async () => {
    vi.stubEnv('APCA_API_KEY_ID', 'test-key')
    vi.stubEnv('APCA_API_SECRET_KEY', 'test-secret')
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init: any) => {
      const url = String(input)
      urls.push(url)
      expect(init.headers['APCA-API-KEY-ID']).toBe('test-key')
      expect(url).not.toContain('test-key')
      const body = url.includes('/v2/options/contracts')
        ? { option_contracts: [{ symbol: 'SPXW261125C06900000', expiration_date: EXP, strike_price: '6900', type: 'call', open_interest: '10' }] }
        : { snapshots: url.includes('/SPXW?') ? { SPXW261125C06900000: { latestQuote: { bp: 40, ap: 41 } } } : {} }
      return new Response(JSON.stringify(body), { status: 200 })
    })
    const chain = await getAlpacaChain('SPX', EXP, 6900)
    expect(chain.length).toBe(1)
    expect(urls.some(u => u.startsWith('https://paper-api.alpaca.markets/v2/options/contracts'))).toBe(true)
    expect(urls.some(u => u.includes('/v1beta1/options/snapshots/SPXW?') && u.includes('feed=indicative'))).toBe(true)
    expect(urls.some(u => u.includes('/v1beta1/options/snapshots/SPX?'))).toBe(true)
  })
})
