'use client'

/**
 * The recycling intake queue.
 *
 * Credit is minted here, by weighing — never by the contributor. That is the
 * artboard's rule and it is enforced in three places rather than one: 059 splits
 * the insert policy from the update policy so a contributor cannot write
 * `credit_grams` at all, the API refuses a credit larger than the weight, and
 * this form asks for both numbers rather than computing one from the other.
 *
 * The yield is the leader's to apply. About three quarters of what comes in
 * becomes filament, and "about" is not a number to put in a ledger — so where
 * the board computes the credit from the weight, this row keeps a second box
 * somebody types themselves, with the typical figure as a hint beside it.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Scales } from '@phosphor-icons/react/dist/ssr'
import type { RecyclingDropoff } from '@splat-connect/types'
import { Badge } from '@/components/badge'
import { browserApiClient } from '@/lib/browser-api-client'

const kg = (grams: number) => `${(grams / 1000).toFixed(1)} kg`

const TINTS = ['bg-honey-soft', 'bg-violet-soft', 'bg-mint-soft', 'bg-brand-tint']

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

/** The board's inline kg box: mono, 46px, on the canvas. */
function KgInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="inline-flex flex-none items-center gap-2 text-sm font-extrabold text-ink">
      {label}
      <input
        className="h-[46px] w-[88px] rounded-field border-(length:--border-width) border-line bg-canvas px-3 font-mono text-[15px] font-bold tabular-nums text-ink"
        inputMode="decimal"
        placeholder="0.0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      kg
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
  onDone: () => void
}) {
  const [weighed, setWeighed] = useState('')
  const [credit, setCredit] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const weighedGrams = Math.round(Number(weighed) * 1000)
  const creditGrams = Math.round(Number(credit) * 1000)
  const valid =
    Number.isFinite(weighedGrams) &&
    Number.isFinite(creditGrams) &&
    weighedGrams >= 0 &&
    creditGrams >= 0 &&
    creditGrams <= weighedGrams

  function decide(status: 'received' | 'declined') {
    setError(null)
    startTransition(async () => {
      try {
        await browserApiClient.patch(`/api/organizations/${orgId}/recycling/${dropoff.id}`, {
          status,
          ...(status === 'received'
            ? { weighed_grams: weighedGrams, credit_grams: creditGrams }
            : {}),
        })
        onDone()
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
      </span>
      <KgInput label="Actual" value={weighed} onChange={setWeighed} />
      <KgInput label="Credit" value={credit} onChange={setCredit} />
      <span className="flex-[1_1_150px] text-[13px] font-bold text-muted">
        About three quarters becomes filament — the credit is the number you decide.
      </span>
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
          disabled={pending || !valid || weighed === '' || credit === ''}
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
                onDone={() => router.refresh()}
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
