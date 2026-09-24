/**
 * A build's five steps, derived from the row rather than decorated onto it.
 *
 * Same contract as `exchange-stages.ts`, different vocabulary. A build has one
 * step an exchange does not: the maker posts a photo of it working and the
 * family approves that photo before anybody travels. 057 stores that as two
 * timestamps rather than two status members, so this file switches on
 * `status` plus `working_photo_url` and `work_approved_at` — every token it
 * reads is one the row actually holds.
 *
 * Captions are computed per record and returned with it. A shared caption map
 * would leak the open record's wording into every other row of the list, which
 * is the bug the per-step `caption` field exists to make unexpressable.
 *
 * ## The one thing the data cannot say
 *
 * The same gap `exchange-stages.ts` documents: a withdrawn build records that
 * somebody pulled out but not when, because `status` is overwritten. Reaching
 * the working shot proves it got past Claimed, and a handover confirmation
 * proves it got past Approved, which narrows it to one step in most cases.
 * Where it does not, the stop is placed at Claimed and says so.
 */
import type { Stage } from '@/components/stage-rail'
import type { ToyTransaction, ToyTransactionDetail } from '@splat-connect/types'
import { shortDate } from '@splat-connect/types'

type Row = Pick<
  ToyTransaction,
  | 'status'
  | 'owner_confirmed_at'
  | 'requester_confirmed_at'
  | 'working_photo_url'
  | 'work_approved_at'
  | 'created_at'
  | 'updated_at'
>

export function buildStages(tx: Row): Stage[] {
  const ended = shortDate(tx.updated_at)
  const asked: Stage = {
    key: 'asked',
    label: 'Asked',
    caption: `Posted ${shortDate(tx.created_at)}`,
    state: 'done',
  }
  const reachedHandover = Boolean(tx.owner_confirmed_at || tx.requester_confirmed_at)

  switch (tx.status) {
    case 'requested':
      return [
        asked,
        { key: 'claimed', label: 'Claimed', caption: 'Waiting for a maker', state: 'now' },
        { key: 'shot', label: 'Working shot', caption: 'Once someone takes it on', state: 'todo' },
        { key: 'approved', label: 'Approved', caption: 'The family checks it', state: 'todo' },
        { key: 'closed', label: 'Handed over', caption: 'Once you both confirm', state: 'todo' },
      ]

    case 'accepted': {
      const claimed: Stage = {
        key: 'claimed',
        label: 'Claimed',
        caption: `Taken on ${shortDate(tx.updated_at)}`,
        state: 'done',
      }
      if (!tx.working_photo_url) {
        return [
          asked,
          claimed,
          { key: 'shot', label: 'Working shot', caption: 'The maker posts a photo', state: 'now' },
          { key: 'approved', label: 'Approved', caption: 'The family checks it', state: 'todo' },
          { key: 'closed', label: 'Handed over', caption: 'Once you both confirm', state: 'todo' },
        ]
      }
      const shot: Stage = {
        key: 'shot',
        label: 'Working shot',
        caption: 'Photo posted',
        state: 'done',
      }
      if (!tx.work_approved_at) {
        return [
          asked,
          claimed,
          shot,
          { key: 'approved', label: 'Approved', caption: 'Waiting on the family', state: 'now' },
          { key: 'closed', label: 'Handed over', caption: 'Once you both confirm', state: 'todo' },
        ]
      }
      return [
        asked,
        claimed,
        shot,
        {
          key: 'approved',
          label: 'Approved',
          caption: `Approved ${shortDate(tx.work_approved_at)}`,
          state: 'done',
        },
        {
          key: 'closed',
          label: 'Handed over',
          caption: reachedHandover ? 'Waiting on the other confirmation' : 'Agree a time',
          state: 'now',
        },
      ]
    }

    case 'completed':
      return [
        asked,
        { key: 'claimed', label: 'Claimed', caption: 'Taken on', state: 'done' },
        { key: 'shot', label: 'Working shot', caption: 'Photo posted', state: 'done' },
        { key: 'approved', label: 'Approved', caption: 'The family said yes', state: 'done' },
        { key: 'closed', label: 'Handed over', caption: `Closed ${ended}`, state: 'done' },
      ]

    // Declining can only happen at the one step where somebody answers, so this
    // stop is exact rather than inferred.
    case 'rejected':
      return [
        asked,
        { key: 'claimed', label: 'Claimed', caption: 'Nobody took it on', state: 'stop' },
        { key: 'shot', label: 'Working shot', caption: 'Never got here', state: 'todo' },
        { key: 'approved', label: 'Approved', caption: 'Never got here', state: 'todo' },
        { key: 'closed', label: 'Handed over', caption: `Closed ${ended}`, state: 'done' },
      ]

    case 'withdrawn': {
      /*
       * How far it got before somebody pulled out, read off what survived the
       * status being overwritten. A handover confirmation proves the family had
       * approved the shot; a shot proves a maker had taken it on. Below that
       * the row genuinely cannot say, and the stop sits at Claimed.
       */
      const stoppedAt = reachedHandover ? 'closed' : tx.work_approved_at ? 'approved' : tx.working_photo_url ? 'shot' : 'claimed'
      const step = (key: string, label: string, caption: string, reached: boolean): Stage =>
        key === stoppedAt
          ? { key, label, caption: 'Withdrawn', state: 'stop' }
          : { key, label, caption: reached ? caption : 'Never got here', state: reached ? 'done' : 'todo' }

      const order = ['claimed', 'shot', 'approved', 'closed']
      const stopIndex = order.indexOf(stoppedAt)
      return [
        asked,
        step('claimed', 'Claimed', 'Taken on', stopIndex > 0),
        step('shot', 'Working shot', 'Photo posted', stopIndex > 1),
        step('approved', 'Approved', 'The family said yes', stopIndex > 2),
        // The record still closes, whatever happened on the way.
        stoppedAt === 'closed'
          ? { key: 'closed', label: 'Handed over', caption: 'Withdrawn', state: 'stop' }
          : { key: 'closed', label: 'Handed over', caption: `Closed ${ended}`, state: 'done' },
      ]
    }
  }
}

export interface StageFacts {
  title: string
  facts: Array<{ label: string; value: string }>
}

/**
 * The four facts under the rail, for the stage this build is actually at.
 *
 * Computed here, from `tx`, after the viewer's side is known — the brief's
 * warning about a panel quoting values assigned later is about exactly this.
 */
export function buildStageFacts(
  tx: ToyTransactionDetail,
  viewerIsMaker: boolean
): StageFacts {
  const address = [tx.pickup_line1, tx.pickup_suburb, tx.pickup_state, tx.pickup_postcode]
    .filter(Boolean)
    .join(', ')
  const code = viewerIsMaker ? tx.owner_code : tx.requester_code
  const confirmedByViewer = viewerIsMaker ? tx.owner_confirmed_at : tx.requester_confirmed_at
  const confirmedByOther = viewerIsMaker ? tx.requester_confirmed_at : tx.owner_confirmed_at
  const guide = tx.tutorial_title ?? 'A guide'

  if (tx.status === 'requested') {
    return {
      title: 'Waiting for a maker',
      facts: [
        { label: 'Guide', value: guide },
        { label: 'Asked', value: new Date(tx.created_at).toLocaleDateString('en-AU') },
        { label: 'Asked of', value: viewerIsMaker ? 'You' : tx.owner_name },
        { label: 'Next', value: viewerIsMaker ? 'Take it on, or decline' : 'They answer here' },
      ],
    }
  }

  if (tx.status === 'accepted' && !tx.working_photo_url) {
    return {
      title: 'The build',
      facts: [
        { label: 'Guide', value: guide },
        { label: 'Maker', value: viewerIsMaker ? 'You' : tx.owner_name },
        { label: 'Next', value: viewerIsMaker ? 'Post a photo of it working' : 'They post a photo when it works' },
        { label: 'Parts', value: 'Recorded in the cost panel above' },
      ],
    }
  }

  if (tx.status === 'accepted' && !tx.work_approved_at) {
    return {
      title: 'The working shot',
      facts: [
        { label: 'Posted by', value: viewerIsMaker ? 'You' : tx.owner_name },
        { label: 'Shows', value: 'The finished build working' },
        { label: 'Checked by', value: viewerIsMaker ? tx.requester_name : 'You' },
        {
          label: 'If it is off',
          value: viewerIsMaker ? 'They ask for a change in the thread' : 'Ask for a change in the thread',
        },
      ],
    }
  }

  if (tx.status === 'accepted') {
    return {
      title: 'The handover',
      facts: [
        { label: 'When', value: tx.pickup_instructions || 'Not agreed yet — say so in the thread' },
        { label: 'Where', value: address || 'Not shared yet' },
        { label: 'Your code', value: code ?? 'Not issued yet' },
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
  }

  if (tx.status === 'completed') {
    return {
      title: 'What was recorded',
      facts: [
        { label: 'Guide', value: guide },
        { label: 'Handed over', value: new Date(tx.updated_at).toLocaleDateString('en-AU') },
        { label: 'Where', value: address || 'Not recorded' },
        { label: 'Made by', value: viewerIsMaker ? 'You' : tx.owner_name },
      ],
    }
  }

  return {
    title: tx.status === 'rejected' ? 'Not taken on' : 'Withdrawn',
    facts: [
      { label: 'Guide', value: guide },
      { label: 'Asked', value: new Date(tx.created_at).toLocaleDateString('en-AU') },
      { label: 'Closed', value: new Date(tx.updated_at).toLocaleDateString('en-AU') },
      { label: 'What now', value: 'Ask another maker, or the same one again' },
    ],
  }
}
