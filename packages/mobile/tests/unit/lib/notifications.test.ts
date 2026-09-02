// packages/mobile/tests/unit/lib/notifications.test.ts
import { NOTIFICATION_TYPES, notificationBucket } from '@splat-connect/types'
import type { Notification, NotificationType } from '@splat-connect/types'
import { COPY, linkFor, relativeTime } from '../../../lib/notifications'

const notification = (over: Partial<Notification>): Notification => ({
  id: 'n1',
  recipient_id: 'viewer1',
  type: 'toy_request',
  tutorial_id: null,
  tutorial_title: null,
  toy_transaction_id: null,
  toy_name: null,
  idea_id: null,
  actor_name: 'Sam',
  read_at: null,
  created_at: '2026-08-01T00:00:00Z',
  ...over,
})

describe('COPY', () => {
  it('has a line for every notification type there is', () => {
    // The guard against a twenty-first type landing as a blank row.
    for (const type of NOTIFICATION_TYPES) {
      expect(typeof COPY[type as NotificationType]).toBe('function')
    }
    expect(Object.keys(COPY)).toHaveLength(NOTIFICATION_TYPES.length)
  })

  it('reads exactly as web reads, across all three buckets', () => {
    expect(COPY.collaborator_invited(notification({ type: 'collaborator_invited', tutorial_title: 'Bubble machine' })))
      .toBe('Sam invited you to collaborate on "Bubble machine"')
    expect(COPY.backing_requested(notification({ type: 'backing_requested', tutorial_title: 'Bubble machine' })))
      .toBe('Sam asked your organisation to back "Bubble machine"')
    expect(COPY.toy_accepted(notification({ type: 'toy_accepted', toy_name: 'Switch car' })))
      .toBe('Sam accepted your request for Switch car')
    expect(COPY.idea_rejected(notification({ type: 'idea_rejected' })))
      .toBe('Your idea was reviewed and not taken forward')
    expect(COPY.idea_graduated(notification({ type: 'idea_graduated' })))
      .toBe('A challenge you were part of is being written up as a guide, and you are credited on it')
    expect(COPY.challenge_removed(notification({ type: 'challenge_removed' })))
      .toBe('Sam removed you from a design challenge')
  })
})

describe('linkFor', () => {
  it('sends anything about a transaction to that exchange', () => {
    expect(linkFor(notification({ type: 'toy_message', toy_transaction_id: 'tx1' }))).toBe('/exchanges/tx1')
  })

  it('sends both review-queue types to the organisation hub, ahead of the editor', () => {
    // Both carry a tutorial_id; the editor branch below must not claim them.
    for (const type of ['backing_requested', 'tutorial_submitted'] as const) {
      expect(linkFor(notification({ type, tutorial_id: 't1' }))).toBe('/organisation')
    }
  })

  it('sends other tutorial news to that guide', () => {
    expect(linkFor(notification({ type: 'tutorial_approved', tutorial_id: 't9' }))).toBe('/tutorials/t9')
  })

  it('sends a rejected idea to your own list, since it has no public page', () => {
    expect(linkFor(notification({ type: 'idea_rejected', idea_id: 'i1' }))).toBe('/challenges')
  })

  it('sends every other idea event to the public brief', () => {
    expect(linkFor(notification({ type: 'challenge_joined', idea_id: 'i1' }))).toBe('/explore/challenges/i1')
    expect(linkFor(notification({ type: 'idea_approved', idea_id: 'i1' }))).toBe('/explore/challenges/i1')
  })

  it('stays put when a row names nothing to open', () => {
    expect(linkFor(notification({ type: 'idea_approved' }))).toBe('/inbox')
  })

  it('lands somewhere real for every type', () => {
    // A type whose row cannot be opened is a dead end in the one screen whose
    // whole job is to route. Each type is given the ids it actually carries.
    for (const type of NOTIFICATION_TYPES as NotificationType[]) {
      const bucket = notificationBucket(type)
      const n = notification({
        type,
        tutorial_id: bucket === 'tutorials' ? 't1' : null,
        toy_transaction_id: bucket === 'exchanges' ? 'tx1' : null,
        idea_id: bucket === 'challenges' ? 'i1' : null,
      })
      expect(linkFor(n)).not.toBe('/inbox')
    }
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-09-01T12:00:00Z')

  it('counts back in the largest unit that fits', () => {
    expect(relativeTime('2026-09-01T11:59:30Z', now)).toBe('30 seconds ago')
    expect(relativeTime('2026-09-01T09:00:00Z', now)).toBe('3 hours ago')
    expect(relativeTime('2026-08-25T12:00:00Z', now)).toBe('last week')
  })

  it('says yesterday rather than 1 day ago', () => {
    expect(relativeTime('2026-08-31T12:00:00Z', now)).toBe('yesterday')
  })
})

describe('relativeTime on Hermes (no Intl.RelativeTimeFormat)', () => {
  // Hermes does not implement Intl.RelativeTimeFormat; on device it is
  // undefined and `new` on it crashed the whole inbox (2026-09-01). Node and
  // Chromium both have it, which is why nothing above ever caught that.
  const original = (Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat
  beforeAll(() => {
    delete (Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat
  })
  afterAll(() => {
    ;(Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat = original
  })

  const now = Date.parse('2026-09-01T12:00:00Z')

  it('renders the same strings the Intl path renders', () => {
    expect(relativeTime('2026-09-01T11:59:30Z', now)).toBe('30 seconds ago')
    expect(relativeTime('2026-09-01T09:00:00Z', now)).toBe('3 hours ago')
    expect(relativeTime('2026-08-31T12:00:00Z', now)).toBe('yesterday')
    expect(relativeTime('2026-08-25T12:00:00Z', now)).toBe('last week')
  })
})
