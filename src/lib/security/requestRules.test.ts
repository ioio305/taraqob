import { describe, expect, it } from 'vitest'
import { isAllowedMutationOrigin, isBodyTooLarge } from './requestRules'

describe('حماية الطلبات', () => {
  it('تسمح بطلب الموقع نفسه', () => {
    expect(isAllowedMutationOrigin({
      origin: 'https://trqob.com',
      fetchSite: 'same-origin',
      requestOrigin: 'https://trqob.com',
    })).toBe(true)
  })

  it('ترفض الطلب القادم من موقع آخر', () => {
    expect(isAllowedMutationOrigin({
      origin: 'https://evil.example',
      fetchSite: 'cross-site',
      requestOrigin: 'https://trqob.com',
    })).toBe(false)
  })

  it('ترفض عنواناً غير صالح', () => {
    expect(isAllowedMutationOrigin({
      origin: 'not-a-url',
      fetchSite: null,
      requestOrigin: 'https://trqob.com',
    })).toBe(false)
  })

  it('ترفض الطلب الأكبر من الحد', () => {
    expect(isBodyTooLarge('65537')).toBe(true)
    expect(isBodyTooLarge('65536')).toBe(false)
  })
})
