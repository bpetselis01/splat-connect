/**
 * A single design challenge's public brief, its participants, and — for a
 * signed-in author or participant — the live thread.
 *
 * Fetches GET /api/public/challenges/:id directly: it is anonymous, same
 * pattern as app/toy-library/[id]/page.tsx and app/tutorials/[id]/page.tsx.
 * `notFound()` on anything but a 200 — the endpoint 404s a pending/rejected
 * idea and a nonexistent one alike (see its doc comment in
 * packages/api/src/routes/public.ts), so this page can't tell them apart
 * either, on purpose.
 *
 * The endpoint never returns `messages` — the brief recruits, the
 * conversation stays private even on a public challenge — so the thread
 * itself is fetched by ChallengeThread, authenticated, client-side.
 *
 * Related files:
 * - packages/api/src/routes/public.ts: GET /api/public/challenges/:id
 * - packages/api/src/routes/toy-ideas.ts: join / messages / participants
 * - components/challenge-thread.tsx: the client half — join button + live thread
 */
import { notFound } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { ChallengeThread } from '@/components/challenge-thread'
import type { ToyIdeaDetail, ContactPref } from '@splat-connect/types'

const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  clarification: 'Clarification',
  co_design: 'Co-design',
  user_testing: 'User testing',
}

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await fetch(`${process.env.API_URL}/api/public/challenges/${id}`, { cache: 'no-store' })
  if (!res.ok) notFound()

  const challenge = (await res.json()) as ToyIdeaDetail
  const caps = await getCapabilities()

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div>
        <h1 className="title-article">{challenge.title}</h1>
        <p className="mt-2 text-base font-semibold leading-relaxed text-muted">
          {challenge.summary}
        </p>
        {challenge.author_name && (
          <p className="mt-1 text-sm text-muted">Posted by {challenge.author_name}</p>
        )}

        <dl className="mt-6 flex flex-col gap-4 text-sm">
          <div>
            <dt className="font-semibold text-ink">Description</dt>
            <dd className="mt-1 leading-relaxed text-muted">{challenge.description}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Intended use</dt>
            <dd className="mt-1 leading-relaxed text-muted">{challenge.intended_use}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Who it&apos;s for</dt>
            <dd className="mt-1 leading-relaxed text-muted">{challenge.primary_user}</dd>
          </div>
        </dl>

        {challenge.contact_prefs.length > 0 && (
          <div className="mt-6">
            <p className="field-label">The author is happy to help with</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {challenge.contact_prefs.map((pref) => (
                <span key={pref} className="chip">
                  {CONTACT_PREF_LABELS[pref]}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="field-label">Participants</p>
          {challenge.participants.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Nobody has joined yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {challenge.participants.map((p) => (
                <li key={p.profile_id} className="chip">
                  {p.name ?? 'Someone'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ChallengeThread
        ideaId={challenge.id}
        status={challenge.status as 'challenge' | 'graduated'}
        viewerId={caps?.profile.id ?? null}
        authorId={challenge.author_id}
        authorName={challenge.author_name}
        participants={challenge.participants}
      />
    </div>
  )
}
