/**
 * The author-side view of design challenges: every idea this account has
 * submitted, at any status, plus every challenge it has joined as a maker.
 *
 * Mirrors app/dashboard/exchanges/page.tsx's shape — a server component that
 * loads its list(s) and renders them as linked cards — rather than the
 * anonymous, try/catch-on-a-bare-fetch shape of the public listing
 * (app/get-involved/design-challenges/page.tsx), because this page needs the
 * caller's session the way apiClient (not a bare fetch) provides it.
 *
 * Two independent lists, two independent failure states: apiClient.get
 * throws on a non-OK response (lib/api-core.ts) rather than degrading, and
 * one endpoint being flaky must not blank the other section or read as
 * "you have submitted/joined nothing" to someone who has.
 *
 * "Challenges you joined" exists because joining is a maker's entire entry
 * point back to a thread they are collaborating in — there is no
 * per-message notification (see components/notifications-list.tsx) and the
 * public listing does not mark which challenges an account has joined.
 * Every row here is 'challenge' or 'graduated' by construction (038's join
 * policy only allows joining a published challenge), so, unlike "Your
 * ideas", every row links out.
 *
 * Only `challenge` and `graduated` ideas ever link to their public brief —
 * GET /api/public/challenges/:id 404s a pending or rejected idea by design
 * (see the reasoning in components/notifications-list.tsx's linkFor), so an
 * unlinkable row in "Your ideas" stays a plain card, not a dead link.
 *
 * Related files:
 * - packages/api/src/routes/toy-ideas.ts: GET /api/ideas/mine, GET /api/ideas/joined
 * - components/idea-status-badge.tsx: the status → copy/colour map
 * - components/challenge-card.tsx: the public listing's equivalent row
 */
import Link from 'next/link'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { IdeaStatusBadge } from '@/components/idea-status-badge'
import { FileText, Handshake } from '@/components/icons'
import { BoundaryLink } from '@/components/boundary-link'
import { MarkNotificationsRead } from '@/components/mark-notifications-read'
import type { ToyIdea } from '@splat-connect/types'

async function loadIdeas(path: string): Promise<{ items: ToyIdea[]; failed: boolean }> {
  try {
    return { items: await apiClient.get<ToyIdea[]>(path), failed: false }
  } catch {
    return { items: [], failed: true }
  }
}

function IdeaRow({ idea }: { idea: ToyIdea }) {
  // Only a published challenge has a public page — GET
  // /api/public/challenges/:id 404s for pending and rejected ideas by
  // design, so those rows stay unlinked rather than pointing at a dead
  // route. Every joined idea is 'challenge' or 'graduated' by construction,
  // so this always resolves true for the "Challenges you joined" section.
  const linkable = idea.status === 'challenge' || idea.status === 'graduated'
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-bold text-ink">{idea.title}</p>
        <IdeaStatusBadge status={idea.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{idea.summary}</p>
      {/* review_note is the point of the rejected state — an admin's reason
          for declining, never shown publicly, only to the author here.
          Absent only when an admin rejected without one. */}
      {idea.status === 'rejected' && idea.review_note && (
        <p className="mt-2 border-t border-line pt-2 text-sm text-muted">{idea.review_note}</p>
      )}
    </>
  )

  return linkable ? (
    <BoundaryLink
      href={`/get-involved/design-challenges/${idea.id}`}
      className="card card-link flex flex-col gap-2 p-4"
    >
      {content}
    </BoundaryLink>
  ) : (
    <div className="card flex flex-col gap-2 p-4">{content}</div>
  )
}

export default async function DashboardChallengesPage() {
  const caps = await requireCapabilities()

  const [mine, joined] = await Promise.all([
    loadIdeas('/api/ideas/mine'),
    loadIdeas('/api/ideas/joined'),
  ])

  return (
    <div>
      <MarkNotificationsRead bucket="challenges" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="title-hub">Design challenges</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Ideas you have submitted, at every stage of review, and challenges you have joined as
            a maker.
          </p>
        </div>
        {/* Persistent, not empty-state-only. The My SPLAT card names this as
            what is behind the Design challenges tile, and the tile itself is
            text — this button is the only way through once an idea already
            exists and the empty-state button below has gone. */}
        <div className="flex flex-wrap gap-3">
          <BoundaryLink href="/get-involved/submit-an-idea" className="btn btn-accent">
            + Submit an idea
          </BoundaryLink>
          {/* The tag on this page's My SPLAT card names "saved challenges";
              this is where that tag leads. It skips the saved hub on purpose —
              the label names a destination, so it lands on the destination. */}
          <Link href="/dashboard/saved/challenges" className="btn btn-quiet">
            Saved challenges
          </Link>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold text-ink">Your ideas</h2>

        {mine.failed ? (
          <div className="card mt-3 flex flex-col items-center px-6 py-12 text-center">
            <p className="font-bold text-ink">Could not load your ideas.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Something has gone wrong on our end. Try refreshing in a moment.
            </p>
          </div>
        ) : mine.items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span aria-hidden="true" className="empty-badge text-brand-dark">
              <FileText className="h-8 w-8" />
            </span>
            <p className="mt-4 font-bold text-ink">You haven&apos;t submitted an idea yet.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Spotted a toy that resists adaptation, or a need no guide covers yet? Tell us about
              it.
            </p>
            <BoundaryLink href="/get-involved/submit-an-idea" className="btn btn-accent mt-6">
              Submit an idea
            </BoundaryLink>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {mine.items.map((idea) => (
              <li key={idea.id}>
                <IdeaRow idea={idea} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">Challenges you joined</h2>

        {joined.failed ? (
          <div className="card mt-3 flex flex-col items-center px-6 py-12 text-center">
            <p className="font-bold text-ink">Could not load your joined challenges.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Something has gone wrong on our end. Try refreshing in a moment.
            </p>
          </div>
        ) : joined.items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span aria-hidden="true" className="empty-badge text-brand-dark">
              <Handshake className="h-8 w-8" />
            </span>
            <p className="mt-4 font-bold text-ink">You haven&apos;t joined a challenge yet.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Browse open challenges and find one to work on.
            </p>
            <BoundaryLink href="/get-involved/design-challenges" className="btn btn-accent mt-6">
              Browse design challenges
            </BoundaryLink>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {joined.items.map((idea) => (
              <li key={idea.id}>
                <IdeaRow idea={idea} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
