import 'server-only'

// ── فحص بيئة محرك LEAN — هل يمكن تشغيل اختبار حقيقي محليًا؟ ────────────────────
// يفحص أدوات التشغيل فقط (محليًا، بلا شبكة): LEAN CLI، Docker وخدمته، ومجلد
// بيانات محلي. يعيد تقريرًا مُهيكلًا بأسباب عربية. لا يشغّل أي اختبار.
//
// الحقيقة المعمارية: محرك LEAN مفتوح المصدر (Apache-2.0) لكن تشغيل اختبار خيارات
// حقيقي يتطلب (1) LEAN CLI + Docker، (2) بيانات خيارات SPX تاريخية حقيقية —
// وهي ليست مجانية ولا قابلة لإعادة التوزيع. راجع docs/strategy-lab.md.

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

function run(cmd: string, args: string[], timeoutMs = 4000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
        resolve({ ok: !err, out: `${stdout ?? ''}${stderr ?? ''}`.trim() })
      })
    } catch {
      resolve({ ok: false, out: '' })
    }
  })
}

export interface LabEnvironment {
  leanCli: { present: boolean; version: string | null }
  docker: { present: boolean; daemonRunning: boolean }
  localData: { dir: string; present: boolean }
  // جاهزة لتشغيل اختبار حقيقي؟ (كل الأدوات + بيانات محلية)
  ready: boolean
  // ما ينقص لإتمام تشغيل حقيقي — يُعرض للمستخدم بوضوح
  missingAr: string[]
  checkedAt: string
}

// مجلد البيانات المحلي المتوقع لـLEAN (قابل للتهيئة لاحقًا). غيابه = لا بيانات حقيقية.
function localDataDir(): string {
  return process.env.LEAN_DATA_DIR
    ? path.resolve(process.env.LEAN_DATA_DIR)
    : path.resolve(process.cwd(), 'lean', 'data')
}

export async function probeLabEnvironment(): Promise<LabEnvironment> {
  const [leanV, dockerV, dockerInfo] = await Promise.all([
    run('lean', ['--version']),
    run('docker', ['--version']),
    run('docker', ['info', '--format', '{{.ServerVersion}}']),
  ])

  const dir = localDataDir()
  // بيانات حقيقية = وجود مجلد بيانات فيه سلاسل خيارات (نتحقق من وجود المجلد ومحتوى option).
  const dataPresent = existsSync(dir) && (
    existsSync(path.join(dir, 'option')) || existsSync(path.join(dir, 'index-option'))
  )

  const leanCli = { present: leanV.ok, version: leanV.ok ? leanV.out.split('\n')[0] : null }
  const docker = { present: dockerV.ok, daemonRunning: dockerInfo.ok }
  const localData = { dir, present: dataPresent }

  const missingAr: string[] = []
  if (!leanCli.present) missingAr.push('LEAN CLI غير مثبّت (التثبيت: pip install lean — الأداة مجانية مفتوحة المصدر).')
  if (!docker.present) missingAr.push('Docker غير مثبّت (يلزم لتشغيل محرك LEAN محليًا).')
  else if (!docker.daemonRunning) missingAr.push('Docker مثبّت لكن خدمته متوقفة — شغّل Docker Desktop.')
  if (!localData.present) {
    missingAr.push(
      'لا تتوفر بيانات خيارات SPX تاريخية حقيقية محليًا. بيانات الخيارات مدفوعة وغير قابلة لإعادة '
      + 'التوزيع (ترخيص المحرك ≠ ترخيص البيانات) — تتطلب موافقة المالك واشتراك بيانات.',
    )
  }

  const ready = leanCli.present && docker.present && docker.daemonRunning && localData.present

  return { leanCli, docker, localData, ready, missingAr, checkedAt: new Date().toISOString() }
}
