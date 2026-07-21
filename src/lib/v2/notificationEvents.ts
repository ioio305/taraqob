export type BellNotification = {
  type: 'signal' | 'alert' | 'info'
  title: string
  body: string
  url: string
}

type StrategySnapshot = {
  entryBalanced?: number | null
  t1Price?: number | null
  t2Price?: number | null
  stopPrice?: number | null
}

export type EntryNotificationInput = {
  symbol: string
  type: 'call' | 'put' | string
  strike: number
  expiration?: string | null
  grade?: string | null
  mid?: number | null
  ask?: number | null
  strategy?: StrategySnapshot | null
}

export type ExitNotificationInput = {
  strike: number
  type: 'call' | 'put'
  expiry?: string
  entry: number
}

export type ExitSnapshot = {
  verdictText?: string | null
  contract?: { mid?: number | null }
  pnl?: { pct?: number | null }
}

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `$${value.toFixed(2)}`
}

function contractName(type: string): string {
  return type === 'put' ? 'بوت' : 'كول'
}

export function riyadhDateTime(date = new Date()): string {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
  }).format(date)
}

function expiryLabel(expiry: string | null | undefined): string {
  if (!expiry) return 'غير محدد'
  const parsed = new Date(`${expiry}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return expiry
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Riyadh',
  }).format(parsed)
}

export function buildEntryNotification(
  contract: EntryNotificationInput,
  now = new Date(),
): BellNotification {
  const name = contractName(contract.type)
  const entry = contract.strategy?.entryBalanced ?? contract.mid ?? contract.ask
  const target1 = contract.strategy?.t1Price
  const target2 = contract.strategy?.t2Price
  const stop = contract.strategy?.stopPrice

  return {
    type: 'signal',
    title: `فرصة دخول ${contract.grade ?? ''} — ${name} ${contract.strike}`.replace('  ', ' ').trim(),
    body: [
      `الدخول ${money(entry)}`,
      `الهدف الأول ${money(target1)}`,
      `الهدف الثاني ${money(target2)}`,
      `الوقف ${money(stop)}`,
      `الانتهاء ${expiryLabel(contract.expiration)}`,
      `صدرت ${riyadhDateTime(now)} بتوقيت الرياض`,
    ].join(' · '),
    url: `/v2/analyze?symbol=${encodeURIComponent(contract.symbol)}`,
  }
}

export function buildExitNotification(
  position: ExitNotificationInput,
  snapshot: ExitSnapshot,
  kind: 'exit' | 'profit',
  now = new Date(),
): BellNotification {
  const name = contractName(position.type)
  const pnl = snapshot.pnl?.pct
  const pnlText = pnl == null || !Number.isFinite(pnl)
    ? '—'
    : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%`

  return {
    type: kind === 'exit' ? 'alert' : 'signal',
    title: kind === 'exit'
      ? `قرار خروج — ${name} ${position.strike}`
      : `إدارة ربح — ${name} ${position.strike}`,
    body: [
      snapshot.verdictText ?? (kind === 'exit' ? 'اخرج الآن' : 'أمّن جزءاً من الربح'),
      `الدخول ${money(position.entry)}`,
      `السعر الآن ${money(snapshot.contract?.mid)}`,
      `النتيجة ${pnlText}`,
      `الانتهاء ${expiryLabel(position.expiry)}`,
      `${riyadhDateTime(now)} بتوقيت الرياض`,
    ].join(' · '),
    url: `/v2/exit?${new URLSearchParams({
      strike: String(position.strike),
      type: position.type,
      entry: String(position.entry),
      ...(position.expiry ? { expiry: position.expiry } : {}),
    }).toString()}`,
  }
}
