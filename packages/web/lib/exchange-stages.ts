/**
 * An exchange's four steps, derived from the row rather than decorated onto it.
 *
 * The brief is explicit that a rail is a data contract: states and captions
 * come from the record's real status vocabulary, and never from tokens the data
 * does not use. Here that vocabulary is
 * `requested | accepted | rejected | withdrawn | completed` plus the two
 * handover confirmations — nothing else exists, so nothing else is switched on.
 *
 * Captions are computed per record and returned with it, which is what stops a
 * shared caption map leaking one row's wording into the rest of the list.
 *
 * ## The one thing the data cannot say
 *
 * A withdrawn exchange records that the requester pulled out, but not *when*.
 * `status` is overwritten, so "requested then withdrawn" and "accepted then
 * withdrawn" are the same row. The handover confirmations narrow it — either one
 * being set proves it got that far — but between Requested and Accepted the row
 * genuinely cannot tell you, and this file places the stop at Accepted.
 *
 * That is the honest reading of what is stored, not a guess dressed up. Fixing
 * it properly means recording where a record stopped, which is a schema change;
 * it is filed in SUPABASE.md rather than papered over here.
 */
import type { Stage } from '@/components/stage-rail'
import type { ToyTransaction, ToyTransactionDetail } from '@splat-connect/types'

type Row = Pick<
  ToyTransaction,
  'status' | 'owner_confirmed_at' | 'requester_confirmed_at' | 'created_at' | 'updated_at'
>

/** "2 Sep" — the form the artboard's captions use. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function exchangeStages(tx: Row): Stage[] {
  const asked = `Asked ${shortDate(tx.created_at)}`
  const ended = shortDate(tx.updated_at)
  const reachedHandover = Boolean(tx.owner_confirmed_at || tx.requester_confirmed_at)

  // Requested always happened — the row exists because somebody asked.
  const requested: Stage = { key: 'requested', label: 'Requested', caption: asked, state: 'done' }

  switch (tx.status) {
    case 'requested':
      return [
        requested,
        { key: 'accepted', label: 'Accepted', caption: 'Not yet answered', state: 'now' },
        { key: 'handover', label: 'Handover', caption: 'After they say yes', state: 'todo' },
        { key: 'closed', label: 'Closed', caption: 'Once you both confirm', state: 'todo' },
      ]

    case 'accepted': {
      // Both sides confirm a handover. One confirmation is still "handover".
      const waitingOn = reachedHandover ? 'Waiting on the other confirmation' : 'Agree a time'
      return [
        requested,
        { key: 'accepted', label: 'Accepted', caption: 'They said yes', state: 'done' },
        { key: 'handover', label: 'Handover', caption: waitingOn, state: 'now' },
        { key: 'closed', label: 'Closed', caption: 'Both confirm to close', state: 'todo' },
      ]
    }

    case 'completed':
      return [
        requested,
        { key: 'accepted', label: 'Accepted', caption: 'They said yes', state: 'done' },
        { key: 'handover', label: 'Handover', caption: 'Handed over', state: 'done' },
        { key: 'closed', label: 'Closed', caption: `Closed ${ended}`, state: 'done' },
      ]

    // Rejected can only happen at the one step where somebody answers, so this
    // stop is exact rather than inferred.
    case 'rejected':
      return [
        requested,
        { key: 'accepted', label: 'Accepted', caption: 'They said no', state: 'stop' },
        { key: 'handover', label: 'Handover', caption: 'Never got here', state: 'todo' },
        { key: 'closed', label: 'Closed', caption: `Closed ${ended}`, state: 'done' },
      ]

    case 'withdrawn':
      return reachedHandover
        ? [
            requested,
            { key: 'accepted', label: 'Accepted', caption: 'They said yes', state: 'done' },
            { key: 'handover', label: 'Handover', caption: 'Withdrawn', state: 'stop' },
            { key: 'closed', label: 'Closed', caption: `Closed ${ended}`, state: 'done' },
          ]
        : [
            requested,
            { key: 'accepted', label: 'Accepted', caption: 'Withdrawn', state: 'stop' },
            { key: 'handover', label: 'Handover', caption: 'Never got here', state: 'todo' },
            { key: 'closed', label: 'Closed', caption: `Closed ${ended}`, state: 'done' },
          ]
  }
}

/**
 * The four facts that sit under the rail on a detail page, for the stage the
 * record is actually at.
 *
 * Every value is read off the record. The brief warns that facts must be
 * computed AFTER the values they quote are assigned — the failure it describes
 * is a panel quoting a stale address or somebody else's code because it was
 * built from variables assigned later, and deriving the whole block from `tx`
 * in one place is what makes that impossible here.
 *
 * "Not agreed yet" and "Not shared yet" are deliberate. A fact panel with a
 * blank in it reads as broken; one that says nothing has been agreed is telling
 * you what to do next.
 */
export interface StageFacts {
  title: string
  facts: Array<{ label: string; value: string }>
}

export function stageFacts(tx: ToyTransactionDetail, viewerIsOwnerSide: boolean): StageFacts {
  const address = [tx.pickup_line1, tx.pickup_suburb, tx.pickup_state, tx.pickup_postcode]
    .filter(Boolean)
    .join(', ')
  // The viewer's own code, never the other party's. Each side reads theirs out
  // and the other types it in; showing both would defeat the point of two.
  const code = viewerIsOwnerSide ? tx.owner_code : tx.requester_code
  const confirmedByViewer = viewerIsOwnerSide ? tx.owner_confirmed_at : tx.requester_confirmed_at
  const confirmedByOther = viewerIsOwnerSide ? tx.requester_confirmed_at : tx.owner_confirmed_at

  switch (tx.status) {
    case 'requested':
      return {
        title: 'Waiting to hear back',
        facts: [
          { label: 'Asked', value: new Date(tx.created_at).toLocaleDateString('en-AU') },
          { label: 'Toy', value: tx.toy_name },
          { label: 'Kind', value: tx.type === 'donation' ? 'Donation' : 'Exchange' },
          {
            label: 'Offered back',
            value: tx.offered_toy_name ?? (tx.type === 'donation' ? 'Nothing — it is a donation' : 'Nothing yet'),
          },
        ],
      }

    case 'accepted':
      return {
        title: 'Meeting them',
        facts: [
          { label: 'When', value: tx.pickup_instructions || 'Not agreed yet — say so in the thread' },
          { label: 'Where', value: address || 'Not shared yet' },
          {
            label: 'Your code',
            value: code ?? 'Not issued yet',
          },
          {
            label: 'Confirmed',
            value: confirmedByViewer
              ? confirmedByOther
                ? 'Both of you'
                : 'You — waiting on them'
              : confirmedByOther
                ? 'Them — waiting on you'
                : 'Neither of you yet',
          },
        ],
      }

    case 'completed':
      return {
        title: 'Handed over',
        facts: [
          { label: 'Closed', value: new Date(tx.updated_at).toLocaleDateString('en-AU') },
          { label: 'Toy', value: tx.toy_name },
          { label: 'Where', value: address || 'Not recorded' },
          { label: 'Kind', value: tx.type === 'donation' ? 'Donation' : 'Exchange' },
        ],
      }

    default:
      return {
        title: tx.status === 'rejected' ? 'Not taken forward' : 'Withdrawn',
        facts: [
          { label: 'Asked', value: new Date(tx.created_at).toLocaleDateString('en-AU') },
          { label: 'Closed', value: new Date(tx.updated_at).toLocaleDateString('en-AU') },
          { label: 'Toy', value: tx.toy_name },
          {
            label: 'What now',
            value: tx.type === 'donation' ? 'The toy stays with its owner' : 'Nothing was exchanged',
          },
        ],
      }
  }
}
