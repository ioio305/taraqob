import 'server-only'

// ══════════════════════════════════════════════════════════════════════════
// مُشغّل LEAN — واجهة تشغيل الاختبار الحقيقي، منفصلة عن طلبات واجهة المنصة
// ──────────────────────────────────────────────────────────────────────────
// • عند توفّر الأدوات + بيانات حقيقية: يُجهّز مشروع LEAN ويستدعي `lean backtest`
//   فعليًا ثم يحلّل النتيجة الحقيقية إلى RunResults.
// • عند نقص أي شرط: يعيد الحالة insufficient_data مع السبب والمتطلبات بدقّة —
//   ولا يُلفّق أي رقم (قاعدة المهمة المطلقة: لا أسعار تركيبية لإظهار أداء حقيقي).
//
// ملاحظة صدق: فرع «التشغيل الحقيقي» مكتوب وجاهز، لكنه لا يُنفَّذ في بيئة بلا
// LEAN/Docker/بيانات؛ لذا يبقى مسار التحليل غير مُختبَر بتشغيل فعلي حتى تتوفّر
// البيانات (موثّق في docs/strategy-lab.md). ما يُختبَر الآن: التطابق في القواعد
// (strategySpec.test.ts + test_parity.py) ومسار الحالات (insufficient_data).
// ══════════════════════════════════════════════════════════════════════════

import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { probeLabEnvironment, type LabEnvironment } from './environment'
import { buildStrategySpec } from './strategySpec'
import { saveRun } from './store'
import type { RunConfig, RunResults, StrategyRun, TradeRecord, EquityPoint } from './types'

const PROJECT_DIR = () => path.resolve(process.cwd(), 'lean', 'taraqob_spx_otm')

export function createRun(config: RunConfig): StrategyRun {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    label: 'historical',
    config,
    dataSource: {
      provider: 'none',
      resolution: config.resolution,
      licenseAr: 'محرك LEAN مفتوح (Apache-2.0). ترخيص بيانات الخيارات منفصل ومدفوع وغير قابل لإعادة التوزيع.',
      coverageAr: 'لم تُحدَّد بعد — تعتمد على مصدر البيانات المتاح.',
    },
    dataQuality: {
      realContractPrices: false,
      hasBidAsk: false,
      intrabarResolution: config.resolution === 'minute',
      notesAr: [],
    },
    results: null,
    reasonAr: null,
    requirementsAr: [],
    engineAr: null,
  }
}

function insufficient(run: StrategyRun, env: LabEnvironment): StrategyRun {
  const spec = buildStrategySpec()
  return {
    ...run,
    status: 'insufficient_data',
    updatedAt: new Date().toISOString(),
    results: null,
    reasonAr:
      'لا يمكن إجراء اختبار تاريخي حقيقي الآن لنقص بيئة التشغيل أو بيانات العقود الحقيقية. '
      + 'لم يُلفَّق أي رقم — هذه هي الحالة الصادقة.',
    requirementsAr: [...env.missingAr, ...spec.dataRequirements],
    dataQuality: { ...run.dataQuality, realContractPrices: false },
    engineAr: env.leanCli.version ? `LEAN CLI ${env.leanCli.version}` : 'LEAN CLI غير متوفّر',
  }
}

// ── تحليل نتيجة LEAN الحقيقية (يُنفَّذ فقط عند توفّر بيانات وتشغيل فعلي) ────────
function parseLeanResult(json: any, config: RunConfig): RunResults | null {
  const stats = json?.Statistics ?? json?.statistics ?? null
  if (!stats) return null
  const num = (v: unknown): number => {
    const n = typeof v === 'string' ? parseFloat(v.replace(/[%$,]/g, '')) : Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const total = num(stats['Total Trades'] ?? stats['Total Orders'])
  const winPct = num(stats['Win Rate'])
  const lossPct = num(stats['Loss Rate'])
  const wins = Math.round(total * (winPct / 100))
  const losses = Math.round(total * (lossPct / 100))

  const equityChart = json?.Charts?.['Strategy Equity']?.Series?.['Equity']?.Values
    ?? json?.charts?.['Strategy Equity']?.series?.['Equity']?.values ?? []
  const benchChart = json?.Charts?.['Benchmark']?.Series?.['Benchmark']?.Values ?? []
  const benchMap = new Map<number, number>()
  for (const p of benchChart) benchMap.set(num(p?.x ?? p?.Time), num(p?.y ?? p?.Close))
  const equityCurve: EquityPoint[] = (Array.isArray(equityChart) ? equityChart : []).map((p: any) => {
    const t = num(p?.x ?? p?.Time)
    return {
      date: new Date(t * 1000).toISOString().slice(0, 10),
      equity: num(p?.y ?? p?.Close),
      benchmark: benchMap.has(t) ? benchMap.get(t)! : null,
    }
  })

  const closed = json?.ClosedTrades ?? json?.closedTrades ?? []
  const tradeLog: TradeRecord[] = (Array.isArray(closed) ? closed : []).map((t: any) => ({
    openedAt: String(t?.EntryTime ?? t?.entryTime ?? ''),
    closedAt: String(t?.ExitTime ?? t?.exitTime ?? '') || null,
    type: (String(t?.Direction ?? '').toLowerCase().includes('put') ? 'put' : 'call'),
    strike: num(t?.Strike),
    expiration: String(t?.Expiry ?? ''),
    dte: 0,
    entryPrice: num(t?.EntryPrice ?? t?.entryPrice),
    exitPrice: num(t?.ExitPrice ?? t?.exitPrice),
    quantity: num(t?.Quantity ?? t?.quantity),
    grossPnl: num(t?.ProfitLoss ?? t?.profitLoss),
    feesTotal: num(t?.TotalFees ?? t?.totalFees),
    netPnl: num(t?.ProfitLoss ?? t?.profitLoss) - num(t?.TotalFees ?? t?.totalFees),
    exitReason: String(t?.ExitReason ?? 'انتهاء/خروج'),
  }))

  return {
    trades: total,
    wins,
    losses,
    winRatePct: winPct,
    grossPnl: num(stats['Net Profit']) + num(stats['Total Fees']),
    netPnl: num(stats['Net Profit']),
    avgWin: num(stats['Average Win']),
    avgLoss: num(stats['Average Loss']),
    profitFactor: num(stats['Profit-Loss Ratio']) || null,
    expectancyR: num(stats['Expectancy']) || null,
    maxDrawdownPct: num(stats['Drawdown']) || null,
    benchmarkReturnPct: null,
    strategyReturnPct: num(stats['Net Profit']) || null,
    equityCurve,
    tradeLog,
  }
}

function execLean(projectDir: string, timeoutMs = 20 * 60 * 1000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile('lean', ['backtest', projectDir], { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 * 32 },
      (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout ?? ''}${stderr ?? ''}` }))
  })
}

// يشغّل الاختبار ويُرجع التشغيل محدَّثًا (ويحفظه في المخزن).
export async function executeRun(run: StrategyRun): Promise<StrategyRun> {
  const env = await probeLabEnvironment()

  // الحالة الصادقة: بلا بيئة/بيانات → insufficient_data (لا تلفيق).
  if (!env.ready) {
    const out = insufficient(run, env)
    await saveRun(out)
    return out
  }

  // ── فرع التشغيل الحقيقي (يحتاج LEAN + Docker + بيانات محلية) ──
  try {
    const projectDir = PROJECT_DIR()
    if (!existsSync(projectDir)) {
      const out = { ...insufficient(run, env), status: 'failed' as const, reasonAr: 'مشروع LEAN غير موجود.' }
      await saveRun(out); return out
    }
    // اكتب إعدادات التشغيل (الفترة/الدقّة/التكاليف) إلى المشروع كي يقرأها main.py.
    await writeFile(
      path.join(projectDir, 'run_config.json'),
      JSON.stringify(run.config, null, 2), 'utf8',
    )

    const running: StrategyRun = { ...run, status: 'running', updatedAt: new Date().toISOString() }
    await saveRun(running)

    const res = await execLean(projectDir)
    if (!res.ok) {
      const out: StrategyRun = {
        ...running, status: 'failed', updatedAt: new Date().toISOString(),
        reasonAr: 'تعطّل تشغيل LEAN — راجع السجل.', requirementsAr: [res.out.slice(-600)],
      }
      await saveRun(out); return out
    }

    // اعثر على أحدث نتيجة backtest.
    const btDir = path.join(projectDir, 'backtests')
    const dirs = existsSync(btDir) ? (await readdir(btDir)).sort() : []
    const latest = dirs[dirs.length - 1]
    const resultFile = latest ? path.join(btDir, latest, `${latest}.json`) : null
    let parsed: RunResults | null = null
    if (resultFile && existsSync(resultFile)) {
      try { parsed = parseLeanResult(JSON.parse(await readFile(resultFile, 'utf8')), run.config) } catch { parsed = null }
    } else {
      // صيغ إخراج بديلة
      const files = latest ? (await readdir(path.join(btDir, latest))).filter((f) => f.endsWith('.json')) : []
      for (const f of files) {
        try { const p = parseLeanResult(JSON.parse(await readFile(path.join(btDir, latest!, f), 'utf8')), run.config); if (p) { parsed = p; break } } catch { /* التالي */ }
      }
    }

    if (!parsed || parsed.trades === 0) {
      const out: StrategyRun = {
        ...running, status: 'insufficient_data', updatedAt: new Date().toISOString(),
        reasonAr: 'اكتمل التشغيل لكن بلا صفقات حقيقية — غالبًا لا بيانات عقود للفترة المطلوبة.',
        requirementsAr: buildStrategySpec().dataRequirements,
      }
      await saveRun(out); return out
    }

    const out: StrategyRun = {
      ...running,
      status: 'completed',
      label: 'historical',
      updatedAt: new Date().toISOString(),
      results: parsed,
      dataSource: {
        provider: 'local-lean',
        resolution: run.config.resolution,
        licenseAr: run.dataSource.licenseAr,
        coverageAr: `${run.config.period.from} → ${run.config.period.to}`,
      },
      dataQuality: { realContractPrices: true, hasBidAsk: true, intrabarResolution: run.config.resolution === 'minute', notesAr: [] },
      engineAr: `LEAN CLI ${env.leanCli.version ?? ''} · Docker ${env.docker.daemonRunning ? 'نشط' : 'متوقف'}`,
    }
    await saveRun(out)
    return out
  } catch (e) {
    const out: StrategyRun = {
      ...run, status: 'failed', updatedAt: new Date().toISOString(),
      reasonAr: `خطأ غير متوقع: ${(e as Error).message}`, requirementsAr: [],
    }
    await saveRun(out)
    return out
  }
}

// للاستخدام عند الحاجة لمجلد البيانات في مكان آخر
export async function ensureProjectScaffold(): Promise<void> {
  const dir = PROJECT_DIR()
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}
