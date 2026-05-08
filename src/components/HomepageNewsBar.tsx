'use client'

import { useNews, NewsBar } from '@/components/v2/NewsBar'

export function HomepageNewsBar() {
  const { news, loading, failed } = useNews(300_000)
  return <NewsBar news={news} loading={loading} failed={failed} />
}
