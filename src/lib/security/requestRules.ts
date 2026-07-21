type OriginCheck = {
  origin: string | null
  fetchSite: string | null
  requestOrigin: string
  configuredOrigin?: string
}

export function isAllowedMutationOrigin(input: OriginCheck) {
  if (input.fetchSite === 'cross-site') return false
  if (!input.origin) return true

  const allowed = new Set([input.requestOrigin])
  if (input.configuredOrigin) {
    try { allowed.add(new URL(input.configuredOrigin).origin) } catch {}
  }

  try {
    return allowed.has(new URL(input.origin).origin)
  } catch {
    return false
  }
}

export function isBodyTooLarge(value: string | null, limit = 65_536) {
  if (!value) return false
  const length = Number(value)
  return Number.isFinite(length) && length > limit
}
