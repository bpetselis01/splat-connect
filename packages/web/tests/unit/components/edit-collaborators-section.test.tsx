import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditCollaboratorsSection } from '@/components/edit-collaborators-section'
import { ToastProvider } from '@/components/toast'
import type {
  TutorialContributor,
  TutorialCollaboratorInvite,
  CollaboratorInviteStatus,
  Profile,
} from '@splat-connect/types'

// The component calls router.refresh() after a successful write, because
// revalidatePath alone does not re-render a client component that invoked a
// server action.
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const primary: TutorialContributor & { profiles: Profile } = {
  tutorial_id: 't1',
  profile_id: 'p1',
  role: 'primary',
  added_at: '',
  profiles: { id: 'p1', name: 'Primary Author', email: 'primary@test.local', role: 'contributor', created_at: '', public_showcase: true },
}
const collaborator = {
  ...primary,
  profile_id: 'p2',
  role: 'collaborator' as const,
  profiles: { id: 'p2', name: 'Jane', email: 'jane@test.local', role: 'contributor' as const, created_at: '', public_showcase: true },
}

const invite = (
  profileId: string,
  name: string,
  status: CollaboratorInviteStatus
): TutorialCollaboratorInvite & { profiles: Profile } => ({
  id: `i-${profileId}`,
  tutorial_id: 't1',
  invited_profile_id: profileId,
  invited_by: 'p1',
  status,
  requested_at: '',
  responded_at: null,
  profiles: {
    id: profileId,
    name,
    email: `${name}@test.local`,
    role: 'contributor',
    created_at: '',
    public_showcase: true,
  },
})

describe('EditCollaboratorsSection', () => {
  it('the primary sees Remove on a collaborator', () => {
    render(
      <EditCollaboratorsSection
        contributors={[primary, collaborator]}
        invites={[]}
        currentProfileId="p1"
        isPrimary
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('a collaborator sees Leave instead of Remove, and no invite field', () => {
    render(
      <EditCollaboratorsSection
        contributors={[primary, collaborator]}
        invites={[]}
        currentProfileId="p2"
        isPrimary={false}
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('Leave')).toBeInTheDocument()
    expect(screen.queryByLabelText(/invite/i)).not.toBeInTheDocument()
  })

  it('the primary can invite by email', async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined)
    render(
      <EditCollaboratorsSection
        contributors={[primary]}
        invites={[]}
        currentProfileId="p1"
        isPrimary
        onInvite={onInvite}
        onRemove={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText(/invite/i), { target: { value: 'jane@example.test' } })
    fireEvent.click(screen.getByText('Invite'))
    await waitFor(() => expect(onInvite).toHaveBeenCalledWith('jane@example.test'))
  })

  it('fires the shared toast naming the invitee after Invite succeeds', async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditCollaboratorsSection
          contributors={[primary]}
          invites={[]}
          currentProfileId="p1"
          isPrimary
          onInvite={onInvite}
          onRemove={vi.fn()}
        />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText(/invite/i), { target: { value: 'jane@example.test' } })
    fireEvent.click(screen.getByText('Invite'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invited jane@example.test'))
  })

  it('fires the shared toast with "Left tutorial" when a collaborator leaves', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditCollaboratorsSection
          contributors={[primary, collaborator]}
          invites={[]}
          currentProfileId="p2"
          isPrimary={false}
          onInvite={vi.fn()}
          onRemove={onRemove}
        />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Leave'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Left tutorial'))
  })

  // Tests: an invite is visible before the invitee answers it
  // How:   renders a pending invite with no matching contributor row
  // Chain: this is the whole bug — inviting writes only to
  //        tutorial_collaborator_invites, so a list built from
  //        tutorial_contributors alone cannot change when you click Invite
  it('shows a pending invitee who has no seat yet', () => {
    render(
      <EditCollaboratorsSection
        contributors={[primary]}
        invites={[invite('p3', 'Sam', 'pending')]}
        currentProfileId="p1"
        isPrimary
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('Sam')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })

  it('shows a declined invitee as REJECTED rather than dropping them', () => {
    render(
      <EditCollaboratorsSection
        contributors={[primary]}
        invites={[invite('p3', 'Sam', 'declined')]}
        currentProfileId="p1"
        isPrimary
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('REJECTED')).toBeInTheDocument()
  })

  // Tests: accepting does not put the same person in the list twice
  // How:   the accepted invite and the contributor row are the same profile
  // Chain: collaborator-invites.ts writes the seat AND keeps the invite row,
  //        so both tables describe Jane the moment she accepts
  it('renders one row for someone whose invite was accepted', () => {
    render(
      <EditCollaboratorsSection
        contributors={[primary, collaborator]}
        invites={[invite('p2', 'Jane', 'accepted')]}
        currentProfileId="p1"
        isPrimary
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getAllByText('Jane')).toHaveLength(1)
    expect(screen.getByText('MEMBER')).toBeInTheDocument()
    expect(screen.queryByText('PENDING')).not.toBeInTheDocument()
  })

  it('badges the primary contributor OWNER, not LEADER', () => {
    render(
      <EditCollaboratorsSection
        contributors={[primary]}
        invites={[]}
        currentProfileId="p1"
        isPrimary
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('OWNER')).toBeInTheDocument()
    expect(screen.queryByText('LEADER')).not.toBeInTheDocument()
  })

  it('offers no Remove on a pending invite, which has no seat to give up', () => {
    render(
      <EditCollaboratorsSection
        contributors={[primary]}
        invites={[invite('p3', 'Sam', 'pending')]}
        currentProfileId="p1"
        isPrimary
        onInvite={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })
})
