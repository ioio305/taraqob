import { describe, expect, it } from 'vitest'
import { createInvitationToken, INVITATION_TOKEN_PATTERN } from './tokens'

describe('رموز الدعوات', () => {
  it('تنشئ رمزاً قوياً مطابقاً للصيغة الجديدة', () => {
    const token = createInvitationToken()
    expect(token).toHaveLength(64)
    expect(INVITATION_TOKEN_PATTERN.test(token)).toBe(true)
  })

  it('تدعم الروابط القديمة حتى تنتهي صلاحيتها', () => {
    expect(INVITATION_TOKEN_PATTERN.test('8e2f8fd7-4ff4-4f4a-a5bb-47f2ad455801')).toBe(true)
  })

  it('لا تكرر الرموز', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => createInvitationToken()))
    expect(tokens.size).toBe(100)
  })
})
