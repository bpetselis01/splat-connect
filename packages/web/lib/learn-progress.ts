'use client'
/**
 * Which lessons a reader has finished.
 *
 * localStorage, and deliberately so: the artboard's note is "Progress lives in
 * localStorage so a guest keeps it." Somebody working through a soldering
 * lesson on a Saturday should not have to make an account to keep their place,
 * and a course that forgot where they were every time they closed a tab is one
 * they would not come back to.
 *
 * What that costs is honest and stated on the page: progress is per-device. It
 * does not follow a sign-in, because nothing here writes to the server.
 *
 * useSyncExternalStore rather than useState + useEffect, and not only to satisfy
 * a lint rule. localStorage IS an external store: it is shared by every
 * component on the page and by other tabs, and this is the hook React added for
 * reading one. It gives a separate server snapshot, so the markup the server
 * renders matches the client's first paint and nothing is corrected a frame
 * later; and the `storage` event subscription means a lesson marked done in one
 * tab updates the outline in another.
 *
 * Every read and write is wrapped. A private window, cleared site data, or a
 * browser set to block storage throws on access rather than returning null.
 */
import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'splat_learn'

export type Stored = {
  /** Lesson slug → finished. */
  done?: Record<string, boolean>
  /** Checkpoint slug → question index → the option they picked. */
  answers?: Record<string, Record<number, number>>
}

/**
 * The parsed snapshot, cached.
 *
 * useSyncExternalStore compares snapshots by identity and loops forever if
 * getSnapshot returns a new object every call — so the raw string is what is
 * compared, and the parse is reused until it changes.
 */
let cachedRaw: string | null = null
let cachedValue: Stored = {}

/** The server's snapshot, and the client's before anything is stored. */
const EMPTY: Stored = {}

function getSnapshot(): Stored {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    return EMPTY
  }
  if (raw === cachedRaw) return cachedValue
  cachedRaw = raw
  try {
    cachedValue = raw ? (JSON.parse(raw) as Stored) : EMPTY
  } catch {
    cachedValue = EMPTY
  }
  return cachedValue
}

function getServerSnapshot(): Stored {
  return EMPTY
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab. The outline in this one should not go stale because the
  // reader finished a lesson next door.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function write(next: Stored) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage blocked or full. The lesson still works; only the memory of it
    // is lost, which is the right thing to degrade.
  }
  // `storage` does not fire in the tab that wrote, so this is what updates the
  // components here.
  for (const l of listeners) l()
}

export function useLearnProgress() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const markDone = useCallback((slug: string, done = true) => {
    const prev = getSnapshot()
    write({ ...prev, done: { ...prev.done, [slug]: done } })
  }, [])

  const recordAnswer = useCallback((slug: string, question: number, option: number) => {
    const prev = getSnapshot()
    const forLesson = { ...(prev.answers?.[slug] ?? {}), [question]: option }
    write({ ...prev, answers: { ...prev.answers, [slug]: forLesson } })
  }, [])

  const resetQuiz = useCallback((slug: string) => {
    const prev = getSnapshot()
    const answers = { ...prev.answers }
    delete answers[slug]
    const done = { ...prev.done }
    delete done[slug]
    write({ ...prev, answers, done })
  }, [])

  return {
    /**
     * False on the server and on the first client paint, true once the store
     * has been read. Guards the "0 of 16" that would otherwise flash before the
     * real number — which reads as the course forgetting.
     */
    ready: state !== EMPTY || cachedRaw !== null,
    done: state.done ?? {},
    answers: state.answers ?? {},
    markDone,
    recordAnswer,
    resetQuiz,
  }
}
