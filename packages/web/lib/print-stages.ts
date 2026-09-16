/**
 * A print job's five steps, derived from the row rather than decorated onto it.
 *
 * Third vocabulary on the same contract as `exchange-stages.ts` and
 * `build-stages.ts`. What a print job has that the others do not is a middle
 * both halves of which are owed by the same side: the printer starts it, then
 * says it is ready with a photo. 058 stores those as two timestamps rather than
 * two status members, so this file switches on `status` plus
 * `printing_started_at` and `ready_at` — every token it reads is one the row
 * actually holds.
 *
 * A declined job is the one place a caption quotes free text: 058 stores the
 * reason because a reason that lives only in the thread cannot be shown on the
 * list row that needs it, and this is that row.
 */
import type { Stage } from '@/components/stage-rail'
import type { ToyTransaction, ToyTransactionDetail } from '@splat-connect/types'

type Row = Pick<
  ToyTransaction,
  | 'status'
  | 'owner_confirmed_at'
  | 'requester_confirmed_at'
  | 'printing_started_at'
  | 'ready_at'
  | 'decline_reason'
  | 'created_at'
  | 'updated_at'
>

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function printStages(tx: Row): Stage[] {
  const ended = shortDate(tx.updated_at)
  const asked: Stage = {
    key: 'asked',
    label: 'Asked',
    caption: `Sent ${shortDate(tx.created_at)}`,
    state: 'done',
  }
  const reachedHandover = Boolean(tx.owner_confirmed_at || tx.requester_confirmed_at)

  switch (tx.status) {
    case 'requested':
      return [
        asked,
        { key: 'accepted', label: 'Accepted', caption: 'Waiting on the printer', state: 'now' },
        { key: 'printing', label: 'Printing', caption: 'Once they take it on', state: 'todo' },
        { key: 'ready', label: 'Ready', caption: 'They post a photo', state: 'todo' },
        { key: 'collected', label: 'Collected', caption: 'Once you both confirm', state: 'todo' },
      ]

    case 'accepted': {
      const accepted: Stage = {
        key: 'accepted',
        label: 'Accepted',
        caption: 'They took it on',
        state: 'done',
      }
      if (!tx.printing_started_at) {
        return [
          asked,
          accepted,
          { key: 'printing', label: 'Printing', caption: 'Waiting for the bed', state: 'now' },
          { key: 'ready', label: 'Ready', caption: 'They post a photo', state: 'todo' },
          { key: 'collected', label: 'Collected', caption: 'Once you both confirm', state: 'todo' },
        ]
      }
      const printing: Stage = {
        key: 'printing',
        label: 'Printing',
        caption: `On the bed ${shortDate(tx.printing_started_at)}`,
        state: 'done',
      }
      if (!tx.ready_at) {
        return [
          asked,
          accepted,
          printing,
          { key: 'ready', label: 'Ready', caption: 'Waiting on the printer', state: 'now' },
          { key: 'collected', label: 'Collected', caption: 'Once you both confirm', state: 'todo' },
        ]
      }
      return [
        asked,
        accepted,
        printing,
        { key: 'ready', label: 'Ready', caption: `Ready ${shortDate(tx.ready_at)}`, state: 'done' },
        {
          key: 'collected',
          label: 'Collected',
          caption: reachedHandover ? 'Waiting on the other confirmation' : 'Arrange a pickup',
          state: 'now',
        },
      ]
    }

    case 'completed':
      return [
        asked,
        { key: 'accepted', label: 'Accepted', caption: 'They took it on', state: 'done' },
        { key: 'printing', label: 'Printing', caption: 'Printed', state: 'done' },
        { key: 'ready', label: 'Ready', caption: 'Photo posted', state: 'done' },
        { key: 'collected', label: 'Collected', caption: `Closed ${ended}`, state: 'done' },
      ]

    // Declining can only happen at the one step where somebody answers, so this
    // stop is exact. The reason is this record's own — never a shared map.
    case 'rejected':
      return [
        asked,
        {
          key: 'accepted',
          label: 'Accepted',
          caption: tx.decline_reason ?? 'They could not take it',
          state: 'stop',
        },
        { key: 'printing', label: 'Printing', caption: 'Never got here', state: 'todo' },
        { key: 'ready', label: 'Ready', caption: 'Never got here', state: 'todo' },
        { key: 'collected', label: 'Collected', caption: `Closed ${ended}`, state: 'done' },
      ]

    case 'withdrawn': {
      /*
       * Where it stopped, read off what survived `status` being overwritten. A
       * ready timestamp proves it got printed; a printing timestamp proves it
       * got onto the bed. Below that the row cannot say, and the stop sits at
       * Accepted.
       */
      const stoppedAt = reachedHandover
        ? 'collected'
        : tx.ready_at
          ? 'ready'
          : tx.printing_started_at
            ? 'printing'
            : 'accepted'
      const order = ['accepted', 'printing', 'ready', 'collected']
      const stopIndex = order.indexOf(stoppedAt)
      const step = (key: string, label: string, caption: string, reached: boolean): Stage =>
        key === stoppedAt
          ? { key, label, caption: 'Withdrawn', state: 'stop' }
          : { key, label, caption: reached ? caption : 'Never got here', state: reached ? 'done' : 'todo' }

      return [
        asked,
        step('accepted', 'Accepted', 'They took it on', stopIndex > 0),
        step('printing', 'Printing', 'Printed', stopIndex > 1),
        step('ready', 'Ready', 'Photo posted', stopIndex > 2),
        stoppedAt === 'collected'
          ? { key: 'collected', label: 'Collected', caption: 'Withdrawn', state: 'stop' }
          : { key: 'collected', label: 'Collected', caption: `Closed ${ended}`, state: 'done' },
      ]
    }
  }
}

export interface StageFacts {
  title: string
  facts: Array<{ label: string; value: string }>
}

/**
 * The four facts under the rail, for the stage this job is actually at.
 *
 * Pickup appears only from Ready, which is the artboard's rule and 028's: the
 * address is copied onto the job at accept, but showing it before there is
 * anything to collect invites somebody to turn up to a bed that is still
 * running.
 */
export function printStageFacts(
  tx: ToyTransactionDetail,
  viewerIsPrinter: boolean
): StageFacts {
  const address = [tx.pickup_line1, tx.pickup_suburb, tx.pickup_state, tx.pickup_postcode]
    .filter(Boolean)
    .join(', ')
  const code = viewerIsPrinter ? tx.owner_code : tx.requester_code
  const confirmedByViewer = viewerIsPrinter ? tx.owner_confirmed_at : tx.requester_confirmed_at
  const confirmedByOther = viewerIsPrinter ? tx.requester_confirmed_at : tx.owner_confirmed_at
  const parts = tx.print_files.length
  const partsLine = `${parts} part${parts === 1 ? '' : 's'} from ${tx.tutorial_title ?? 'a guide'}`

  if (tx.status === 'requested') {
    return {
      title: 'Waiting on the printer',
      facts: [
        { label: 'Parts', value: partsLine },
        { label: 'Printer', value: tx.printer?.name ?? 'Not recorded' },
        { label: 'Sent', value: new Date(tx.created_at).toLocaleDateString('en-AU') },
        {
          label: 'Next',
          value: viewerIsPrinter ? 'Take the job, or decline with a reason' : 'They answer here',
        },
      ],
    }
  }

  if (tx.status === 'accepted' && !tx.printing_started_at) {
    return {
      title: 'Waiting for the bed',
      facts: [
        { label: 'Parts', value: partsLine },
        { label: 'Printer', value: tx.printer?.name ?? 'Not recorded' },
        { label: 'Material', value: tx.printer?.materials.join(', ') || 'Not recorded' },
        {
          label: 'Next',
          value: viewerIsPrinter ? 'Start it when the bed is free' : 'They start it when the bed is free',
        },
      ],
    }
  }

  if (tx.status === 'accepted' && !tx.ready_at) {
    return {
      title: 'On the bed',
      facts: [
        { label: 'Started', value: new Date(tx.printing_started_at!).toLocaleDateString('en-AU') },
        { label: 'Parts', value: partsLine },
        { label: 'Printer', value: tx.printer?.name ?? 'Not recorded' },
        {
          label: 'Next',
          value: viewerIsPrinter ? 'Post a photo when it comes off' : 'A photo when it comes off',
        },
      ],
    }
  }

  if (tx.status === 'accepted') {
    return {
      title: 'Ready to collect',
      facts: [
        { label: 'When', value: tx.pickup_instructions || 'Not agreed yet — say so in the thread' },
        // Pickup appears only from here. Before this there is nothing to come for.
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
        { label: 'Parts', value: partsLine },
        { label: 'Collected', value: new Date(tx.updated_at).toLocaleDateString('en-AU') },
        { label: 'Where', value: address || 'Not recorded' },
        { label: 'Printed by', value: viewerIsPrinter ? 'You' : tx.owner_name },
      ],
    }
  }

  return {
    title: tx.status === 'rejected' ? 'Not taken on' : 'Withdrawn',
    facts: [
      { label: 'Parts', value: partsLine },
      { label: 'Sent', value: new Date(tx.created_at).toLocaleDateString('en-AU') },
      { label: 'Closed', value: new Date(tx.updated_at).toLocaleDateString('en-AU') },
      {
        label: tx.status === 'rejected' ? 'Reason' : 'What now',
        value:
          tx.status === 'rejected'
            ? tx.decline_reason ?? 'Not given'
            : 'Send it to another printer',
      },
    ],
  }
}
