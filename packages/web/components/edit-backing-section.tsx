'use client'
import { PanelActions } from '@/components/panel-actions'
/**
 * Backing controls for one project.
 *
 * A client component because the "ask another organisation" picker needs a
 * controlled select and both actions need a busy state. The writes are server
 * actions passed in as props, matching EditItemsSection.
 *
 * READ-ONLY once the tutorial is approved, and that is not a UI nicety: every
 * action is already refused by policy — you cannot add backing to published work,
 * and you cannot withdraw the organisation that approved it. Rendering the
 * controls anyway would offer buttons the database rejects.
 *
 * It also removes a hazard. Editing an approved tutorial resets it to pending, so
 * a contributor who came here only to withdraw a request would otherwise be one
 * stray keystroke from unpublishing their own work. The two dangerous states never
 * coexist.
 *
 * Related files:
 * - packages/api/src/routes/tutorial-orgs.ts: every endpoint behind this
 * - components/backing-state.tsx: the wording and the badge
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BackingBadge } from '@/components/backing-state'
import { useToast } from '@/components/toast'
import type { TutorialOrg, Organization, TutorialStatus } from '@splat-connect/types'

export function EditBackingSection({
  backing,
  organizations,
  tutorialStatus,
  reviewedForOrgId,
  onAsk,
  onWithdraw,
}: {
  backing: TutorialOrg[]
  organizations: Organization[]
  tutorialStatus: TutorialStatus
  reviewedForOrgId: string | null
  onAsk: (orgId: string) => Promise<void>
  onWithdraw: (orgId: string) => Promise<void>
}) {
  const router = useRouter()
  const showToast = useToast()
  const [choice, setChoice] = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const readOnly = tutorialStatus === 'approved'
  const asked = new Set(backing.map((b) => b.org_id))
  const available = organizations.filter((o) => !asked.has(o.id) && o.status === 'active')

  async function run(key: string, fn: () => Promise<void>, toastMessage?: string) {
    setPendingAction(key)
    setError(null)
    try {
      await fn()
      if (toastMessage) showToast(toastMessage)
      // revalidatePath in the server action marks the route stale, but a client
      // component that called it does not re-render on its own — without this the
      // contributor clicks Ask or Withdraw, the write lands, and nothing visibly
      // changes. Found by E2E, which is the only place the difference shows.
      router.refresh()
    } catch {
      setError('That did not work. Please try again.')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="px-5 pb-5">
      {backing.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          No organisation is backing this project yet. SPLAT will review it — asking
          an organisation is optional.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {backing.map((b) => {
            const name = b.organizations?.name ?? 'An organisation'
            const isApprover = readOnly && reviewedForOrgId === b.org_id
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <BackingBadge status={b.status} />
                <span className="text-sm font-medium text-ink">{name}</span>

                {isApprover && (
                  <span className="w-full text-xs leading-relaxed text-muted">
                    {name} approved this. Withdrawing means asking SPLAT to unpublish
                    it.
                  </span>
                )}

                {!readOnly && (
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => run(b.org_id, () => onWithdraw(b.org_id), `Withdrew from ${name}`)}
                    className="btn btn-quiet btn-sm ml-auto"
                  >
                    {pendingAction === b.org_id ? 'Withdrawing…' : 'Withdraw'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="alert alert-danger mt-4">
          {error}
        </p>
      )}

      {!readOnly && (
        <div className="mt-5">
          <label htmlFor="ask-org" className="block text-sm font-medium text-ink">
            Ask another organisation
          </label>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Their leaders can read this while they decide, including if they say no.
            Choose the one or two who know your work.
          </p>
          {available.length === 0 ? (
            <p className="mt-2 text-xs text-muted">
              {organizations.length === 0
                ? 'There are no organisations on the platform yet.'
                : 'You have already asked every organisation.'}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                id="ask-org"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                disabled={pendingAction !== null}
                className="min-w-0 flex-1"
              >
                <option value="">Choose an organisation…</option>
                {available.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.description ? `${o.name} — ${o.description}` : o.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!choice || pendingAction !== null}
                onClick={() => {
                  const orgName = available.find((o) => o.id === choice)?.name ?? 'the organisation'
                  run('ask', async () => {
                    await onAsk(choice)
                    setChoice('')
                  }, `Asked ${orgName}`)
                }}
                className="btn btn-accent"
              >
                {pendingAction === 'ask' ? 'Asking…' : 'Ask'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ask belongs to the organisation picker above, not to the step — it
          adds one backer rather than saving the section — so Next gets a row
          of its own rather than standing level with it. */}
      <PanelActions />
    </div>
  )
}
