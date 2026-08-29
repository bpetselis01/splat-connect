/**
 * One route for every saved list.
 *
 * The slug keys SAVE_SLUGS, which is the same object packages/api's saves route
 * validates against — so one missing key produces both the API's 404 and this
 * page's notFound(), and a type cannot half-exist.
 *
 * Cards render WITH the save control, filled. That is the unsave affordance:
 * clicking it deletes the row and refreshes, so the card leaves. There is no
 * separate delete UI, and nothing here says "no longer available" — a saved
 * thing that stops being visible simply is not in the list, because the API
 * reads through the user client and RLS drops it.
 *
 * Related files:
 * - packages/api/src/routes/saves.ts: GET /api/saves/:slug and the same map
 * - components/save-button.tsx: the filled control that removes a row
 */
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { BoundaryLink } from '@/components/boundary-link'
import { SAVE_SLUGS, type SaveSlug } from '@splat-connect/types'
import type { Tutorial, ToyWithOwner, ToyIdea } from '@splat-connect/types'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { TutorialCard } from '@/components/tutorial-card'
import { ToyLibraryCard } from '@/components/toy-library-card'
import { ChallengeCard } from '@/components/challenge-card'

/** Title and the way out, per slug. The empty state is the only copy that
    differs between the three lists. */
const VIEW = {
  tutorials: {
    title: 'Saved tutorials',
    browse: '/library',
    browseLabel: 'Browse the guide library',
  },
  toys: {
    title: 'Saved toys',
    browse: '/toy-library',
    browseLabel: 'Browse the toy library',
  },
  challenges: {
    title: 'Saved challenges',
    browse: '/get-involved/design-challenges',
    browseLabel: 'Browse design challenges',
  },
} satisfies Record<SaveSlug, { title: string; browse: Route; browseLabel: string }>

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!Object.hasOwn(VIEW, type)) return { title: 'Saved — SPLAT Connect' }
  return { title: `${VIEW[type as SaveSlug].title} — SPLAT Connect` }
}

export default async function SavedList({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!Object.hasOwn(SAVE_SLUGS, type)) notFound()
  const slug = type as SaveSlug

  const caps = await requireCapabilities()

  const view = VIEW[slug]
  // Degrades to empty rather than throwing: an unreachable API should read as
  // "nothing here yet" with a way out, not a 500 on a page about your own list.
  const items = await apiClient.get<{ id: string }[]>(`/api/saves/${slug}`).catch(() => [])

  return (
    <div>
      <h1 className="title-hub">{view.title}</h1>

      {items.length === 0 ? (
        <p className="mt-4 max-w-prose text-base leading-relaxed text-muted">
          Nothing saved yet.{' '}
          {/* BoundaryLink, not next/link: every one of these three destinations is
              a public page reached from a rail-only account page, and the root
              layout does not re-run on a soft transition — so /library rendered
              with the saved list's rail still on screen until the next hard
              navigation. See components/boundary-link.tsx. */}
          <BoundaryLink href={view.browse} className="font-semibold text-brand-dark hover:underline">
            {view.browseLabel}
          </BoundaryLink>{' '}
          and use the bookmark on anything you want to keep.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const save = { slug, id: item.id, saved: true, signedIn: true } as const
            if (slug === 'tutorials') {
              return <TutorialCard key={item.id} tutorial={item as Tutorial} save={save} />
            }
            if (slug === 'toys') {
              return <ToyLibraryCard key={item.id} toy={item as ToyWithOwner} save={save} />
            }
            return (
              <ChallengeCard
                key={item.id}
                idea={item as Pick<ToyIdea, 'id' | 'title' | 'summary' | 'status'>}
                save={save}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
