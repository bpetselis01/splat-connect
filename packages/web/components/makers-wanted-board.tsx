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
import {
  Baby,
  BookOpen,
  CalendarBlank,
  Car,
  Hammer,
  HandWaving,
  HourglassMedium,
  MapPin,
  Package,
} from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

const DIFF: Record<string, { label: string; tint: string }> = {
  easy: { label: 'Easy', tint: 'var(--tmint)' },
  medium: { label: 'Medium', tint: 'var(--tamber)' },
  hard: { label: 'Hard', tint: 'var(--tcoral)' },
}

export function MakersWantedBoard({ builds }: { builds: OpenBuild[] }) {
  const router = useRouter()
  const [range, setRange] = useState<number>(0)
  // The board's four tabs are Needs a maker / Live / Handed over / Your
  // requests. This feed only carries unclaimed requests, so only the two it
  // can fill are drawn.
  const [tab, setTab] = useState<'open' | 'mine'>('open')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inTab = builds.filter((b) => (tab === 'mine' ? b.mine : !b.mine))
  const shown = range === 0 ? inTab : inTab.filter((b) => (b.travel_km ?? 0) >= range)
  const count = (t: 'open' | 'mine') => builds.filter((b) => (t === 'mine' ? b.mine : !b.mine)).length

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList aria-label="Filter build requests" className="flex gap-1 rounded-full bg-[var(--surface2)] p-1">
            {(
              [
                ['open', 'Needs a maker', 'var(--tmint)'],
                ['mine', 'Your requests', 'var(--tcoral)'],
              ] as const
            ).map(([k, label, nBg]) => {
              const n = count(k)
              return (
                <TabsTrigger
                  key={k}
                  value={k}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-ink ${
                    tab === k ? 'bg-[var(--surface)] shadow-[var(--e1)]' : ''
                  }`}
                >
                  {label}
                  {n > 0 && (
                    <span className="h-5 min-w-5 rounded-full px-1.5 text-center text-xs font-extrabold leading-5 text-[var(--tink)]" style={{ background: nBg }}>
                      {n}
                    </span>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-bold text-muted">Families who can travel</span>
          {RANGES.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => setRange(km)}
              aria-pressed={range === km}
              className={`min-h-9 rounded-full border px-3 text-[13px] font-bold text-ink hover:border-brand ${
                range === km ? 'border-[var(--b600)] bg-[var(--b100)]' : 'border-line bg-[var(--surface)]'
              }`}
            >
              {km === 0 ? 'Any distance' : `${km} km or more`}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="alert alert-danger mb-4">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-line bg-[var(--surface)] p-12 text-center">
          <h3 className="mb-1 mt-3 font-display text-2xl font-extrabold text-ink">
            {tab === 'mine' ? 'You have not asked for a build yet' : 'Nothing at that stage'}
          </h3>
          <p className="max-w-[38ch] text-muted">
            {tab === 'mine'
              ? 'Pick the guide your child needs and ask for a build. It lands here and in My exchanges.'
              : builds.length === 0
                ? 'Nothing waiting on a maker right now. Requests land here the moment a family posts one.'
                : 'No family in that range at the moment. Try Any distance.'}
          </p>
        </div>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          {shown.map((b) => {
            const diff = b.tutorial?.difficulty ? DIFF[b.tutorial.difficulty] : undefined
            return (
              <li key={b.id}>
                <article className="card flex h-full flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-xs font-extrabold text-[var(--tink)]"
                      style={{ background: b.mine ? 'var(--tcoral)' : 'var(--tmint)' }}
                    >
                      {b.mine ? (
                        <HourglassMedium weight="fill" aria-hidden="true" />
                      ) : (
                        <HandWaving weight="fill" aria-hidden="true" />
                      )}
                      {b.mine ? 'Waiting for a maker' : 'Needs a maker'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-muted">
                      <MapPin aria-hidden="true" /> {b.requester_suburb} · {formatRelativeTime(b.created_at)}
                    </span>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="grid h-16 w-16 shrink-0 place-items-center rounded-[18px]"
                      style={{ background: diff?.tint ?? 'var(--b100)' }}
                    >
                      <BookOpen weight="duotone" className="text-[32px] text-[var(--tink)] opacity-75" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-extrabold leading-[1.3] text-ink">
                        {b.tutorial ? (
                          <Link href={`/tutorials/${b.tutorial.id}`} className="hover:text-[var(--b700)]">
                            {b.tutorial.title}
                          </Link>
                        ) : (
                          // A guide can be withdrawn after somebody asks for it. The
                          // request stays — the family still wants the thing — but
                          // there is nothing to link to.
                          'A guide that is no longer published'
                        )}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-extrabold">
                        {diff && (
                          <span className="rounded-full px-2.5 py-[3px] text-[var(--tink)]" style={{ background: diff.tint }}>
                            {diff.label}
                          </span>
                        )}
                        {b.family_has_toy && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--tamber)] px-2.5 py-[3px] text-[var(--tink)]">
                            <Package weight="fill" aria-hidden="true" /> Family has the toy
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {b.build_brief && (
                    <p className="rounded-[14px] bg-[var(--surface2)] px-3.5 py-3 text-sm leading-[1.5] text-muted">
                      <span className="font-extrabold text-ink">Family in {b.requester_suburb}:</span>{' '}
                      “{b.build_brief}”
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3.5 text-[13px] font-bold text-muted">
                    {b.child_label && (
                      <span className="inline-flex items-center gap-1">
                        <Baby aria-hidden="true" /> {b.child_label}
                      </span>
                    )}
                    {b.travel_km !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Car aria-hidden="true" /> Can travel {b.travel_km} km
                      </span>
                    )}
                    {b.urgency && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarBlank aria-hidden="true" /> {b.urgency}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-2.5">
                    <span className="text-[13px] font-bold text-muted">
                      {b.mine ? 'This is your request' : 'Nobody has claimed this yet'}
                    </span>
                    {!b.mine && (
                      <button
                        type="button"
                        disabled={busy === b.id}
                        onClick={() => claim(b.id)}
                        className="btn btn-primary min-h-11 px-[18px] text-sm"
                      >
                        <Hammer weight="bold" aria-hidden="true" />
                        {busy === b.id ? 'Claiming…' : "I'll build this"}
                      </button>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
