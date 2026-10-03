// packages/mobile/lib/recents.ts
//
// "Pick up where you left off": the last few things opened, newest first, kept
// on the device. Device-wide rather than per user, because screens record with
// a plain call and have no signed-in user to hand. Never a source of truth:
// unreadable storage starts empty, a failed write keeps the list in memory.
import { useEffect, useState } from 'react'
import type { Href } from 'expo-router'
import { resolveAuthStorage } from './supabase-storage'

export type Recent = {
  key: string
  kind: 'guide' | 'toy' | 'event' | 'printer' | 'recycling' | 'challenge' | 'organisation'
  title: string
  subtitle: string
  badge?: string
  href: Href
  at: number
}

export const RECENTS_KEY = 'home-recents'
const CAP = 10
const KINDS = ['guide', 'toy', 'event', 'printer', 'recycling', 'challenge', 'organisation']

function isRecent(x: unknown): x is Recent {
  const r = x as Recent
  return (
    !!r &&
    typeof r === 'object' &&
    typeof r.key === 'string' &&
    KINDS.includes(r.kind) &&
    typeof r.title === 'string' &&
    typeof r.subtitle === 'string' &&
    typeof r.at === 'number' &&
    (typeof r.href === 'string' || (!!r.href && typeof r.href === 'object'))
  )
}

export function parseRecents(raw: string | null): Recent[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, CAP) : []
  } catch {
    return []
  }
}

let list: Recent[] = []
let loaded = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Test seam: forget what this process has loaded. */
export function resetRecentsCache() {
  list = []
  loaded = false
  loading = null
  notify()
}

function load() {
  loading ??= resolveAuthStorage()
    .getItem(RECENTS_KEY)
    .then((raw) => {
      // Anything recorded before the read landed stays on top.
      const mine = new Set(list.map((r) => r.key))
      list = [...list, ...parseRecents(raw).filter((r) => !mine.has(r.key))].slice(0, CAP)
    })
    .catch((err) => console.error('[recents] could not read recents, starting empty:', err))
    .finally(() => {
      loaded = true
      notify()
    })
  return loading
}

function persist() {
  try {
    resolveAuthStorage()
      .setItem(RECENTS_KEY, JSON.stringify(list))
      .catch((err) => console.error('[recents] could not save recents, keeping them in memory:', err))
  } catch (err) {
    console.error('[recents] could not save recents, keeping them in memory:', err)
  }
}

export function recordRecent(item: Omit<Recent, 'at' | 'key'> & { id: string }) {
  const { id, ...rest } = item
  const key = `${item.kind}:${id}`
  list = [{ ...rest, key, at: Date.now() }, ...list.filter((r) => r.key !== key)].slice(0, CAP)
  notify()
  // Read first so a record made before the first load does not overwrite what
  // the device already holds.
  load().then(persist)
}

export function useRecents() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const l = () => setTick((n) => n + 1)
    listeners.add(l)
    if (!loaded) load()
    return () => {
      listeners.delete(l)
    }
  }, [])
  return {
    recents: list,
    ready: loaded,
    clear: () => {
      list = []
      notify()
      persist()
    },
  }
}
