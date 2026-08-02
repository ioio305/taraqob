'use client'

// ── محوّل المؤشرات المشترك — يحفظ الاختيار ويقلب المنصة عليه ──────────────────
// SPX → صفحته الأم (/v2) · الباقي → /v2/index?symbol=X (نفس المحرك والعرض)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { INDICES, getSelectedIndex, setSelectedIndex, type IndexId } from '@/lib/v2/indexSelection'

const GOLD = '#C9943A'

export function IndexSwitcher({ active }: { active?: IndexId }) {
  const router = useRouter()
  const [sel, setSel] = useState<IndexId>('SPX')

  useEffect(() => {
    setSel(getSelectedIndex())
    const onCustom = (e: Event) => setSel((e as CustomEvent<IndexId>).detail)
    const onStorage = () => setSel(getSelectedIndex())
    window.addEventListener('taraqob:index', onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('taraqob:index', onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const current = active ?? sel

  function pick(id: IndexId, href: string) {
    setSelectedIndex(id)
    setSel(id)
    router.push(href)
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {INDICES.map(ix => {
        const isActive = ix.id === current
        return (
          <button key={ix.id} onClick={() => pick(ix.id, ix.href)}
                  className="px-4 py-1.5 rounded-full text-xs font-black transition-transform hover:scale-105"
                  style={{
                    color: isActive ? GOLD : '#8A97A6',
                    background: isActive ? 'rgba(201,148,58,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? 'rgba(201,148,58,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
            {ix.id}
          </button>
        )
      })}
    </div>
  )
}
