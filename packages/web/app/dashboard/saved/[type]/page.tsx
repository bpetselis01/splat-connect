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
import {
  BookOpen,
  Buildings,
  CircleHalf,
  Fire,
  Gift,
  Smiley,
  Target,
} from '@phosphor-icons/react/dist/ssr'
import { CardPhoto, tintFor } from '@/components/card-photo'
import { SaveButton } from '@/components/save-button'
import { gradeOf } from '@/lib/toy-grade'
import type { OrgCardOrg } from '@/components/org-card'

/** Title and the way out, per slug. The empty state is the only copy that
    differs between the three lists. */
const VIEW = {
  tutorials: {
    title: 'Saved tutorials',
    lead: 'Guides you kept to build later.',
    browse: '/library',
    browseLabel: 'Browse the guide library',
  },
  toys: {
    title: 'Saved toys',
    lead: 'Toys you are considering asking for.',
    browse: '/toy-library',
    browseLabel: 'Browse the toy library',
  },
  challenges: {
    title: 'Saved design challenges',
    lead: 'Challenges you want to come back to.',
    browse: '/get-involved/design-challenges',
    browseLabel: 'Browse design challenges',
  },
  organisations: {
    title: 'Saved organisations',
    lead: 'Organisations whose work you want to follow.',
    browse: '/organizations',
    browseLabel: 'Browse organisations',
  },
  // `satisfies`, not a cast: it is what turned switching organisations on into
  // a compile error here rather than a 404 somebody found later.
} satisfies Record<SaveSlug, { title: string; lead: string; browse: Route; browseLabel: string }>

/** What one saved card shows, whatever kind of thing it is. */
type Shown = {
  href: string
  title: string
  photo: string | null
  Icon: typeof Gift
  tag: string
  /** The second pill: a guide's difficulty, a toy's condition. */
  pill?: { label: string; tint: string; Icon?: typeof Gift }
  note: string | null
  by: string | null
}

const DIFF = {
  easy: { label: 'Easy', tint: 'var(--tok)', Icon: Smiley },
  medium: { label: 'Medium', tint: 'var(--tamber)', Icon: CircleHalf },
  hard: { label: 'Hard', tint: 'var(--tcoral)', Icon: Fire },
} as const

type SavedTutorial = Tutorial & {
  tutorial_orgs?: { status: string; organizations: { name: string } | null }[]
}

function shown(slug: SaveSlug, item: { id: string }): Shown {
  if (slug === 'tutorials') {
    const t = item as SavedTutorial
    return {
      href: `/tutorials/${t.id}`,
      title: t.title,
      photo: t.photo_urls?.[0] ?? t.toy_photo_url,
      Icon: BookOpen,
      tag: 'Guide',
      pill: DIFF[t.difficulty],
      note: t.description,
      by:
        t.tutorial_orgs?.find((o) => o.status === 'accepted')?.organizations?.name ?? null,
    }
  }
  if (slug === 'toys') {
    const t = item as ToyWithOwner
    const grade = gradeOf(t.condition)
    return {
      href: `/toy-library/${t.id}`,
      title: t.name,
      photo: t.cover_photo_url,
      Icon: Gift,
      tag: 'Toy',
      pill: { label: grade.label, tint: grade.tint },
      note: t.description,
      by: t.organizations?.name ?? t.profiles?.name ?? null,
    }
  }
  if (slug === 'organisations') {
    const o = item as OrgCardOrg & { suburb?: string | null; state?: string | null }
    return {
      href: `/organizations/${o.id}/public`,
      title: o.name,
      photo: null,
      Icon: Buildings,
      tag: 'Organisation',
      note: o.description ?? null,
      by: [o.suburb, o.state].filter(Boolean).join(', ') || null,
    }
  }
  const i = item as ToyIdea
  return {
    href: `/get-involved/design-challenges/${i.id}`,
    title: i.title,
    photo: null,
    Icon: Target,
    tag: 'Challenge',
    note: i.summary,
    by: i.status === 'graduated' ? 'Being written up' : 'Open challenge',
  }
}

/*
 * The board's saved card: a tinted 4:3 band, the title, a grey type tag beside
 * whatever pill the thing has, one line about it, and a hairline footer with
 * who it belongs to. The board's footer also says when it was saved; the list
 * endpoint returns the saved things, not the save rows, so there is no date.
 */
function SavedCard({ slug, item }: { slug: SaveSlug; item: { id: string } }) {
  const c = shown(slug, item)
  return (
    <div className="save-host relative">
      <BoundaryLink
        href={c.href as Route}
        className="card card-link flex h-full flex-col overflow-hidden"
      >
        <CardPhoto src={c.photo} icon={c.Icon} tint={tintFor(item.id)} iconSize={74} />
        <span className="flex flex-1 flex-col gap-2.5 px-[18px] pb-[18px] pt-4">
          <span className="block text-lg font-extrabold leading-[1.3] text-ink">{c.title}</span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="stage-pill text-[11px]" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
              {c.tag}
            </span>
            {c.pill && (
              <span className="stage-pill gap-1 text-[11px]" style={{ background: c.pill.tint, color: 'var(--tink)' }}>
                {c.pill.Icon && <c.pill.Icon weight="fill" aria-hidden="true" />}
                {c.pill.label}
              </span>
            )}
          </span>
          <span className="line-clamp-2 flex-1 text-[13px] text-muted">{c.note}</span>
          {c.by && (
            <span className="border-t border-line pt-2.5 text-xs font-semibold text-muted">
              {c.by}
            </span>
          )}
        </span>
      </BoundaryLink>
      <SaveButton slug={slug} id={item.id} saved signedIn className="absolute right-3 top-3" />
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!Object.hasOwn(VIEW, type)) return { title: 'Saved — SPLAT Connect' }
  return { title: `${VIEW[type as SaveSlug].title} — SPLAT Connect` }
}

export default async function SavedList({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!Object.hasOwn(SAVE_SLUGS, type)) notFound()
  const slug = type as SaveSlug

  await requireCapabilities()

  const view = VIEW[slug]
  // Degrades to empty rather than throwing: an unreachable API should read as
  // "nothing here yet" with a way out, not a 500 on a page about your own list.
  const items = await apiClient.get<{ id: string }[]>(`/api/saves/${slug}`).catch(() => [])

  return (
    <div>
      <h1 className="title-hub">{view.title}</h1>
      <p className="mt-2 text-[15px] text-muted">{view.lead}</p>

      {items.length === 0 ? (
        <p className="mt-4 max-w-prose text-base leading-relaxed text-muted">
          Nothing saved yet.{' '}
          {/* BoundaryLink, not next/link: every one of these destinations is a
              public page reached from an account page, and the root layout does
              not re-run on a soft transition — so /library rendered with the
              account chrome still on screen until the next hard navigation. See
              components/boundary-link.tsx. */}
          <BoundaryLink href={view.browse} className="font-semibold text-brand-dark hover:underline">
            {view.browseLabel}
          </BoundaryLink>{' '}
          and use the bookmark on anything you want to keep.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <SavedCard key={item.id} slug={slug} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
