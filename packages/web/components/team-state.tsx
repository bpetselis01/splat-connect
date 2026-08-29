/**
 * Team State — the single owner of how a tutorial's team is worded, coloured
 * and ordered.
 *
 * Sibling to backing-state.tsx, and deliberately the same palette: honey means
 * "waiting", mint means "went through", apricot means "did not". A contributor
 * on the Team step sees the Collaborators panel and the Backing panel directly
 * below it agree, because both render through a module like this one.
 *
 * Two tables feed one list. tutorial_contributors holds the people who are on
 * the project; tutorial_collaborator_invites holds the handshake that put them
 * there. An accepted invite leaves a row in BOTH — collaborator-invites.ts
 * writes the seat and keeps the invite — so teamRows() drops an invite whenever
 * a contributor row for the same person exists. Without that every accepted
 * collaborator would appear twice.
 *
 * "OWNER", not "LEADER": leader already means organisation leader everywhere
 * else here (org_leaders, the leader terms, admin/organizations), and one word
 * cannot carry both meanings on one page.
 *
 * Related files:
 * - components/backing-state.tsx: the module this mirrors
 * - packages/api/src/routes/collaborators.ts: invite and remove
 * - packages/api/src/routes/collaborator-invites.ts: accept and decline
 */
import type { Profile, TutorialContributor, TutorialCollaboratorInvite } from '@splat-connect/types'

export type TeamState = 'primary' | 'collaborator' | 'pending' | 'declined'

const BADGE: Record<TeamState, string> = {
  primary: 'bg-mint-soft text-mint-deep',
  collaborator: 'bg-mint-soft text-mint-deep',
  pending: 'bg-honey-soft text-honey-deep',
  declined: 'bg-apricot-soft text-apricot-deep',
}

const WORD: Record<TeamState, string> = {
  primary: 'OWNER',
  collaborator: 'MEMBER',
  pending: 'PENDING',
  declined: 'REJECTED',
}

/** Seated people first, then who is still deciding, then who said no. */
const RANK: Record<TeamState, number> = { primary: 0, collaborator: 1, pending: 2, declined: 3 }

export function TeamBadge({ state }: { state: TeamState }) {
  return <span className={`badge ${BADGE[state]}`}>{WORD[state]}</span>
}

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
    ...contributors.map((c) => ({
      profileId: c.profile_id,
      name: c.profiles.name,
      state: c.role,
      isContributor: true,
    })),
    // Two guards, two different holes: `seated` catches the accepted invite
    // whose seat we can already see, and the status check catches an accepted
    // invite whose contributor row this reader has no RLS access to — a
    // collaborator reads their own invite but not necessarily every seat.
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
