import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
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

  const reload = useCallback(() => {
    return storage.getItem(LEARN_PROGRESS_KEY).then((saved) => {
      if (!saved) return
      setRead(new Set(JSON.parse(saved) as string[]))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The hub (learn-hub.tsx) and the article reader (article-screen.tsx) each
  // hold their own instance of this hook, and expo-router keeps the hub
  // mounted underneath the article screen rather than tearing it down — so
  // a markRead on the article screen never touches the hub's state, and its
  // tick/Continue card/all-read line go stale until the app is backgrounded
  // and reopened. Same fix as my-tutorials/list-screen.tsx and
  // my-toys/list-screen.tsx use for their own stale-after-navigation gap.
  //
  // No separate mount-time effect: useFocusEffect's callback already runs on
  // a screen's initial focus, which covers the old mount-time read too.
  useFocusEffect(
    useCallback(() => {
      void reload()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload])
  )

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
