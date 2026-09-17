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
import { Newspaper, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { shortDate } from '@/lib/dates'
import { STORY_KIND_LABEL, type StoryKind, type StoryListItem } from '@splat-connect/types'

export const metadata = {
  title: 'Stories — SPLAT Connect',
  description:
    'What families, makers and organisations have actually done with SPLAT, written by the people who were there.',
}

const FILTERS: Array<{ value: '' | StoryKind; label: string }> = [
  { value: '', label: 'All' },
  { value: 'family', label: 'Family stories' },
  { value: 'maker', label: 'Maker stories' },
  { value: 'org_update', label: 'Organisation updates' },
  { value: 'announcement', label: 'From SPLAT' },
]

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  const { kind = '' } = await searchParams
  const all = await apiClient
    .get<StoryListItem[]>('/api/public/stories')
    .catch(() => [] as StoryListItem[])

  // The featured story is drawn once, at the top, and never again in the grid
  // below it — the artboard shows it as a different shape, not a repeat.
  const featured = all.find((s) => s.featured) ?? null
  const rest = all.filter((s) => s.id !== featured?.id)
  const shown = kind ? rest.filter((s) => s.kind === kind) : rest

  const counts = (value: string) =>
    value === '' ? all.length : all.filter((s) => s.kind === value).length

  const href = (value: string): Route =>
    (value ? `/about/stories?kind=${value}` : '/about/stories') as Route

  return (
    <div>
      <h1 className="title-hub">Stories</h1>
      <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">
        What families, makers and organisations have actually done with SPLAT — written by the
        people who were there. The human side of the Impact numbers.
      </p>

      {featured && (
        <article className="card mt-8 flex flex-col gap-5 p-6 sm:flex-row">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-brand-tint text-brand-deep">
                {STORY_KIND_LABEL[featured.kind]}
              </span>
              <span className="badge bg-honey-soft text-ink">Featured</span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
              <Link href={`/about/stories/${featured.id}`} className="hover:underline">
                {featured.title}
              </Link>
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              {featured.summary}
            </p>
            <p className="mt-3 text-sm text-muted">
              <strong className="font-bold text-ink">{featured.byline}</strong>
              {featured.published_at && ` · ${shortDate(featured.published_at)}`} ·{' '}
              {featured.read_minutes} min read
            </p>
            <Link href={`/about/stories/${featured.id}`} className="btn btn-primary btn-sm mt-4">
              Read the story
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </article>
      )}

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Story type">
        {FILTERS.map((f) => (
          <Link key={f.label} href={href(f.value)} className="chip" aria-pressed={kind === f.value}>
            {f.label} {counts(f.value)}
          </Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="card mt-6 p-6 text-sm text-muted">
          {all.length === 0
            ? 'No stories yet. Organisations publish them from their dashboard, and they appear here the moment they do.'
            : 'Nothing under that filter yet. Try All.'}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((story) => (
            <article key={story.id} className="card flex flex-col p-5">
              <span className="badge self-start bg-sunken text-muted">
                {STORY_KIND_LABEL[story.kind]}
              </span>
              <h3 className="mt-2 font-display text-lg font-extrabold text-ink">
                <Link href={`/about/stories/${story.id}`} className="hover:underline">
                  {story.title}
                </Link>
              </h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{story.summary}</p>
              <p className="mt-3 text-xs text-muted">
                <strong className="font-bold text-ink">{story.byline}</strong>
                {story.published_at && ` · ${shortDate(story.published_at)}`} ·{' '}
                {story.read_minutes} min
              </p>
            </article>
          ))}
        </div>
      )}

      <p className="mt-10 flex items-center gap-2 text-sm text-muted">
        <Newspaper className="h-4 w-4" aria-hidden="true" />
        Organisation leaders publish stories from their dashboard.
      </p>
    </div>
  )
}
