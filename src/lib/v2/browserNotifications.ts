'use client'

const STORAGE_KEY = 'taraqob_browser_notices_v2'
const MAX_REMEMBERED = 200

function fingerprint(title: string, body: string): string {
  let hash = 2166136261
  const value = `${title}\u0000${body}`
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function showBrowserNotificationOnce(title: string, body: string): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false
  }

  const key = fingerprint(title, body)
  try {
    const remembered: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (remembered.includes(key)) return false
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...remembered.slice(-(MAX_REMEMBERED - 1)), key]))
  } catch {
    // استمرار الإشعار أهم من فشل التخزين المحلي.
  }

  try {
    new Notification(title, { body, icon: '/favicon.ico', dir: 'rtl', lang: 'ar' })
    return true
  } catch {
    return false
  }
}
