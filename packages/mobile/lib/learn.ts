import { useEffect, useState } from 'react'
import { resolveAuthStorage } from './supabase-storage'
import { LEARN_ARTICLES, type LearnArticle } from './learn-content'

export const LEARN_PROGRESS_KEY = 'learn-progress'

export type LearnProgress = {
  read: Set<string>
  markRead: (slug: string) => void
  next: LearnArticle | null
  count: number
}

export function useLearnProgress(): LearnProgress {
  const [read, setRead] = useState<Set<string>>(new Set())
  const storage = resolveAuthStorage()

  useEffect(() => {
    storage.getItem(LEARN_PROGRESS_KEY).then((saved) => {
      if (!saved) return
      setRead(new Set(JSON.parse(saved) as string[]))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function markRead(slug: string) {
    setRead((prev) => {
      if (prev.has(slug)) return prev
      const next = new Set(prev).add(slug)
      void storage.setItem(LEARN_PROGRESS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  return {
    read,
    markRead,
    next: LEARN_ARTICLES.find((a) => !read.has(a.slug)) ?? null,
    count: read.size,
  }
}
