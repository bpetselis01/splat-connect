/**
 * Request a toy.
 *
 * Its own screen rather than a control on the detail page, because it is a
 * decision with three parts — how you are asking, what you are offering, and a
 * paragraph about a child — and the artboard draws it that way. The detail
 * page's inline control is the entry to it now.
 *
 * Signed out lands on /login and comes back here: there is no anonymous ask,
 * because the other family needs somebody to reply to.
 *
 * Related files:
 * - components/request-toy-form.tsx: the form
 * - packages/api/src/routes/toy-transactions.ts: POST /, which takes the note
 */
import { notFound, redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { RequestToyForm } from '@/components/request-toy-form'
import { toyHolderName } from '@splat-connect/types'
import type { Toy, ToyWithOwner, ToyTransactionSummary } from '@splat-connect/types'

export const metadata = { title: 'Request a toy — SPLAT Connect' }

export default async function RequestToyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  const { id } = await params
  const { mode } = await searchParams
  const caps = await getCapabilities()
  if (!caps) {
    redirect(`/login?next=${encodeURIComponent(`/toy-library/${id}/request`)}`)
  }

  const res = await fetch(`${process.env.API_URL}/api/public/toys/${id}`, { cache: 'no-store' })
  if (!res.ok) notFound()
  const toy = (await res.json()) as ToyWithOwner

  const [myToys, myExchanges] = await Promise.all([
    apiClient.get<Toy[]>('/api/toys').catch(() => [] as Toy[]),
    apiClient
      .get<ToyTransactionSummary[]>('/api/toy-transactions')
      .catch(() => [] as ToyTransactionSummary[]),
  ])

  // Which of my toys are already promised elsewhere. Computed here so the
  // picker can say WHY one cannot be offered rather than hiding it — somebody
  // hunting for a toy they can see on their own shelf is the worse outcome.
  const offeredElsewhere = myExchanges
    .filter((t) => t.offered_toy_id && (t.status === 'requested' || t.status === 'accepted'))
    .map((t) => t.offered_toy_id as string)

  const holder = toyHolderName(toy) ?? 'the holder'

  return (
    // The board's 900px column less its 32px gutters.
    <div className="mx-auto max-w-[836px]">
      <h1 className="m-0 font-display text-[clamp(30px,3.4vw,42px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        Ask {holder} for {toy.name}
      </h1>
      <p className="m-0 mt-2.5 max-w-[62ch] text-[17px] text-muted">
        {toy.offer_type === 'both'
          ? `${holder} is open to either. Offer one of your own toys, or just ask and let them decide.`
          : toy.offer_type === 'exchange'
            ? `${holder} is only after a swap, so pick one of your own toys to offer.`
            : `${holder} is giving this one away. Just ask — nothing is expected back.`}
      </p>

      <RequestToyForm
        toyId={toy.id}
        holderName={holder}
        offerType={toy.offer_type}
        myToys={myToys}
        offeredElsewhere={offeredElsewhere}
        // The saved pickup suburb, which is what "I can collect from Ashfield"
        // reads off. Null for an account that has never set one, and the
        // sentence loses the place rather than the offer.
        suburb={caps.profile.pickup_suburb ?? null}
        initialMode={mode === 'donation' || mode === 'exchange' ? mode : undefined}
      />
    </div>
  )
}
