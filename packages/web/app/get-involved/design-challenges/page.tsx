/**
 * Design challenges listing.
 *
 * Replaces the ComingSoon scaffold as of Task 13 — the section flipped 'live'
 * in lib/public-nav.ts alongside this. Fetches GET /api/public/challenges
 * (anonymous, Task 8) at request time; a server component, not client, so a
 * search engine and a first paint both see real challenges without a spinner.
 *
 * Day one there are zero published challenges, so the empty state carries
 * the actual weight here: it has to teach a visitor what a design challenge
 * is and point them at submitting one, not read as an apology.
 *
 * Related files:
 * - packages/api/src/routes/public.ts: GET /api/public/challenges
 * - components/challenge-card.tsx: one row of the grid below
 * - app/get-involved/submit-an-idea/page.tsx: where the empty state points
 */
import {
  ChatsCircle,
  NotePencil,
  Plus,
  PuzzlePiece,
  Smiley,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { ChallengeCard } from '@/components/challenge-card'
import {
  FlowSteps,
  FreeForever,
  InvolvedIntro,
  SECONDARY_BTN,
  TintNote,
} from '@/components/involved-page'
import { getSavedIds } from '@/lib/saves'
import type { ToyIdea } from '@splat-connect/types'

export const metadata = {
  title: 'Design challenges — SPLAT Connect',
  description: 'Problems nobody has solved yet, open to anyone.',
}

type Challenge = Pick<ToyIdea, 'id' | 'title' | 'summary' | 'status'>

// The board cycles its cards through the five tints in listing order.
const TINTS = ['var(--b100)', 'var(--tmint)', 'var(--tamber)', 'var(--tviolet)', 'var(--tcoral)']

export default async function DesignChallengesPage() {
  // null means signed out — the island still renders, it just routes to
  // /signup instead of saving. Sets rather than .includes: the lookup runs
  // once per card.
  const saved = await getSavedIds()
  const signedIn = saved !== null
  const savedChallenges = new Set(saved?.challenges ?? [])

  let challenges: Challenge[] = []
  // Two distinct failure shapes: a non-OK response and a network/parse throw.
  // Both count as "could not load" rather than "nothing published" — telling
  // a visitor there are no challenges when the API is actually down is the
  // dishonest reading Task 13's brief rules out.
  let failed = false
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/challenges`, { cache: 'no-store' })
    if (res.ok) challenges = await res.json()
    else failed = true
  } catch {
    failed = true
  }

  const list = failed ? (
    <div className="card mt-4 flex flex-col items-center px-6 py-16 text-center">
      <span aria-hidden="true" className="empty-badge text-brand-deep">
        <WarningCircle className="h-8 w-8" />
      </span>
      <p className="mt-4 font-bold text-ink">Could not load design challenges.</p>
      <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
        Something has gone wrong on our end. Try refreshing in a moment.
      </p>
    </div>
  ) : challenges.length === 0 ? (
    <div className="card mt-4 flex flex-col items-center px-6 py-16 text-center">
      <span aria-hidden="true" className="empty-badge text-brand-deep">
        <PuzzlePiece className="h-8 w-8" />
      </span>
      <p className="mt-4 font-bold text-ink">No challenges are open yet.</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">
        A design challenge is a problem our usual guides cannot answer yet — a toy that
        resists adaptation, or a need nobody has written up a fix for. Spotted one?
      </p>
      <Link href="/get-involved/submit-an-idea" className="btn btn-primary mt-5">
        Submit an idea
      </Link>
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {challenges.map((idea, i) => (
        <ChallengeCard
          key={idea.id}
          idea={idea}
          tint={TINTS[i % TINTS.length]}
          save={{
            slug: 'challenges',
            id: idea.id,
            saved: savedChallenges.has(idea.id),
            signedIn,
          }}
        />
      ))}
    </div>
  )

  if (!signedIn) {
    // The board's signed-out page is the explainer alone. Live has always
    // listed challenges publicly, so the list stays underneath it: hiding it
    // is an access decision, not a design one.
    return (
      <div>
        <div className="max-w-[860px]">
          <InvolvedIntro
            title="Design challenges"
            lead="Problems nobody has solved yet, open to anyone. Each one started as a parent’s idea; makers, students and therapists work it out together in a thread until it becomes a guide."
          />
          <FlowSteps
            steps={[
              { t: 'Pick an open problem', d: 'A brief and constraints, written from a family’s idea.', icon: PuzzlePiece, tint: 'var(--tviolet)' },
              { t: 'Join the thread', d: 'Prototypes, photos, dead ends — anyone can contribute.', icon: ChatsCircle, tint: 'var(--b100)' },
              { t: 'Test it with a child', d: 'A therapist or the family tries it and reports back.', icon: Smiley, tint: 'var(--tamber)' },
              { t: 'Write it up as a guide', d: 'The solved challenge graduates into a reviewed guide.', icon: NotePencil, tint: 'var(--tmint)' },
            ]}
          />
          <TintNote title="What a solved challenge becomes">
            A published guide, reviewed like any other, with the challenge thread kept as its
            history. The family who asked gets the first build.
          </TintNote>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={`/login?next=${encodeURIComponent('/get-involved/design-challenges')}`}
              className="btn btn-primary px-[26px]"
            >
              Sign in to join a challenge
            </Link>
            <Link href="/get-involved/submit-an-idea" className={SECONDARY_BTN}>
              Submit an idea instead
            </Link>
          </div>
          <FreeForever />
        </div>
        <h2 className="mb-4 mt-14 font-display text-[22px] font-extrabold text-ink">Open challenges</h2>
        {list}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="text-[13px] font-extrabold uppercase tracking-[.1em] text-brand">
            Get Involved
          </span>
          <h1 className="mt-2.5 font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-.02em] text-ink">
            Design challenges
          </h1>
          <p className="mt-3 max-w-[58ch] text-lg leading-[1.6] text-muted">
            Problems nobody has solved yet, worked out in the open.
          </p>
        </div>
        <Link
          href="/get-involved/submit-an-idea"
          className="btn min-h-[52px] bg-[var(--coral)] px-6 text-base text-[#1c2530] shadow-[var(--e3),var(--hi)]"
        >
          <Plus weight="bold" aria-hidden="true" /> Submit an idea
        </Link>
      </div>
      <div className="mt-7">{list}</div>
    </div>
  )
}
