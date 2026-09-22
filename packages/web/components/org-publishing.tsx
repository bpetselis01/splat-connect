'use client'

/**
 * Events and stories, in two tabs.
 *
 * Publish and unpublish are one click each and take effect on the public page
 * immediately — the artboard's rule, and the reason a draft is a status rather
 * than a separate table: unpublishing must not delete the evening somebody
 * spent writing it.
 *
 * The forms are their own screens (events/new, stories/new); the page header
 * links to them, and each empty tab does too.
 *
 * Publishing a story is disabled until consent is confirmed for everyone named
 * or pictured. That is a check constraint in 059 as well as this control —
 * the button is the courtesy, the constraint is the guarantee.
 */
import { useState, useTransition } from 'react'
import type { ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'
import {
  CalendarDots,
  CalendarPlus,
  CheckCircle,
  ClockCounterClockwise,
  Eye,
  Info,
  Newspaper,
  PenNib,
  PencilSimple,
  Trash,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr'
import type { IconProps } from '@phosphor-icons/react'
import { EVENT_KIND_LABEL, STORY_KIND_LABEL } from '@splat-connect/types'
import type { EventKind, OrgEvent, OrgStory, StoryKind } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { formatTimeRange, isPast, shortDate } from '@/lib/dates'

// The board's tints, by what the row is.
const KIND_TINT: Record<EventKind, string> = {
  build_day: 'var(--tmint)',
  workshop: 'var(--tamber)',
  open_day: 'var(--tviolet)',
  print_day: 'var(--tok)',
}
const STORY_TINT: Record<StoryKind, string> = {
  family: 'var(--tcoral)',
  maker: 'var(--tamber)',
  org_update: 'var(--tviolet)',
  announcement: 'var(--b100)',
}
type Shown = 'published' | 'draft' | 'past'
const STATE: Record<Shown, [string, ComponentType<IconProps>, string]> = {
  published: ['Published', CheckCircle, 'var(--tok)'],
  draft: ['Draft', PencilSimple, 'var(--tamber)'],
  past: ['Past', ClockCounterClockwise, 'var(--surface2)'],
}

export function OrgPublishing({
  orgId,
  events,
  stories,
  going,
  toAnswer,
}: {
  orgId: string
  events: OrgEvent[]
  stories: OrgStory[]
  /** Registrations per event id. */
  going: Record<string, number>
  /** Unanswered part-print requests per event id. */
  toAnswer: Record<string, number>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'events' | 'stories'>('events')

  function run(work: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await work()
        router.refresh()
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setError(detail ?? 'That did not save. Check your connection and try again.')
      }
    })
  }

  const setStatus = (kind: 'events' | 'stories', id: string, status: 'draft' | 'published') =>
    run(() => browserApiClient.patch(`/api/organizations/${orgId}/${kind}/${id}`, { status }))

  const remove = (kind: 'events' | 'stories', id: string) =>
    run(() => browserApiClient.delete(`/api/organizations/${orgId}/${kind}/${id}`))

  const shownOf = (e: OrgEvent): Shown =>
    e.status === 'draft' ? 'draft' : isPast(e.starts_at, e.ends_at) ? 'past' : 'published'

  const stats = [
    { k: 'Upcoming events', v: events.filter((e) => shownOf(e) === 'published').length },
    { k: 'People going', v: events.reduce((n, e) => n + (going[e.id] ?? 0), 0) },
    { k: 'Stories live', v: stories.filter((s) => s.status === 'published').length },
    {
      k: 'Drafts',
      v: [...events, ...stories].filter((x) => x.status === 'draft').length,
    },
  ]

  function Row({
    kind,
    id,
    title,
    meta,
    status,
    shown,
    icon: Icon,
    tint,
    view,
    manage,
    answer = 0,
  }: {
    kind: 'events' | 'stories'
    id: string
    title: string
    meta: string
    status: 'draft' | 'published'
    shown: Shown
    icon: ComponentType<IconProps>
    tint: string
    /** The public page, once there is one. */
    view?: Route
    /** An event's own screen: registrations and part requests. */
    manage?: Route
    answer?: number
  }) {
    const [word, StateIcon, stateTint] = STATE[shown]
    return (
      <li>
        <article className="row-card">
          <div className="flex flex-wrap items-start gap-[13px]">
            <span aria-hidden="true" className="tint-tile text-2xl" style={{ backgroundColor: tint }}>
              <Icon weight="duotone" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="row-card__title">{title}</h2>
              <p className="row-card__meta">{meta}</p>
            </div>
            <span className="badge flex-none text-[var(--tink)]" style={{ backgroundColor: stateTint }}>
              <StateIcon weight="fill" aria-hidden="true" />
              {word}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {manage && (
              <Link href={manage} className="btn btn-primary min-h-11 px-[18px] text-sm">
                <UsersThree weight="bold" aria-hidden="true" />
                Manage
                {answer > 0 && (
                  <span className="rounded-pill bg-[var(--coral)] px-[7px] text-xs text-[#1c2530]">
                    {answer}
                  </span>
                )}
              </Link>
            )}
            {view && (
              <Link href={view} className="btn btn-quiet px-[15px] text-sm">
                <Eye weight="bold" aria-hidden="true" />
                View
              </Link>
            )}
            <button
              type="button"
              className="btn btn-quiet whitespace-nowrap px-[15px] text-sm"
              disabled={pending}
              onClick={() => setStatus(kind, id, status === 'published' ? 'draft' : 'published')}
            >
              {status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
            <span className="flex-1" />
            <button
              type="button"
              className="btn btn-danger w-11 min-h-11 p-0"
              disabled={pending}
              aria-label={`Remove ${title}`}
              onClick={() => remove(kind, id)}
            >
              <Trash size={16} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </article>
      </li>
    )
  }

  const rows = tab === 'events' ? events : stories
  const empty =
    tab === 'events'
      ? {
          Icon: CalendarPlus,
          title: 'No events yet',
          body: 'A build day or open afternoon is the fastest way to meet the families near you.',
          cta: 'Publish an event',
          href: '/dashboard/organisation/events/new' as Route,
        }
      : {
          Icon: PenNib,
          title: 'No stories yet',
          body: 'One thing that happened, told plainly. It takes ten minutes.',
          cta: 'Write a story',
          href: '/dashboard/organisation/stories/new' as Route,
        }

  return (
    <>
      <ul className="count-chips">
        {stats.map((s) => (
          <li key={s.k} className="count-chip">
            <span className="count-chip__value">{s.v}</span>
            <span className="count-chip__label">{s.k}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="alert alert-danger mb-4">
          {error}
        </p>
      )}

      <div role="tablist" aria-label="Kind" className="seg mb-4">
        {(
          [
            ['events', 'Events', CalendarDots, events.length],
            ['stories', 'Stories', Newspaper, stories.length],
          ] as const
        ).map(([key, label, TabIcon, n]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            <TabIcon weight="bold" aria-hidden="true" />
            {label} <span className="seg__count">{n}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border-[length:var(--bw)] border-dashed border-line bg-surface p-11 text-center">
          <empty.Icon weight="duotone" aria-hidden="true" className="mx-auto text-[40px] text-muted" />
          <p className="mb-1 mt-2.5 font-display text-xl font-extrabold text-ink">{empty.title}</p>
          <p className="mb-4 text-[15px] text-muted">{empty.body}</p>
          <Link href={empty.href} className="btn btn-primary min-h-11 px-[18px] text-sm">
            {empty.cta}
          </Link>
        </div>
      ) : tab === 'events' ? (
        <ul className="flex list-none flex-col gap-3">
          {events.map((event) => {
            const shown = shownOf(event)
            const place =
              event.format === 'online'
                ? 'Online'
                : [event.suburb, event.state].filter(Boolean).join(' ') || event.location || 'In person'
            return (
              <Row
                key={event.id}
                kind="events"
                id={event.id}
                title={event.title}
                meta={`${EVENT_KIND_LABEL[event.kind]} · ${place} · ${shortDate(event.starts_at)} · ${formatTimeRange(
                  event.starts_at,
                  null,
                  event.format,
                )} · ${going[event.id] ?? 0} going${
                  toAnswer[event.id] ? ` · ${toAnswer[event.id]} to answer` : ''
                }`}
                status={event.status}
                shown={shown}
                icon={CalendarDots}
                tint={KIND_TINT[event.kind]}
                view={event.status === 'published' ? (`/get-involved/events/${event.id}` as Route) : undefined}
                manage={event.status === 'draft' ? undefined : (`/dashboard/org/events/${event.id}` as Route)}
                answer={toAnswer[event.id]}
              />
            )
          })}
        </ul>
      ) : (
        <ul className="flex list-none flex-col gap-3">
          {stories.map((story) => (
            <Row
              key={story.id}
              kind="stories"
              id={story.id}
              title={story.title}
              meta={`${STORY_KIND_LABEL[story.kind]} · ${story.byline} · ${shortDate(
                story.published_at ?? story.created_at,
              )}${story.consent_confirmed ? '' : ' · consent not confirmed'}`}
              status={story.status}
              shown={story.status}
              icon={Newspaper}
              tint={STORY_TINT[story.kind]}
              view={story.status === 'published' ? (`/about/stories/${story.id}` as Route) : undefined}
            />
          ))}
        </ul>
      )}

      <p className="mt-[18px] max-w-[70ch] text-[13px] leading-normal text-muted">
        <Info weight="bold" aria-hidden="true" className="mr-1 inline align-[-2px]" />
        Events and stories go live without review. They carry your organisation&apos;s name, so the{' '}
        <a href="/legal/org-leader-terms">leader terms</a> apply: nothing that names a child or
        family without their agreement, and no medical claims.
      </p>
    </>
  )
}
