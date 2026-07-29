/**
 * The Organisation tab — one leader's queue, merged across every organisation
 * they lead.
 *
 * No organisation id and no picker: GET /api/tutorials is already scoped by the
 * leader read grant in 007, so the list arrives correct for the caller.
 * app/organizations/[id] narrows that same list back down to one organisation,
 * which is the only reason it needs an id in the URL — this drops the narrowing
 * and badges each row with its organisation instead.
 *
 * Rows link to the existing review screen; the acts of backing and reviewing
 * stay distinguished there, which is where the applicable action is decided.
 *
 * Related files:
 * - app/organizations/[id]: the per-organisation page this generalises
 * - app/organizations/[id]/projects/[tutorialId]: the review screen rows link to
 * - lib/org-access.ts: the same "affordance, not control" rule this notFound() follows
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { OrgReviewBanner } from '@/components/org-review-banner'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { BackingBadge } from '@/components/backing-state'
import type { Tutorial, TutorialOrg, UserAgreement } from '@splat-connect/types'

type Backed = Tutorial & { tutorial_orgs?: TutorialOrg[] }

export default async function OrganisationTabPage() {
  const caps = await getCapabilities()
  // The tab strip hides this for a non-leader, but the strip is an affordance —
  // the page is its own control (lib/org-access.ts states the same rule).
  if (!caps || caps.ledOrgs.length === 0) notFound()

  const [tutorials, agreements] = await Promise.all([
    apiClient.get<Backed[]>('/api/tutorials').catch(() => [] as Backed[]),
    apiClient.get<UserAgreement[]>('/api/agreements/me').catch(() => [] as UserAgreement[]),
  ])
  const hasTerms = agreements.some((a) => a.agreement_type === 'org_leader_terms')
  const byId = new Map(caps.ledOrgs.map((o) => [o.id, o]))

  // Same rule as the per-organisation page, merged across every led organisation:
  // a pending row is a request to back; an accepted row on a pending tutorial is a
  // request to review. Oldest first — a leader arrives asking what is oldest, not
  // what kind of thing is oldest.
  const waiting = tutorials
    .flatMap((t) =>
      (t.tutorial_orgs ?? [])
        .filter((row) => byId.has(row.org_id))
        .filter(
          (row) => row.status === 'pending' || (row.status === 'accepted' && t.status === 'pending')
        )
        .map((row) => ({ tutorial: t, row, org: byId.get(row.org_id)! }))
    )
    .sort((a, b) => a.tutorial.created_at.localeCompare(b.tutorial.created_at))

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Organisation</h1>

      {!hasTerms && <OrgReviewBanner />}

      {waiting.length === 0 ? (
        <p className="empty-badge">
          Nothing waiting. Contributors ask by choosing your organisation when they
          submit a tutorial.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {waiting.map(({ tutorial, row, org }) => (
            <li key={row.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <BackingBadge status={row.status} />
                {/* Always the project page, never /tutorials/[id]. That link is
                    the hole: the public page serves only approved work, so every
                    item in this queue 404'd. */}
                <Link
                  href={`/organizations/${org.id}/projects/${tutorial.id}`}
                  className="font-medium text-ink"
                >
                  {tutorial.title}
                </Link>
                <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-deep">
                  {org.name}
                </span>
                <span className="ml-auto">
                  <DifficultyBadge difficulty={tutorial.difficulty} />
                </span>
              </div>
              {org.status === 'suspended' && (
                <p className="mt-2 text-xs text-muted">
                  Suspended — you can look, but not approve
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
