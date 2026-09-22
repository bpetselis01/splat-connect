'use client'
/**
 * The contact-form inbox.
 *
 * Safety sits at the top of Open whatever its age, and the API sorts it that
 * way rather than the client — a list that arrives in the wrong order and is
 * fixed on render is one refresh away from being wrong again.
 *
 * Two actions and no reply box, deliberately. The answer to a contact message
 * is an email from a person, which is what the page has always said: "Email
 * reaches a person. There is no ticketing system and no chatbot." Marking one
 * replied records that somebody did it, and closing it takes it off the queue.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  WarningCircle,
  Buildings,
  BookOpenText,
  ChatCircleDots,
  ArrowBendUpLeft,
} from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { formatRelativeTime } from '@/lib/relative-time'

export type ContactMessage = {
  id: string
  topic: 'safety' | 'organisation' | 'guide' | 'other'
  name: string
  email: string
  body: string
  status: 'open' | 'replied' | 'closed'
  created_at: string
}

// The board's topic tints.
const TOPIC = {
  safety: { label: 'Safety report', icon: WarningCircle, tint: 'var(--tcoral)' },
  organisation: { label: 'My organisation', icon: Buildings, tint: 'var(--tviolet)' },
  guide: { label: 'A guide', icon: BookOpenText, tint: 'var(--b100)' },
  other: { label: 'Something else', icon: ChatCircleDots, tint: 'var(--surface2)' },
} as const

const TABS = ['open', 'replied', 'closed'] as const

export function AdminInbox({ messages }: { messages: ContactMessage[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<(typeof TABS)[number]>('open')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const shown = messages.filter((m) => m.status === tab)

  async function setStatus(id: string, status: ContactMessage['status']) {
    setError(null)
    setBusy(id)
    try {
      await browserApiClient.patch(`/api/admin/inbox/${id}`, { status })
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div role="tablist" aria-label="Message status" className="seg-tabs mb-[18px]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            // aria-selected, not aria-pressed: role="tab" does not support the
            // latter, and two conflicting states read worse than one.
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}{' '}
            <span className="opacity-60">{messages.filter((m) => m.status === t).length}</span>
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="alert alert-danger mb-4">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-card border-[length:var(--bw)] border-dashed border-line bg-surface p-9 text-center text-muted">
          Nothing here.
        </p>
      ) : (
        <ul className="grid list-none gap-2.5">
          {shown.map((m) => {
            const topic = TOPIC[m.topic]
            const urgent = m.topic === 'safety' && m.status === 'open'
            return (
              <li
                key={m.id}
                className="admin-row flex flex-col gap-4 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start"
                style={urgent ? { borderColor: 'var(--coral)' } : undefined}
              >
                <span className="admin-tag self-start py-[5px]" style={{ background: topic.tint }}>
                  <topic.icon size={14} weight="bold" aria-hidden="true" />
                  {topic.label}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold text-ink">
                    {m.name}{' '}
                    <span className="font-semibold text-muted">
                      · {formatRelativeTime(m.created_at)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-normal text-ink">{m.body}</p>
                  {/* The reply route. A mailto rather than a form, because that
                      is what the contact page promises and a half-ticketing
                      system would be a worse version of both. */}
                  <p className="mt-1.5">
                    <a
                      href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to SPLAT Connect')}`}
                      className="text-sm font-semibold text-brand-dark hover:underline"
                    >
                      {m.email}
                    </a>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {m.status === 'open' && (
                    <button
                      type="button"
                      disabled={busy === m.id}
                      onClick={() => setStatus(m.id, 'replied')}
                      className="btn btn-primary btn-md"
                    >
                      <ArrowBendUpLeft size={16} weight="bold" aria-hidden="true" />
                      Replied
                    </button>
                  )}
                  {m.status !== 'closed' ? (
                    <button
                      type="button"
                      disabled={busy === m.id}
                      onClick={() => setStatus(m.id, 'closed')}
                      className="btn btn-quiet btn-md"
                    >
                      Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === m.id}
                      onClick={() => setStatus(m.id, 'open')}
                      className="btn btn-quiet btn-md"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
