/**
 * The way in to asking for a toy.
 *
 * It used to BE the ask: two buttons and a bare select, which posted a
 * transaction with no note at all. The artboard gives asking its own screen —
 * how you are asking, what you are offering, and a paragraph about a child —
 * and that last part is the one the whole exchange turns on: "a line or two
 * about the child is what gets a yes."
 *
 * So this states the offer and hands over. It stays a component rather than
 * being inlined into the detail page because the "what does pressing this do"
 * sentence differs by offer_type, and that reasoning belongs next to the
 * control rather than in a page's JSX.
 *
 * No longer a client component: there is nothing to hold. The one piece of
 * state it had — which toy you were offering — moved to the screen that needs
 * it.
 *
 * Related files:
 * - app/toy-library/[id]/request/page.tsx: where this goes
 */
import Link from 'next/link'
import { Gift, ArrowsLeftRight } from '@phosphor-icons/react/dist/ssr'
import type { Toy, ToyWithOwner } from '@splat-connect/types'

export function ToyTransactionRequest({
  toy,
  viewerId,
  myToys,
}: {
  toy: ToyWithOwner
  viewerId: string | null
  /** Kept in the signature: the copy below says whether a swap is possible. */
  myToys: Toy[]
}) {
  if (!viewerId) {
    return (
      <p className="text-sm text-muted">
        <Link href="/login" className="font-semibold text-brand-dark underline">
          Sign in
        </Link>{' '}
        to request this toy.
      </p>
    )
  }
  // Your own toy, or your organisation's. The API refuses either; saying so
  // here is what stops somebody pressing a button that will refuse itself.
  if (viewerId === toy.owner_id) return null
  if (!toy.offer_type) {
    return <p className="text-sm text-muted">Not currently offered for donation or exchange.</p>
  }

  const canDonate = toy.offer_type === 'donation' || toy.offer_type === 'both'
  const canExchange = toy.offer_type === 'exchange' || toy.offer_type === 'both'

  return (
    <div className="card-flat flex flex-col gap-3 p-4">
      {/* Says what pressing this actually does. It opens a conversation with
          the holder rather than completing anything, which the label alone
          does not make obvious. */}
      <p className="text-sm leading-relaxed text-muted">
        {canDonate && canExchange
          ? 'Ask to collect this toy, or offer one of yours in exchange. Either way it starts a conversation with the holder.'
          : canDonate
            ? 'Ask to collect this toy. This starts a conversation with the holder.'
            : 'Offer one of your toys in exchange. This starts a conversation with the holder.'}
        {canExchange && myToys.length === 0 && ' You have no listed toys to offer yet.'}
      </p>

      <Link href={`/toy-library/${toy.id}/request`} className="btn btn-primary self-start">
        {canExchange && !canDonate ? (
          <ArrowsLeftRight className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Gift className="h-4 w-4" aria-hidden="true" />
        )}
        Ask for this toy
      </Link>
    </div>
  )
}
