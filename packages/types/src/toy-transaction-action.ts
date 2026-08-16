// Whether a transaction is waiting on one particular person.
//
// Lives here rather than in web or api because both run it and they must agree:
// the API counts these for the sidebar badge, the exchanges list marks the same
// cards "waiting on you". A second copy would let the number disagree with the
// cards it is supposed to be counting.

import type { ToyTransaction } from './index'

/**
 * A transaction the viewer is blocking. Only two states qualify — an incoming
 * request they have not answered, and an accepted handoff still missing their
 * confirmation. Everything else is either finished or waiting on the other party.
 *
 * `blocked_by_rival_accept` requests are excluded: the owner cannot accept one
 * while another handoff on the same toy is in flight, and that handoff is itself
 * counted. Including both would show one real obligation as two.
 */
export function needsAction(
  tx: Pick<
    ToyTransaction,
    'status' | 'type' | 'owner_id' | 'owner_confirmed_at' | 'requester_confirmed_at'
  > & { blocked_by_rival_accept?: boolean },
  viewerId: string
): boolean {
  const isOwner = tx.owner_id === viewerId

  if (tx.status === 'requested') return isOwner && !tx.blocked_by_rival_accept

  if (tx.status === 'accepted') {
    // Donations are confirmed by the owner alone; exchanges need both parties.
    const confirms = tx.type === 'exchange' || isOwner
    const alreadyConfirmed = isOwner ? tx.owner_confirmed_at : tx.requester_confirmed_at
    return confirms && alreadyConfirmed === null
  }

  return false
}

/** The copy the sidebar badge is counting, shown on the card itself. */
export function actionLabel(
  tx: Pick<ToyTransaction, 'status'>,
): string {
  return tx.status === 'requested'
    ? 'Waiting on you — accept or decline'
    : 'Waiting on you — confirm the handoff'
}
