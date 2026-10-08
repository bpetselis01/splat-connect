// packages/mobile/lib/guide-notes.ts
//
// Community notes on a guide (093): the fetch, and the board's derived
// labels — revisions vs discussion, per-step counts, pinned missing steps.
import { logFailure } from './log'
import { useCallback, useEffect, useState } from 'react'
import type { GuideNote } from '@splat-connect/types'
import { apiClient } from './api-client'

export function useGuideNotes(tutorialId: string) {
  const [notes, setNotes] = useState<GuideNote[]>([])
  const reload = useCallback(
    () =>
      apiClient
        .get<GuideNote[]>(`/api/public/tutorials/${tutorialId}/notes`)
        .then(setNotes)
        .catch((err) => logFailure('[useGuideNotes] fetch failed:', err)),
    [tutorialId]
  )
  useEffect(() => {
    void reload()
  }, [reload])
  return { notes, reload }
}

const isMissing = (n: GuideNote, stepCount: number) => n.step_position == null || n.step_position > stepCount

export const stepLabel = (n: GuideNote, stepCount: number) =>
  isMissing(n, stepCount) ? 'Missing step' : `Step ${n.step_position}`

export const pinCountLabel = (n: number) => `${n} pinned revision${n === 1 ? '' : 's'}`

export function noteSummary(notes: GuideNote[], stepCount: number) {
  const pinned = notes.filter((n) => n.pinned_at)
  const open = notes.filter((n) => !n.pinned_at)
  const extras = pinned
    .filter((n) => isMissing(n, stepCount))
    .map((n, i) => ({ no: stepCount + 1 + i, body: n.body, by: n.author_name, pinnedBy: n.pinned_by_name ?? 'Deleted member' }))
  const labels = new Map<number, string>()
  for (let p = 1; p <= stepCount; p++) {
    const all = notes.filter((n) => n.step_position === p).length
    if (!all) continue
    const pins = pinned.filter((n) => n.step_position === p).length
    const rest = all - pins
    labels.set(p, [pins ? pinCountLabel(pins) : '', rest ? `${rest} note${rest === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '))
  }
  return { pinned, open, extras, labels }
}
