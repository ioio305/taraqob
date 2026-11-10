import { describe, expect, it } from 'vitest'
import {
  bypassesSubscriptions, can, canManageTarget, invitableRoles, isPanelStaff, normalizeAccountRole,
} from './staffRoles'

describe('staffRoles', () => {
  it('normalizes unknown and legacy roles to user', () => {
    expect(normalizeAccountRole('support')).toBe('support')
    expect(normalizeAccountRole('analyst')).toBe('user')
    expect(normalizeAccountRole(null)).toBe('user')
  })

  it('panel access: owner, general supervisor and support only', () => {
    expect(isPanelStaff('admin')).toBe(true)
    expect(isPanelStaff('moderator')).toBe(true)
    expect(isPanelStaff('support')).toBe(true)
    expect(isPanelStaff('user')).toBe(false)
  })

  it('support never bypasses subscriptions', () => {
    expect(bypassesSubscriptions('admin')).toBe(true)
    expect(bypassesSubscriptions('moderator')).toBe(true)
    expect(bypassesSubscriptions('support')).toBe(false)
  })

  it('activity log and role granting are owner-only', () => {
    expect(can('admin', 'activity.view')).toBe(true)
    expect(can('moderator', 'activity.view')).toBe(false)
    expect(can('support', 'activity.view')).toBe(false)
    expect(can('moderator', 'roles.assign')).toBe(false)
  })

  it('support cannot change plans; supervisor can', () => {
    expect(can('support', 'plans.assign')).toBe(false)
    expect(can('moderator', 'plans.assign')).toBe(true)
    expect(can('support', 'users.view')).toBe(true)
    expect(can('user', 'users.view')).toBe(false)
  })

  it('non-owners manage regular users only; nobody manages the owner', () => {
    expect(canManageTarget('admin', 'moderator')).toBe(true)
    expect(canManageTarget('admin', 'admin')).toBe(false)
    expect(canManageTarget('moderator', 'user')).toBe(true)
    expect(canManageTarget('moderator', 'support')).toBe(false)
    expect(canManageTarget('support', 'user')).toBe(true)
  })

  it('invitations: owner can invite team roles, supervisor users only', () => {
    expect(invitableRoles('admin')).toEqual(['user', 'moderator', 'support'])
    expect(invitableRoles('moderator')).toEqual(['user'])
    expect(invitableRoles('support')).toEqual([])
  })
})
