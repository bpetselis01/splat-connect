import { describe, it, expect } from 'vitest'
import {
  NOTIFICATION_TYPES,
  notificationBucket,
  typesInBucket,
} from '@splat-connect/types'

describe('notificationBucket', () => {
  /*
   * The badge on a My SPLAT card is only as good as this map: a type that
   * buckets nowhere is a notification the user is never told about on the hub.
   * The `satisfies Record<NotificationType, …>` in index.ts makes a new type a
   * compile error; this makes a *wrong* value a test failure.
   */
  it('gives every notification type a bucket', () => {
    expect(NOTIFICATION_TYPES.length).toBe(18)
    for (const type of NOTIFICATION_TYPES) {
      expect(['tutorials', 'exchanges', 'challenges']).toContain(notificationBucket(type))
    }
  })

  it('buckets authoring and collaboration to tutorials', () => {
    expect(notificationBucket('tutorial_approved')).toBe('tutorials')
    expect(notificationBucket('collaborator_invited')).toBe('tutorials')
    expect(notificationBucket('collaborator_left')).toBe('tutorials')
  })

  /* Every toy_* type is a transaction event, so My toys gets no badge and
     My exchanges gets all five. See the spec — do not invent a toy
     notification to fill that card. */
  it('buckets all five toy events to exchanges, none to toys', () => {
    expect(typesInBucket('exchanges').sort()).toEqual([
      'toy_accepted',
      'toy_message',
      'toy_rejected',
      'toy_request',
      'toy_withdrawn',
    ])
  })

  it('buckets ideas and challenges together', () => {
    expect(notificationBucket('idea_graduated')).toBe('challenges')
    expect(notificationBucket('challenge_joined')).toBe('challenges')
  })

  it('round-trips every type through its own bucket', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(typesInBucket(notificationBucket(type))).toContain(type)
    }
  })
})
