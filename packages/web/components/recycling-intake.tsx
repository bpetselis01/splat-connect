'use client'

/**
 * The recycling intake queue.
 *
 * Credit is minted here, by weighing — never by the contributor. 059 splits
 * the insert policy from the update policy so a contributor cannot write
 * `credit_grams` at all; the API refuses a credit larger than the weight and
 * anything under two kilos.
 *
 * One weight box; the credit box is prefilled at about three quarters and is
 * the leader's to change (decided 2026-09-30). intakeCredit
 * (@splat-connect/types) is the rule, shared with the phone.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Scales } from '@phosphor-icons/react/dist/ssr'
import type { RecyclingDropoff } from '@splat-connect/types'
import { Badge } from '@/components/badge'
import { browserApiClient } from '@/lib/browser-api-client'
import { initials, intakeCredit, weighedInLine } from '@splat-connect/types'

const kg = (grams: number) => `${(grams / 1000).toFixed(1)} kg`

const TINTS = ['bg-honey-soft', 'bg-violet-soft', 'bg-mint-soft', 'bg-brand-tint']

/** The board's inline number box: mono, 46px, on the canvas. */
function NumberInput({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: 'kg' | 'g'
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="inline-flex flex-none items-center gap-2 text-sm font-extrabold text-ink max-sm:gap-1.5">
      {label}
      <input
        aria-label={`${label}, in ${unit === 'kg' ? 'kilograms' : 'grams'}`}
        className="h-[46px] w-[88px] max-sm:w-[72px] rounded-field border-(length:--border-width) border-line bg-canvas px-3 font-mono text-[15px] font-bold tabular-nums text-ink"
        inputMode={unit === 'kg' ? 'decimal' : 'numeric'}
        placeholder={unit === 'kg' ? '0.0' : '0'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit}
    </label>
  )
}

function BookedRow({
  orgId,
  dropoff,
  name,
  tint,
  onDone,
}: {
  orgId: string
  dropoff: RecyclingDropoff
  name: string
  tint: string
  onDone: (line?: string) => void
}) {
  const [weighed, setWeighed] = useState('')
  // null until the leader types in the credit box: until then it follows the weight.
  const [credit, setCredit] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const check = intakeCredit(weighed, credit)
  const shownCredit = credit ?? (check.ok ? String(check.credit_grams) : '')

  function decide(status: 'received' | 'declined') {
    setError(null)
    startTransition(async () => {
      try {
        await browserApiClient.patch(`/api/organizations/${orgId}/recycling/${dropoff.id}`, {
          status,
          ...(status === 'received' && check.ok
            ? { weighed_grams: check.weighed_grams, credit_grams: check.credit_grams }
            : {}),
        })
        onDone(status === 'received' && check.ok ? weighedInLine(check.weighed_grams, check.credit_grams, name) : undefined)
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setError(detail ?? 'That did not save. Check your connection and try again.')
      }
    })
  }

  return (
    <li className="card-flat flex flex-wrap items-center gap-4 px-5 py-4 shadow-e1">
      <span
        aria-hidden="true"
        className={`grid h-[42px] w-[42px] flex-none place-items-center rounded-full text-[13px] font-extrabold text-ink ${tint}`}
      >
        {initials(name)}
      </span>
      <span className="min-w-0 flex-[1_1_180px]">
        <span className="block font-extrabold text-ink">{name}</span>
        <span className="block text-sm font-semibold text-muted">
          {kg(dropoff.estimated_grams)} declared · {dropoff.material} · Booked{' '}
          {new Date(dropoff.created_at).toLocaleDateString('en-AU')}
        </span>
        {dropoff.note && <span className="mt-1 block text-sm text-muted">{dropoff.note}</span>}
        {dropoff.photo_signed_url && (
          // eslint-disable-next-line @next/next/no-img-element -- a signed URL from a private bucket
          <img
            src={dropoff.photo_signed_url}
            alt="Photo of the sorted plastic"
            className="mt-2 h-[120px] w-auto rounded-[14px] object-cover"
          />
        )}
      </span>
      <NumberInput label="Actual" unit="kg" value={weighed} onChange={setWeighed} />
      <NumberInput label="Credit" unit="g" value={shownCredit} onChange={setCredit} />
      <span className="flex-[1_1_150px] text-[13px] font-bold text-muted">{check.line}</span>
      <span className="flex flex-none gap-2">
        <button
          type="button"
          className="btn btn-quiet min-h-11 px-3.5 text-sm text-danger hover:bg-apricot-soft hover:text-ink"
          disabled={pending}
          onClick={() => decide('declined')}
        >
          Contaminated
        </button>
        <button
          type="button"
          className="btn btn-primary min-h-11 px-4 text-sm"
          disabled={pending || !check.ok}
          onClick={() => decide('received')}
        >
          <Scales weight="bold" aria-hidden="true" />
          Weigh and credit
        </button>
      </span>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  )
}

export function RecyclingIntake({
  orgId,
  dropoffs,
  names,
}: {
  orgId: string
  dropoffs: RecyclingDropoff[]
  /** Contributor names, resolved on the server — a leader needs to know who is
   *  at the door, and the browser has no way to read another profile. */
  names: Record<string, string>
}) {
  const router = useRouter()
  const [done, setDone] = useState<string | null>(null)

  const booked = dropoffs.filter((d) => d.status === 'booked')
  const settled = dropoffs.filter((d) => d.status !== 'booked')
  const nameOf = (d: RecyclingDropoff) => names[d.contributor_id] ?? 'A contributor'

  return (
    <>
      <section>
        <h2 className="mb-1.5 mt-8 font-display text-2xl font-extrabold text-ink">
          Booked in{' '}
          <span className="font-sans text-[15px] font-bold text-muted">({booked.length})</span>
        </h2>
        <p className="mb-4 max-w-[66ch] text-sm text-muted">
          Weigh it on your scale, enter the real number, and the credit is issued against that. If
          it turns up contaminated, refuse it.
        </p>
        {done && (
          <p role="status" className="mb-4 text-sm font-bold text-ink">
            {done}
          </p>
        )}
        {booked.length === 0 ? (
          <div className="browse-empty p-9 text-muted">Nothing booked in right now.</div>
        ) : (
          <ul className="grid list-none gap-2.5">
            {booked.map((dropoff, i) => (
              <BookedRow
                key={dropoff.id}
                orgId={orgId}
                dropoff={dropoff}
                name={nameOf(dropoff)}
                tint={TINTS[i % TINTS.length]}
                onDone={(line) => {
                  setDone(line ?? null)
                  router.refresh()
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <h2 className="mb-4 mt-8 font-display text-2xl font-extrabold text-ink">Weighed in</h2>
          <ul className="grid list-none gap-2.5">
            {settled.map((dropoff, i) => (
              <li
                key={dropoff.id}
                className="card-flat flex flex-wrap items-center gap-4 px-5 py-4 shadow-e1"
              >
                <span
                  aria-hidden="true"
                  className={`grid h-[42px] w-[42px] flex-none place-items-center rounded-full text-[13px] font-extrabold text-ink ${TINTS[i % TINTS.length]}`}
                >
                  {initials(nameOf(dropoff))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold text-ink">{nameOf(dropoff)}</span>
                  <span className="block text-sm font-semibold text-muted">
                    {kg(dropoff.estimated_grams)} declared · {dropoff.material}
                    {dropoff.status === 'received' &&
                      dropoff.weighed_grams !== null &&
                      dropoff.credit_grams !== null &&
                      ` · weighed ${kg(dropoff.weighed_grams)}, credited ${kg(dropoff.credit_grams)}`}
                  </span>
                </span>
                <Badge
                  status={dropoff.status === 'received' ? 'completed' : 'rejected'}
                  label={dropoff.status === 'received' ? 'RECEIVED' : 'TURNED AWAY'}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
