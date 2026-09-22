/**
 * The author-side view of design challenges: every idea this account has
 * submitted, at any status, plus every challenge it has joined as a maker —
 * one card grid in the My tutorials shape, filtered by the board's shared
 * stage track (components/stage.tsx).
 *
 * Two independent lists, two independent failure states: apiClient.get
 * throws on a non-OK response (lib/api-core.ts) rather than degrading, and
 * one endpoint being flaky must not blank the other list or read as
 * "you have submitted/joined nothing" to someone who has.
 *
 * Joined cards exist because joining is a maker's entire entry point back to
 * a thread they are collaborating in — there is no per-message notification
 * and the public listing does not mark which challenges an account joined.
 * Every joined row is 'challenge' or 'graduated' by construction (038's join
 * policy only allows joining a published challenge), so every one links out.
 *
 * Only `challenge` and `graduated` ideas ever link to their public brief —
 * GET /api/public/challenges/:id 404s a pending or rejected idea by design
 * (see components/notifications-list.tsx's linkFor), so an unlinkable idea
 * stays a plain card, not a dead link.
 *
 * Related files:
 * - packages/api/src/routes/toy-ideas.ts: GET /api/ideas/mine, GET /api/ideas/joined
 * - components/stage.tsx: the stage words, pill and filter track
 */
import Link from 'next/link'
import {
  ArrowRight,
  HourglassMedium,
  Lightbulb,
  LightbulbFilament,
  Plus,
  PuzzlePiece,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { BoundaryLink } from '@/components/boundary-link'
import { MarkNotificationsRead } from '@/components/mark-notifications-read'
import { StageFilter, StageNone, StagePill, STAGE, type StageKey } from '@/components/stage'
import type { ToyIdea, ToyIdeaStatus } from '@splat-connect/types'

const BASE = '/dashboard/challenges'

// ToyIdeaStatus onto the shared stage words, as the board maps them.
const IDEA_STAGE: Record<ToyIdeaStatus, StageKey> = {
  pending: 'waiting',
  challenge: 'live',
  graduated: 'waiting',
  rejected: 'declined',
}

type Card = ToyIdea & { joined: boolean }

async function loadIdeas(path: string): Promise<{ items: ToyIdea[]; failed: boolean }> {
  try {
    return { items: await apiClient.get<ToyIdea[]>(path), failed: false }
  } catch {
    return { items: [], failed: true }
  }
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

function IdeaCard({ idea }: { idea: Card }) {
  const linkable = idea.status === 'challenge' || idea.status === 'graduated'
  const RoleIcon = idea.joined ? UsersThree : Lightbulb
  const Art = idea.joined ? PuzzlePiece : LightbulbFilament
  // /api/ideas/joined returns the idea, not the participant row, so there is
  // no join date to print — only the idea's own.
  const when = idea.joined ? 'Joined' : `Submitted ${day(idea.created_at)}`

  const body = (
    <>
      <span
        className="relative grid aspect-[4/3] w-full place-items-center"
        style={{ background: idea.joined ? 'var(--tviolet)' : 'var(--tamber)', color: 'var(--tink)' }}
      >
        <Art size={74} weight="duotone" opacity={linkable ? 0.7 : 0.55} aria-hidden="true" />
        <span className="ch-role">
          <RoleIcon size={12} weight="fill" aria-hidden="true" className="text-brand-dark" />
          {idea.joined ? 'Joined' : 'Your idea'}
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-2.5 px-[18px] pb-[18px] pt-4">
        <span className="block font-display text-[17px] font-extrabold leading-[1.2] text-ink">
          {idea.title}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <StagePill stage={IDEA_STAGE[idea.status]} />
        </span>
        <span className="line-clamp-3 flex-1 text-[13px] leading-[1.55] text-muted">
          {idea.summary}
        </span>
        {/* review_note is the point of the rejected state — an admin's reason
            for declining, never shown publicly, only to the author here.
            Absent only when an admin rejected without one. */}
        {idea.status === 'rejected' && idea.review_note && (
          <span className="block rounded-[14px] px-[13px] py-[11px] text-[13px] leading-[1.5] text-[var(--tink)]" style={{ background: 'var(--tcoral)' }}>
            <strong>Why it was not taken forward:</strong> {idea.review_note}
          </span>
        )}
        {idea.status === 'pending' && (
          <span className="flex items-start gap-2 text-[13px] font-semibold leading-[1.5] text-muted">
            <HourglassMedium weight="fill" aria-hidden="true" className="mt-0.5 flex-none" />
            An admin reads every idea. Nothing is public until one is approved.
          </span>
        )}
        <span className="flex items-center justify-between gap-2 border-t border-line pt-2.5 text-xs font-bold text-muted">
          <span>{when}</span>
          {linkable && (
            <span className="inline-flex items-center gap-1.5 text-brand-dark">
              {idea.joined ? 'Open the thread' : 'View the brief'}
              <ArrowRight weight="bold" aria-hidden="true" />
            </span>
          )}
        </span>
      </span>
    </>
  )

  return linkable ? (
    <BoundaryLink
      href={`/get-involved/design-challenges/${idea.id}`}
      className="card card-link flex h-full flex-col overflow-hidden"
    >
      {body}
    </BoundaryLink>
  ) : (
    <div className="card flex h-full flex-col overflow-hidden">{body}</div>
  )
}

function LoadError({ what }: { what: string }) {
  return (
    <div className="card mb-6 flex flex-col items-center px-6 py-[52px] text-center">
      <span
        aria-hidden="true"
        className="grid h-14 w-14 place-items-center rounded-full"
        style={{ background: 'var(--tbad)', color: 'var(--bad)' }}
      >
        <WarningCircle size={27} weight="duotone" />
      </span>
      <p className="mt-3.5 font-extrabold text-ink">Could not load {what}.</p>
      <p className="mt-1 max-w-[32ch] text-sm leading-relaxed text-muted">
        Something has gone wrong on our end. Try refreshing in a moment.
      </p>
    </div>
  )
}

export default async function DashboardChallengesPage({
  searchParams,
}: {
  searchParams?: Promise<{ stage?: string }>
} = {}) {
  await requireCapabilities()
  const stage = (await searchParams)?.stage ?? 'all'

  const [mine, joined] = await Promise.all([
    loadIdeas('/api/ideas/mine'),
    loadIdeas('/api/ideas/joined'),
  ])

  const all: Card[] = [
    ...joined.items.map((i) => ({ ...i, joined: true })),
    ...mine.items.map((i) => ({ ...i, joined: false })),
  ]

  const FILTERS: Array<{ id: string; label: string; test: (c: Card) => boolean; divider?: boolean }> = [
    { id: 'all', label: 'All', test: () => true },
    { id: 'joined', label: 'Joined', test: (c) => c.joined },
    { id: 'mine', label: 'Mine', test: (c) => !c.joined },
    { id: 'live', label: STAGE.live.label, test: (c) => c.status === 'challenge', divider: true },
    { id: 'waiting', label: STAGE.waiting.label, test: (c) => IDEA_STAGE[c.status] === 'waiting' },
    { id: 'declined', label: STAGE.declined.label, test: (c) => c.status === 'rejected' },
  ]
  const active = FILTERS.find((f) => f.id === stage) ?? FILTERS[0]
  const shown = all.filter(active.test)
  const failedBoth = mine.failed && joined.failed

  return (
    <div>
      <MarkNotificationsRead bucket="challenges" />

      <div className="mb-[26px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="title-hub">Design challenges</h1>
          <p className="mt-2 max-w-[58ch] text-[15px] text-muted">
            Challenges you have joined as a maker, and ideas you have submitted at every stage of
            review.
          </p>
        </div>
        {/* Persistent, not empty-state-only: once an idea exists the empty
            state's button is gone, and this is the only way to the form. */}
        <div className="flex flex-wrap gap-2.5">
          <BoundaryLink href="/get-involved/submit-an-idea" className="btn btn-coral">
            <Plus size={16} weight="bold" aria-hidden="true" />
            Submit an idea
          </BoundaryLink>
          {/* Skips the saved hub on purpose — the label names a destination,
              so it lands on the destination. */}
          <Link href="/dashboard/saved/challenges" className="btn btn-quiet">
            Saved challenges
          </Link>
          <BoundaryLink href="/get-involved/design-challenges" className="btn btn-quiet">
            Browse challenges
          </BoundaryLink>
        </div>
      </div>

      {failedBoth ? (
        <LoadError what="your challenges" />
      ) : (
        <>
          {mine.failed && <LoadError what="your ideas" />}
          {joined.failed && <LoadError what="your joined challenges" />}

          {all.length === 0 ? (
            !mine.failed &&
            !joined.failed && (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <span
                  aria-hidden="true"
                  className="grid h-[72px] w-[72px] place-items-center rounded-full"
                  style={{ background: 'var(--b50)', color: 'var(--b700)' }}
                >
                  <PuzzlePiece size={34} weight="duotone" />
                </span>
                <p className="mt-[18px] text-[17px] font-extrabold text-ink">Nothing here yet.</p>
                <p className="mt-1.5 max-w-[38ch] text-sm leading-relaxed text-muted">
                  Join an open challenge to work on somebody else&apos;s problem, or submit an idea
                  of your own and let a maker take it on.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                  <BoundaryLink href="/get-involved/design-challenges" className="btn btn-coral">
                    Browse design challenges
                  </BoundaryLink>
                  <BoundaryLink href="/get-involved/submit-an-idea" className="btn btn-quiet">
                    Submit an idea
                  </BoundaryLink>
                </div>
              </div>
            )
          ) : (
            <>
              <div className="mb-[22px]">
                <StageFilter
                  label="Filter challenges"
                  basePath={BASE}
                  current={active.id}
                  options={FILTERS.map((f) => ({
                    id: f.id,
                    label: f.label,
                    n: all.filter(f.test).length,
                    divider: f.divider,
                  }))}
                />
              </div>
              {shown.length === 0 ? (
                <StageNone
                  basePath={BASE}
                  note="Nothing you have joined or submitted sits at that stage right now."
                />
              ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {shown.map((idea) => (
                    <li key={`${idea.joined ? 'j' : 'm'}-${idea.id}`}>
                      <IdeaCard idea={idea} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
