/**
 * One story, as a reading page.
 *
 * A 68ch column, one pull quote, one link back into the product. That ceiling
 * is the whole layout decision: everything else on this site is a grid or a
 * form, and the one place SPLAT asks somebody to read four hundred words is the
 * one place a measure matters.
 *
 * The byline card is not a credit line. A story about a named child is
 * publishable only because an organisation took responsibility for the consent,
 * and this is where that is visible and clickable.
 *
 * Related files:
 * - packages/api/src/routes/public.ts: GET /public/stories/:id
 * - supabase/migrations/062_stories.sql: the columns this draws
 */
import { Quotes } from '@phosphor-icons/react/dist/ssr'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { shortDate } from '@/lib/dates'
import { STORY_KIND_LABEL, type StoryListItem } from '@splat-connect/types'

type StoryDetail = StoryListItem & {
  org: { id: string; name: string } | null
  link_tutorial: { id: string; title: string } | null
  more: Array<Pick<StoryListItem, 'id' | 'kind' | 'title' | 'byline' | 'published_at'>>
}

async function load(id: string) {
  return apiClient.get<StoryDetail>(`/api/public/stories/${id}`).catch(() => null)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const story = await load(id)
  if (!story) return { title: 'Story — SPLAT Connect' }
  return { title: `${story.title} — SPLAT Connect`, description: story.summary }
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const story = await load(id)
  if (!story) notFound()

  const meta = [
    story.org?.name,
    story.published_at ? shortDate(story.published_at) : null,
    `${story.read_minutes} min read`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="mx-auto max-w-[68ch]">
      <p className="eyebrow text-muted">{STORY_KIND_LABEL[story.kind]}</p>
      <h1 className="mt-1.5 title-article">{story.title}</h1>
      <p className="mt-2 text-lg leading-relaxed text-muted">{story.summary}</p>

      <div className="card mt-5 flex items-center gap-3 p-4">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-tint font-display text-sm font-extrabold text-brand-deep"
        >
          {(story.org?.name ?? 'SPLAT').slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-bold text-ink">{story.byline}</span>
          <span className="block truncate text-xs text-muted">{meta}</span>
        </span>
        {story.org && (
          <Link
            href={`/organizations/${story.org.id}/public`}
            className="btn btn-quiet btn-sm ml-auto shrink-0"
          >
            About them
          </Link>
        )}
      </div>

      {/* Blank-line separated, the way the publish form asks for it. No
          markdown: a leader writing about their build day should not have to
          learn a syntax, and the one thing they cannot express — a pull quote —
          has a field of its own below. */}
      <div className="mt-8 flex flex-col gap-4">
        {story.body.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="text-base leading-relaxed text-ink">
            {para}
          </p>
        ))}
      </div>

      {/* A quote glyph and a byline, not a left-border accent bar — §6 of the
          brief names that rule, and this was the last bar on the site. */}
      {story.pull_quote && (
        <blockquote className="mt-8 flex items-start gap-3 rounded-[var(--radius-inset)] bg-sunken p-5">
          <Quotes size={22} weight="fill" className="mt-1 flex-none text-brand-dark" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-display text-xl font-extrabold leading-snug text-ink">
              {story.pull_quote}
            </p>
            <footer className="mt-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
              {story.pull_quote_by}
            </footer>
          </div>
        </blockquote>
      )}

      {story.link_tutorial && (
        <Link
          href={`/tutorials/${story.link_tutorial.id}`}
          className="btn btn-primary btn-sm mt-8"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Read the guide: {story.link_tutorial.title}
        </Link>
      )}

      {story.more.length > 0 && (
        <section className="mt-12">
          <h2 className="title-detail">More stories</h2>
          <div className="mt-3 flex flex-col gap-2">
            {story.more.map((other) => (
              <Link
                key={other.id}
                href={`/about/stories/${other.id}`}
                className="card-link card flex flex-col p-4"
              >
                <span className="eyebrow text-muted">{STORY_KIND_LABEL[other.kind]}</span>
                <span className="card-title mt-1">{other.title}</span>
                <span className="mt-0.5 text-xs text-muted">
                  {other.byline}
                  {other.published_at && ` · ${shortDate(other.published_at)}`}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10">
        <Link href="/about/stories" className="text-sm font-semibold text-brand-dark hover:underline">
          All stories
          <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden="true" />
        </Link>
      </p>
    </article>
  )
}
