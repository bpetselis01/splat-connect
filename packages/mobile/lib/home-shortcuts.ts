// packages/mobile/lib/home-shortcuts.ts
//
// Home's customisable grid: the catalogue of every place a member can go, and
// which of them this member pinned, kept on the device per user (guest when
// signed out). Never a source of truth: unreadable storage means the default
// eight, and a failed write keeps the change in memory for this visit.
import { useEffect, useState } from 'react'
import type { Href } from 'expo-router'
import type { Ionicons } from '@expo/vector-icons'
import { useAuth } from './auth-context'
import { resolveAuthStorage } from './supabase-storage'

export type ShortcutGroup = 'Learn and build' | 'Toys' | 'Printing' | 'Community' | 'Me'
type ShortcutTint = 'sky' | 'apr' | 'mint' | 'honey' | 'vio' | 'sun'
export type Feature = {
  id: string
  name: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  tint: ShortcutTint
  group: ShortcutGroup
  href: Href
}

// Hrefs are the same ones the hubs push today (explore-screen, my-routes).
export const FEATURES: Feature[] = [
  { id: 'guides', name: 'Guides', icon: 'book-outline', tint: 'sky', group: 'Learn and build', href: '/guides' },
  { id: 'learn', name: 'Learn', icon: 'school-outline', tint: 'honey', group: 'Learn and build', href: '/explore/learn' },
  { id: 'challenges', name: 'Design challenges', icon: 'extension-puzzle-outline', tint: 'vio', group: 'Learn and build', href: '/explore/challenges' },
  { id: 'submit-idea', name: 'Submit an idea', icon: 'bulb-outline', tint: 'vio', group: 'Learn and build', href: '/explore/challenges/new' },
  { id: 'makers', name: 'Makers wanted', icon: 'people-outline', tint: 'sky', group: 'Learn and build', href: '/explore/makers-wanted' },
  { id: 'new-guide', name: 'Write a guide', icon: 'create-outline', tint: 'honey', group: 'Learn and build', href: '/guides/new' },
  { id: 'my-guides', name: 'My guides', icon: 'document-text-outline', tint: 'honey', group: 'Learn and build', href: '/tutorials' },
  { id: 'toys', name: 'Toys', icon: 'shapes-outline', tint: 'apr', group: 'Toys', href: '/toy-library' },
  { id: 'my-toys', name: 'My toys', icon: 'albums-outline', tint: 'apr', group: 'Toys', href: '/toys' },
  { id: 'add-toy', name: 'Add a toy', icon: 'add-circle-outline', tint: 'apr', group: 'Toys', href: '/toys/new' },
  { id: 'exchanges', name: 'My exchanges', icon: 'swap-horizontal-outline', tint: 'sky', group: 'Toys', href: '/exchanges' },
  { id: 'saves', name: 'My saves', icon: 'heart-outline', tint: 'apr', group: 'Toys', href: '/saved' },
  { id: 'organisations', name: 'Organisations', icon: 'business-outline', tint: 'mint', group: 'Toys', href: '/toy-library/organisations' },
  { id: 'print', name: 'Request a print', icon: 'print-outline', tint: 'mint', group: 'Printing', href: '/printing' },
  { id: 'printers', name: 'Find a printer', icon: 'map-outline', tint: 'vio', group: 'Printing', href: '/map?kind=printer' },
  { id: 'print-requests', name: 'My print requests', icon: 'list-outline', tint: 'apr', group: 'Printing', href: '/print-requests' },
  { id: 'print-for-others', name: 'Print for others', icon: 'hand-left-outline', tint: 'mint', group: 'Printing', href: '/print-for-others' },
  { id: 'print-basics', name: 'Printing basics', icon: 'help-circle-outline', tint: 'sky', group: 'Printing', href: '/printing/basics' },
  { id: 'events', name: 'Events', icon: 'calendar-outline', tint: 'honey', group: 'Community', href: '/events' },
  { id: 'recycling', name: 'Recycling', icon: 'refresh-outline', tint: 'mint', group: 'Community', href: '/explore/recycling' },
  { id: 'inbox', name: 'Messages', icon: 'chatbubbles-outline', tint: 'sky', group: 'Community', href: '/inbox' },
  { id: 'about', name: 'About SPLAT', icon: 'information-circle-outline', tint: 'sky', group: 'Community', href: '/explore/about' },
  { id: 'account', name: 'Account', icon: 'person-outline', tint: 'vio', group: 'Me', href: '/account' },
  { id: 'notifications', name: 'Notifications', icon: 'notifications-outline', tint: 'sun', group: 'Me', href: '/notifications' },
  { id: 'organisation', name: 'My organisation', icon: 'briefcase-outline', tint: 'mint', group: 'Me', href: '/organisation' },
]

// "makers" is the Makers wanted door.
export const DEFAULT_HOME_IDS = ['guides', 'toys', 'print', 'printers', 'events', 'saves', 'recycling', 'makers']

const KNOWN = new Set(FEATURES.map((f) => f.id))
const BY_ID = new Map(FEATURES.map((f) => [f.id, f]))

// SecureStore keys allow [A-Za-z0-9._-]; a uuid fits.
export const homeKey = (userId: string | null | undefined) => `home-shortcuts.${userId ?? 'guest'}`

/** What the device holds, kept only where it names a feature that still exists. */
export function parseIds(raw: string | null): string[] {
  if (!raw) return DEFAULT_HOME_IDS
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_HOME_IDS
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string' && KNOWN.has(x)))]
  } catch {
    return DEFAULT_HOME_IDS
  }
}

// One module-level copy per key so every component using the hook stays in sync.
const cache = new Map<string, string[]>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Test seam: forget what this process has loaded. */
export function resetHomeShortcutsCache() {
  cache.clear()
  notify()
}

function load(key: string) {
  resolveAuthStorage()
    .getItem(key)
    .then((raw) => {
      // A change made before the read landed wins.
      if (!cache.has(key)) cache.set(key, parseIds(raw))
    })
    .catch((err) => {
      console.error('[useHomeShortcuts] could not read shortcuts, using the defaults:', err)
      if (!cache.has(key)) cache.set(key, DEFAULT_HOME_IDS)
    })
    .finally(notify)
}

function commit(key: string, ids: string[]) {
  cache.set(key, ids)
  notify()
  try {
    resolveAuthStorage()
      .setItem(key, JSON.stringify(ids))
      .catch((err) => console.error('[useHomeShortcuts] could not save shortcuts, keeping them in memory:', err))
  } catch (err) {
    console.error('[useHomeShortcuts] could not save shortcuts, keeping them in memory:', err)
  }
}

export function useHomeShortcuts() {
  const { session } = useAuth()
  const key = homeKey(session?.user?.id)
  const [, setTick] = useState(0)

  useEffect(() => {
    const l = () => setTick((n) => n + 1)
    listeners.add(l)
    if (!cache.has(key)) load(key)
    return () => {
      listeners.delete(l)
    }
  }, [key])

  const ready = cache.has(key)
  const ids = cache.get(key) ?? DEFAULT_HOME_IDS
  const set = (next: string[]) => commit(key, next)

  return {
    ids,
    features: ids.map((id) => BY_ID.get(id)).filter((f): f is Feature => !!f),
    ready,
    add: (id: string) => {
      if (KNOWN.has(id) && !ids.includes(id)) set([...ids, id])
    },
    remove: (id: string) => set(ids.filter((x) => x !== id)),
    move: (id: string, toIndex: number) => {
      if (!ids.includes(id)) return
      const rest = ids.filter((x) => x !== id)
      rest.splice(Math.max(0, Math.min(toIndex, rest.length)), 0, id)
      set(rest)
    },
    moveToTop: (id: string) => {
      if (ids.includes(id)) set([id, ...ids.filter((x) => x !== id)])
    },
    reset: () => set(DEFAULT_HOME_IDS),
  }
}
