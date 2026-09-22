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
 * Laid out as the board's cards. Its "Make and model" and "Colours on hand"
 * have no column on `printers` yet, so they are not drawn rather than drawn
 * and discarded. The filament-cost switch is 070's `filament_cents_per_g`: off
 * is null, which the card reads as free, parts only. SPLAT never handles the
 * money — the rates card says so in the board's words.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle, Info, MapPin, PauseCircle } from '@phosphor-icons/react/dist/ssr'
import { PRINT_MATERIALS, formatCents } from '@splat-connect/types'
import type { Organization } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { dollarsToCents } from '@/components/cost-panel'

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
  const [showCost, setShowCost] = useState(false)
  const [rate, setRate] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    if (!name || materials.length === 0) return

    // Parsed from text, never multiplied: cost-panel.tsx explains the cent
    // that `12.10 * 100` loses.
    const cents = showCost ? dollarsToCents(rate) : null
    if (showCost && cents === null) {
      setError('Filament cost is dollars per gram, like 0.12.')
      return
    }

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
          filament_cents_per_g: cents,
          rate_note: String(form.get('rate_note') ?? '').trim(),
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
        <h2 className={CARD_TITLE}>Pickup and cost</h2>
        <div className="flex items-start gap-3 rounded-[18px] bg-[var(--surface2)] px-4 py-3.5">
          <MapPin size={22} weight="fill" aria-hidden="true" className="shrink-0 text-[var(--coral)]" />
          {/* The board leads on where the suburb below came from — it is
              prefilled from the profile, and saying so is what makes the
              "Change it on your account" route obvious. */}
          <p className="text-[13px] leading-normal text-muted">
            Your pickup point comes from your profile. Requesters see the suburb until you
            accept; the street address is the pickup point, and you give it when you take a
            job on.
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

        <div className="flex flex-wrap items-center gap-4 rounded-[18px] border border-line px-4 py-3.5">
          <button
            type="button"
            role="switch"
            aria-checked={showCost}
            aria-labelledby="cost-switch-label"
            onClick={() => setShowCost((on) => !on)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
              showCost ? 'bg-brand' : 'bg-[var(--line)]'
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-surface shadow-[var(--shadow-e1)] transition-transform ${
                showCost ? 'translate-x-[23px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
          <div className="min-w-0 flex-1">
            <p id="cost-switch-label" className="text-sm font-extrabold text-ink">
              Show your filament cost
            </p>
            <p className="mt-0.5 text-[13px] leading-normal text-muted">
              You give the time and the machine; the family covers what it is printed from.
              This shows “about $3 filament” on your card so they know the figure before they
              ask, cash at pickup.
            </p>
          </div>
          {showCost && (
            <label className="flex items-center gap-2 text-sm font-extrabold text-ink">
              $
              <input
                name="rate"
                inputMode="decimal"
                aria-label="Dollars per gram"
                className="field field-sm w-[88px] font-mono tabular-nums"
                placeholder="0.12"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              / g
            </label>
          )}
        </div>
      </section>

      <section className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-[48ch]">
            <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
              Your standard rates
            </p>
            <p className="mt-1.5 text-[13px] leading-normal text-muted">
              What a family is asked to cover, shown on your card before they request. Your time
              and your machine stay free.
            </p>
          </div>
          {/* The board's shape: a label over the bare figure. Off is $0.00
              under "Asking back", which is literally what is asked. */}
          <div
            className="rounded-[14px] bg-[var(--tamber)] px-4 py-2.5 text-right text-[var(--tink)]"
            aria-live="polite"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.1em]">Asking back</p>
            <h3 className="font-display text-[22px] font-extrabold">
              {formatCents(showCost ? dollarsToCents(rate) ?? 0 : 0)}
            </h3>
            <p className="text-[11px] font-bold">
              {showCost ? 'per gram of filament' : 'free — parts only'}
            </p>
          </div>
        </div>
        <label className={LABEL}>
          Why these costs
          <textarea
            name="rate_note"
            className="field rounded-[18px] font-semibold"
            rows={2}
            maxLength={500}
            placeholder="e.g. Filament is the only thing I ask back, at what the spool cost me."
          />
          <span className="text-[13px] font-normal text-muted">
            Whoever you are asking to pay reads this word for word. Name the material and the
            rate — a number with no reason gets declined.
          </span>
        </label>
        <p className="flex items-start gap-2 rounded-[14px] bg-[var(--surface2)] px-3.5 py-2.5 text-[13px] leading-normal text-muted">
          <Info size={16} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
          SPLAT does not take payments or a cut. This is a written record both of you can see —
          you settle it between yourselves.
        </p>
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
