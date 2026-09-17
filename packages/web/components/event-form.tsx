'use client'
/**
 * Publish an event.
 *
 * Four required things — name, date and time, where, who for — and the artboard
 * is firm that those four are enough to publish. Everything below them is
 * optional, and the form says so rather than making a leader guess which
 * blanks will block the button. That ordering is the whole design: an
 * organisation writing its first build day should be able to get it in front of
 * families in two minutes, and come back for the bench list later.
 *
 * Save as draft is always available and never validates the optional half —
 * the point of a draft is that it is unfinished.
 *
 * The registration form is edited here rather than on a screen of its own,
 * because what an organiser asks depends on what kind of day they are running
 * and both decisions are made in one sitting. It is sent whole on save: see
 * the organizations route's own note on why questions are replaced rather than
 * patched.
 *
 * Related files:
 * - packages/api/src/routes/organizations.ts: POST/PATCH the event, PUT the
 *   questions
 * - app/dashboard/organisation/events/new/page.tsx: what renders this
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretUp, CaretDown, Trash, Plus, Info } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import {
  EVENT_KINDS,
  EVENT_KIND_LABEL,
  EVENT_TOOLS,
  ANSWER_TYPES,
  AU_STATES,
  type EventKind,
  type AnswerType,
  type OrgEvent,
  type OrgEventQuestion,
} from '@splat-connect/types'

/** A question being edited. `id` is absent until it has been saved once. */
type DraftQuestion = {
  id?: string
  prompt: string
  answer_type: AnswerType
  required: boolean
  options: string[]
}

/**
 * The asks an organiser reaches for most, as one-tap starters.
 *
 * Every extra question loses people, so the fastest way to keep a form short is
 * to make the useful ones free rather than to warn against the rest.
 */
const COMMON_ASKS: Array<{ label: string; q: DraftQuestion }> = [
  {
    label: 'Head count',
    q: {
      prompt: 'How many people are coming, including you?',
      answer_type: 'number',
      required: true,
      options: [],
    },
  },
  {
    label: 'Toy they bring',
    q: { prompt: 'What toy are you bringing?', answer_type: 'short', required: true, options: [] },
  },
  {
    label: 'Access needs',
    q: {
      prompt: 'Anything we should know about access, sensory or support needs?',
      answer_type: 'paragraph',
      required: false,
      options: [],
    },
  },
  {
    label: 'Child’s age',
    q: { prompt: 'How old is your child?', answer_type: 'number', required: false, options: [] },
  },
  {
    label: 'Soldering',
    q: {
      prompt: 'Have you soldered before?',
      answer_type: 'boolean',
      required: false,
      options: [],
    },
  },
  {
    label: 'Parking',
    q: { prompt: 'Will you need a parking space?', answer_type: 'boolean', required: false, options: [] },
  },
]

export function EventForm({
  orgId,
  event,
  questions: initialQuestions = [],
}: {
  orgId: string
  /** Absent when publishing a new one. */
  event?: OrgEvent
  questions?: OrgEventQuestion[]
}) {
  const router = useRouter()

  const [title, setTitle] = useState(event?.title ?? '')
  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'build_day')
  const [date, setDate] = useState(event ? event.starts_at.slice(0, 10) : '')
  const [starts, setStarts] = useState(event ? event.starts_at.slice(11, 16) : '')
  const [ends, setEnds] = useState(event?.ends_at ? event.ends_at.slice(11, 16) : '')
  const [format, setFormat] = useState<'in_person' | 'online'>(event?.format ?? 'in_person')
  const [location, setLocation] = useState(event?.location ?? '')
  const [suburb, setSuburb] = useState(event?.suburb ?? '')
  const [state, setState] = useState<string>(event?.state ?? 'NSW')
  const [onlineUrl, setOnlineUrl] = useState(event?.online_url ?? '')
  const [audience, setAudience] = useState(event?.audience ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [whatToBring, setWhatToBring] = useState(event?.what_to_bring ?? '')
  const [capacity, setCapacity] = useState(event?.capacity ? String(event.capacity) : '')
  const [printsParts, setPrintsParts] = useState(event?.prints_parts ?? false)
  const [partSetsMax, setPartSetsMax] = useState(
    event?.part_sets_max ? String(event.part_sets_max) : '6',
  )
  const [tools, setTools] = useState<string[]>(event?.tools ?? [])
  const [accessibility, setAccessibility] = useState(event?.accessibility_note ?? '')
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    initialQuestions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      answer_type: q.answer_type,
      required: q.required,
      options: q.options,
    })),
  )

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null)

  const toggleTool = (tool: string) =>
    setTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]))

  const patchQuestion = (i: number, patch: Partial<DraftQuestion>) =>
    setQuestions((prev) => prev.map((q, j) => (i === j ? { ...q, ...patch } : q)))

  const move = (i: number, by: -1 | 1) =>
    setQuestions((prev) => {
      const next = [...prev]
      const j = i + by
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  // The four required things, checked here so the Publish button can be honest
  // before it is pressed. Save as draft ignores all of it.
  const missing: string[] = []
  if (!title.trim()) missing.push('a name')
  if (!date || !starts) missing.push('a date and time')
  if (format === 'in_person' && !location.trim()) missing.push('a venue')
  if (format === 'in_person' && !suburb.trim()) missing.push('a suburb')
  if (format === 'online' && !onlineUrl.trim()) missing.push('a joining link')
  if (!audience.trim()) missing.push('who it is for')

  async function save(status: 'draft' | 'published') {
    setError(null)
    setSaving(status)
    try {
      const body = {
        title: title.trim(),
        kind,
        // Sent as a local wall-clock time with no zone. The host typed the time
        // they will open the door, and that is what a family reads back.
        starts_at: date && starts ? `${date}T${starts}:00` : undefined,
        ends_at: date && ends ? `${date}T${ends}:00` : null,
        format,
        location: location.trim(),
        suburb: suburb.trim(),
        state,
        online_url: onlineUrl.trim(),
        audience: audience.trim(),
        description: description.trim(),
        what_to_bring: whatToBring.trim(),
        tools,
        capacity: capacity.trim() === '' ? null : Number(capacity),
        prints_parts: printsParts,
        part_sets_max: printsParts ? Number(partSetsMax) : null,
        accessibility_note: accessibility.trim(),
        status,
      }

      const saved = event
        ? await browserApiClient.patch<OrgEvent>(
            `/api/organizations/${orgId}/events/${event.id}`,
            body,
          )
        : await browserApiClient.post<OrgEvent>(`/api/organizations/${orgId}/events`, body)

      await browserApiClient.put(`/api/organizations/${orgId}/events/${saved.id}/questions`, {
        questions,
      })

      // Publish goes straight to the public page, so a leader sees what a
      // family sees; a draft goes back to the list, because there is nothing
      // public to look at yet. The artboard says exactly this.
      router.push(
        status === 'published'
          ? `/get-involved/events/${saved.id}`
          : '/dashboard/organisation/publish',
      )
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
      setSaving(null)
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="mt-6 flex flex-col gap-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">Event name</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          placeholder="Switch-adaptation build day"
          className="field"
        />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-ink">What kind of event?</legend>
        <div role="radiogroup" aria-label="Event kind" className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(EVENT_KINDS) as EventKind[]).map((k) => (
            <label
              key={k}
              className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 ${
                kind === k ? 'border-brand bg-brand-tint' : 'border-line bg-surface'
              }`}
            >
              <input
                type="radio"
                name="kind"
                checked={kind === k}
                onChange={() => setKind(k)}
                className="mt-1"
              />
              <span>
                <span className="block font-bold text-ink">{EVENT_KIND_LABEL[k]}</span>
                <span className="block text-xs text-muted">{EVENT_KINDS[k]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Starts</span>
          <input type="time" value={starts} onChange={(e) => setStarts(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Ends</span>
          <input type="time" value={ends} onChange={(e) => setEnds(e.target.value)} className="field" />
        </label>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-ink">Where</legend>
        <div role="radiogroup" aria-label="Format" className="flex flex-wrap gap-2">
          {(['in_person', 'online'] as const).map((f) => (
            <label
              key={f}
              className={`flex cursor-pointer items-center gap-2 rounded-pill border px-4 py-2 text-sm font-bold ${
                format === f ? 'border-brand bg-brand-tint text-brand-deep' : 'border-line bg-surface text-ink'
              }`}
            >
              <input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} />
              {f === 'in_person' ? 'In person' : 'Online'}
            </label>
          ))}
        </div>

        {format === 'in_person' ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-[2fr_1fr_auto]">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">Venue and street</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Northside Therapy, 14 Corella St"
                className="field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">Suburb</span>
              <input
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                placeholder="Crows Nest"
                className="field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">State</span>
              <select value={state} onChange={(e) => setState(e.target.value)} className="field">
                {AU_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Joining link</span>
            <input
              value={onlineUrl}
              onChange={(e) => setOnlineUrl(e.target.value)}
              placeholder="https://…"
              className="field"
            />
            {/* The rule, where the decision is made. A leader pasting a Zoom
                link should be told here that it is not going on the page. */}
            <span className="mt-1.5 block text-xs text-muted">
              Hidden until somebody says they are coming. It is never on the public page.
            </span>
          </label>
        )}
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">Who is it for?</span>
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          maxLength={200}
          placeholder="Parents and carers with a toy to adapt. No experience needed."
          className="field"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">
          About this event <span className="font-semibold text-muted">(optional)</span>
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="field"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">
            What to bring <span className="font-semibold text-muted">(optional)</span>
          </span>
          <input
            value={whatToBring}
            onChange={(e) => setWhatToBring(e.target.value)}
            placeholder="The toy and its batteries. We supply the rest."
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Seats (blank = no limit)</span>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="field"
          />
        </label>
      </div>

      <fieldset className="card p-5">
        <legend className="px-1 font-bold text-ink">On the day</legend>
        <p className="mb-3 text-xs text-muted">
          Families see this when they ask for help with a guide.
        </p>

        <p className="mb-1.5 text-sm font-bold text-ink">Can you print parts before the day?</p>
        <div className="flex flex-wrap items-center gap-3">
          {[true, false].map((yes) => (
            <label
              key={String(yes)}
              className={`flex cursor-pointer items-center gap-2 rounded-pill border px-4 py-2 text-sm font-bold ${
                printsParts === yes
                  ? 'border-brand bg-brand-tint text-brand-deep'
                  : 'border-line bg-surface text-ink'
              }`}
            >
              <input
                type="radio"
                name="prints"
                checked={printsParts === yes}
                onChange={() => setPrintsParts(yes)}
              />
              {yes ? 'Yes, on request' : 'No'}
            </label>
          ))}
          {printsParts && (
            <label className="flex items-center gap-2 text-sm text-muted">
              Up to
              <input
                type="number"
                min={1}
                max={100}
                aria-label="Up to part sets"
                value={partSetsMax}
                onChange={(e) => setPartSetsMax(e.target.value)}
                className="field w-20"
              />
              part sets
            </label>
          )}
        </div>
        {printsParts && (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Families who ask for help with a printable guide can choose “the host prints them”.
            Each request lands on this event for you to accept or decline.
          </p>
        )}

        <p className="mb-1.5 mt-4 text-sm font-bold text-ink">Tools on the bench</p>
        <div className="flex flex-wrap gap-2">
          {EVENT_TOOLS.map((tool) => (
            <button
              key={tool}
              type="button"
              onClick={() => toggleTool(tool)}
              aria-pressed={tools.includes(tool)}
              className="chip"
            >
              {tool}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">
          Access notes <span className="font-semibold text-muted">(optional)</span>
        </span>
        <input
          value={accessibility}
          onChange={(e) => setAccessibility(e.target.value)}
          maxLength={500}
          placeholder="Step-free entry, accessible toilet, quiet room available."
          className="field"
        />
      </label>

      <fieldset className="card p-5">
        <legend className="px-1 font-bold text-ink">Registration form</legend>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">What people answer when they tap I&apos;m going.</p>
          <span className="badge bg-sunken text-muted">
            {questions.length} question{questions.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="mb-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Name and email are always asked. Add only what changes how you run the day — every
          extra question loses people.
        </p>

        <div className="flex flex-col gap-3">
          {questions.map((q, i) => (
            <div key={q.id ?? `new-${i}`} className="rounded-card border border-line p-3">
              <div className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken font-mono text-xs font-bold text-brand-deep"
                >
                  {i + 1}
                </span>
                <input
                  aria-label="Ask one thing, plainly"
                  value={q.prompt}
                  onChange={(e) => patchQuestion(i, { prompt: e.target.value })}
                  placeholder="Ask one thing, plainly"
                  className="field flex-1"
                />
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move "${q.prompt || 'question'}" up`}
                    className="btn btn-quiet btn-sm"
                  >
                    <CaretUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === questions.length - 1}
                    aria-label={`Move "${q.prompt || 'question'}" down`}
                    className="btn btn-quiet btn-sm"
                  >
                    <CaretDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove "${q.prompt || 'question'}"`}
                    className="btn btn-danger btn-sm"
                  >
                    <Trash className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
                <select
                  aria-label="Answer type"
                  value={q.answer_type}
                  onChange={(e) =>
                    patchQuestion(i, { answer_type: e.target.value as AnswerType })
                  }
                  className="field w-auto"
                >
                  {(Object.keys(ANSWER_TYPES) as AnswerType[]).map((t) => (
                    <option key={t} value={t}>
                      {ANSWER_TYPES[t]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => patchQuestion(i, { required: !q.required })}
                  aria-pressed={q.required}
                  className="chip"
                >
                  {q.required ? 'Required' : 'Optional'}
                </button>
                {q.answer_type === 'choice' && (
                  <input
                    aria-label="Options, comma separated"
                    value={q.options.join(', ')}
                    onChange={(e) =>
                      patchQuestion(i, {
                        options: e.target.value
                          .split(',')
                          .map((o) => o.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Options, comma separated"
                    className="field flex-1"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted">Add</span>
          {(Object.keys(ANSWER_TYPES) as AnswerType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() =>
                setQuestions((prev) => [
                  ...prev,
                  { prompt: '', answer_type: t, required: false, options: t === 'choice' ? ['Yes'] : [] },
                ])
              }
              className="btn btn-quiet btn-sm"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {ANSWER_TYPES[t]}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted">Common asks</span>
          {COMMON_ASKS.map((ask) => (
            <button
              key={ask.label}
              type="button"
              onClick={() => setQuestions((prev) => [...prev, { ...ask.q }])}
              className="btn btn-quiet btn-sm"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {ask.label}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => save('published')}
          disabled={saving !== null || missing.length > 0}
          className="btn btn-primary"
        >
          {saving === 'published' ? 'Publishing…' : 'Publish'}
        </button>
        <button
          type="button"
          onClick={() => save('draft')}
          disabled={saving !== null}
          className="btn btn-quiet"
        >
          {saving === 'draft' ? 'Saving…' : 'Save as draft'}
        </button>
      </div>
      {missing.length > 0 && (
        <p className="text-sm text-muted">
          Still needs {missing.join(', ')} before it can be published. Save it as a draft
          meanwhile.
        </p>
      )}
    </form>
  )
}
