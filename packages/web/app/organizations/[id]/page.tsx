/**
 * Organisation Leader Dashboard
 *
 * Two lists, and the split between them is the point: backing a project is a
 * commitment to look at it, not a verdict on it.
 *
 * The leader half is ONE queue of everything waiting on this organisation, oldest
 * first — requests to back and projects to review together, distinguished by a
 * badge. The two acts stay separate where it matters: on the project page, which
 * offers only the action the state allows.
 *
 * Both come from GET /api/tutorials with no filter for safety: the leader read
 * grant in 007 already limits that list to projects offered to an organisation the
 * caller leads. The filtering here only splits the two lists.
 *
 * Access is checked by requireOrgLeader rather than by middleware — leadership is
 * per-organisation data, not a role. See lib/org-access.ts.
 *
 * Related files:
 * - packages/api/src/routes/tutorial-orgs.ts: accept and decline
 * - app/org/[orgId]/review/[tutorialId]: the approve/reject screen
 * - components/org-review-banner.tsx: the terms gate for reviewing
 */
import Link from 'next/link'
import { BoundaryLink } from '@/components/boundary-link'
import { notFound, redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { isOrgLeader } from '@/lib/org-access'
import { OrgReviewBanner } from '@/components/org-review-banner'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { BackingBadge } from '@/components/backing-state'
import { BookOpen, Inbox } from '@/components/icons'
import type { Tutorial, TutorialOrg, UserAgreement, Organization, OrgLeader } from '@splat-connect/types'

type Backed = Tutorial & { tutorial_orgs?: TutorialOrg[] }

type OrgWithLeaders = Organization & { org_leaders?: OrgLeader[] }

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: orgId } = await params

  // Leadership decides whether this dashboard renders at all. A non-leader —
  // including an anonymous visitor, who is trivially not a leader — is sent to
  // the public profile instead of a dead end: isOrgLeader itself never fails
  // open for an unauthenticated caller (its GET /api/organizations/mine sits
  // behind authMiddleware same as everything else here), so this is a redirect,
  // not a weaker check.
  const leads = await isOrgLeader(orgId)
  if (!leads) redirect(`/organizations/${orgId}/public`)

  let org: OrgWithLeaders
  try {
    org = await apiClient.get<OrgWithLeaders>(`/api/organizations/${orgId}`)
  } catch {
    notFound()
  }

  const [tutorials, agreements] = await Promise.all([
    apiClient.get<Backed[]>('/api/tutorials').catch(() => [] as Backed[]),
    apiClient.get<UserAgreement[]>('/api/agreements/me').catch(() => [] as UserAgreement[]),
  ])
  const hasTerms = agreements.some((a) => a.agreement_type === 'org_leader_terms')
  const rowFor = (t: Backed) => t.tutorial_orgs?.find((b) => b.org_id === orgId)

  // ONE queue, oldest first. Two sections put the leader in the position of
  // merging the answer themselves — they arrive asking "what is oldest", not
  // "what kind of thing is oldest". The two acts stay distinguished where it
  // matters: on the project page, which offers only the applicable action.
  const waiting = tutorials
    .filter((t) => {
      const row = rowFor(t)
      if (!row) return false
      if (row.status === 'pending') return true
      return row.status === 'accepted' && t.status === 'pending'
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  // The public half: what this organisation has actually put its name to. Derived
  // from the list rather than a dedicated endpoint — GET /api/tutorials already
  // embeds the backing rows.
  const backed = tutorials.filter(
    (t) => t.status === 'approved' && rowFor(t)?.status === 'accepted'
  )

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 title-detail">{org!.name}</h1>
      {org!.description && (
        <p className="mb-6 max-w-prose text-muted">{org!.description}</p>
      )}

      {org!.status === 'suspended' && (
        <p className="alert alert-danger mb-6">
          This organisation is suspended. You can still see its work, but you cannot
          approve or reject anything.
        </p>
      )}

      {/* The public half — what this organisation has actually put its name to.
          This is the answer to "who are they?" that a badge on a library card
          cannot give, and it is the same for a leader and a stranger. */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-ink">
          Tutorials backed ({backed.length})
        </h2>
        {backed.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span aria-hidden="true" className="empty-badge text-brand-dark">
              <BookOpen className="h-8 w-8" />
            </span>
            <p className="mt-4 font-bold text-ink">Nothing backed yet.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              This organisation has not backed a published tutorial yet.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {backed.map((t) => (
              <li key={t.id}>
                {/* The leader dashboard carries the rail; /tutorials/[id] is the
                    public page. BoundaryLink forces the full load that lets the
                    header replace it. The whole card is the target — the same
                    change the merged queue in dashboard/organisation carries. */}
                <BoundaryLink href={`/tutorials/${t.id}`} className="card card-link p-4">
                  <span className="text-sm font-bold text-ink">{t.title}</span>
                  {t.description && (
                    <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
                      {t.description}
                    </p>
                  )}
                </BoundaryLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!hasTerms && <OrgReviewBanner />}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-ink">
          Waiting on you ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span aria-hidden="true" className="empty-badge text-brand-dark">
              <Inbox className="h-8 w-8" />
            </span>
            <p className="mt-4 font-bold text-ink">Nothing waiting.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Contributors ask by choosing your organisation when they submit a
              tutorial.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {waiting.map((t) => (
              <li key={t.id}>
                {/* Always the project page, never /tutorials/[id]. That link is
                    the hole: the public page serves only approved work, so every
                    item in this queue 404'd. */}
                <Link
                  href={`/organizations/${orgId}/projects/${t.id}`}
                  className="card card-link p-4"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <BackingBadge status={rowFor(t)!.status} />
                    <span className="text-sm font-bold text-ink">{t.title}</span>
                    <span className="ml-auto">
                      <DifficultyBadge difficulty={t.difficulty} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
