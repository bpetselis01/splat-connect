'use client'
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
import type { TutorialContributor, Profile } from '@splat-connect/types'

export function EditCollaboratorsSection({
  contributors,
  currentProfileId,
  isPrimary,
  onInvite,
  onRemove,
}: {
  contributors: (TutorialContributor & { profiles: Profile })[]
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
      <ul className="flex flex-col gap-2">
        {contributors.map((c) => {
          const isSelf = c.profile_id === currentProfileId
          const canAct = c.role === 'collaborator' && (isPrimary || isSelf)
          return (
            <li key={c.profile_id} className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink">{c.profiles.name}</span>
              <span className="text-xs text-muted">{c.role}</span>
              {canAct && (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => run(c.profile_id, () => onRemove(c.profile_id), isSelf ? 'Left tutorial' : 'Removed collaborator')}
                  className="btn btn-quiet btn-sm ml-auto"
                >
                  {pending === c.profile_id ? 'Working…' : isSelf ? 'Leave' : 'Remove'}
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
    </div>
  )
}
