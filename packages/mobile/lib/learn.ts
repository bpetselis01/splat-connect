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
    return storage
      .getItem(LEARN_PROGRESS_KEY)
      .then((saved) => {
        if (!saved) return
        // Parsed defensively rather than cast. This value is whatever is on
        // the device, and a cast would let a corrupt one through to the spread
        // below, which throws on a non-iterable — permanently, on every focus,
        // with nothing on screen to say why. Unreadable progress is worth
        // starting over from; a dead Learn tab is not.
        const fromStorage: unknown = JSON.parse(saved)
        if (!Array.isArray(fromStorage)) {
          // Parsed, but not the shape this key holds. Same class of corruption
          // as a truncated write, and worth the same line in the log.
          console.error('[useLearnProgress] saved progress was not a list:', fromStorage)
          return
        }
        const slugs = fromStorage.filter((s): s is string => typeof s === 'string')
        // Union, not replace: markRead's setItem isn't awaited, so a focus
        // reload's getItem can resolve before it lands and would otherwise
        // wipe the just-marked slug back out of state. Read state is
        // monotonic here — nothing ever un-reads an article — so merging
        // what's on disk into what's already in memory is always correct,
        // never stale.
        setRead((prev) => new Set([...prev, ...slugs]))
      })
      .catch((err) => {
        // Includes JSON.parse throwing on a truncated write. Read state is a
        // convenience, never a source of truth — losing it costs six ticks.
        console.error('[useLearnProgress] could not read saved progress:', err)
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
      storage
        .setItem(LEARN_PROGRESS_KEY, JSON.stringify([...next]))
        .catch((err) => console.error('[useLearnProgress] could not save progress:', err))
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
