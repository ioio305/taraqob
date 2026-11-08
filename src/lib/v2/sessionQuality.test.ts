import { describe, expect, it } from 'vitest'
import { evaluateSessionQuality } from './sessionQuality'

describe('نافذة إصدار التوصية', () => {
  it('يمنع أي دخول جديد بعد الثانية ظهراً في نيويورك', () => {
    const result = evaluateSessionQuality(new Date('2026-08-07T18:01:00.000Z'))
    expect(result.action).toBe('block')
    expect(result.reason).toContain('2:00')
  })

  it('يسمح خلال النافذة الأساسية بعد استقرار الافتتاح', () => {
    const result = evaluateSessionQuality(new Date('2026-08-07T15:00:00.000Z'))
    expect(result.action).not.toBe('block')
  })
})
