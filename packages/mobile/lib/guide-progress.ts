// packages/mobile/lib/guide-progress.ts
//
// A parent's ticks on a guide — steps done, parts gathered, tools owned — kept on the
// device, per guide and per account, the way lib/learn.ts keeps Learn progress. Never a
// source of truth: unreadable storage starts empty, a failed write keeps the
// tick in memory for this visit.
import { useEffect, useRef, useState } from 'react'
import type { TutorialStep } from '@splat-connect/types'
import { resolveAuthStorage } from './supabase-storage'

// Per account, like recents: on a shared phone the next account must not see
// which guides the last one built. Set by auth-context as the session changes.
let owner: string | null = null
export const setTicksOwner = (userId: string | null) => {
  owner = userId
}

// SecureStore keys allow [A-Za-z0-9._-]; a uuid fits.
export const ticksKey = (kind: 'steps' | 'tools' | 'parts', tutorialId: string) =>
  `guide-${kind}.${tutorialId}.${owner ?? 'signed-out'}`

/** What the device holds, kept only where it names something the guide still has. */
export function parseTicks(raw: string | null, validIds: readonly string[]): Set<string> {
  if (!raw) return new Set()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    const valid = new Set(validIds)
    return new Set(parsed.filter((x): x is string => typeof x === 'string' && valid.has(x)))
  } catch {
    return new Set()
  }
}

type StepRef = Pick<TutorialStep, 'id' | 'position' | 'title'>

export function stepProgress(steps: readonly StepRef[], ticked: ReadonlySet<string>) {
  const total = steps.length
  const done = steps.filter((s) => ticked.has(s.id)).length
  return {
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    allDone: total > 0 && done === total,
    resume: done > 0 && done < total ? (steps.find((s) => !ticked.has(s.id)) ?? null) : null,
  }
}

// ponytail: ticks are keyed by step id, and 080's PUT gives every step a new id
// on each save, so a guide re-approved after an edit drops its readers' ticks.
// Key by position plus a body hash if parents ever lose progress that way.
export function useDeviceTicks(key: string, validIds: readonly string[]) {
  const storage = resolveAuthStorage()
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  // Which key and step list the stored ticks were last read for (a failed read
  // counts): build mode waits for its own steps' read to know where to resume.
  const [readFor, setReadFor] = useState<string | null>(null)
  // Bumped by reread(): a screen that stays mounted under another (the guide
  // page under build mode) reads the ticks again when it comes back.
  const [readCount, setReadCount] = useState(0)
  // A tap before the read lands wins: the read would otherwise undo it.
  const touched = useRef(false)
  const ids = validIds.join(',')

  useEffect(() => {
    let ignore = false
    touched.current = false
    storage
      .getItem(key)
      .then((raw) => {
        if (!ignore && !touched.current) setTicked(parseTicks(raw, validIds))
      })
      .catch((err) => console.error('[useDeviceTicks] could not read ticks, keeping them in memory:', err))
      .finally(() => {
        if (!ignore) setReadFor(`${key}|${ids}`)
      })
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ids, readCount])

  function write(next: Set<string>) {
    touched.current = true
    setTicked(next)
    storage
      .setItem(key, JSON.stringify([...next]))
      .catch((err) => console.error('[useDeviceTicks] could not save ticks, keeping them in memory:', err))
  }

  return {
    ticked,
    loaded: readFor === `${key}|${ids}`,
    reread: () => setReadCount((n) => n + 1),
    toggle: (id: string) => {
      const next = new Set(ticked)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      write(next)
    },
    reset: () => write(new Set()),
  }
}

export type Ticks = { ticked: ReadonlySet<string>; toggle: (id: string) => void }

/**
 * The parts gathered and tools owned for one guide, read once by the screen
 * so its summary card, its gathered bar and both checklists agree as you tick.
 */
export function useGatherTicks(tutorialId: string, parts: readonly { id: string }[], tools: readonly { id: string }[]) {
  const p = useDeviceTicks(ticksKey('parts', tutorialId), parts.map((x) => x.id))
  const t = useDeviceTicks(ticksKey('tools', tutorialId), tools.map((x) => x.id))
  const partsGot = parts.filter((x) => p.ticked.has(x.id)).length
  const toolsGot = tools.filter((x) => t.ticked.has(x.id)).length
  return {
    parts: { ticked: p.ticked, toggle: p.toggle } as Ticks,
    tools: { ticked: t.ticked, toggle: t.toggle } as Ticks,
    partsGot,
    toolsGot,
    left: parts.length + tools.length - partsGot - toolsGot,
  }
}
