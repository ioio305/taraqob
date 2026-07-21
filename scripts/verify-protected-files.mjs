import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const protectedFiles = {
  'src/app/api/v2/recommend/route.ts': '0ec924a3acf41ff3e34dca30a4381ee41629252439b17bcbe7fc8b5fc8145a12',
  'src/app/api/v2/analyze/route.ts': 'be867b138c57f160bdd7572e9f71c06af34f04371c0c1d527b799ab879cf0bb5',
  'src/app/api/v2/strategy/route.ts': '872d47563057ee8a2d4a7b8dcd7a5204e165c9272be3b48766bea199656670e5',
  'src/app/api/v2/chart/route.ts': '33f5e963a096129c55e69ba5276c3ca147d4d5545fa9905a067d2244fc36e710',
  'src/app/v2/chart/page.tsx': '56d862dd8cbc993971937022ebbfb1abaf284c94c830ba484db2f526ecacfa3b',
  'src/lib/v2/strategyEngine.ts': '66fe695430338632decfe09c58352768ea8082d1fa4e2db412e88f9f9b8afaf0',
  'src/lib/v2/marketAnalysis.ts': 'bc92d45f51f9d27ca604aa9b2430d157b205bcd47858210e8c736880b1bd2fcc',
  'src/lib/v2/marketReaction.ts': '264380454674d8db2bc4ec558edb4db28122f4b311694c2801abea4c6a906c5e',
  'src/lib/v2/marketData.ts': '22dd5f1f4b7fa526eb032684680e799e3ce21c567b1abfd258c00c4f94bf4eac',
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
