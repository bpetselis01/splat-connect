import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditCollaboratorsSection } from '@/components/edit-collaborators-section'
import { ToastProvider } from '@/components/toast'
import type { TutorialContributor, Profile } from '@splat-connect/types'

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

describe('EditCollaboratorsSection', () => {
  it('the primary sees Remove on a collaborator', () => {
    render(
      <EditCollaboratorsSection
        contributors={[primary, collaborator]}
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
})
