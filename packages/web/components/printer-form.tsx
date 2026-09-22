'use client'

/**
 * Adding a printer.
 *
 * Bed size and materials are not decoration: they are the fit check a request
 * runs before it is offered to the machine, which is why they are required and
 * why the copy says what they are for.
 *
 * Availability is two fields on purpose — the toggle is the deliberate act and
 * the capacity is the honest one. Either closes you, and the form says so
 * rather than leaving somebody to discover it.
 *
 * Laid out as the board's three cards. Its "Make and model", "Colours on hand"
 * and filament-cost switch have no column on `printers` yet, so they are not
 * drawn rather than drawn and discarded.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle, MapPin, PauseCircle } from '@phosphor-icons/react/dist/ssr'
import { PRINT_MATERIALS } from '@splat-connect/types'
import type { Organization } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

const CARD =
  'flex flex-col gap-4 rounded-[24px] border border-line bg-surface p-[22px] shadow-[var(--shadow-e2),var(--shadow-hi)]'
const CARD_TITLE = 'font-display text-[22px] font-extrabold text-ink'
const LABEL = 'flex flex-col gap-1.5 text-sm font-extrabold text-ink'
const INPUT = 'field min-h-12 font-semibold'
const LEGEND = 'mb-2 text-sm font-extrabold text-ink'
/** The board's toggle pill: hairline off, brand tint and border on. */
const pill = (on: boolean) =>
  `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold text-ink transition-colors hover:border-brand ${
    on ? 'border-brand bg-[var(--b100)]' : 'border-line bg-surface'
  }`

export function PrinterForm({
  ledOrgs,
  defaultSuburb = '',
  defaultState = '',
}: {
  ledOrgs: Pick<Organization, 'id' | 'name'>[]
  /** The viewer's profile pickup suburb and state, as a starting point. */
  defaultSuburb?: string
  defaultState?: string
}) {
  const router = useRouter()
  const [materials, setMaterials] = useState<string[]>(['PLA'])
  const [ownerOrgId, setOwnerOrgId] = useState('')
  const [accepting, setAccepting] = useState(true)
  const [capacity, setCapacity] = useState(1)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    if (!name || materials.length === 0) return

    setError(null)
    startTransition(async () => {
      try {
        await browserApiClient.post('/api/printers', {
          name,
          materials,
          bed_x: Number(form.get('bed_x')),
          bed_y: Number(form.get('bed_y')),
          bed_z: Number(form.get('bed_z')),
          suburb: String(form.get('suburb') ?? '').trim(),
          state: String(form.get('state') ?? '').trim(),
          capacity,
          accepting,
          notes: String(form.get('notes') ?? '').trim(),
          ...(ownerOrgId ? { owner_org_id: ownerOrgId } : {}),
        })
        router.push('/dashboard/printers')
        router.refresh()
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setError(detail ?? 'That did not save. Check your connection and try again.')
      }
    })
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <section className={CARD}>
        <h2 className={CARD_TITLE}>The machine</h2>
        <div className={`grid gap-3.5 ${ledOrgs.length > 0 ? 'sm:grid-cols-2' : ''}`}>
          <label className={LABEL}>
            Name it
            <input
              name="name"
              className={INPUT}
              maxLength={80}
              required
              placeholder="e.g. Garage Bambu"
            />
          </label>
          {ledOrgs.length > 0 && (
            <label className={LABEL}>
              Whose machine
              <select
                className={INPUT}
                value={ownerOrgId}
                onChange={(e) => setOwnerOrgId(e.target.value)}
              >
                <option value="">Mine</option>
                {ledOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <fieldset>
          <legend className={LEGEND}>Bed size (mm)</legend>
          <div className="grid max-w-[420px] grid-cols-3 gap-2.5">
            {(['bed_x', 'bed_y', 'bed_z'] as const).map((axis, i) => (
              <input
                key={axis}
                name={axis}
                type="number"
                min={1}
                max={2000}
                required
                aria-label={['Bed width', 'Bed depth', 'Bed height'][i]}
                placeholder={`${'XYZ'[i]} · 256`}
                className={INPUT}
              />
            ))}
          </div>
          {/* The fit check a request runs before it is offered to the machine,
              which is why the bed is required. */}
          <p className="mt-2 text-[13px] text-muted">
            Parts bigger than your bed are never offered to you.
          </p>
        </fieldset>

        <fieldset>
          <legend className={LEGEND}>Materials you keep on hand</legend>
          <div className="flex flex-wrap gap-2">
            {PRINT_MATERIALS.map((material) => {
              const on = materials.includes(material)
              return (
                <button
                  key={material}
                  type="button"
                  aria-pressed={on}
                  className={pill(on)}
                  onClick={() =>
                    setMaterials((prev) =>
                      on ? prev.filter((m) => m !== material) : [...prev, material]
                    )
                  }
                >
                  {material}
                </button>
              )
            })}
          </div>
        </fieldset>
      </section>

      <section className={CARD}>
        <h2 className={CARD_TITLE}>Availability</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className={LEGEND}>Start as</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { on: true, label: 'Open now', Icon: CheckCircle },
                { on: false, label: 'Start paused', Icon: PauseCircle },
              ].map(({ on, label, Icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={accepting === on}
                  className={pill(accepting === on)}
                  onClick={() => setAccepting(on)}
                >
                  <Icon size={16} weight="bold" aria-hidden="true" className="text-brand-dark" />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <p className={LEGEND} id="capacity-label">
              Jobs at once
            </p>
            <div
              role="group"
              aria-labelledby="capacity-label"
              className="inline-flex items-center gap-0.5 rounded-full bg-[var(--surface2)] p-[3px]"
            >
              <button
                type="button"
                aria-label="Fewer"
                disabled={capacity <= 0}
                onClick={() => setCapacity((n) => Math.max(0, n - 1))}
                className="h-[42px] w-[42px] rounded-full bg-surface text-xl text-ink shadow-[var(--shadow-e1)]"
              >
                −
              </button>
              <output aria-live="polite" className="min-w-11 text-center font-display text-lg font-extrabold">
                {capacity}
              </output>
              <button
                type="button"
                aria-label="More"
                disabled={capacity >= 20}
                onClick={() => setCapacity((n) => Math.min(20, n + 1))}
                className="h-[42px] w-[42px] rounded-full bg-surface text-xl text-ink shadow-[var(--shadow-e1)]"
              >
                +
              </button>
            </div>
            <p className="mt-2 text-[13px] text-muted">
              When you hit this number you are hidden until one finishes.
            </p>
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={CARD_TITLE}>Pickup</h2>
        <div className="flex items-start gap-3 rounded-[18px] bg-[var(--surface2)] px-4 py-3.5">
          <MapPin size={22} weight="fill" aria-hidden="true" className="shrink-0 text-[var(--coral)]" />
          <p className="text-[13px] leading-normal text-muted">
            Requesters see the suburb until you accept. The street address is the pickup point,
            and you give it when you take a job on.
          </p>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-[2fr_1fr]">
          <label className={LABEL}>
            Suburb
            <input name="suburb" className={INPUT} maxLength={60} defaultValue={defaultSuburb} />
          </label>
          <label className={LABEL}>
            State
            <input name="state" className={INPUT} maxLength={10} defaultValue={defaultState} />
          </label>
        </div>
        <label className={LABEL}>
          Anything else
          <textarea
            name="notes"
            className="field rounded-[18px] font-semibold"
            rows={2}
            maxLength={500}
          />
        </label>
      </section>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Link href="/dashboard/printers" className="btn btn-quiet min-h-12 shadow-none no-underline">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary px-6" disabled={pending}>
          <Check size={18} weight="bold" aria-hidden="true" />
          List this printer
        </button>
      </div>
    </form>
  )
}
