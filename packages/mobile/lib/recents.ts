// packages/mobile/lib/recents.ts
//
// "Pick up where you left off": the last ten things opened, newest first, kept
// on the device, one list per signed-in account (Byron, 2026-10-05). Screens
// record with a plain call; the auth context tells this module whose list is
// current (setRecentsOwner). The eleventh entry pushes the oldest out, so
// storage never grows. Never a source of truth: unreadable storage starts
// empty, a failed write keeps the list in memory.
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

/** The device-wide key from before lists were per account; adopted once, then removed. */
export const RECENTS_KEY = 'home-recents'
// A dot, not a colon: iOS's secure store takes only letters, digits, '.', '-' and '_' in a key.
export const recentsKeyFor = (userId: string) => `${RECENTS_KEY}.${userId}`
export const RECENTS_CAP = 10
const CAP = RECENTS_CAP
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

let owner: string | null = null
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

/** Whose list is current: the signed-in account's id, or null when signed out (nothing is kept). */
export function setRecentsOwner(userId: string | null) {
  if (userId === owner) return
  // On a cold start a screen can open and record before the session is read
  // (a link straight to a guide); that visit belongs to the account that loads.
  const carried = owner === null ? list : []
  owner = userId
  list = carried
  loaded = false
  loading = null
  notify()
  // A screen already showing the list (Home, on a cold start) needs the new
  // account's list read now; it will not ask again.
  if (owner) void load().then(() => (carried.length ? persist() : undefined))
}

async function readFor(userId: string): Promise<string | null> {
  const storage = resolveAuthStorage()
  const raw = await storage.getItem(recentsKeyFor(userId))
  if (raw !== null) return raw
  // The first account to load on this device inherits the old shared list.
  const legacy = await storage.getItem(RECENTS_KEY)
  if (legacy !== null) await storage.removeItem(RECENTS_KEY)
  return legacy
}

function load() {
  const forOwner = owner
  if (!forOwner) {
    loaded = true
    return Promise.resolve()
  }
  if (loading) return loading
  // A read overtaken by an owner switch or a reset lands on nothing.
  const read: Promise<void> = readFor(forOwner)
    .then((raw) => {
      if (loading !== read) return
      // Anything recorded before the read landed stays on top.
      const mine = new Set(list.map((r) => r.key))
      list = [...list, ...parseRecents(raw).filter((r) => !mine.has(r.key))].slice(0, CAP)
    })
    .catch((err) => console.error('[recents] could not read recents, starting empty:', err))
    .finally(() => {
      if (loading !== read) return
      loaded = true
      notify()
    })
  loading = read
  return read
}

function persist() {
  if (!owner) return
  try {
    resolveAuthStorage()
      .setItem(recentsKeyFor(owner), JSON.stringify(list))
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
