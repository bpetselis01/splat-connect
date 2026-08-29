import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamBadge, teamRows } from '@/components/team-state'
import type {
  ContributorRole,
  CollaboratorInviteStatus,
  Profile,
  TutorialContributor,
  TutorialCollaboratorInvite,
} from '@splat-connect/types'

const profile = (id: string, name: string): Profile => ({
  id,
  name,
  email: `${id}@test.local`,
  role: 'contributor',
  created_at: '',
  public_showcase: true,
})

const seat = (
  id: string,
  name: string,
  role: ContributorRole
): TutorialContributor & { profiles: Profile } => ({
  tutorial_id: 't1',
  profile_id: id,
  role,
  added_at: '',
  profiles: profile(id, name),
})

const invite = (
  id: string,
  name: string,
  status: CollaboratorInviteStatus
): TutorialCollaboratorInvite & { profiles: Profile } => ({
  id: `i-${id}`,
  tutorial_id: 't1',
  invited_profile_id: id,
  invited_by: 'p1',
  status,
  requested_at: '',
  responded_at: null,
  profiles: profile(id, name),
})

describe('TeamBadge', () => {
  // Tests: the word for a primary contributor is OWNER
  // Chain: "leader" already means organisation leader in this app (org_leaders,
  //        the leader terms, admin/organizations) — one word cannot carry both
  it('calls the primary contributor OWNER', () => {
    render(<TeamBadge state="primary" />)
    expect(screen.getByText('OWNER')).toBeInTheDocument()
  })

  it('calls a seated collaborator MEMBER', () => {
    render(<TeamBadge state="collaborator" />)
    expect(screen.getByText('MEMBER')).toBeInTheDocument()
  })

  // Tests: the palette agrees with the Backing panel rendered beside it
  // Chain: honey means waiting and mint means went through across this platform;
  //        a second colour language on the same step would be a drift
  it('paints a seat mint and an unanswered invite honey', () => {
    const { container: seated } = render(<TeamBadge state="collaborator" />)
    expect(seated.firstChild).toHaveClass('bg-mint-soft')

    const { container: waiting } = render(<TeamBadge state="pending" />)
    expect(waiting.firstChild).toHaveClass('bg-honey-soft')
  })

  it('paints a refusal apricot, the same as a declined backing', () => {
    const { container } = render(<TeamBadge state="declined" />)
    expect(container.firstChild).toHaveClass('bg-apricot-soft')
  })
})

describe('teamRows', () => {
  it('lists a pending invitee alongside the people already seated', () => {
    const rows = teamRows([seat('p1', 'Ada', 'primary')], [invite('p3', 'Sam', 'pending')])
    expect(rows.map((r) => [r.name, r.state])).toEqual([
      ['Ada', 'primary'],
      ['Sam', 'pending'],
    ])
  })

  // Tests: accepting an invite does not duplicate the person
  // How:   the same profile id holds a seat and an accepted invite
  // Chain: collaborator-invites.ts inserts the tutorial_contributors row and
  //        leaves the invite at 'accepted', so both tables describe them
  it('drops an accepted invite in favour of the seat it produced', () => {
    const rows = teamRows(
      [seat('p1', 'Ada', 'primary'), seat('p2', 'Jane', 'collaborator')],
      [invite('p2', 'Jane', 'accepted')]
    )
    expect(rows).toHaveLength(2)
    expect(rows.filter((r) => r.name === 'Jane')).toHaveLength(1)
  })

  // Tests: an accepted invite is dropped even when its seat is not readable
  // Chain: a collaborator reads their own invite but not necessarily every
  //        contributor row, so the status check has to stand on its own
  it('drops an accepted invite even with no matching seat in view', () => {
    const rows = teamRows([seat('p1', 'Ada', 'primary')], [invite('p2', 'Jane', 'accepted')])
    expect(rows.map((r) => r.name)).toEqual(['Ada'])
  })

  it('orders seats first, then who is deciding, then who said no', () => {
    const rows = teamRows(
      [seat('p2', 'Jane', 'collaborator'), seat('p1', 'Ada', 'primary')],
      [invite('p4', 'Kim', 'declined'), invite('p3', 'Sam', 'pending')]
    )
    expect(rows.map((r) => r.name)).toEqual(['Ada', 'Jane', 'Sam', 'Kim'])
  })

  // Tests: only a seat can be acted on
  // Chain: Remove and Leave both delete a tutorial_contributors row, and an
  //        invitee has none — offering the button would call an endpoint that
  //        has nothing to delete
  it('marks invites as unseated so no Remove is offered for them', () => {
    const rows = teamRows([seat('p1', 'Ada', 'primary')], [invite('p3', 'Sam', 'pending')])
    expect(rows.find((r) => r.name === 'Ada')!.isContributor).toBe(true)
    expect(rows.find((r) => r.name === 'Sam')!.isContributor).toBe(false)
  })
})
