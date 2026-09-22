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
import type { Route } from 'next'
import { ArrowsLeftRight, HandHeart, LockSimple } from '@phosphor-icons/react/dist/ssr'
import { toyHolderName, type Toy, type ToyWithOwner } from '@splat-connect/types'

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
  // Your own toy, or your organisation's. The API refuses either; saying so
  // here is what stops somebody pressing a button that will refuse itself.
  if (viewerId && viewerId === toy.owner_id) return null
  if (!toy.offer_type) {
    return <p className="m-0 text-sm text-muted">Not currently offered for donation or exchange.</p>
  }

  const holder = toyHolderName(toy) ?? 'the holder'
  const canDonate = toy.offer_type === 'donation' || toy.offer_type === 'both'
  const canExchange = toy.offer_type === 'exchange' || toy.offer_type === 'both'

  // The board's rail: one button per way this toy can be asked for, the
  // first filled. Each lands on the request screen with its mode picked; a
  // signed-out visitor is sent through sign-in to the same place.
  const actions = [
    canDonate && { mode: 'donation', label: 'Ask to collect it', guest: 'Sign in to ask for it', Icon: HandHeart },
    canExchange && { mode: 'exchange', label: 'Offer a swap', guest: 'Sign in to offer a swap', Icon: ArrowsLeftRight },
  ].filter((a) => a !== false)

  return (
    <>
      {actions.map(({ mode, label, guest, Icon }, i) => {
        const request = `/toy-library/${toy.id}/request?mode=${mode}`
        return (
          <Link
            key={mode}
            href={(viewerId ? request : `/login?next=${encodeURIComponent(request)}`) as Route}
            className={`btn ${i === 0 ? 'btn-primary' : 'btn-quiet'} btn-lg btn-block no-underline`}
          >
            {viewerId ? (
              <Icon size={20} weight="bold" aria-hidden="true" />
            ) : (
              <LockSimple size={20} weight="bold" aria-hidden="true" />
            )}
            {viewerId ? label : guest}
          </Link>
        )
      })}
      {/* Says what pressing this actually does. It opens a conversation with
          the holder rather than completing anything, which the label alone
          does not make obvious. */}
      <p className="m-0 text-[13px] leading-[1.5] text-muted">
        {viewerId
          ? `Given, not sold. This opens a chat with ${holder} in My exchanges — nothing is agreed until you both confirm. They never see your address.`
          : `Given, not sold. Sign in first so ${holder} knows who is asking — they see your name and your note, never your address.`}
        {viewerId && canExchange && myToys.length === 0 && ' You have no listed toys to offer yet.'}
      </p>
    </>
  )
}
