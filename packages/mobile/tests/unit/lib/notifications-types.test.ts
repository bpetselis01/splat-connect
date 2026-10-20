// packages/mobile/tests/unit/lib/notifications-types.test.ts
//
// One row per NotificationType: the ids the API puts on that row, the sentence
// the inbox shows, and the screen a tap opens. The table is a Record over the
// union, so a type added to @splat-connect/types without a row here fails the
// typecheck, and the loop below fails it at runtime too.
import { copyFor, NOTIFICATION_TYPES } from '@splat-connect/types'
import type { Notification, NotificationType } from '@splat-connect/types'
import { linkFor } from '../../../lib/notifications'

type Row = { carries: Partial<Notification>; copy: string; link: string }

const TX = { toy_transaction_id: 'tx1', toy_name: 'Switch car' }
const GUIDE = { tutorial_id: 't1', tutorial_title: 'Bubble machine' }
const IDEA = { idea_id: 'i1' }

const TABLE: Record<NotificationType, Row> = {
  collaborator_invited: { carries: GUIDE, copy: 'Sam invited you to collaborate on "Bubble machine"', link: '/inbox' },
  collaborator_accepted: { carries: GUIDE, copy: 'Sam accepted your invite to "Bubble machine"', link: '/tutorials/t1' },
  collaborator_declined: { carries: GUIDE, copy: 'Sam declined your invite to "Bubble machine"', link: '/tutorials/t1' },
  collaborator_removed: { carries: GUIDE, copy: 'Sam removed you from "Bubble machine"', link: '/tutorials/t1' },
  collaborator_left: { carries: GUIDE, copy: 'Sam left "Bubble machine"', link: '/tutorials/t1' },
  backing_requested: { carries: GUIDE, copy: 'Sam asked your organisation to back "Bubble machine"', link: '/organisation' },
  tutorial_submitted: { carries: GUIDE, copy: 'Sam submitted "Bubble machine" for review', link: '/organisation' },
  tutorial_approved: { carries: GUIDE, copy: '"Bubble machine" was approved and is now published', link: '/tutorials/t1' },
  tutorial_rejected: { carries: GUIDE, copy: '"Bubble machine" was rejected', link: '/tutorials/t1' },
  tutorial_thanked: { carries: GUIDE, copy: 'A family said thanks for "Bubble machine"', link: '/guides/t1' },
  backing_accepted: { carries: GUIDE, copy: 'Sam agreed to back "Bubble machine"', link: '/guides/t1' },
  backing_declined: { carries: GUIDE, copy: 'Sam can\'t back "Bubble machine" right now', link: '/guides/t1' },
  report_resolved: { carries: { member_report_id: 'r1' }, copy: 'Your report was looked at', link: '/reports' },
  tutorial_noted: { carries: GUIDE, copy: 'Sam added a note to "Bubble machine"', link: '/guides/t1' },
  challenge_guide_published: {
    carries: GUIDE,
    copy: 'The guide from a challenge you follow is published: "Bubble machine"',
    link: '/guides/t1',
  },
  toy_request: { carries: TX, copy: 'Sam requested Switch car', link: '/exchanges/tx1' },
  toy_accepted: { carries: TX, copy: 'Sam accepted your request for Switch car', link: '/exchanges/tx1' },
  toy_rejected: { carries: TX, copy: 'Sam declined your request for Switch car', link: '/exchanges/tx1' },
  toy_withdrawn: { carries: TX, copy: 'Sam withdrew their request for Switch car', link: '/exchanges/tx1' },
  toy_message: { carries: TX, copy: 'Sam sent a message about Switch car', link: '/exchanges/tx1' },
  build_shot_posted: { carries: TX, copy: 'Sam posted a photo of Switch car working', link: '/exchanges/build/tx1' },
  build_approved: { carries: TX, copy: 'Sam approved the working shot for Switch car', link: '/exchanges/build/tx1' },
  build_question: {
    carries: TX,
    copy: 'Sam wrote about Switch car before anyone claimed it',
    link: '/exchanges/build/ask/tx1',
  },
  profile_thanked: { carries: { profile_id: 'p1' }, copy: 'Sam said thanks to you', link: '/guides/contributor/p1' },
  print_started: { carries: TX, copy: 'Sam started printing Switch car', link: '/printing/jobs/tx1' },
  print_ready: { carries: TX, copy: 'Sam finished printing Switch car', link: '/printing/jobs/tx1' },
  idea_approved: { carries: IDEA, copy: 'Your idea was published as a design challenge', link: '/explore/challenges/i1' },
  idea_rejected: { carries: IDEA, copy: 'Your idea was reviewed and not taken forward', link: '/challenges' },
  idea_graduated: {
    carries: IDEA,
    copy: 'A challenge you were part of is being written up as a guide, and you are credited on it',
    link: '/explore/challenges/i1',
  },
  challenge_joined: { carries: IDEA, copy: 'Sam joined your design challenge', link: '/explore/challenges/i1' },
  challenge_left: { carries: IDEA, copy: 'Sam left your design challenge', link: '/explore/challenges/i1' },
  challenge_removed: { carries: IDEA, copy: 'Sam removed you from a design challenge', link: '/explore/challenges/i1' },
  org_message: {
    carries: { org_conversation_id: 'c1', tutorial_title: 'Northbank' },
    copy: 'Sam messaged Northbank',
    link: '/messages/c1',
  },
  org_event_published: {
    carries: { org_event_id: 'e1', tutorial_title: 'Open day' },
    copy: 'Sam published an event: Open day',
    link: '/events/e1',
  },
  org_event_changed: {
    carries: { org_event_id: 'e1', tutorial_title: 'Open day' },
    copy: 'Sam changed the time or place of Open day',
    link: '/events/e1',
  },
  org_event_cancelled: {
    carries: { org_event_id: 'e1', tutorial_title: 'Open day' },
    copy: 'Sam cancelled Open day',
    link: '/events/e1',
  },
  org_story_published: {
    carries: { org_story_id: 's1', tutorial_title: 'A good year' },
    copy: 'Sam published a story: A good year',
    link: '/news/story/s1',
  },
  org_thanked: { carries: { org_id: 'o1' }, copy: 'Sam said thanks to your organisation', link: '/organisation/profile' },
  recycling_received: { carries: { org_id: 'o1' }, copy: 'Sam received your drop-off', link: '/explore/recycling' },
  recycling_declined: { carries: { org_id: 'o1' }, copy: 'Sam couldn\'t take your drop-off', link: '/explore/recycling' },
  org_request_approved: { carries: { org_id: 'o1' }, copy: 'Sam was approved and you now lead it', link: '/organisation' },
  org_request_declined: { carries: {}, copy: 'Sam wasn\'t approved', link: '/inbox' },
  test_print_passed: { carries: {}, copy: 'The test print for Sam passed', link: '/print-for-others' },
  test_print_failed: { carries: { org_id: 'o1' }, copy: 'The test print for Sam didn\'t pass', link: '/print-for-others' },
  handover_confirmed: { carries: TX, copy: 'Sam confirmed the handover of Switch car', link: '/exchanges/tx1' },
  leader_added: { carries: { org_id: 'o1' }, copy: 'You now lead Sam', link: '/organisation' },
  leader_removed: { carries: { org_id: 'o1' }, copy: 'You no longer lead Sam', link: '/toy-library/organisation/o1' },
  org_event_deleted: { carries: { org_id: 'o1', body: 'Open day' }, copy: 'Sam deleted an event you registered for', link: '/toy-library/organisation/o1' },
}

const row = (type: NotificationType): Notification => ({
  id: 'n1', recipient_id: 'viewer1', type, tutorial_id: null, tutorial_title: null, toy_transaction_id: null,
  toy_name: null, idea_id: null, actor_name: 'Sam', read_at: null, created_at: '2026-08-01T00:00:00Z',
  ...TABLE[type].carries,
})

describe('every notification type', () => {
  it('has a row in the table above', () => {
    expect(Object.keys(TABLE).sort()).toEqual([...NOTIFICATION_TYPES].sort())
  })

  it.each(Object.keys(TABLE) as NotificationType[])('%s reads and routes as the table says', (type) => {
    expect(copyFor(row(type))).toBe(TABLE[type].copy)
    expect(linkFor(row(type))).toBe(TABLE[type].link)
  })

  it('an admin is sent to the admin review screen for the two review-queue types, and nowhere else differs', () => {
    for (const type of Object.keys(TABLE) as NotificationType[]) {
      const admin = type === 'backing_requested' || type === 'tutorial_submitted' ? '/admin/review/t1' : TABLE[type].link
      expect(linkFor(row(type), true)).toBe(admin)
    }
  })
})
