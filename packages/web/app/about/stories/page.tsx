/**
 * Stories — the human side of the Impact numbers.
 *
 * One featured story at the top, then a filterable grid. The filters are the
 * four voices rather than four kinds of event, because what a reader chooses by
 * is whose account they want: a family's, a maker's, an organisation's, or
 * SPLAT's own. That is the whole reason 062 replaced 059's vocabulary.
 *
 * Every story is attributed to a byline and, unless it is an announcement, to
 * an organisation. That is not decoration: a story about a named child is
 * publishable only because somebody took responsibility for the consent, and
 * the byline is where that responsibility is visible.
 *
 * Related files:
 * - packages/api/src/routes/public.ts: GET /public/stories
 * - app/about/stories/[id]/page.tsx: the reading page
 */
import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowRight,
  Buildings,
  Heart,
  Megaphone,
  PenNib,
  PencilSimpleLine,
  SquaresFour,
  Wrench,
} from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { shortDate } from '@/lib/dates'
import { getCapabilities } from '@/lib/capabilities'
import { StoryKindPill, StoryPhoto, STORY_KIND_STYLE, initials } from '@/components/story-bits'
import { type StoryKind, type StoryListItem } from '@splat-connect/types'

export const metadata = {
  title: 'Stories — SPLAT Connect',
  description:
    'What families, makers and organisations have actually done with SPLAT, written by the people who were there.',
}

const FILTERS: Array<{ value: '' | StoryKind; label: string; icon: typeof Heart }> = [
  { value: '', label: 'All', icon: SquaresFour },
  { value: 'family', label: 'Family stories', icon: Heart },
  { value: 'maker', label: 'Maker stories', icon: Wrench },
  { value: 'org_update', label: 'Organisation updates', icon: Buildings },
  { value: 'announcement', label: 'From SPLAT', icon: Megaphone },
]

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  const { kind = '' } = await searchParams
  const [all, caps] = await Promise.all([
    apiClient.get<StoryListItem[]>('/api/public/stories').catch(() => [] as StoryListItem[]),
    getCapabilities(),
  ])
  const leader = (caps?.ledOrgs.length ?? 0) > 0

  // The featured story is drawn once, at the top, and never again in the grid
  // below it — the artboard shows it as a different shape, not a repeat.
  const featured = all.find((s) => s.featured) ?? null
  const rest = all.filter((s) => s.id !== featured?.id)
  const shown = kind ? rest.filter((s) => s.kind === kind) : rest

  const counts = (value: string) =>
    value === '' ? rest.length : rest.filter((s) => s.kind === value).length

  const href = (value: string): Route =>
    (value ? `/about/stories?kind=${value}` : '/about/stories') as Route

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-[62ch]">
          <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-brand">About</span>
          <h1 className="mt-2.5 font-display text-[clamp(34px,4vw,52px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            Stories
          </h1>
          <p className="mt-3.5 text-lg leading-[1.6] text-muted [text-wrap:pretty]">
            What families, makers and organisations have actually done with SPLAT — written by
            the people who were there. The human side of the Impact numbers.
          </p>
        </div>
        {leader && (
          <Link href="/dashboard/organisation/publish" className="btn btn-primary">
            <PencilSimpleLine size={16} weight="bold" aria-hidden="true" />
            Write a story
          </Link>
        )}
      </div>

      {featured && (
        <article
          className="mt-[30px] grid overflow-hidden rounded-card border border-line bg-surface md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
          style={{ boxShadow: 'var(--shadow-e3), var(--shadow-hi)' }}
        >
          <Link
            href={`/about/stories/${featured.id}`}
            aria-label={`Open ${featured.title}`}
            className="relative block min-h-[340px]"
          >
            <StoryPhoto kind={featured.kind} photos={featured.photo_urls} iconSize={72} />
          </Link>
          <div className="flex flex-col justify-center gap-3.5 px-9 py-[34px]">
            <span className="flex items-center gap-2.5">
              <StoryKindPill kind={featured.kind} />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">
                Featured
              </span>
            </span>
            <h2 className="font-display text-[clamp(26px,2.6vw,34px)] font-extrabold leading-[1.15] tracking-[-0.01em] text-ink [text-wrap:balance]">
              <Link href={`/about/stories/${featured.id}`} className="hover:text-[var(--b700)]">
                {featured.title}
              </Link>
            </h2>
            <p className="m-0 text-[16.5px] leading-[1.6] text-muted">{featured.summary}</p>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-field)] text-xs font-extrabold text-[var(--tink)]"
                style={{ background: STORY_KIND_STYLE[featured.kind].tint }}
              >
                {initials(featured.org_name ?? 'SPLAT')}
              </span>
              <span className="text-sm text-muted">
                <strong className="text-ink">{featured.byline}</strong>
                {featured.published_at && ` · ${shortDate(featured.published_at)}`} ·{' '}
                {featured.read_minutes} min read
              </span>
            </div>
            <Link
              href={`/about/stories/${featured.id}`}
              className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 self-start rounded-pill bg-ink px-5 text-sm font-extrabold text-surface"
            >
              Read the story
              <ArrowRight size={14} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </article>
      )}

      <div className="mb-[18px] mt-9 flex flex-wrap gap-2" role="group" aria-label="Story type">
        {FILTERS.map((f) => {
          const on = kind === f.value
          return (
            <Link
              key={f.label}
              href={href(f.value)}
              aria-pressed={on}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-pill border-2 px-3.5 text-[13px] font-extrabold text-ink ${
                on ? 'border-[var(--b600)] bg-[var(--b100)]' : 'border-line bg-surface'
              }`}
            >
              <f.icon size={14} weight="bold" aria-hidden="true" />
              {f.label} <span className="font-bold text-muted">{counts(f.value)}</span>
            </Link>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <p className="card p-6 text-sm text-muted">
          {all.length === 0
            ? 'No stories yet. Organisations publish them from their dashboard, and they appear here the moment they do.'
            : 'Nothing under that filter yet. Try All.'}
        </p>
      ) : (
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {shown.map((story) => (
            <article
              key={story.id}
              className="card card-link flex flex-col overflow-hidden"
              style={{ boxShadow: 'var(--shadow-e1), var(--shadow-hi)' }}
            >
              <Link
                href={`/about/stories/${story.id}`}
                aria-label={`Open ${story.title}`}
                tabIndex={-1}
                className="relative block h-[170px]"
              >
                <StoryPhoto kind={story.kind} photos={story.photo_urls} />
              </Link>
              <div className="flex flex-1 flex-col gap-2 px-5 pb-5 pt-[18px]">
                <StoryKindPill kind={story.kind} className="text-[10.5px]" />
                <h3 className="font-display text-[19px] font-extrabold leading-[1.25] text-ink">
                  <Link href={`/about/stories/${story.id}`} className="hover:text-[var(--b700)]">
                    {story.title}
                  </Link>
                </h3>
                <p className="m-0 flex-1 text-sm leading-[1.5] text-muted">{story.summary}</p>
                <p className="mt-1 text-[13px] text-muted">
                  <strong className="text-ink">{story.byline}</strong>
                  {story.published_at && ` · ${shortDate(story.published_at)}`} ·{' '}
                  {story.read_minutes} min
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      <aside className="mt-10 flex flex-wrap items-center gap-4 rounded-card border border-line bg-[var(--tcoral)] px-7 py-6 text-[var(--tink)]">
        <PenNib size={32} weight="duotone" className="shrink-0" aria-hidden="true" />
        <div className="min-w-[240px] flex-1">
          <p className="m-0 font-display text-[19px] font-extrabold">Got a story from your organisation?</p>
          <p className="mt-1 text-sm leading-[1.5]">
            Leaders publish here from their dashboard. Families&apos; stories go up with their
            say-so, in their words where we can.
          </p>
        </div>
        <Link
          href={leader ? '/dashboard/organisation/publish' : '/get-involved/organisations'}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill bg-ink px-4 text-sm font-extrabold text-surface"
        >
          {leader ? 'Write a story' : 'Register your organisation'}
          <ArrowRight size={14} weight="bold" aria-hidden="true" />
        </Link>
      </aside>
    </div>
  )
}
