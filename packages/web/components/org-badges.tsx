/**
 * The backing badges on a published tutorial.
 *
 * Renders only ACCEPTED organisations. A pending or declined request must never
 * appear anywhere public — an organisation's mark belongs only where one of its
 * leaders put it. The API already filters this way, so the check here is belt and
 * braces rather than the only guard.
 *
 * The approver line is separate from the badge list on purpose. Several
 * organisations may back one project but only one leader approves it, so
 * "backed by A, B" and "approved by Sam of A" are different claims and the page
 * should not blur them.
 *
 * Related files:
 * - packages/api/src/routes/tutorial-orgs.ts: GET /api/tutorials/:id/orgs
 * - supabase/migrations/007_organizations.sql: the public badge SELECT policy
 */
import type { TutorialOrg } from '@splat-connect/types'

export function OrgBadges({
  backing,
  approvedByName,
  approvedForOrgName,
}: {
  backing: TutorialOrg[]
  approvedByName?: string | null
  approvedForOrgName?: string | null
}) {
  const accepted = backing.filter((b) => b.status === 'accepted')
  if (accepted.length === 0 && !approvedByName) return null

  return (
    <div className="mt-3 text-sm">
      {accepted.length > 0 && (
        <p className="font-medium text-ink">
          Backed by{' '}
          {accepted
            .map((b) => b.organizations?.name)
            .filter(Boolean)
            .join(', ')}
        </p>
      )}
      {approvedByName && (
        <p className="mt-1 text-xs text-muted">
          Approved by {approvedByName}
          {approvedForOrgName ? `, ${approvedForOrgName}` : ''}
        </p>
      )}
    </div>
  )
}
