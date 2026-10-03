import { copyFor, notificationBucket, notificationSecondLine } from '@splat-connect/types'
import type { Notification } from '@splat-connect/types'
import { linkFor, relativeTime } from '../../../lib/notifications'
import { doorRoute, sinceYear } from '../../../lib/org-profile'
import { tabBarClearance, TAB_BAR_HEIGHT } from '../../../lib/tab-bar-layout'
import { myRoute } from '../../../lib/my-routes'

const n = (over: Partial<Notification>): Notification => ({
  id: 'n1', recipient_id: 'v', type: 'toy_request', tutorial_id: null, tutorial_title: null,
  toy_transaction_id: null, toy_name: null, idea_id: null, actor_name: 'Sam', read_at: null,
  created_at: '2026-08-01T00:00:00Z', ...over,
})
const NOW = Date.parse('2026-10-03T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR

describe('linkFor precedence and edges', () => {
  it('a transaction wins over a tutorial or idea on the same row', () => {
    expect(linkFor(n({ type: 'toy_message', toy_transaction_id: 'tx', tutorial_id: 't', idea_id: 'i' }))).toBe('/exchanges/tx')
  })
  it('a build question with no transaction id falls past the Ask route', () => {
    expect(linkFor(n({ type: 'build_question', toy_transaction_id: null }))).toBe('/inbox')
  })
  it('an empty-string transaction id is treated as none, not as /exchanges/', () => {
    expect(linkFor(n({ type: 'toy_message', toy_transaction_id: '' }))).not.toBe('/exchanges/')
  })
  it('an org thanks goes to the hub even when it also names a conversation-less org id', () => {
    expect(linkFor(n({ type: 'org_thanked', org_id: 'o1' }))).toBe('/organisation')
  })
  it('a conversation id wins over an org event', () => {
    expect(linkFor(n({ org_conversation_id: 'c1', org_event_id: 'e1' }))).toBe('/messages/c1')
  })
  it('an org event and a story open their own news route', () => {
    expect(linkFor(n({ org_event_id: 'e1' }))).toBe('/news/event/e1')
    expect(linkFor(n({ org_story_id: 's1' }))).toBe('/news/story/s1')
  })
  it('a challenge idea that graduated opens the brief; a rejected one goes to my list', () => {
    expect(linkFor(n({ type: 'idea_approved', idea_id: 'i1' }))).toBe('/explore/challenges/i1')
    expect(linkFor(n({ type: 'idea_rejected', idea_id: 'i1' }))).toBe('/challenges')
  })
  it('a profile thanks without a profile id stays in the inbox', () => {
    expect(linkFor(n({ type: 'profile_thanked', profile_id: null }))).toBe('/inbox')
    expect(linkFor(n({ type: 'profile_thanked', profile_id: 'p1' }))).toBe('/guides/contributor/p1')
  })
  it('a tutorial thanks with no tutorial id has nowhere better than the inbox', () => {
    expect(linkFor(n({ type: 'tutorial_thanked', tutorial_id: null }))).toBe('/inbox')
  })
  it('an unknown future type with nothing attached lands in the inbox', () => {
    expect(linkFor(n({ type: 'brand_new' as Notification['type'] }))).toBe('/inbox')
  })
  it('ids are placed in the path verbatim, whatever they contain', () => {
    // The API issues uuids; this pins that linkFor does not mangle them.
    expect(linkFor(n({ toy_transaction_id: 'a-b_c.1' }))).toBe('/exchanges/a-b_c.1')
  })
})

describe('relativeTime edges', () => {
  it('says a few seconds ago as seconds, and now for the same instant', () => {
    expect(relativeTime(ago(30 * SEC), NOW)).toMatch(/30 seconds ago/)
    expect(relativeTime(ago(0), NOW)).toMatch(/now/)
  })
  it('flips unit exactly at the boundary: 59 minutes vs 60 minutes', () => {
    expect(relativeTime(ago(59 * MIN), NOW)).toMatch(/59 minutes ago/)
    expect(relativeTime(ago(60 * MIN), NOW)).toMatch(/1 hour ago/)
  })
  it('reads 23 hours then yesterday', () => {
    expect(relativeTime(ago(23 * HOUR), NOW)).toMatch(/23 hours ago/)
    expect(relativeTime(ago(24 * HOUR), NOW)).toBe('yesterday')
  })
  it('counts weeks, months and years back', () => {
    expect(relativeTime(ago(14 * DAY), NOW)).toMatch(/2 weeks ago/)
    expect(relativeTime(ago(90 * DAY), NOW)).toMatch(/3 months ago/)
    expect(relativeTime(ago(800 * DAY), NOW)).toMatch(/2 years ago/)
  })
  it('a timestamp slightly in the future (clock skew) reads as now-ish, not as a negative count', () => {
    const out = relativeTime(new Date(NOW + 2 * SEC).toISOString(), NOW)
    expect(out).not.toMatch(/-/)
    expect(out).toMatch(/now|in 2 seconds/)
  })
  it('a far-future timestamp reads in the future', () => {
    expect(relativeTime(new Date(NOW + 3 * DAY).toISOString(), NOW)).toMatch(/in 3 days/)
  })
  it('an unparseable timestamp gives an empty string rather than throwing or "NaN"', () => {
    for (const bad of ['', 'not a date', 'undefined']) expect(relativeTime(bad, NOW)).toBe('')
  })
  it('a huge age (year 1970) still returns a year phrase', () => {
    expect(relativeTime('1970-01-01T00:00:00Z', NOW)).toMatch(/57 years ago/)
  })
})

describe('the fallback (Hermes has no Intl.RelativeTimeFormat) at the edges', () => {
  const orig = Intl.RelativeTimeFormat
  beforeAll(() => { (Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat = undefined })
  afterAll(() => { (Intl as { RelativeTimeFormat?: unknown }).RelativeTimeFormat = orig })
  it('pluralises: 1 minute vs 2 minutes, 1 hour vs 5 hours', () => {
    expect(relativeTime(ago(MIN), NOW)).toBe('1 minute ago')
    expect(relativeTime(ago(2 * MIN), NOW)).toBe('2 minutes ago')
    expect(relativeTime(ago(HOUR), NOW)).toBe('1 hour ago')
    expect(relativeTime(ago(5 * HOUR), NOW)).toBe('5 hours ago')
  })
  it('says now, yesterday, last week and last month in words', () => {
    expect(relativeTime(ago(0), NOW)).toBe('now')
    expect(relativeTime(ago(DAY), NOW)).toBe('yesterday')
    expect(relativeTime(ago(7 * DAY), NOW)).toBe('last week')
    expect(relativeTime(ago(35 * DAY), NOW)).toBe('last month')
    expect(relativeTime(ago(400 * DAY), NOW)).toBe('last year')
  })
  it('future values read "in N units", tomorrow for one day', () => {
    expect(relativeTime(new Date(NOW + DAY).toISOString(), NOW)).toBe('tomorrow')
    expect(relativeTime(new Date(NOW + 3 * HOUR).toISOString(), NOW)).toBe('in 3 hours')
  })
  it('an unparseable timestamp is still an empty string', () => {
    expect(relativeTime('garbage', NOW)).toBe('')
  })
})

describe('notification copy with missing or hostile fields', () => {
  it('carries quotes, angle brackets and emoji through as plain text', () => {
    const t = '<b>"Bubble" & Co</b> 🧸'
    expect(copyFor(n({ type: 'tutorial_approved', tutorial_title: t }))).toContain(t)
  })
  it('second line: body wins, then subject plus date, then the date alone', () => {
    const date = () => '3 Oct'
    expect(notificationSecondLine(n({ body: 'Out of stock', tutorial_title: 'T' }), date)).toBe('Out of stock')
    expect(notificationSecondLine(n({ tutorial_title: 'Bubble machine' }), date)).toBe('Bubble machine · 3 Oct')
    expect(notificationSecondLine(n({ toy_name: 'Drum' }), date)).toBe('Drum · 3 Oct')
    expect(notificationSecondLine(n({}), date)).toBe('3 Oct')
  })
  it('second line: an empty body falls through to the subject, and an empty date yields null', () => {
    expect(notificationSecondLine(n({ body: '', toy_name: 'Drum' }), () => '3 Oct')).toBe('Drum · 3 Oct')
    expect(notificationSecondLine(n({}), () => '')).toBeNull()
  })
  it('every type has a bucket, and an unknown one does not crash the bucket lookup', () => {
    expect(() => notificationBucket('brand_new' as Notification['type'])).not.toThrow()
  })
})

describe('org-profile doors and byline year', () => {
  it.each([
    ['toy_library', '/toy-library'], ['dropoff', '/explore/recycling'], ['print', '/printing'],
    ['build', '/explore/makers-wanted/new'], ['message', '/messages/org/o1'],
  ] as const)('%s opens %s', (t, route) => expect(doorRoute(t, 'o1')).toBe(route))
  it('events has no phone screen, so it is not a button', () => expect(doorRoute('events', 'o1')).toBeNull())
  it('the message door carries the org id as given', () => {
    expect(doorRoute('message', 'abc-123')).toBe('/messages/org/abc-123')
  })
  it.each([[null], [undefined], [''], ['garbage'], ['0000-00-00']])('since year is null for %p', (v) => {
    expect(sinceYear(v as string | null | undefined)).toBeNull()
  })
  it('reads the year from an ISO timestamp', () => {
    expect(sinceYear('2024-06-15T10:00:00Z')).toBe(2024)
  })
})

describe('tab bar clearance', () => {
  it('uses the home-indicator inset when it exceeds the 16px offset, else the offset', () => {
    expect(tabBarClearance(34)).toBe(TAB_BAR_HEIGHT + 34 + 12)
    expect(tabBarClearance(0)).toBe(TAB_BAR_HEIGHT + 16 + 12)
    expect(tabBarClearance(16)).toBe(tabBarClearance(0))
  })
  it('a negative inset (a layout glitch) still reserves the bar', () => {
    expect(tabBarClearance(-20)).toBe(tabBarClearance(0))
  })
})

describe('myRoute for hostile hrefs', () => {
  it.each(['', '/', '/dashboard', '/ADMIN', '/admin/', '/admin?x=1', '/dashboard/tutorials/'])(
    '%p goes to the hub, not to a guessed screen', (h) => expect(myRoute(h)).toBe('/me'))
  it('inherited object keys are not routes', () => {
    for (const h of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) expect(myRoute(h)).toBe('/me')
  })
})

describe('copy never prints "null"', () => {
  it.each(['toy_request', 'tutorial_approved', 'org_event_published', 'org_message'] as const)('%s with no title or toy', (type) => {
    expect(copyFor(n({ type, tutorial_title: null, toy_name: null }))).not.toMatch(/null|undefined/)
  })
})
