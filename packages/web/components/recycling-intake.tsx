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
 * becomes filament, and "about" is not a number to put in a ledger — so the
 * form shows the typical figure as a hint beside a field somebody types
 * themselves.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Scales } from '@phosphor-icons/react/dist/ssr'
import type { RecyclingDropoff } from '@splat-connect/types'
import { Badge } from '@/components/badge'
import { browserApiClient } from '@/lib/browser-api-client'

const kg = (grams: number) => `${(grams / 1000).toFixed(1)} kg`

function WeighIn({
  orgId,
  dropoff,
  onDone,
}: {
  orgId: string
  dropoff: RecyclingDropoff
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
    <div className="mt-3 flex flex-col gap-3 rounded-[var(--radius-inset)] bg-canvas p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-32">
          <span className="block text-[13px] font-bold text-muted">Weighed, kg</span>
          <input
            className="field mt-1 w-full font-mono tabular-nums"
            inputMode="decimal"
            value={weighed}
            onChange={(e) => setWeighed(e.target.value)}
          />
        </label>
        <label className="w-32">
          <span className="block text-[13px] font-bold text-muted">Credit, kg</span>
          <input
            className="field mt-1 w-full font-mono tabular-nums"
            inputMode="decimal"
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
          />
        </label>
        <p className="text-[13px] leading-relaxed text-muted">
          About three quarters of what comes in becomes filament — but the number on the record is
          the one you decide.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || !valid || weighed === '' || credit === ''}
          onClick={() => decide('received')}
        >
          <Scales size={18} weight="bold" aria-hidden="true" />
          Record it
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          disabled={pending}
          onClick={() => decide('declined')}
        >
          Turn it away
        </button>
      </div>
    </div>
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
  const [open, setOpen] = useState<string | null>(null)

  const booked = dropoffs.filter((d) => d.status === 'booked')
  const settled = dropoffs.filter((d) => d.status !== 'booked')

  function Row({ dropoff }: { dropoff: RecyclingDropoff }) {
    return (
      <li className="card flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-ink">
              {dropoff.material} · about {kg(dropoff.estimated_grams)}
            </span>
            <span className="block text-sm text-muted">
              {names[dropoff.contributor_id] ?? 'A contributor'} ·{' '}
              {new Date(dropoff.created_at).toLocaleDateString('en-AU')}
              {dropoff.status === 'received' &&
                dropoff.weighed_grams !== null &&
                dropoff.credit_grams !== null &&
                ` · weighed ${kg(dropoff.weighed_grams)}, credited ${kg(dropoff.credit_grams)}`}
            </span>
          </span>
          <Badge
            status={
              dropoff.status === 'received'
                ? 'completed'
                : dropoff.status === 'declined'
                  ? 'rejected'
                  : 'requested'
            }
            label={
              dropoff.status === 'received'
                ? 'RECEIVED'
                : dropoff.status === 'declined'
                  ? 'TURNED AWAY'
                  : 'BOOKED'
            }
          />
          {dropoff.status === 'booked' && (
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              onClick={() => setOpen(open === dropoff.id ? null : dropoff.id)}
            >
              {open === dropoff.id ? 'Close' : 'Weigh it in'}
            </button>
          )}
        </div>

        {dropoff.note && <p className="text-sm leading-relaxed text-muted">{dropoff.note}</p>}

        {open === dropoff.id && (
          <WeighIn
            orgId={orgId}
            dropoff={dropoff}
            onDone={() => {
              setOpen(null)
              router.refresh()
            }}
          />
        )}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="title-section mb-3">Booked in ({booked.length})</h2>
        {booked.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">Nothing booked in right now.</p>
        ) : (
          <ul className="flex list-none flex-col gap-3">
            {booked.map((dropoff) => (
              <Row key={dropoff.id} dropoff={dropoff} />
            ))}
          </ul>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <h2 className="title-section mb-3">Weighed in</h2>
          <ul className="flex list-none flex-col gap-3">
            {settled.map((dropoff) => (
              <Row key={dropoff.id} dropoff={dropoff} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
