import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const protectedFiles = {
  'src/app/api/v2/recommend/route.ts': 'f9e1c28f3431a7fbff052bebc21bdff55862393c9f34a9c5377cbfdd209eb299',
  'src/app/api/v2/analyze/route.ts': 'dbc65888468de1c82e6b6ead85831533e817c905110df6f7240175ade509ed19',
  'src/app/api/v2/strategy/route.ts': '872d47563057ee8a2d4a7b8dcd7a5204e165c9272be3b48766bea199656670e5',
  'src/app/api/v2/chart/route.ts': 'efa7f2a08596e310c78586a0bff047aedbfc463b10ae9375d382b312302b8add',
  'src/app/v2/chart/page.tsx': '25fdfbb6b795ef036bf41d3519ff143c4d2624df72a8c8462c4a0d021aa937b2',
  'src/lib/v2/strategyEngine.ts': '866ca2dd4403fa49070ceb092ec1be322c6f447806c3a48bb2df23f83327e120',
  'src/lib/v2/marketAnalysis.ts': 'bc92d45f51f9d27ca604aa9b2430d157b205bcd47858210e8c736880b1bd2fcc',
  'src/lib/v2/marketReaction.ts': '8e9c21df8c4732cf40b596dd94a33a3c44544515cd5db11f2e3d2095c12fa91e',
  'src/lib/v2/marketData.ts': 'fe558fa325ae1426bfdcf6a6249fe23efd325d7819ebab3f4b183b06ae4847ed',
}

const changed = []
for (const [file, expected] of Object.entries(protectedFiles)) {
  const actual = createHash('sha256').update(await readFile(file)).digest('hex')
  if (actual !== expected) changed.push(file)
}

if (changed.length > 0) {
  console.error(`تغيّرت ملفات محمية:\n${changed.join('\n')}`)
  process.exit(1)
}

console.log('ملفات التوصيات والمؤشرات والشارت لم تتغير.')
