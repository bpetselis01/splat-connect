'use client'
/**
 * The contact form.
 *
 * It was a mailto: link, which meant a safety report reached whichever inbox
 * somebody happened to be watching. Now it lands in a queue where safety jumps
 * ahead of everything else (065, /admin/inbox), and the email address stays on
 * the page beside it — the promise has always been that "email reaches a
 * person", and this is a second door rather than a replacement.
 *
 * No account required, deliberately. Somebody reporting that a battery pack
 * gets warm should not have to sign up first, and requiring it is the
 * difference between hearing about a hazard and not.
 */
import { useState } from 'react'
import { PaperPlaneTilt, Check } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

const TOPICS = [
  { value: 'safety', label: 'A safety problem with a guide' },
  { value: 'organisation', label: 'Bringing an organisation on board' },
  { value: 'guide', label: 'Something wrong in a guide' },
  { value: 'other', label: 'Something else' },
] as const

export function ContactForm({ defaultName = '', defaultEmail = '' }) {
  const [topic, setTopic] = useState<string>('other')
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      await browserApiClient.post('/api/public/contact', {
        topic,
        name: name.trim(),
        email: email.trim(),
        body: body.trim(),
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not send. Try again, or email us.')
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="card flex flex-col items-start gap-2 p-5">
        <span aria-hidden="true" className="empty-badge text-brand-deep">
          <Check className="h-7 w-7" />
        </span>
        <p className="font-display text-lg font-extrabold text-ink">That has reached us</p>
        <p className="text-sm leading-relaxed text-muted">
          {topic === 'safety'
            ? 'A safety report goes to the top of the queue. If a guide is involved we will take it down while we check it.'
            : 'Somebody will read it and reply by email. There is no ticket number, because there is no ticketing system.'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">What is it about?</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className="field">
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Your email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="field"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">What happened?</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={5}
          maxLength={4000}
          placeholder={
            topic === 'safety'
              ? 'Which guide, and what you found. We would much rather pull a guide than leave a hazard published.'
              : ''
          }
          className="field"
        />
      </label>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={sending || !name.trim() || !email.trim() || !body.trim()}
          className="btn btn-primary"
        >
          <PaperPlaneTilt className="h-4 w-4" aria-hidden="true" />
          {sending ? 'Sending…' : 'Send it'}
        </button>
      </div>
    </form>
  )
}
