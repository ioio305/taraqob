import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const protectedFiles = {
  'src/app/api/v2/recommend/route.ts': '0ec924a3acf41ff3e34dca30a4381ee41629252439b17bcbe7fc8b5fc8145a12',
  'src/app/api/v2/analyze/route.ts': 'e05ef2eb34dd5063e9c0c67e7c1a8ae2ce90bef261f9b7b597fec803ae72217c',
  'src/app/api/v2/strategy/route.ts': '872d47563057ee8a2d4a7b8dcd7a5204e165c9272be3b48766bea199656670e5',
  'src/app/api/v2/chart/route.ts': '76ed5736b3dcf250bf1ff0c01ef842649784540706cc52df1fc5d27b3de3b057',
  'src/app/v2/chart/page.tsx': '60f0e356a8b6225962f169b69740f4cef5bf42c5d96ff66f0d7563ac2e157920',
  'src/lib/v2/strategyEngine.ts': '66fe695430338632decfe09c58352768ea8082d1fa4e2db412e88f9f9b8afaf0',
  'src/lib/v2/marketAnalysis.ts': 'bc92d45f51f9d27ca604aa9b2430d157b205bcd47858210e8c736880b1bd2fcc',
  'src/lib/v2/marketReaction.ts': '264380454674d8db2bc4ec558edb4db28122f4b311694c2801abea4c6a906c5e',
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
