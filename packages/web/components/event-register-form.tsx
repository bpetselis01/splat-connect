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
import { CheckCircle } from '@phosphor-icons/react/dist/ssr'
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

  const LABEL = 'text-xs font-extrabold uppercase tracking-[.1em] text-muted'
  const pill = (on: boolean) =>
    `min-h-11 rounded-full border-2 px-[18px] text-[15px] font-extrabold text-ink ${
      on ? 'border-[var(--b600)] bg-[var(--b50)]' : 'border-line bg-[var(--surface)]'
    }`

  return (
    <form
      onSubmit={submit}
      className="mt-[18px] flex flex-col gap-6 rounded-card border border-line bg-[var(--surface)] p-7 shadow-[var(--e2)]"
    >
      <fieldset className="flex flex-col gap-3.5">
        <legend className={`${LABEL} mb-3.5`}>Your details</legend>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <label className="block">
            <span className="mb-[7px] block text-sm font-extrabold text-ink">Name</span>
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
            <span className="mb-[7px] block text-sm font-extrabold text-ink">Email</span>
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
        <p className="text-[13px] leading-[1.5] text-muted">
          Only the host sees this. Reminders come the day before and nothing else.
        </p>
      </fieldset>

      {questions.length > 0 ? (
        <fieldset className="flex flex-col gap-[22px] border-t border-line pt-[22px]">
          <legend className={`${LABEL} float-left mb-[22px] w-full`}>
            {questions.length} question{questions.length === 1 ? '' : 's'} from {orgName}
          </legend>
          {questions.map((q) => {
            const picks =
              q.answer_type === 'choice'
                ? q.options.map((o) => ({ label: o, value: o as string | boolean }))
                : q.answer_type === 'boolean'
                  ? [
                      { label: 'Yes', value: true },
                      { label: 'No', value: false },
                    ]
                  : null
            return (
              <div key={q.id} className="flex flex-col gap-2.5">
                <label
                  htmlFor={picks ? undefined : `q-${q.id}`}
                  id={`q-${q.id}-label`}
                  className="flex flex-wrap items-baseline gap-2.5"
                >
                  <span className="text-base font-extrabold leading-[1.35] text-ink">{q.prompt}</span>
                  {/* Both states are written out. "Required" beside nothing
                      makes the unmarked ones ambiguous, and an optional
                      question left blank is the most common honest answer. */}
                  <span
                    className={`text-xs font-extrabold uppercase tracking-[.06em] ${
                      q.required ? 'text-[var(--coral)]' : 'text-muted'
                    }`}
                  >
                    {q.required ? 'Required' : 'Optional'}
                  </span>
                </label>

                {picks ? (
                  <div role="radiogroup" aria-labelledby={`q-${q.id}-label`} className="flex flex-wrap gap-2">
                    {picks.map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        role="radio"
                        aria-checked={answers[q.id] === o.value}
                        onClick={() => set(q.id, o.value)}
                        className={pill(answers[q.id] === o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                ) : q.answer_type === 'paragraph' ? (
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
                    className="field !w-[140px]"
                  />
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
            )
          })}
        </fieldset>
      ) : (
        <p className="flex items-start gap-2 rounded-[18px] bg-[var(--tmint)] px-[18px] py-4 text-[15px] leading-[1.5] text-[var(--tink)]">
          <CheckCircle weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
          {orgName} asks nothing else — your name and email are enough.
        </p>
      )}

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-2">
        <button type="submit" disabled={saving || missing.length > 0} className="btn btn-primary mt-4 px-[26px]">
          <CheckCircle weight="bold" aria-hidden="true" />
          {saving ? 'Confirming…' : 'Confirm my spot'}
        </button>
        <a
          href={`/get-involved/events/${eventId}`}
          className="btn mt-4 min-h-[52px] border-line bg-[var(--surface)] text-ink"
        >
          Back to the event
        </a>
        <span className="mt-4 max-w-[34ch] text-[13px] leading-[1.45] text-muted">
          {missing.length > 0
            ? `${missing.length} required question${missing.length === 1 ? '' : 's'} still to answer.`
            : 'Free to attend. You can change or cancel any time from My events.'}
        </span>
      </div>
    </form>
  )
}
