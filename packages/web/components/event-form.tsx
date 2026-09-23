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
import {
  ArrowDown,
  ArrowUp,
  Asterisk,
  Baby,
  Car,
  ChalkboardTeacher,
  CircleDashed,
  Cube,
  DoorOpen,
  Drop,
  Fire,
  Hammer,
  HandCoins,
  Hash,
  Lightning,
  ListChecks,
  MapPin,
  Megaphone,
  Printer,
  PuzzlePiece,
  Screwdriver,
  TextAa,
  TextAlignLeft,
  ToggleLeft,
  Trash,
  User,
  Users,
  VideoCamera,
  Wheelchair,
  Wrench,
  X,
} from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import { browserApiClient } from '@/lib/browser-api-client'
import { dollarsToCents } from '@/components/cost-panel'
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
const COMMON_ASKS: Array<{ label: string; icon: Icon; q: DraftQuestion }> = [
  {
    label: 'Head count',
    icon: Users,
    q: {
      prompt: 'How many people are coming, including you?',
      answer_type: 'number',
      required: true,
      options: [],
    },
  },
  {
    label: 'Toy they bring',
    icon: PuzzlePiece,
    q: { prompt: 'What toy are you bringing?', answer_type: 'short', required: true, options: [] },
  },
  {
    label: 'Access needs',
    icon: Wheelchair,
    q: {
      prompt: 'Anything we should know about access, sensory or support needs?',
      answer_type: 'paragraph',
      required: false,
      options: [],
    },
  },
  {
    label: 'Child’s age',
    icon: Baby,
    q: { prompt: 'How old is your child?', answer_type: 'number', required: false, options: [] },
  },
  {
    label: 'Soldering',
    icon: Fire,
    q: {
      prompt: 'Have you soldered before?',
      answer_type: 'boolean',
      required: false,
      options: [],
    },
  },
  {
    label: 'Parking',
    icon: Car,
    q: { prompt: 'Will you need a parking space?', answer_type: 'boolean', required: false, options: [] },
  },
]

// The board's glyphs for the kinds, the bench tools and the answer types.
const KIND_ICON: Record<EventKind, Icon> = {
  build_day: Hammer,
  workshop: ChalkboardTeacher,
  open_day: DoorOpen,
  print_day: Printer,
}
const TOOL_ICON: Record<string, Icon> = {
  'Soldering irons': Fire,
  Drill: Screwdriver,
  'Hot glue': Drop,
  Multimeter: Lightning,
  Screwdrivers: Wrench,
  '3D printer on site': Cube,
}
const ANSWER_ICON: Record<AnswerType, Icon> = {
  short: TextAa,
  paragraph: TextAlignLeft,
  number: Hash,
  choice: ListChecks,
  boolean: ToggleLeft,
}

export function EventForm({
  orgId,
  orgName,
  event,
  questions: initialQuestions = [],
}: {
  orgId: string
  /** Shown beside the buttons: whose name this goes out under. */
  orgName: string
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
  const [costDollars, setCostDollars] = useState(
    event?.cost_cents ? (event.cost_cents / 100).toFixed(2) : '',
  )
  const [costNote, setCostNote] = useState(event?.cost_note ?? '')
  // Blank is free; anything else has to read as dollars before it can be sent.
  const costCents = costDollars.trim() === '' ? 0 : dollarsToCents(costDollars)
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
  if (costCents === null) missing.push('a cost written as dollars, like 12 or 12.50')
  // Checked before anything is sent: the event is written first and the
  // questions second, so a refusal at the second step would leave a new event
  // saved and the next press would publish it twice.
  const blankQuestion = questions.some((q) => !q.prompt.trim())
  if (blankQuestion) missing.push('something to ask in every question')

  async function save(status: 'draft' | 'published') {
    if (blankQuestion) {
      setError('Every question needs something to ask. Fill it in or remove it.')
      return
    }
    setError(null)
    setSaving(status)
    try {
      const body = {
        title: title.trim(),
        kind,
        // Parsed through Date before sending, NOT passed through as
        // `2026-09-26T10:00`. A datetime-local value carries no offset and
        // Postgres reads one without an offset as UTC — an event entered as 6pm
        // in Sydney came back as 5am the next day, which is the bug
        // components/org-publishing.tsx already records. `new Date` here reads
        // it in the browser's own zone, which is what the host meant by "10am".
        starts_at: date && starts ? new Date(`${date}T${starts}`).toISOString() : undefined,
        ends_at: date && ends ? new Date(`${date}T${ends}`).toISOString() : null,
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
        cost_cents: costCents ?? 0,
        cost_note: costNote.trim(),
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
    <form onSubmit={(e) => e.preventDefault()} className="form-card">
      <label className="block">
        <span className="form-label">Event name</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          placeholder="Switch-adaptation build day"
          className="field"
        />
      </label>

      <fieldset>
        <legend className="form-label mb-2">What kind of event?</legend>
        <div role="radiogroup" aria-label="Event kind" className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(EVENT_KINDS) as EventKind[]).map((k) => {
            const KindIcon = KIND_ICON[k]
            return (
              <label key={k} className="choice-card">
                <input
                  type="radio"
                  name="kind"
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="sr-only"
                />
                <KindIcon weight="duotone" aria-hidden="true" className="choice-card__icon" />
                <span>
                  <span className="choice-card__label">{EVENT_KIND_LABEL[k]}</span>
                  <span className="choice-card__sub">{EVENT_KINDS[k]}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="block">
          <span className="form-label">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="form-label">Starts</span>
          <input type="time" value={starts} onChange={(e) => setStarts(e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="form-label">Ends</span>
          <input type="time" value={ends} onChange={(e) => setEnds(e.target.value)} className="field" />
        </label>
      </div>

      <div>
        <span className="form-label mb-2">Where</span>
        <div role="radiogroup" aria-label="Format" className="seg">
          {(
            [
              ['in_person', 'In person', MapPin],
              ['online', 'Online', VideoCamera],
            ] as const
          ).map(([f, label, FormatIcon]) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              onClick={() => setFormat(f)}
              className="px-4"
            >
              <FormatIcon weight="bold" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {format === 'in_person' ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,.8fr)]">
            <label className="block">
              <span className="form-label mb-1.5 text-[13px] text-muted">Venue and street</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Northside Therapy, 14 Corella St"
                className="field"
              />
            </label>
            <label className="block">
              <span className="form-label mb-1.5 text-[13px] text-muted">Suburb</span>
              <input
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                placeholder="Crows Nest"
                className="field"
              />
            </label>
            <label className="block">
              <span className="form-label mb-1.5 text-[13px] text-muted">State</span>
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
          <>
            {/* The rule, where the decision is made. A leader pasting a Zoom
                link should be told here that it is not going on the page. */}
            <p className="mt-3 rounded-[14px] bg-sunken px-4 py-3 text-sm leading-normal text-muted">
              <VideoCamera weight="bold" aria-hidden="true" className="mr-1 inline align-[-2px]" />
              The meeting link is not shown publicly. It is hidden until somebody says they are
              coming.
            </p>
            <label className="mt-3 block">
              <span className="form-label mb-1.5 text-[13px] text-muted">Meeting link</span>
              <input
                value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)}
                placeholder="https://meet…"
                className="field"
              />
            </label>
          </>
        )}
      </div>

      <label className="block">
        <span className="form-label">Who is it for?</span>
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          maxLength={200}
          placeholder="Parents and carers with a toy to adapt. No experience needed."
          className="field"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <label className="block">
          <span className="form-label">
            What to bring <span>(optional)</span>
          </span>
          <input
            value={whatToBring}
            onChange={(e) => setWhatToBring(e.target.value)}
            placeholder="The toy and its batteries. We supply the rest."
            className="field"
          />
        </label>
        <label className="block">
          <span className="form-label">
            Seats <span>(blank = no limit)</span>
          </span>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="16"
            className="field"
          />
        </label>
      </div>

      <fieldset className="form-well">
        <legend className="sr-only">On the day</legend>
        <p aria-hidden="true" className="form-well__kicker">
          On the day <span>— families see this when they ask for help with a guide</span>
        </p>

        <div>
          <span className="form-label mb-2">Can you print parts before the day?</span>
          <div className="flex flex-wrap items-center gap-2">
            {[true, false].map((yes) => {
              const OptIcon = yes ? Printer : X
              return (
                <label key={String(yes)} className="toggle-pill px-4 text-sm">
                  <input
                    type="radio"
                    name="prints"
                    checked={printsParts === yes}
                    onChange={() => setPrintsParts(yes)}
                    className="sr-only"
                  />
                  <OptIcon weight="bold" aria-hidden="true" />
                  {yes ? 'Yes, on request' : 'No'}
                </label>
              )
            })}
            {printsParts && (
              <label className="ml-1.5 flex items-center gap-2 text-sm font-bold text-ink">
                Up to
                <input
                  type="number"
                  min={1}
                  max={100}
                  aria-label="Up to part sets"
                  value={partSetsMax}
                  onChange={(e) => setPartSetsMax(e.target.value)}
                  className="field min-h-[42px] w-[70px]"
                />
                part sets
              </label>
            )}
          </div>
          <p className="mt-2 text-[13px] leading-normal text-muted">
            {printsParts
              ? 'Families who ask for help with a printable guide can choose “the host prints them”. Each request lands on this event for you to accept or decline.'
              : 'Families will be asked to pick a printer themselves before the day.'}
          </p>
        </div>

        <div>
          <span className="form-label mb-2">Tools on the bench</span>
          <div className="flex flex-wrap gap-2">
            {EVENT_TOOLS.map((tool) => {
              const ToolIcon = TOOL_ICON[tool]
              return (
                <button
                  key={tool}
                  type="button"
                  onClick={() => toggleTool(tool)}
                  aria-pressed={tools.includes(tool)}
                  className="toggle-pill text-[13.5px] font-bold"
                >
                  {ToolIcon && <ToolIcon weight="bold" aria-hidden="true" />}
                  {tool}
                </button>
              )
            })}
          </div>
        </div>
      </fieldset>

      <label className="block">
        <span className="form-label">
          Access notes <span>(optional)</span>
        </span>
        <input
          value={accessibility}
          onChange={(e) => setAccessibility(e.target.value)}
          maxLength={500}
          placeholder="Step-free entry, accessible toilet, quiet room available."
          className="field"
        />
      </label>

      <fieldset className="form-well">
        <legend className="sr-only">What it costs a family to come</legend>
        <p aria-hidden="true" className="form-well__kicker">
          <HandCoins weight="bold" aria-hidden="true" className="mr-1 inline align-[-2px]" />
          What it costs a family to come{' '}
          <span>— leave it empty and the event shows as free to attend</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
          <label className="block">
            <span className="form-label mb-1.5 text-[13px] text-muted">Amount, in dollars</span>
            <input
              inputMode="decimal"
              value={costDollars}
              onChange={(e) => setCostDollars(e.target.value)}
              placeholder="0.00"
              className="field"
            />
          </label>
          <label className="block">
            <span className="form-label mb-1.5 text-[13px] text-muted">Breakdown, in your words</span>
            <input
              value={costNote}
              onChange={(e) => setCostNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. kits are bought in bulk and passed on at cost — $12 is what one bench uses."
              className="field"
            />
          </label>
        </div>
        <p className="text-[13px] leading-normal text-muted">
          SPLAT never takes the payment. Families read the figure before they confirm and settle it
          with you directly.
        </p>
      </fieldset>

      <fieldset className="form-well">
        <legend className="sr-only">Registration form</legend>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p aria-hidden="true" className="form-well__kicker">
            Registration form <span>— what people answer when they tap I&apos;m going</span>
          </p>
          <span className="text-[13px] font-bold text-muted">
            {questions.length} question{questions.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="rounded-[14px] bg-surface px-3.5 py-2.5 text-[13px] leading-normal text-muted">
          <User weight="bold" aria-hidden="true" className="mr-1 inline align-[-2px] text-ink" />
          Name and email are always asked. Add only what changes how you run the day — every
          extra question loses people.
        </p>

        {questions.length === 0 && (
          <p className="rounded-[18px] border-[length:var(--bw)] border-dashed border-line bg-surface p-5 text-center text-sm text-muted">
            No questions yet — people give their name and email and that is it.
          </p>
        )}

        <div className="grid gap-2.5">
          {questions.map((q, i) => (
            <div
              key={q.id ?? `new-${i}`}
              className="flex flex-col gap-2.5 rounded-[18px] border-[length:var(--bw)] border-line bg-surface p-3.5"
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 flex-none place-items-center rounded-[14px] bg-sunken text-xs font-extrabold text-muted"
                >
                  {i + 1}
                </span>
                <input
                  aria-label="Ask one thing, plainly"
                  value={q.prompt}
                  onChange={(e) => patchQuestion(i, { prompt: e.target.value })}
                  placeholder="Ask one thing, plainly"
                  className="field min-h-[46px] min-w-0 flex-1 font-semibold"
                />
                <span className="flex flex-none gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move "${q.prompt || 'question'}" up`}
                    className="grid h-[38px] w-[38px] place-items-center rounded-[14px] border-[length:var(--bw)] border-line bg-surface text-muted hover:bg-sunken hover:text-ink disabled:opacity-50"
                  >
                    <ArrowUp weight="bold" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === questions.length - 1}
                    aria-label={`Move "${q.prompt || 'question'}" down`}
                    className="grid h-[38px] w-[38px] place-items-center rounded-[14px] border-[length:var(--bw)] border-line bg-surface text-muted hover:bg-sunken hover:text-ink disabled:opacity-50"
                  >
                    <ArrowDown weight="bold" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove "${q.prompt || 'question'}"`}
                    className="grid h-[38px] w-[38px] place-items-center rounded-[14px] border-[length:var(--bw)] border-line bg-surface text-[var(--coral)] hover:bg-[var(--tcoral)] hover:text-[var(--tink)]"
                  >
                    <Trash weight="bold" aria-hidden="true" />
                  </button>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pl-[38px]">
                <select
                  aria-label="Answer type"
                  value={q.answer_type}
                  onChange={(e) =>
                    patchQuestion(i, { answer_type: e.target.value as AnswerType })
                  }
                  className="field min-h-10 w-auto text-[13.5px] font-bold"
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
                  className="toggle-pill"
                >
                  {q.required ? (
                    <Asterisk weight="bold" aria-hidden="true" />
                  ) : (
                    <CircleDashed weight="bold" aria-hidden="true" />
                  )}
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
                    placeholder="Options, separated by commas"
                    className="field min-h-10 min-w-[200px] flex-1"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">Add</span>
          {(Object.keys(ANSWER_TYPES) as AnswerType[]).map((t) => {
            const TypeIcon = ANSWER_ICON[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setQuestions((prev) => [
                    ...prev,
                    { prompt: '', answer_type: t, required: false, options: t === 'choice' ? ['Yes'] : [] },
                  ])
                }
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-pill border-[length:var(--bw)] border-line bg-surface px-[13px] text-[13px] font-extrabold text-ink hover:border-[var(--b600)] hover:bg-[var(--b100)]"
              >
                <TypeIcon weight="bold" aria-hidden="true" />
                {ANSWER_TYPES[t]}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
            Common asks
          </span>
          {COMMON_ASKS.map((ask) => (
            <button
              key={ask.label}
              type="button"
              title={ask.q.prompt}
              onClick={() => setQuestions((prev) => [...prev, { ...ask.q }])}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-pill border-[length:var(--bw)] border-dashed border-line bg-surface px-[13px] text-[13px] font-bold text-muted hover:border-solid hover:border-[var(--b600)] hover:text-ink"
            >
              <ask.icon weight="bold" aria-hidden="true" />
              {ask.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="form-label">About the event</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="What happens, who will be there, and what people leave with."
          className="field"
        />
      </label>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="form-foot">
        <button
          type="button"
          onClick={() => save('published')}
          disabled={saving !== null || missing.length > 0}
          className="btn btn-primary px-[26px]"
        >
          <Megaphone weight="bold" aria-hidden="true" />
          {saving === 'published' ? 'Publishing…' : 'Publish to Events'}
        </button>
        <button
          type="button"
          onClick={() => save('draft')}
          disabled={saving !== null}
          className="btn btn-quiet min-h-[52px]"
        >
          {saving === 'draft' ? 'Saving…' : 'Save as draft'}
        </button>
        <span className="text-[13px] text-muted">
          Published as <strong className="text-ink">{orgName}</strong>
        </span>
      </div>
      {missing.length > 0 && (
        <p className="-mt-3 text-sm text-muted">
          Still needs {missing.join(', ')} before it can be published. Save it as a draft
          meanwhile.
        </p>
      )}
    </form>
  )
}
