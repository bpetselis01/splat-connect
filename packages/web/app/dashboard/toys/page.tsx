import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { requireCapabilities } from '@/lib/require-capabilities'
import { Plus, Gift } from '@phosphor-icons/react/dist/ssr'
import { CardPhoto, tintFor } from '@/components/card-photo'
import { OFFER, GRADE_ICON } from '@/components/toy-library-card'
import { StageFilter, StageNone, StagePill, STAGE, type StageKey } from '@/components/stage'
import { gradeOf } from '@/lib/toy-grade'
import { Box } from '@/components/icons'
import { BoundaryLink } from '@/components/boundary-link'
import { givenAway } from '@splat-connect/types'
import type { Toy, ToyTransactionSummary, GivenAwayToy, OfferType } from '@splat-connect/types'

const BASE = '/dashboard/toys'

// The board's offer tints; the words are the library card's, bar "Swap" for
// "Swap only" — the board's shorter word on the owner's own card.
const OFFER_TINT: Record<OfferType, string> = {
  donation: 'var(--tmint)',
  exchange: 'var(--tviolet)',
  both: 'var(--tamber)',
}

/** The board's card: tinted band, title, then stage, offer and grade pills. */
function ToyCard({ toy, stage }: { toy: Toy; stage: StageKey }) {
  const grade = gradeOf(toy.condition)
  const GradeIcon = GRADE_ICON[grade.key]
  const offer = toy.offer_type ? OFFER[toy.offer_type] : null
  return (
    <Link href={`/dashboard/toys/${toy.id}`} className="card card-link flex h-full flex-col overflow-hidden">
      <CardPhoto src={toy.cover_photo_url} icon={Gift} tint={tintFor(toy.id)} iconSize={80} />
      <div className="px-[18px] pb-[18px] pt-4">
        <p className="mb-2 font-display text-[17px] font-extrabold text-ink">{toy.name}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StagePill stage={stage} />
          {offer && toy.offer_type && (
            <span className="stage-pill" style={{ background: OFFER_TINT[toy.offer_type], color: 'var(--tink)' }}>
              <offer.Icon weight="bold" aria-hidden="true" />
              {toy.offer_type === 'exchange' ? 'Swap' : offer.label}
            </span>
          )}
          <span className="stage-pill" style={{ background: grade.tint, color: 'var(--tink)' }}>
            <GradeIcon weight="bold" aria-hidden="true" />
            {grade.label}
          </span>
        </div>
      </div>
    </Link>
  )
}

/**
 * What a person gave away: the toy is not theirs any more, so it cannot come
 * from /api/toys. It is read back off the completed handoffs instead — see
 * givenAway() in packages/types for which side gave what.
 */
function GivenAwayCard({ row }: { row: GivenAwayToy }) {
  return (
    <Link
      href={`/dashboard/exchanges/${row.transaction_id}`}
      className="card card-link flex h-full flex-col overflow-hidden"
    >
      {/* The board's short 110px band: these are history, not listings. */}
      <div className="h-[110px] overflow-hidden bg-sunken [&>div]:h-full [&>div]:aspect-auto">
        <CardPhoto src={row.cover_photo_url} tint="var(--surface2)" iconSize={40} />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <p className="truncate text-[15px] font-extrabold text-ink">{row.name}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {row.received_name
            ? `Swapped with ${row.other_party_name} for ${row.received_name}`
            : `Donated to ${row.other_party_name}`}
        </p>
        <p className="mt-[3px] text-xs text-muted">{formatHandoffDate(row.at)}</p>
      </div>
    </Link>
  )
}

function formatHandoffDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function ToyListPage({
  searchParams,
}: {
  searchParams?: Promise<{ stage?: string }>
} = {}) {
  const caps = await requireCapabilities()
  const requested = (await searchParams)?.stage ?? 'all'

  // No .catch() here: an empty array is already the legitimate "no toys yet"
  // value, so swallowing a fetch failure into the same empty array would tell
  // an owner their toys are gone. Let a failed fetch throw into error.tsx.
  const toys = await apiClient.get<Toy[]>('/api/toys')

  // Given away is a nice-to-have beside the toys someone still holds, so unlike
  // the fetch above it degrades: a failed read costs the section, not the page.
  const transactions = await apiClient
    .get<ToyTransactionSummary[]>('/api/toy-transactions')
    .catch(() => [] as ToyTransactionSummary[])
  const gone = givenAway(transactions, caps.profile.id, caps.ledOrgs.map((o) => o.id))

  // The board's shared stage words. "Needs you" is a toy someone has asked
  // for and is waiting on your answer; otherwise published is Live and a
  // draft is Hidden.
  const asked = new Set(
    transactions.filter((tx) => tx.status === 'requested' && tx.toy_id).map((tx) => tx.toy_id)
  )
  const stageOf = (toy: Toy): StageKey =>
    asked.has(toy.id) ? 'needsyou' : toy.status === 'published' ? 'live' : 'hidden'
  const count = (id: StageKey) => toys.filter((t) => stageOf(t) === id).length
  const options = [
    { id: 'all', label: 'All', n: toys.length },
    { id: 'needsyou', label: STAGE.needsyou.label, n: count('needsyou') },
    { id: 'live', label: STAGE.live.label, n: count('live') },
    { id: 'hidden', label: STAGE.hidden.label, n: count('hidden') },
  ]
  const current = options.some((o) => o.id === requested) ? requested : 'all'
  const shown = current === 'all' ? toys : toys.filter((t) => stageOf(t) === current)


  return (
    <div>
      <div className="mb-[26px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="title-hub">My toys</h1>
          <p className="mt-2 max-w-[58ch] text-[15px] text-muted">
            The adapted toys you hold, ready to offer for exchange with an association.
          </p>
        </div>
        {/* The My SPLAT card promises three things here. Two of them exist;
            "Saved toys" waits on the saves subsystem, and an absent button
            beats one that leads nowhere. */}
        <div className="flex flex-wrap gap-2.5">
          <Link href="/dashboard/toys/new" className="btn btn-coral">
            <Plus size={16} weight="bold" aria-hidden="true" />
            Add a toy
          </Link>
          <BoundaryLink href="/toy-library" className="btn btn-quiet">
            Browse toy library
          </BoundaryLink>
          {/* The tag on this page's My SPLAT card names "saved toys";
              this is where that tag leads. It skips the saved hub on purpose —
              the label names a destination, so it lands on the destination. */}
          <Link href="/dashboard/saved/toys" className="btn btn-quiet">
            Saved toys
          </Link>
        </div>
      </div>

      {toys.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <Box className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">You haven&apos;t added any toys yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            A toy is one adapted item you hold — its condition, a photo, and whether it has been
            wired for a switch.
          </p>
          <Link href="/dashboard/toys/new" className="btn btn-accent mt-6">
            Add your first toy
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-[22px]">
            <StageFilter label="Filter toys by status" basePath={BASE} current={current} options={options} />
          </div>
          {shown.length === 0 ? (
            <StageNone basePath={BASE} note="None of your toys are at that status right now." />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {shown.map((toy) => (
                <li key={toy.id}>
                  <ToyCard toy={toy} stage={stageOf(toy)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {gone.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 font-display text-[22px] font-extrabold text-muted">Given away</h2>
          <ul className="grid grid-cols-1 gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
            {gone.map((row) => (
              <li key={row.transaction_id}>
                <GivenAwayCard row={row} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
