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
import Link from 'next/link'
import { StepList } from '@/components/step-list'
import { ChallengeCard } from '@/components/challenge-card'
import type { ToyIdea } from '@splat-connect/types'

export const metadata = {
  title: 'Design challenges — SPLAT Connect',
  description: 'Problems nobody has solved yet, open to anyone.',
}

type Challenge = Pick<ToyIdea, 'id' | 'title' | 'summary' | 'status'>

const HOW_IT_WORKS = [
  {
    title: 'A family or therapist posts a problem with no known solution',
    body: 'A toy that resists adaptation, or a need no existing guide covers.',
  },
  {
    title: 'Anyone can work on it',
    body: 'Alone or together, makers try approaches and share what they attempt.',
  },
  {
    title: 'A working answer becomes a guide',
    body: 'It joins the library, so the next family with the same problem finds an answer.',
  },
]

export default async function DesignChallengesPage() {
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

  return (
    <div>
      <h1 className="title-hub">Design challenges</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Problems nobody has solved yet — a toy that resists adaptation, or a need no existing
        guide covers. Open to anyone: you do not need to already be a contributor to take one on.
      </p>

      <StepList steps={HOW_IT_WORKS} />

      <h2 className="title-detail mt-12">Open challenges</h2>

      {failed ? (
        <div className="card mt-4 flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge">
            ⚠️
          </span>
          <p className="mt-4 font-bold text-ink">Could not load design challenges.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Something has gone wrong on our end. Try refreshing in a moment.
          </p>
        </div>
      ) : challenges.length === 0 ? (
        <div className="card mt-4 flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge">
            🧩
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
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((idea) => (
            <ChallengeCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  )
}
