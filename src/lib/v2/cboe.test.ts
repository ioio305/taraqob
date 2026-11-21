import { afterEach, describe, expect, it, vi } from 'vitest'
import { cboeDelayedEnabled, getCboeData } from './cboe'
import { syntheticExpirations } from './marketData'

describe('مصدر CBOE المحجوب (منذ 2026-11-20)', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

  it('موقوف افتراضياً ولا يُرسل أي طلب', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    expect(cboeDelayedEnabled()).toBe(false)
    expect(await getCboeData()).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('يُعاد تفعيله بمتغيّر البيئة', () => {
    vi.stubEnv('CBOE_DELAYED_ENABLED', 'true')
    expect(cboeDelayedEnabled()).toBe(true)
  })
})

describe('تواريخ الانتهاء التركيبية', () => {
  it('أيام تداول بتاريخ نيويورك — لا سبت ولا أحد مهما كان توقيت الخادم', () => {
    // السبت 2026-11-21 الساعة 23:30 بتوقيت الرياض = 15:30 بتوقيت نيويورك (السبت)
    const exps = syntheticExpirations(5, new Date('2026-11-21T20:30:00Z'))
    expect(exps).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'])
    for (const e of exps) expect([0, 6]).not.toContain(new Date(`${e}T00:00:00Z`).getUTCDay())
  })

  it('يوم تداول يبدأ بنفسه', () => {
    expect(syntheticExpirations(2, new Date('2026-11-23T15:00:00Z'))).toEqual(['2026-11-23', '2026-11-24'])
  })
})
