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
import type { ToyTransaction } from '@splat-connect/types'

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
