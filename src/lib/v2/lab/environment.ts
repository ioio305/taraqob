import 'server-only'
export interface LabEnvironment {
  ready: boolean; storageReady: boolean; workerReady: boolean; missingAr: string[]; checkedAt: string
}
export function workerConnection(): { url: string; token: string } | null {
  const raw = process.env.LAB_WORKER_URL, token = process.env.LAB_WORKER_TOKEN
  if (!raw || !token || token.length < 32) return null
  try {
    const url = new URL(raw), local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
    if (url.username || url.password || url.search || url.hash) return null
    return { url: url.toString().replace(/\/$/, ''), token }
  } catch { return null }
}
// Web host never executes Docker or writes local files.
export async function probeLabEnvironment(storageReady = false): Promise<LabEnvironment> {
  const missingAr: string[] = []
  if (!storageReady) missingAr.push('سجل الاختبارات الخاص بحسابك لم يُهيّأ بعد.')
  const connection = workerConnection()
  let workerReady = false
  if (!connection) missingAr.push('خدمة الاختبار لم تُربط بالمنصة بعد.')
  else {
    try {
      const response = await fetch(connection.url + '/health', {
        headers: { Authorization: 'Bearer ' + connection.token }, cache: 'no-store',
        signal: AbortSignal.timeout(4000), redirect: 'error',
      })
      const health = response.ok ? await response.json() : null
      workerReady = health?.protocol === 1 && health?.ready === true
      if (!workerReady) missingAr.push('خدمة الاختبار متصلة، لكن المحرك أو بيانات العقود وقرارات الاختبار لم تكتمل جاهزيتها.')
    } catch { missingAr.push('تعذّر الاتصال بخدمة الاختبار. حاول التحقق من الجاهزية لاحقًا.') }
  }
  return { ready: storageReady && workerReady, storageReady, workerReady, missingAr, checkedAt: new Date().toISOString() }
}
