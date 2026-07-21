import { randomBytes } from 'node:crypto'

export const INVITATION_TOKEN_PATTERN = /^(?:[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i

export function createInvitationToken() {
  return randomBytes(32).toString('hex')
}
