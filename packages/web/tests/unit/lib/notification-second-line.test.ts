import { describe, it, expect } from 'vitest'
import { notificationBody, notificationSecondLine, type Notification } from '@splat-connect/types'

const n = (over: Partial<Notification>): Notification => ({
  id: 'n1', recipient_id: 'r', type: 'tutorial_rejected', actor_name: 'SPLAT', read_at: null,
  created_at: '2026-08-19T03:00:00Z', ...over,
})
const day = () => '19 Aug'

describe('notificationBody', () => {
  it('trims, and stores a blank reason as nothing', () => {
    expect(notificationBody('  step 4 needs the wire named.  ')).toBe('step 4 needs the wire named.')
    expect(notificationBody('   ')).toBeNull()
    expect(notificationBody(null)).toBeNull()
  })
  it('cuts a long reason to 300 with an ellipsis rather than refusing it', () => {
    const out = notificationBody('x'.repeat(500))!
    expect(out).toHaveLength(300)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('notificationSecondLine', () => {
  it('shows the reason when there is one', () => {
    expect(notificationSecondLine(n({ body: 'Step 4 needs the wire named.', tutorial_title: 'Fan' }), day)).toBe('Step 4 needs the wire named.')
  })
  it('falls back to "{subject} · {date}"', () => {
    expect(notificationSecondLine(n({ tutorial_title: 'Fan with a proximity switch' }), day)).toBe('Fan with a proximity switch · 19 Aug')
    expect(notificationSecondLine(n({ type: 'toy_accepted', toy_name: 'Bubble machine' }), day)).toBe('Bubble machine · 19 Aug')
  })
  it('is just the date when the row names nothing', () => {
    expect(notificationSecondLine(n({ type: 'idea_approved', tutorial_title: '' }), day)).toBe('19 Aug')
  })
})
