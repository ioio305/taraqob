// مُولّد مواصفة الاستراتيجية — يكتب lean/taraqob_spx_otm/strategy_spec.json من
// المصدر الواحد src/lib/v2/lab/strategySpec.ts، كي يقرأها محرك LEAN واختبار
// التطابق Python من نفس القيم التي تستخدمها المنصة (لا نسخة يدوية ثانية).
// التشغيل: npx tsx scripts/lab/gen-spec.ts
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { buildStrategySpec } from '../../src/lib/v2/lab/strategySpec.ts'

const spec = buildStrategySpec()
const outDir = path.resolve(process.cwd(), 'lean', 'taraqob_spx_otm')
mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'strategy_spec.json')
writeFileSync(outFile, JSON.stringify(spec, null, 2), 'utf8')
console.log(`كُتبت المواصفة (${spec.version}) إلى ${outFile}`)
