import { afterEach, describe, expect, it, vi } from 'vitest'
import { liveFeedBase, liveFeedName, liveFeedToken } from './liveFeed'
import { tradierGet } from './marketData'

describe('مصدر الأسعار المباشرة (Tradier أو جسر IBKR)', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

  it('بلا جسر: Tradier كما كان', () => {
    vi.stubEnv('IBKR_BRIDGE_URL', '')
    vi.stubEnv('IBKR_BRIDGE_TOKEN', '')
    vi.stubEnv('TRADIER_API_KEY', 'tradier-token')
    expect(liveFeedName()).toBe('tradier')
    expect(liveFeedBase()).toBe('https://api.tradier.com/v1')
    expect(liveFeedToken()).toBe('tradier-token')
  })

  it('الجسر له الأولوية متى ضُبط رابطه ومفتاحه', () => {
    vi.stubEnv('IBKR_BRIDGE_URL', 'https://ibkr.example.com/')
    vi.stubEnv('IBKR_BRIDGE_TOKEN', 'bridge-token')
    vi.stubEnv('TRADIER_API_KEY', 'tradier-token')
    expect(liveFeedName()).toBe('ibkr')
    expect(liveFeedBase()).toBe('https://ibkr.example.com/v1')
    expect(liveFeedToken()).toBe('bridge-token')
  })

  it('رابط بلا مفتاح لا يفعّل الجسر', () => {
    vi.stubEnv('IBKR_BRIDGE_URL', 'https://ibkr.example.com')
    vi.stubEnv('IBKR_BRIDGE_TOKEN', '')
    expect(liveFeedName()).toBe('tradier')
  })

  it('الطلبات تذهب إلى الجسر بمفتاحه في الترويسة فقط', async () => {
    vi.stubEnv('IBKR_BRIDGE_URL', 'https://ibkr.example.com')
    vi.stubEnv('IBKR_BRIDGE_TOKEN', 'bridge-token')
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"clock":{"state":"open"}}', { status: 200 }))
    await tradierGet('/markets/clock')
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ibkr.example.com/v1/markets/clock')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer bridge-token')
  })
})
