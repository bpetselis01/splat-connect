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
import { notFound } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { OrgReviewBanner } from '@/components/org-review-banner'
import { BoundaryLink } from '@/components/boundary-link'
import { shortDate } from '@splat-connect/types'
import {
  BookOpen,
  Check,
  CheckCircle,
  Gauge,
  MagnifyingGlass,
  SealCheck,
  Tray,
} from '@phosphor-icons/react/dist/ssr'
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

  // The board names the one organisation it is for; a leader of several gets
  // the plain version rather than a list of names.
  const whose = caps.ledOrgs.length === 1 ? caps.ledOrgs[0].name : 'your organisations'

  return (
    <div className="max-w-[920px]">
      <div className="dash-head">
        <div>
          <h1 className="title-hub">Review queue</h1>
          <p className="dash-head__lede max-w-[52ch]">Guides waiting on {whose}. Oldest first.</p>
        </div>
        <span className="inline-flex flex-none items-center gap-2 rounded-pill bg-[var(--tamber)] px-4 py-[9px] text-sm font-extrabold text-[var(--tink)]">
          <Tray weight="fill" aria-hidden="true" />
          {waiting.length} waiting
        </span>
      </div>

      {hasTerms ? (
        <p className="mb-[18px] inline-flex items-center gap-[7px] rounded-pill bg-[var(--tok)] px-3.5 py-[7px] text-[13px] font-extrabold text-[var(--tink)]">
          <CheckCircle weight="fill" aria-hidden="true" />
          Leader terms accepted
        </p>
      ) : (
        <OrgReviewBanner variant="strip" />
      )}

      {waiting.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <Tray className="h-8 w-8" weight="bold" aria-hidden="true" />
          </span>
          <p className="mt-4 font-bold text-ink">Nothing waiting.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Contributors ask by choosing your organisation when they submit a
            tutorial.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {waiting.map(({ tutorial, row, org }) => {
            // A pending row is a request to back; an accepted one on a pending
            // tutorial is a request to review — the same split the query makes.
            const asked = row.status === 'pending'
            const tint = asked ? 'var(--tamber)' : 'var(--b100)'
            const StateIcon = asked ? SealCheck : MagnifyingGlass
            // Every action lands on the project page. Which of them the leader
            // may actually take is decided there (leaderActions), not here —
            // this queue only says what the next step is.
            const href = `/organizations/${org.id}/projects/${tutorial.id}` as const
            return (
              <li key={row.id}>
                <article className="row-card gap-3.5 p-5">
                  <div className="flex flex-wrap items-start gap-3.5">
                    <span aria-hidden="true" className="tint-tile" style={{ backgroundColor: tint }}>
                      <StateIcon weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="row-card__title text-[19px]">{tutorial.title}</h2>
                      <p className="row-card__meta text-sm">
                        {caps.ledOrgs.length > 1 && (
                          <>
                            <span>{org.name}</span> ·{' '}
                          </>
                        )}
                        submitted{' '}
                        {shortDate(tutorial.created_at)}
                      </p>
                      {org.status === 'suspended' && (
                        <p className="mt-1 text-xs text-muted">
                          Suspended — you can look, but not approve
                        </p>
                      )}
                    </div>
                    <span className="badge text-[var(--tink)]" style={{ backgroundColor: tint }}>
                      {asked ? 'Asked to back' : 'Ready to review'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Always the project page, never /tutorials/[id]: the
                        public page serves only approved work, so every item
                        in this queue would 404 there. */}
                    <BoundaryLink href={href} className="btn btn-primary min-h-12 text-[15px]">
                      <BookOpen weight="fill" aria-hidden="true" />
                      Read the guide
                    </BoundaryLink>
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-sunken px-3 py-[5px] text-[13px] font-extrabold capitalize text-muted">
                      <Gauge weight="bold" aria-hidden="true" />
                      {tutorial.difficulty}
                    </span>
                    <span className="flex-1" />
                    <BoundaryLink
                      href={href}
                      className={`btn min-h-12 px-[18px] text-sm ${hasTerms ? 'btn-primary' : 'bg-sunken text-muted'}`}
                    >
                      <Check weight="bold" aria-hidden="true" />
                      {asked ? 'Back it' : 'Start the review'}
                    </BoundaryLink>
                    <BoundaryLink href={href} className="btn btn-quiet min-h-12 px-4 text-sm">
                      Ask for changes
                    </BoundaryLink>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
