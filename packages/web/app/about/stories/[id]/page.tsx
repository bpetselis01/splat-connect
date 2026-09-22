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
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, CaretRight } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { shortDate } from '@/lib/dates'
import { ShareButton } from '@/components/share-button'
import { StoryKindPill, StoryPhoto, STORY_KIND_STYLE, initials } from '@/components/story-bits'
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

  const tint = STORY_KIND_STYLE[story.kind].tint
  const meta = [
    story.org?.name,
    story.published_at ? shortDate(story.published_at) : null,
    `${story.read_minutes} min read`,
  ]
    .filter(Boolean)
    .join(' · ')

  const byline = (
    <>
      <span
        aria-hidden="true"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-field)] text-sm font-extrabold text-[var(--tink)]"
        style={{ background: tint }}
      >
        {initials(story.org?.name ?? 'SPLAT')}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold text-ink">{story.byline}</span>
        <span className="block text-[13px] text-muted">{meta}</span>
      </span>
    </>
  )

  return (
    <article>
      <nav
        aria-label="Breadcrumb"
        className="mb-[22px] flex items-center gap-2 text-sm font-bold text-muted"
      >
        <Link href="/about/stories" className="text-[var(--b700)]">
          Stories
        </Link>
        <CaretRight size={12} weight="bold" aria-hidden="true" />
        <span>{STORY_KIND_LABEL[story.kind]}</span>
      </nav>

      <div className="mx-auto max-w-[760px]">
        <StoryKindPill kind={story.kind} className="!px-3 !py-1 text-xs tracking-[0.06em]" />
        <h1 className="mt-3.5 font-display text-[clamp(32px,4vw,50px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink [text-wrap:balance]">
          {story.title}
        </h1>
        <p className="mt-3.5 text-xl leading-[1.55] text-muted [text-wrap:pretty]">{story.summary}</p>

        {/* The byline is not a credit line. A story about a named child is
            publishable only because an organisation took responsibility for
            the consent, and this is where that is visible and clickable. */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-line py-4">
          {story.org ? (
            <Link href={`/organizations/${story.org.id}/public`} className="flex items-center gap-3">
              {byline}
            </Link>
          ) : (
            <div className="flex items-center gap-3">{byline}</div>
          )}
          <ShareButton title={story.title} copyLink className="min-h-11 px-3.5 text-[13px]" />
        </div>
      </div>

      <div
        className="relative mx-auto mt-7 aspect-[2.2] max-w-[960px] overflow-hidden rounded-card border border-line"
        style={{ background: tint, boxShadow: 'var(--shadow-e2), var(--shadow-hi)' }}
      >
        <StoryPhoto kind={story.kind} photos={story.photo_urls} iconSize={72} />
      </div>

      {/* Blank-line separated, the way the publish form asks for it. No
          markdown: a leader writing about their build day should not have to
          learn a syntax, and the one thing they cannot express — a pull quote —
          has a field of its own below. */}
      <div className="mx-auto mt-9 max-w-[680px] text-lg leading-[1.75] text-ink">
        {story.body.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="mb-[22px]">
            {para}
          </p>
        ))}

        {story.pull_quote && (
          <blockquote
            className="mb-7 mt-2 rounded-card px-[26px] py-[22px] font-display text-2xl font-extrabold leading-[1.35] text-[var(--tink)]"
            style={{ background: tint }}
          >
            &ldquo;{story.pull_quote}&rdquo;
            <footer className="mt-2.5 font-sans text-sm font-bold opacity-85">
              — {story.pull_quote_by}
            </footer>
          </blockquote>
        )}

        {story.link_tutorial && (
          <Link href={`/tutorials/${story.link_tutorial.id}`} className="btn btn-quiet">
            <BookOpen size={16} weight="bold" aria-hidden="true" />
            Read the guide: {story.link_tutorial.title}
          </Link>
        )}
      </div>

      {story.more.length > 0 && (
        <section className="mx-auto mt-14 max-w-[960px]">
          <h2 className="mb-4 font-display text-2xl font-extrabold text-ink">More stories</h2>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
            {story.more.map((other) => (
              <Link
                key={other.id}
                href={`/about/stories/${other.id}`}
                className="card card-link flex flex-col gap-2 rounded-[var(--radius-inset)] px-[18px] py-4"
                style={{ boxShadow: 'var(--shadow-e1)' }}
              >
                <StoryKindPill kind={other.kind} className="text-[10.5px]" />
                <span className="font-display text-[17px] font-extrabold leading-[1.25] text-ink">
                  {other.title}
                </span>
                <span className="text-[13px] text-muted">
                  {other.byline}
                  {other.published_at && ` · ${shortDate(other.published_at)}`}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
