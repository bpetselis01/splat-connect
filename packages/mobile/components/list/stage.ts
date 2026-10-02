// packages/mobile/components/list/stage.ts
//
// The board's one lifecycle vocabulary for My tutorials, My toys and Design
// challenges — Needs you (your move) · Live (public) · Waiting (someone else's
// move) · Hidden (only you can see it) · Declined · Handed over. Web's
// components/stage.tsx is the other half; the status → stage rules below are
// the ones web's /dashboard/toys and /dashboard/tutorials apply.
import type { Ionicons } from '@expo/vector-icons'
import type { ComponentProps } from 'react'
import type { TutorialStatus } from '@splat-connect/types'
import { theme } from '../../lib/theme'

export type StageKey = 'needsyou' | 'live' | 'waiting' | 'hidden' | 'declined' | 'gone'

type IconName = ComponentProps<typeof Ionicons>['name']

export const STAGE: Record<StageKey, { label: string; bg: string; fg: string; icon: IconName }> = {
  needsyou: { label: 'Needs you', bg: theme.colors.apricotSoft, fg: theme.colors.ink, icon: 'notifications-outline' },
  live: { label: 'Live', bg: theme.colors.mintSoft, fg: theme.colors.ink, icon: 'radio-outline' },
  waiting: { label: 'Waiting', bg: theme.colors.honeySoft, fg: theme.colors.ink, icon: 'hourglass-outline' },
  hidden: { label: 'Hidden', bg: theme.colors.surfaceSunken, fg: theme.colors.muted, icon: 'eye-off-outline' },
  declined: { label: 'Declined', bg: theme.colors.violetSoft, fg: theme.colors.ink, icon: 'close-circle-outline' },
  gone: { label: 'Handed over', bg: theme.colors.mintSoft, fg: theme.colors.ink, icon: 'gift-outline' },
}

/** Web's TUTORIAL_STAGE: a returned guide is the author's move. */
export const TUTORIAL_STAGE: Record<TutorialStatus, StageKey> = {
  approved: 'live',
  pending: 'waiting',
  rejected: 'needsyou',
  draft: 'hidden',
}

/** Web's toy rule: someone asked for it → Needs you; else published → Live; else Hidden. */
export function toyStage(status: string, waiting: number): StageKey {
  return waiting > 0 ? 'needsyou' : status === 'published' ? 'live' : 'hidden'
}

export type StageOption = { id: 'all' | StageKey; label: string; n: number }

/** The segmented filter's options: All first, then each stage in board order, with counts. */
export function stageOptions<T>(
  items: readonly T[],
  stageOf: (item: T) => StageKey,
  stages: readonly StageKey[],
  labels: Partial<Record<StageKey, string>> = {}
): StageOption[] {
  return [
    { id: 'all', label: 'All', n: items.length },
    ...stages.map((id) => ({
      id,
      label: labels[id] ?? STAGE[id].label,
      n: items.filter((i) => stageOf(i) === id).length,
    })),
  ]
}
