/**
 * The pure rules behind a design challenge's detail, shared by web and mobile
 * (docs/superpowers/specs/2026-10-01-challenges-makers-build-design.md).
 */
import type { Role, ToyIdeaStatus } from './index'

export type OutcomeState = 'done' | 'now' | 'todo'

/** The Outcome tab's four steps. The two boards word the notes differently,
 *  so each platform reads its own; the labels are the same on both. */
export const OUTCOME_STEPS = [
  {
    label: 'Idea approved',
    note: {
      mobile: 'An admin reads it and opens it as a challenge.',
      web: 'An admin reads it and opens it as a challenge.',
    },
  },
  {
    label: 'Makers working',
    note: {
      mobile: 'People join and the thread records what has been tried.',
      web: 'People join and the thread becomes the record of what has been tried.',
    },
  },
  {
    label: 'Written up as a guide',
    note: {
      mobile: 'A maker turns the solution into a draft guide. It reads Waiting until approved.',
      web: 'A maker turns the solution into a draft guide. The challenge reads Waiting until it is approved.',
    },
  },
  {
    label: 'Guide published',
    note: {
      mobile: 'The draft goes through the same review as any other guide.',
      web: 'The draft goes through the same review as any other guide before a family sees it.',
    },
  },
] as const

// The board's CDAT: where each status stands on the four steps.
const OUTCOME_AT: Record<ToyIdeaStatus, number> = { pending: 0, challenge: 1, graduated: 2, rejected: 0 }

/** Each step's state for an idea at this status. A rejected idea went nowhere,
 *  so every step is still to do. */
export function outcomeStates(status: ToyIdeaStatus): OutcomeState[] {
  const at = OUTCOME_AT[status]
  return OUTCOME_STEPS.map((_, i) =>
    status === 'rejected' ? 'todo' : i < at ? 'done' : i === at ? 'now' : 'todo'
  )
}

/** profiles.role in the board's words on a Makers row. "OT" is not stored. */
export const PARTICIPANT_ROLE_LABEL: Record<Role, string> = { contributor: 'Maker', admin: 'Admin' }
