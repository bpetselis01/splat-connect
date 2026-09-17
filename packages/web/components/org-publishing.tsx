'use client'

/**
 * Events and stories, in two tabs.
 *
 * Publish and unpublish are one click each and take effect on the public page
 * immediately — the artboard's rule, and the reason a draft is a status rather
 * than a separate table: unpublishing must not delete the evening somebody
 * spent writing it.
 *
 * The forms are inline behind a disclosure rather than on their own routes.
 * Each is four required fields; a page transition between "I want to publish an
 * event" and the four fields buys nothing, and the list stays on screen as the
 * thing the new row joins.
 *
 * Publishing a story is disabled until consent is confirmed for everyone named
 * or pictured. That is a check constraint in 059 as well as this control —
 * the button is the courtesy, the constraint is the guarantee.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'
import { CalendarPlus, PenNib, Trash } from '@phosphor-icons/react/dist/ssr'
import { STORY_KIND_LABEL } from '@splat-connect/types'
import type { OrgEvent, OrgStory } from '@splat-connect/types'
import { Badge } from '@/components/badge'
import { Disclosure } from '@/components/disclosure'
import { ProfileTabs } from '@/components/profile-tabs'
import { browserApiClient } from '@/lib/browser-api-client'

export function OrgPublishing({
  orgId,
  events,
  stories,
}: {
  orgId: string
  events: OrgEvent[]
  stories: OrgStory[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<'in_person' | 'online'>('in_person')

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

  function addEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const el = e.currentTarget
    run(async () => {
      await browserApiClient.post(`/api/organizations/${orgId}/events`, {
        title: String(form.get('title') ?? ''),
        summary: String(form.get('summary') ?? ''),
        // A datetime-local value carries no offset, and Postgres reads one
        // without an offset as UTC — an event entered as 6pm in Sydney came
        // back as 5am the next day. Parsed here, where the browser's own
        // timezone is what "6pm" meant.
        starts_at: new Date(String(form.get('starts_at') ?? '')).toISOString(),
        format,
        location: String(form.get('location') ?? ''),
        online_url: String(form.get('online_url') ?? ''),
        audience: String(form.get('audience') ?? ''),
        status: form.get('publish') === 'on' ? 'published' : 'draft',
      })
      el.reset()
    })
  }

  function Row({
    kind,
    id,
    title,
    meta,
    status,
    href,
  }: {
    kind: 'events' | 'stories'
    id: string
    title: string
    meta: string
    status: 'draft' | 'published'
    /** Where the title links, when the thing has a screen of its own. */
    href?: Route
  }) {
    return (
      <li className="card flex flex-wrap items-center gap-3 p-4">
        <span className="min-w-0 flex-1">
          {href ? (
            <Link href={href} className="block font-bold text-ink hover:underline">
              {title}
            </Link>
          ) : (
            <span className="block font-bold text-ink">{title}</span>
          )}
          <span className="block text-sm text-muted">{meta}</span>
        </span>
        <Badge status={status === 'published' ? 'published' : 'draft'} />
        <button
          type="button"
          className="btn btn-sm btn-quiet"
          disabled={pending}
          onClick={() => setStatus(kind, id, status === 'published' ? 'draft' : 'published')}
        >
          {status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-quiet"
          disabled={pending}
          aria-label={`Remove ${title}`}
          onClick={() => remove(kind, id)}
        >
          <Trash size={16} weight="bold" aria-hidden="true" />
        </button>
      </li>
    )
  }

  return (
    <>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <ProfileTabs
        tabs={[
          {
            key: 'events',
            label: `Events (${events.length})`,
            content: (
              <div className="flex flex-col gap-4">
                {/* The full form is its own screen. It was a cut-down
                    disclosure here until 061 gave an event a kind, a capacity,
                    a bench list, a part-print offer and a registration form of
                    its own — eleven more fields than a disclosure over a list
                    can hold, and the artboard draws them on a page. */}
                <p>
                  <Link href="/dashboard/organisation/events/new" className="btn btn-primary btn-sm">
                    <CalendarPlus size={18} weight="bold" aria-hidden="true" />
                    Publish an event
                  </Link>
                </p>

                {events.length === 0 ? (
                  <p className="text-sm leading-relaxed text-muted">Nothing published yet.</p>
                ) : (
                  <ul className="flex list-none flex-col gap-3">
                    {events.map((event) => (
                      <Row
                        key={event.id}
                        kind="events"
                        id={event.id}
                        title={event.title}
                        href={`/dashboard/org/events/${event.id}` as Route}
                        meta={`${new Date(event.starts_at).toLocaleString('en-AU')} · ${
                          event.format === 'online' ? 'Online' : event.location ?? 'In person'
                        }`}
                        status={event.status}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
          {
            key: 'stories',
            label: `Stories (${stories.length})`,
            content: (
              <div className="flex flex-col gap-4">
                {/* Its own screen, for the same reason the event form got one:
                    062 gave a story a cover photo, a featured slot, a pull
                    quote and a link back into the product, and the artboard
                    draws them on a page. */}
                <p>
                  <Link href="/dashboard/organisation/stories/new" className="btn btn-primary btn-sm">
                    <PenNib size={18} weight="bold" aria-hidden="true" />
                    Publish a story
                  </Link>
                </p>

                {stories.length === 0 ? (
                  <p className="text-sm leading-relaxed text-muted">Nothing published yet.</p>
                ) : (
                  <ul className="flex list-none flex-col gap-3">
                    {stories.map((story) => (
                      <Row
                        key={story.id}
                        kind="stories"
                        id={story.id}
                        title={story.title}
                        meta={`${STORY_KIND_LABEL[story.kind]} · ${story.byline}${
                          story.consent_confirmed ? '' : ' · consent not confirmed'
                        }`}
                        status={story.status}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
        ]}
      />

      <p className="mt-6 text-[13px] leading-relaxed text-muted">
        Nothing here is reviewed. Publishing puts it on your public page immediately, and the{' '}
        <a href="/legal/org-leader-terms">organisation leader terms</a> are what you are standing
        behind when you do.
      </p>
    </>
  )
}
