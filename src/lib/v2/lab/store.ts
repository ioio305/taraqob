import 'server-only'

// ── مخزن تشغيلات المختبر — ملفات JSON محلية (قابلة لإعادة الفتح والمقارنة) ──────
// نحفظ محليًا تحت lab-runs/ (مُستثنى من git) بدل Supabase: مفاتيح Supabase المحلية
// قد تكون مرفوضة، والمطلوب أولًا نسخة محلية مُجرّبة. البنية جاهزة للترحيل لاحقًا.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { StrategyRun } from './types'

function runsDir(): string {
  return process.env.LAB_RUNS_DIR
    ? path.resolve(process.env.LAB_RUNS_DIR)
    : path.resolve(process.cwd(), 'lab-runs')
}

async function ensureDir(): Promise<string> {
  const dir = runsDir()
  await mkdir(dir, { recursive: true })
  return dir
}

export async function saveRun(run: StrategyRun): Promise<void> {
  const dir = await ensureDir()
  const file = path.join(dir, `${run.id}.json`)
  await writeFile(file, JSON.stringify(run, null, 2), 'utf8')
}

export async function getRun(id: string): Promise<StrategyRun | null> {
  // تنقية المعرّف: لا مسارات نسبية.
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null
  try {
    const file = path.join(runsDir(), `${id}.json`)
    const raw = await readFile(file, 'utf8')
    return JSON.parse(raw) as StrategyRun
  } catch {
    return null
  }
}

export async function listRuns(limit = 50): Promise<StrategyRun[]> {
  try {
    const dir = runsDir()
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
    const runs: StrategyRun[] = []
    for (const f of files) {
      try {
        runs.push(JSON.parse(await readFile(path.join(dir, f), 'utf8')) as StrategyRun)
      } catch { /* تجاهل ملف تالف */ }
    }
    return runs
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  } catch {
    return []
  }
}
