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
import { Printer as PrinterIcon, Trash } from '@phosphor-icons/react/dist/ssr'
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

  return (
    <li className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className="empty-badge text-brand-deep">
          <PrinterIcon size={22} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">
            {printer.name}
            {printer.org_name && <span className="text-muted"> · {printer.org_name}</span>}
          </p>
          <p className="text-sm text-muted">
            {[
              printer.materials.join(', '),
              `${printer.bed_x}×${printer.bed_y}×${printer.bed_z} mm`,
              [printer.suburb, printer.state].filter(Boolean).join(', ') || null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <span className={`badge ${!accepting || full ? 'bg-sunken text-brand-deep' : 'bg-mint-soft text-ink'}`}>
          {!accepting ? 'Closed' : full ? 'Full' : 'Open'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={accepting}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked
              setAccepting(next)
              patch({ accepting: next }, () => setAccepting(!next))
            }}
          />
          Taking new jobs
        </label>

        <label className="flex items-center gap-2 text-sm text-ink">
          Jobs at once
          <input
            type="number"
            min={0}
            max={20}
            value={capacity}
            disabled={pending}
            className="field w-20 font-mono tabular-nums"
            onChange={(e) => setCapacity(Number(e.target.value))}
            onBlur={(e) => {
              const next = Number(e.target.value)
              if (next === printer.capacity) return
              patch({ capacity: next }, () => setCapacity(printer.capacity))
            }}
          />
        </label>

        <span className="text-sm text-muted">
          {printer.open_jobs} on it now
        </span>

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
    </li>
  )
}
