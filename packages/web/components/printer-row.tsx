'use client'

/**
 * One of the viewer's own machines, with the two controls that actually change
 * anything day to day: whether it is taking jobs, and how many it will carry.
 *
 * Both are live writes rather than a form with a save button, because both are
 * the kind of thing somebody changes on the way past — the filament ran out,
 * they are away for a week — and a save step is the reason a stale "accepting"
 * flag sends a family to a machine nobody is watching.
 *
 * Removing is refused while a job is on the machine. The API says so with a
 * sentence rather than letting 058's `on delete restrict` surface as a 500.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle,
  MapPin,
  PauseCircle,
  Printer as PrinterIcon,
  Trash,
} from '@phosphor-icons/react/dist/ssr'
import type { PrinterWithOwner } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

export function PrinterRow({ printer }: { printer: PrinterWithOwner }) {
  const router = useRouter()
  const [accepting, setAccepting] = useState(printer.accepting)
  const [capacity, setCapacity] = useState(printer.capacity)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function patch(body: Record<string, unknown>, revert: () => void) {
    setError(null)
    startTransition(async () => {
      try {
        await browserApiClient.patch(`/api/printers/${printer.id}`, body)
        router.refresh()
      } catch {
        revert()
        setError('That did not save. Check your connection and try again.')
      }
    })
  }

  function remove() {
    setError(null)
    startTransition(async () => {
      try {
        await browserApiClient.delete(`/api/printers/${printer.id}`)
        router.refresh()
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setError(detail ?? 'That did not remove. Check your connection and try again.')
      }
    })
  }

  const full = printer.open_jobs >= capacity
  const where = [printer.suburb, printer.state].filter(Boolean).join(', ')
  const status = !accepting
    ? { label: 'Paused · not offered to anyone', bg: 'var(--surface2)' }
    : full
      ? { label: `Full · ${printer.open_jobs} of ${capacity} slots used`, bg: 'var(--tamber)' }
      : { label: `Open · ${printer.open_jobs} of ${capacity} slots used`, bg: 'var(--tok)' }

  function setAvailability(next: boolean) {
    if (next === accepting) return
    setAccepting(next)
    patch({ accepting: next }, () => setAccepting(!next))
  }

  return (
    <li className="grid gap-6 rounded-[24px] border border-line bg-surface p-[22px] shadow-[var(--shadow-e2),var(--shadow-hi)] md:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[var(--tmint)] text-[var(--tink)]"
          >
            <PrinterIcon size={30} weight="duotone" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-extrabold text-ink">{printer.name}</h2>
            <p className="mt-0.5 text-[13px] font-bold text-muted">
              {printer.org_name && `${printer.org_name} · `}bed {printer.bed_x} × {printer.bed_y} ×{' '}
              {printer.bed_z} mm
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-[18px] gap-y-2.5 text-sm">
          <div>
            <dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">Materials</dt>
            <dd className="mt-[3px] font-bold text-ink">{printer.materials.join(', ') || 'None listed'}</dd>
          </div>
          <div>
            <dt className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">Slots</dt>
            <dd className="mt-[3px] flex items-center gap-2 font-bold text-ink">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: full || !accepting ? 'var(--amber)' : 'var(--ok)' }}
              />
              {printer.open_jobs} of {capacity} in use
            </dd>
          </div>
        </dl>

        {where && (
          <div className="flex items-center gap-3 rounded-[18px] bg-[var(--surface2)] px-3.5 py-3">
            <MapPin size={20} weight="fill" aria-hidden="true" className="shrink-0 text-[var(--coral)]" />
            <p className="flex-1 text-sm font-bold text-ink">Pickup near {where}</p>
            <Link
              href="/dashboard/profile"
              className="text-[13px] font-extrabold text-brand-deep no-underline hover:underline"
            >
              Change in Account
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">Availability</p>
        <div role="group" aria-label="Availability" className="flex gap-1 rounded-full bg-[var(--surface2)] p-1">
          {[
            { on: true, label: 'Open', Icon: CheckCircle },
            { on: false, label: 'Paused', Icon: PauseCircle },
          ].map(({ on, label, Icon }) => (
            <button
              key={label}
              type="button"
              aria-pressed={accepting === on}
              disabled={pending}
              onClick={() => setAvailability(on)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-extrabold transition-all ${
                accepting === on ? 'bg-surface text-ink shadow-[var(--shadow-e1)]' : 'text-muted'
              }`}
            >
              <Icon size={16} weight="bold" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <span
          className="self-start rounded-full px-3 py-1.5 text-[13px] font-extrabold text-[var(--tink)]"
          style={{ background: status.bg }}
        >
          {status.label}
        </span>
        <p className="text-[13px] leading-normal text-muted">
          Paused or full, you are hidden from Find a printer. Nothing you already accepted is
          affected.
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            Jobs at once
            <input
              type="number"
              min={0}
              max={20}
              value={capacity}
              disabled={pending}
              className="field field-sm w-20 font-mono tabular-nums"
              onChange={(e) => setCapacity(Number(e.target.value))}
              onBlur={(e) => {
                const next = Number(e.target.value)
                if (next === printer.capacity) return
                patch({ capacity: next }, () => setCapacity(printer.capacity))
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-sm btn-quiet ml-auto"
            disabled={pending}
            onClick={remove}
          >
            <Trash size={16} weight="bold" aria-hidden="true" />
            Remove
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}
