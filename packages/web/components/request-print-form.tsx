'use client'

/**
 * Asking one printer for the printed parts of a guide.
 *
 * "Parts come from the guide, never uploaded" is the artboard's rule, and it is
 * the shape of this form rather than a sentence in it: the only parts offered
 * are the STL files the guide already carries, and there is no file input
 * anywhere near it.
 *
 * "Tick any combination, one request" — one job covers everything ticked, so a
 * family asking for four parts does not open four conversations.
 *
 * Laid out as the board's #print_request_new: numbered panels on the left
 * (parts, preferences, printer, pickup) and a sticky summary with the send
 * button on the right. The board's per-part quantity, print time, grams and
 * settings, its colour and deadline preferences, and its pick-up-to-three
 * printers have no field on the request or the STL row yet, so they are not
 * drawn — a stepper that sends nothing would be a promise the job page breaks.
 *
 * A full or closed machine is shown and disabled rather than hidden. A list
 * that silently omits the printer somebody was about to choose reads as an
 * empty directory.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import type { ReactNode } from 'react'
import {
  CheckSquare,
  Square,
  Cube,
  MapPinLine,
  PaperPlaneTilt,
  RadioButton,
  Circle,
} from '@phosphor-icons/react/dist/ssr'
import type { PrinterWithOwner } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { printerAvailability } from '@/lib/printer-availability'

export interface PrintablePart {
  id: string
  filename: string
}

const TINTS = ['var(--tmint)', 'var(--b100)', 'var(--tamber)', 'var(--tviolet)', 'var(--tcoral)']

const NEXT_STEPS = [
  ['The printer replies', 'They accept, or say why they cannot take it on.'],
  [
    'You watch it move',
    'Accepted, printing, ready — each step is a notification and a line in the thread.',
  ],
  [
    'Collect and confirm',
    'A photo of the parts before you travel, then a six-digit code each way.',
  ],
]

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow text-muted">{children}</p>
}

export function RequestPrintForm({
  tutorialId,
  tutorialTitle,
  parts,
  printers,
  header,
  requesterSuburb,
}: {
  tutorialId: string
  tutorialTitle: string
  parts: PrintablePart[]
  printers: PrinterWithOwner[]
  /** The page's heading block, which the board puts at the top of the left column. */
  header: ReactNode
  /** What the printer will see of the requester, when the profile has it. */
  requesterSuburb?: string | null
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>(parts.map((p) => p.id))
  const [printerId, setPrinterId] = useState(
    printers.find((p) => printerAvailability(p) === null)?.id ?? ''
  )
  const [note, setNote] = useState('')
  const [agree, setAgree] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const valid = picked.length > 0 && printerId !== '' && agree

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setError(null)
    startTransition(async () => {
      try {
        const tx = await browserApiClient.post<{ id: string }>('/api/toy-transactions/print', {
          tutorial_id: tutorialId,
          printer_id: printerId,
          stl_file_ids: picked,
          note: note.trim(),
        })
        router.push(`/dashboard/print-requests/${tx.id}` as Route)
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setError(detail ?? 'That did not send. Check your connection and try again.')
      }
    })
  }

  if (parts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p className="text-sm leading-relaxed text-muted">
          {tutorialTitle} has no printable parts, so there is nothing to ask a printer for.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-7">
        {header}

        <section className="print-panel">
          <div className="flex items-end justify-between gap-3">
            <div>
              <Eyebrow>1 · Parts</Eyebrow>
              <h2 className="print-panel__title">Which parts?</h2>
            </div>
            <span className="rounded-pill bg-sunken px-3 py-1.5 text-[13px] font-extrabold text-muted">
              {picked.length} of {parts.length} ticked
            </span>
          </div>
          <ul className="flex list-none flex-col gap-2.5 p-0">
            {parts.map((part) => {
              const on = picked.includes(part.id)
              return (
                <li key={part.id} className="print-part" data-on={on}>
                  <button
                    type="button"
                    onClick={() => toggle(part.id)}
                    aria-pressed={on}
                    aria-label={`Include ${part.filename}`}
                    className="grid h-11 w-11 flex-none place-items-center rounded-field text-brand-dark"
                  >
                    {on ? (
                      <CheckSquare size={26} weight="bold" aria-hidden="true" />
                    ) : (
                      <Square size={26} aria-hidden="true" />
                    )}
                  </button>
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 flex-none place-items-center rounded-field bg-violet-soft text-[var(--tink)]"
                  >
                    <Cube size={24} weight="duotone" />
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-sm font-bold text-ink [overflow-wrap:anywhere]">
                    {part.filename}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="print-panel gap-4">
          <div>
            <Eyebrow>2 · Preferences</Eyebrow>
            <h2 className="print-panel__title">What matters to you?</h2>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink">
            <span>
              A note for the printer <span className="font-semibold text-muted">(optional)</span>
            </span>
            <textarea
              className="field w-full rounded-[var(--radius-inset)] font-semibold"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. It is for a round cot rail, about 25 mm across."
            />
          </label>
        </section>

        <section className="print-panel">
          <div>
            <Eyebrow>3 · Printers</Eyebrow>
            <h2 className="print-panel__title">Who you asked</h2>
          </div>
          {printers.length === 0 ? (
            <p className="rounded-[var(--radius-inset)] bg-sunken p-[18px] text-center text-sm text-muted">
              Nobody has listed a printer yet.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Printer" className="flex flex-col gap-2.5">
              {printers.map((printer, i) => {
                const unavailable = printerAvailability(printer)
                const who = printer.org_name ?? printer.owner_name ?? 'A contributor'
                const on = printerId === printer.id
                return (
                  <label
                    key={printer.id}
                    className={`print-part cursor-pointer ${unavailable ? 'cursor-not-allowed opacity-60' : ''}`}
                    data-on={on ? 'true' : undefined}
                  >
                    <input
                      type="radio"
                      name="printer"
                      className="sr-only"
                      value={printer.id}
                      checked={on}
                      disabled={Boolean(unavailable)}
                      onChange={() => setPrinterId(printer.id)}
                    />
                    <span
                      aria-hidden="true"
                      className="grid h-11 w-11 flex-none place-items-center rounded-field text-sm font-extrabold text-[var(--tink)]"
                      style={{ background: TINTS[i % TINTS.length] }}
                    >
                      {initials(who)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-extrabold text-ink">{who}</span>
                      <span className="text-[13px] text-muted">
                        {[
                          [printer.suburb, printer.state].filter(Boolean).join(' ') || null,
                          unavailable ?? 'Open',
                          `${printer.name} · ${printer.materials.join(', ')}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    {on ? (
                      <RadioButton
                        size={22}
                        weight="fill"
                        className="text-brand-dark"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle size={22} className="text-line" aria-hidden="true" />
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </section>

        <section className="print-panel flex-row items-start gap-4">
          <span
            aria-hidden="true"
            className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[var(--radius-inset)] bg-mint-soft text-[var(--tink)]"
          >
            <MapPinLine size={28} weight="duotone" />
          </span>
          <div>
            <Eyebrow>4 · Pickup</Eyebrow>
            <h2 className="print-panel__title text-[22px]">You collect it</h2>
            <p className="mt-2 text-sm leading-[1.55] text-muted">
              Each printer has a fixed pickup point. It appears on your job page the moment they
              accept. If it does not suit, agree somewhere else in the chat — the same way toy
              exchanges work. The printer sees your note and your suburb
              {requesterSuburb ? (
                <>
                  , <strong className="text-ink">{requesterSuburb}</strong>
                </>
              ) : null}
              , and nothing more.
            </p>
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-[94px]">
        <div className="print-panel shadow-[var(--e3),var(--hi)]">
          <Eyebrow>Your request</Eyebrow>
          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              [picked.length, 'parts'],
              [printerId ? 1 : 0, 'printers asked'],
            ].map(([n, label]) => (
              <div key={label} className="rounded-field bg-sunken p-2.5">
                <p className="font-display text-xl font-extrabold text-ink">{n}</p>
                <p className="text-xs font-bold text-muted">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 rounded-[var(--radius-inset)] bg-sunken px-4 py-3.5">
            <p className="text-[13px] leading-[1.5] text-muted">
              The printer gives their time and machine. You cover the filament, settled directly
              with them. SPLAT takes no payment and no cut.
            </p>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-field border-2 px-3.5 py-3 ${
                agree ? 'border-brand bg-brand-50' : 'border-line bg-surface'
              }`}
            >
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-px h-5 w-5 flex-none accent-[var(--b600)]"
              />
              <span className="text-sm font-bold leading-[1.45] text-ink">
                I understand I cover the filament, and that I settle it with the printer, not
                through SPLAT.
              </span>
            </label>
          </div>

          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={!valid || pending}
          >
            <PaperPlaneTilt size={20} weight="bold" aria-hidden="true" />
            Send request
          </button>
        </div>

        <div className="rounded-card border border-line bg-surface px-[22px] py-5 shadow-[var(--e2)]">
          <p className="eyebrow mb-3.5 text-muted">What happens next</p>
          <ol className="flex list-none flex-col gap-3.5 p-0">
            {NEXT_STEPS.map(([title, body], i) => (
              <li key={title} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 flex-none place-items-center rounded-field bg-brand-tint font-display text-[13px] font-extrabold text-brand-deep"
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[15px] font-extrabold text-ink">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-[1.45] text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </form>
  )
}
