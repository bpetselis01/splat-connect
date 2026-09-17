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
import { Warning, Buildings, BookOpen, ChatCircle, Check } from '@phosphor-icons/react/dist/ssr'
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

const TOPIC = {
  safety: { label: 'Safety report', icon: Warning, tone: 'bg-danger-soft text-ink' },
  organisation: { label: 'My organisation', icon: Buildings, tone: 'bg-brand-tint text-brand-deep' },
  guide: { label: 'A guide', icon: BookOpen, tone: 'bg-honey-soft text-ink' },
  other: { label: 'Something else', icon: ChatCircle, tone: 'bg-sunken text-muted' },
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
      <div role="tablist" aria-label="Message status" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            // aria-selected, not aria-pressed: role="tab" does not support the
            // latter, and two conflicting states read worse than one.
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="chip"
            data-on={tab === t ? 'true' : undefined}
          >
            {t[0].toUpperCase() + t.slice(1)} {messages.filter((m) => m.status === t).length}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="alert alert-danger mt-4">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="card mt-6 p-6 text-sm text-muted">Nothing {tab}.</p>
      ) : (
        <ul className="mt-6 flex list-none flex-col gap-3">
          {shown.map((m) => {
            const topic = TOPIC[m.topic]
            return (
              <li key={m.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
                <span className={`badge shrink-0 ${topic.tone}`}>
                  <topic.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {topic.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">
                    {m.name}{' '}
                    <span className="font-semibold text-muted">
                      · {formatRelativeTime(m.created_at)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{m.body}</p>
                  {/* The reply route. A mailto rather than a form, because that
                      is what the contact page promises and a half-ticketing
                      system would be a worse version of both. */}
                  <p className="mt-2">
                    <a
                      href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to SPLAT Connect')}`}
                      className="text-sm font-semibold text-brand-dark hover:underline"
                    >
                      {m.email}
                    </a>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {m.status !== 'replied' && (
                    <button
                      type="button"
                      disabled={busy === m.id}
                      onClick={() => setStatus(m.id, 'replied')}
                      className="btn btn-quiet btn-sm"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Replied
                    </button>
                  )}
                  {m.status !== 'closed' ? (
                    <button
                      type="button"
                      disabled={busy === m.id}
                      onClick={() => setStatus(m.id, 'closed')}
                      className="btn btn-quiet btn-sm"
                    >
                      Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === m.id}
                      onClick={() => setStatus(m.id, 'open')}
                      className="btn btn-quiet btn-sm"
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
