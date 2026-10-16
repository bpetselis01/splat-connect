// packages/mobile/lib/team-state.ts
//
// Who is on a guide's team, in display order. Port of web's team-state.tsx
// (teamRows, rank, badge words) without the JSX; a change there is the
// reminder to bring this copy along.
import type { Profile, TutorialContributor, TutorialCollaboratorInvite } from '@splat-connect/types'

export type TeamState = 'primary' | 'collaborator' | 'pending' | 'declined'

export const TEAM_WORD: Record<TeamState, string> = {
  primary: 'OWNER',
  collaborator: 'MEMBER',
  pending: 'PENDING',
  declined: 'REJECTED',
}

/** Seated people first, then who is still deciding, then who said no. */
const RANK: Record<TeamState, number> = { primary: 0, collaborator: 1, pending: 2, declined: 3 }

export interface TeamRow {
  profileId: string
  name: string
  state: TeamState
  /** Only a seated contributor can be removed or leave; an invite has no seat. */
  isContributor: boolean
}

export function teamRows(
  contributors: (TutorialContributor & { profiles: Profile })[],
  invites: (TutorialCollaboratorInvite & { profiles: Profile })[]
): TeamRow[] {
  const seated = new Set(contributors.map((c) => c.profile_id))

  const rows: TeamRow[] = [
    ...contributors.map((c) => ({ profileId: c.profile_id, name: c.profiles.name, state: c.role, isContributor: true })),
    // `seated` catches an accepted invite whose seat we can see; the status
    // check catches one whose contributor row this reader cannot read (RLS).
    ...invites
      .filter((i) => !seated.has(i.invited_profile_id) && i.status !== 'accepted')
      .map((i) => ({
        profileId: i.invited_profile_id,
        name: i.profiles.name,
        state: i.status === 'declined' ? ('declined' as const) : ('pending' as const),
        isContributor: false,
      })),
  ]

  return rows.sort((a, b) => RANK[a.state] - RANK[b.state])
}
