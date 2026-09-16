'use client'

/**
 * Booking a drop-off with one organisation.
 *
 * Only rendered where the organisation has said what it can take — an empty
 * materials list means no form at all, rather than a form whose first field has
 * no valid answer.
 *
 * The estimate is named as an estimate. What counts is weighed at the door, and
 * the copy says so before somebody fills a car.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Package } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

/** Kilograms as typed, in whole grams. Null for anything that is not a weight. */
export function kgToGrams(input: string): number | null {
  const match = /^\s*(\d{1,4})(?:\.(\d{1,3}))?\s*$/.exec(input)
  if (!match) return null
  const fraction = (match[2] ?? '').padEnd(3, '0')
  return Number(match[1]) * 1000 + Number(fraction)
}

export function BookDropoffForm({
  orgId,
  orgName,
  materials,
  note,
  signedIn,
}: {
  orgId: string
  orgName: string
  materials: string[]
  note: string | null
  signedIn: boolean
}) {
  const router = useRouter()
  const [material, setMaterial] = useState(materials[0] ?? '')
  const [amount, setAmount] = useState('')
  const [declared, setDeclared] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [booked, setBooked] = useState(false)

  if (materials.length === 0) return null

  const grams = kgToGrams(amount)
  // Two kilos so a machine run is worth firing up. The API says the same; this
  // says it before the request rather than after.
  const valid = material !== '' && grams !== null && grams >= 2000 && declared

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!valid || grams === null) return
    const form = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      try {
        await browserApiClient.post(`/api/organizations/${orgId}/recycling`, {
          material,
          estimated_grams: grams,
          condition_declared: true,
          note: String(form.get('note') ?? ''),
        })
        setBooked(true)
        setAmount('')
        setDeclared(false)
        router.refresh()
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setError(detail ?? 'That did not book. Check your connection and try again.')
      }
    })
  }

  if (!signedIn) {
    return (
      <div className="card flex flex-col items-start gap-3 p-5">
        <h2 className="text-base font-bold text-ink">Recycling</h2>
        <p className="text-sm leading-relaxed text-ink">
          {orgName} takes {materials.join(', ')}. You need an account to book a drop-off.
        </p>
        <a href="/signup" className="btn btn-primary no-underline">
          Create an account
        </a>
      </div>
    )
  }

  return (
    <form className="card flex flex-col gap-4 p-5" onSubmit={submit}>
      <div>
        <h2 className="text-base font-bold text-ink">Book a drop-off</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {orgName} takes {materials.join(', ')}. What you bring is weighed at the door, and the
          credit comes from that weight — about three quarters of it becomes filament.
        </p>
        {note && <p className="mt-1 text-sm leading-relaxed text-muted">{note}</p>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="w-40">
          <span className="field-label">What</span>
          <select
            className="field mt-1 w-full"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
          >
            {materials.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="w-32">
          <span className="field-label">Roughly, kg</span>
          <input
            className="field mt-1 w-full font-mono tabular-nums"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="2.0"
          />
        </label>
      </div>

      <label>
        <span className="field-label">Anything they should know</span>
        <textarea name="note" className="field mt-1 w-full" rows={3} maxLength={500} />
      </label>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
        It is clean, dry, sorted, and free of metal, labels and food waste.
      </label>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {booked && (
        <p role="status" className="alert bg-mint-soft text-ink">
          Booked. {orgName} will weigh it in when you arrive.
        </p>
      )}

      <button type="submit" className="btn btn-primary self-start" disabled={!valid || pending}>
        <Package size={18} weight="bold" aria-hidden="true" />
        Book it in
      </button>
    </form>
  )
}
