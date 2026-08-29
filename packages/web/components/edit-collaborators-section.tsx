'use client'
import { PanelActions } from '@/components/panel-actions'
/**
 * Collaborator management for one project. Same run()-busy-state shape as
 * EditBackingSection.
 *
 * Related files:
 * - packages/api/src/routes/collaborators.ts: invite and remove/leave
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/toast'
import { TeamBadge, teamRows } from '@/components/team-state'
import type { TutorialContributor, TutorialCollaboratorInvite, Profile } from '@splat-connect/types'

export function EditCollaboratorsSection({
  contributors,
  invites,
  currentProfileId,
  isPrimary,
  onInvite,
  onRemove,
}: {
  contributors: (TutorialContributor & { profiles: Profile })[]
  /** Unanswered and declined invites. Without these the list cannot change
   *  until the invitee answers, which is what made Invite look like it did
   *  nothing. */
  invites: (TutorialCollaboratorInvite & { profiles: Profile })[]
  currentProfileId: string
  isPrimary: boolean
  onInvite: (email: string) => Promise<void>
  onRemove: (profileId: string) => Promise<void>
}) {
  const router = useRouter()
  const showToast = useToast()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<void>, toastMessage?: string) {
    setPending(key)
    setError(null)
    try {
      await fn()
      if (toastMessage) showToast(toastMessage)
      router.refresh()
    } catch {
      setError('That did not work. Please try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="px-5 pb-5">
      {/* Same row shape as the Backing panel below: state badge, then the name,
          then whatever action the row allows. The badge replaces the plain role
          word this list used to print — it says the same thing and agrees with
          the panel underneath. */}
      <ul className="flex flex-col gap-3">
        {teamRows(contributors, invites).map((r) => {
          const isSelf = r.profileId === currentProfileId
          // An invite has no seat to give up, so it offers neither Remove nor
          // Leave — the primary withdraws interest by re-inviting or ignoring it.
          const canAct = r.isContributor && r.state === 'collaborator' && (isPrimary || isSelf)
          return (
            <li key={r.profileId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <TeamBadge state={r.state} />
              <span className="text-sm font-medium text-ink">{r.name}</span>
              {canAct && (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => run(r.profileId, () => onRemove(r.profileId), isSelf ? 'Left tutorial' : 'Removed collaborator')}
                  className="btn btn-quiet btn-sm ml-auto"
                >
                  {pending === r.profileId ? 'Working…' : isSelf ? 'Leave' : 'Remove'}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {error && (
        <p role="alert" className="alert alert-danger mt-4">
          {error}
        </p>
      )}

      {isPrimary && (
        <div className="mt-5">
          <label htmlFor="invite-email" className="block text-sm font-medium text-ink">
            Invite a collaborator
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="their email"
              disabled={pending !== null}
              className="field min-w-0 flex-1"
            />
            <button
              type="button"
              disabled={!email.trim() || pending !== null}
              onClick={() => {
                const invitee = email.trim()
                run('invite', async () => { await onInvite(invitee); setEmail('') }, `Invited ${invitee}`)
              }}
              className="btn btn-accent"
            >
              {pending === 'invite' ? 'Inviting…' : 'Invite'}
            </button>
          </div>
        </div>
      )}

      {/* Invite adds a person; it does not save the step. Same reasoning as
          the backing panel below it. */}
      <PanelActions />
    </div>
  )
}
