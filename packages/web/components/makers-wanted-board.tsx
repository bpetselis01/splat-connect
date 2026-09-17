'use client'
/**
 * The Makers wanted board: build requests nobody has claimed.
 *
 * "I'll build this" is a claim, not a message — one tap and the request becomes
 * an ordinary build thread with the maker on the other end of it. That is the
 * whole shape of this feature and the reason 064 exists: the board is a
 * different way IN to the same record, not a second kind of record.
 *
 * ponytail: the artboard draws a second button, "Ask first", for the maker who
 * wants to check something before committing. It is NOT here, because it needs
 * a thread on a request that has no second party — toy_transaction_messages is
 * keyed to a transaction whose two sides are the whole basis of who may read
 * it, and an unclaimed request has one. Two buttons that both claim would be
 * worse than one honest one: a maker who pressed "Ask first" would find they
 * had committed. Add it when messages can belong to an unowned transaction.
 *
 * Distance is a filter over the FAMILY's stated range, not over any distance
 * between two points — SPLAT stores neither party's location, only a suburb and
 * how far the family said they can travel. A filter that implied otherwise
 * would be inventing precision it does not have, which is why the control reads
 * "families who can travel" rather than "within".
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Hammer, MapPin, Clock, Package, User } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { formatRelativeTime } from '@/lib/relative-time'

export type OpenBuild = {
  id: string
  tutorial_id: string
  build_brief: string | null
  travel_km: number | null
  urgency: string | null
  child_label: string | null
  requester_suburb: string | null
  family_has_toy: boolean
  created_at: string
  mine: boolean
  tutorial: { id: string; title: string; difficulty: string | null; status: string } | null
}

const RANGES = [5, 10, 25, 0] as const

export function MakersWantedBoard({ builds }: { builds: OpenBuild[] }) {
  const router = useRouter()
  const [range, setRange] = useState<number>(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const shown = range === 0 ? builds : builds.filter((b) => (b.travel_km ?? 0) >= range)

  async function claim(id: string) {
    setError(null)
    setBusy(id)
    try {
      await browserApiClient.post(`/api/toy-transactions/${id}/claim`, {})
      // Straight to the thread. There is nothing left on the board for this
      // row, and a refresh here would leave the maker looking at a list their
      // own claim just shortened.
      router.push(`/dashboard/exchanges/build/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go through. Try once more.')
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-muted">Families who can travel</span>
        {RANGES.map((km) => (
          <button
            key={km}
            type="button"
            onClick={() => setRange(km)}
            aria-pressed={range === km}
            className="chip"
          >
            {km === 0 ? 'Any distance' : `${km} km or more`}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="alert alert-danger mt-4">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="card mt-6 p-6 text-sm leading-relaxed text-muted">
          {builds.length === 0
            ? 'Nothing waiting on a maker right now. Requests land here the moment a family posts one.'
            : 'No family in that range at the moment. Try Any distance.'}
        </p>
      ) : (
        <ul className="mt-6 flex list-none flex-col gap-3">
          {shown.map((b) => (
            <li key={b.id}>
              <article className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="badge bg-honey-soft text-ink">
                    <Hammer className="h-3.5 w-3.5" aria-hidden="true" />
                    Needs a maker
                  </span>
                  <span className="text-xs text-muted">
                    {b.requester_suburb} · {formatRelativeTime(b.created_at)}
                  </span>
                </div>

                <h3 className="mt-2 font-display text-lg font-extrabold text-ink">
                  {b.tutorial ? (
                    <Link href={`/tutorials/${b.tutorial.id}`} className="hover:underline">
                      {b.tutorial.title}
                    </Link>
                  ) : (
                    // A guide can be withdrawn after somebody asks for it. The
                    // request stays — the family still wants the thing — but
                    // there is nothing to link to.
                    'A guide that is no longer published'
                  )}
                </h3>

                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {b.tutorial?.difficulty && (
                    <span className="badge bg-sunken text-muted">{b.tutorial.difficulty}</span>
                  )}
                  {b.family_has_toy && (
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" aria-hidden="true" />
                      Family has the toy
                    </span>
                  )}
                </p>

                {b.build_brief && (
                  <p className="mt-3 text-sm leading-relaxed text-ink">
                    <strong className="font-bold">Family in {b.requester_suburb}:</strong>{' '}
                    “{b.build_brief}”
                  </p>
                )}

                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  {b.child_label && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5" aria-hidden="true" />
                      {b.child_label}
                    </span>
                  )}
                  {b.travel_km !== null && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      Can travel {b.travel_km} km
                    </span>
                  )}
                  {b.urgency && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {b.urgency}
                    </span>
                  )}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-muted">
                    {b.mine ? 'This is your request' : 'Nobody has claimed this yet'}
                  </span>
                  {!b.mine && (
                    <button
                      type="button"
                      disabled={busy === b.id}
                      onClick={() => claim(b.id)}
                      className="btn btn-primary btn-sm"
                    >
                      <Hammer className="h-4 w-4" aria-hidden="true" />
                      {busy === b.id ? 'Claiming…' : "I'll build this"}
                    </button>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
