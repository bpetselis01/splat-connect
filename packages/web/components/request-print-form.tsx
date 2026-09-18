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
 * A full or closed machine is shown and disabled rather than hidden. A list
 * that silently omits the printer somebody was about to choose reads as an
 * empty directory.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { Printer as PrinterIcon } from '@phosphor-icons/react/dist/ssr'
import type { PrinterWithOwner } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { printerAvailability } from '@/lib/printer-availability'

export interface PrintablePart {
  id: string
  filename: string
}


export function RequestPrintForm({
  tutorialId,
  tutorialTitle,
  parts,
  printers,
}: {
  tutorialId: string
  tutorialTitle: string
  parts: PrintablePart[]
  printers: PrinterWithOwner[]
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>(parts.map((p) => p.id))
  const [printerId, setPrinterId] = useState(
    printers.find((p) => printerAvailability(p) === null)?.id ?? ''
  )
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const valid = picked.length > 0 && printerId !== ''

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
      <p className="text-sm leading-relaxed text-muted">
        {tutorialTitle} has no printable parts, so there is nothing to ask a printer for.
      </p>
    )
  }

  return (
    <form className="card flex flex-col gap-6 p-6" onSubmit={submit}>
      <fieldset className="flex flex-col gap-2">
        <legend className="field-label">Which parts</legend>
        {parts.map((part) => (
          <label key={part.id} className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={picked.includes(part.id)}
              onChange={() => toggle(part.id)}
            />
            {part.filename}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label">Which printer</legend>
        {printers.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            Nobody has listed a printer yet.
          </p>
        ) : (
          printers.map((printer) => {
            const unavailable = printerAvailability(printer)
            return (
              <label
                key={printer.id}
                className={`flex items-start gap-3 rounded-[var(--radius-inset)] bg-canvas p-3 text-sm ${
                  unavailable ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="radio"
                  name="printer"
                  className="mt-1"
                  value={printer.id}
                  checked={printerId === printer.id}
                  disabled={Boolean(unavailable)}
                  onChange={() => setPrinterId(printer.id)}
                />
                <span className="min-w-0">
                  <span className="block font-bold text-ink">
                    {printer.name} · {printer.org_name ?? printer.owner_name ?? 'A contributor'}
                  </span>
                  <span className="block text-muted">
                    {[
                      printer.materials.join(', '),
                      `${printer.bed_x}×${printer.bed_y}×${printer.bed_z} mm`,
                      [printer.suburb, printer.state].filter(Boolean).join(', ') || null,
                      unavailable,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </label>
            )
          })
        )}
      </fieldset>

      <label>
        <span className="field-label">Anything they should know</span>
        <textarea
          className="field mt-1 w-full"
          rows={4}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="It is for a 100 mm switch, so the base plate has to be the large one."
        />
        {/* The privacy line the artboard makes explicit, stated once. */}
        <span className="mt-1 block text-[13px] text-muted">
          They see this and your suburb, nothing else about you.
        </span>
      </label>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary self-start" disabled={!valid || pending}>
        <PrinterIcon size={18} weight="bold" aria-hidden="true" />
        Send the request
      </button>
    </form>
  )
}
