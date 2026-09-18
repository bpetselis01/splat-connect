'use client'
/**
 * The RSVP as a form, not a toggle.
 *
 * Name and email are always asked and are never questions — they are columns,
 * because every event needs them and a question that cannot be removed is not
 * a question. Everything below them is what this organiser added, in the order
 * they put it, with the answer control the type says.
 *
 * Required answers block the confirm and everything else is optional by
 * default, which is the artboard's rule. The server holds the same line
 * (packages/api/src/routes/events.ts): this page is public, and its confirm
 * button is not the only way to reach that route.
 *
 * Related files:
 * - packages/api/src/routes/events.ts: POST /events/:id/registrations
 * - components/event-rsvp-button.tsx: the one-tap path, for an event that asks
 *   nothing extra
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import type { OrgEventQuestion } from '@splat-connect/types'

type Answers = Record<string, string | boolean>

export function EventRegisterForm({
  eventId,
  orgName,
  questions,
  defaultName,
  defaultEmail,
}: {
  eventId: string
  orgName: string
  questions: OrgEventQuestion[]
  defaultName: string
  defaultEmail: string
}) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [answers, setAnswers] = useState<Answers>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (id: string, value: string | boolean) =>
    setAnswers((prev) => ({ ...prev, [id]: value }))

  // Computed rather than validated on submit, so the button is honest about
  // what is missing before it is pressed. The server checks the same thing.
  const missing = questions.filter((q) => {
    if (!q.required) return false
    const v = answers[q.id]
    return v === undefined || v === '' || v === null
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await browserApiClient.post(`/api/events/${eventId}/registrations`, { name, email, answers })
      router.push(`/get-involved/events/${eventId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save. Try once more.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <fieldset className="card p-5">
        <legend className="px-1 font-bold text-ink">Your details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Name</span>
            <input
              id="name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Who is the booking under"
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Email</span>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="field"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-muted">
          Only the host sees this. Reminders come the day before and nothing else.
        </p>
      </fieldset>

      {questions.length > 0 && (
        <fieldset className="card p-5">
          <legend className="px-1 font-bold text-ink">
            {questions.length} question{questions.length === 1 ? '' : 's'} from {orgName}
          </legend>
          <div className="flex flex-col gap-4">
            {questions.map((q) => (
              <div key={q.id}>
                <label htmlFor={`q-${q.id}`} className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">{q.prompt}</span>
                  {/* Both states are written out. "Required" beside nothing
                      makes the unmarked ones ambiguous, and an optional
                      question left blank is the most common honest answer. */}
                  <span className={`badge ${q.required ? 'bg-honey-soft text-ink' : 'bg-sunken text-muted'}`}>
                    {q.required ? 'Required' : 'Optional'}
                  </span>
                </label>

                {q.answer_type === 'paragraph' ? (
                  <textarea
                    id={`q-${q.id}`}
                    rows={3}
                    required={q.required}
                    value={String(answers[q.id] ?? '')}
                    onChange={(e) => set(q.id, e.target.value)}
                    className="field"
                  />
                ) : q.answer_type === 'number' ? (
                  <input
                    id={`q-${q.id}`}
                    type="number"
                    min={0}
                    required={q.required}
                    value={String(answers[q.id] ?? '')}
                    onChange={(e) => set(q.id, e.target.value)}
                    className="field"
                  />
                ) : q.answer_type === 'choice' ? (
                  <select
                    id={`q-${q.id}`}
                    required={q.required}
                    value={String(answers[q.id] ?? '')}
                    onChange={(e) => set(q.id, e.target.value)}
                    className="field"
                  >
                    <option value="">Choose one</option>
                    {q.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : q.answer_type === 'boolean' ? (
                  <select
                    id={`q-${q.id}`}
                    required={q.required}
                    value={answers[q.id] === undefined ? '' : String(answers[q.id])}
                    onChange={(e) => set(q.id, e.target.value === 'true')}
                    className="field"
                  >
                    <option value="">Choose one</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    id={`q-${q.id}`}
                    maxLength={2000}
                    required={q.required}
                    value={String(answers[q.id] ?? '')}
                    onChange={(e) => set(q.id, e.target.value)}
                    className="field"
                  />
                )}
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || missing.length > 0} className="btn btn-primary">
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          {saving ? 'Confirming…' : 'Confirm my spot'}
        </button>
        <a href={`/get-involved/events/${eventId}`} className="btn btn-quiet">
          Back to the event
        </a>
      </div>
      {missing.length > 0 && (
        <p className="text-sm text-muted">
          {missing.length} required question{missing.length === 1 ? '' : 's'} still to answer.
        </p>
      )}
      <p className="text-xs text-muted">
        No ticket price. Change or cancel any time from My events.
      </p>
    </form>
  )
}
