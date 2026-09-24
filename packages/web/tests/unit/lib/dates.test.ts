import { describe, it, expect } from 'vitest'
import {
  dateBadge,
  shortDate,
  monthHeading,
  monthKey,
  longDate,
  formatTimeRange,
  isPast,
} from '@splat-connect/types'

// 20 September 2026 is a Sunday. 10am–2pm Sydney is 00:00–04:00 UTC, which is
// deliberately the awkward case: a naive local render on a machine set to UTC
// would call this the 20th at midnight, and on a machine in Perth it would say
// 8am. Both are wrong about a build day in Crows Nest.
const START = '2026-09-20T00:00:00Z'
const END = '2026-09-20T04:00:00Z'

describe('event dates', () => {
  it('writes the three-line badge in Sydney time', () => {
    expect(dateBadge(START)).toEqual({ weekday: 'Sun', day: '20', month: 'Sep' })
  })

  // Tests: the badge does not slip a day for a viewer west of Sydney
  // Chain: this is the whole reason the zone is fixed rather than local. A
  //        10am Sydney event is 08:00 in Perth and 00:00 UTC — either of which
  //        can land on the previous calendar day and put the wrong number in
  //        the badge a family scans the list by
  it('keeps the same calendar day whatever the machine is set to', () => {
    // 20 Sep 2026, 9am Sydney — 23:00 UTC on the 19th.
    expect(dateBadge('2026-09-19T23:00:00Z').day).toBe('20')
  })

  it('groups by month, and sorts across a year boundary', () => {
    expect(monthHeading(START)).toBe('September 2026')
    expect(monthKey('2026-12-01T00:00:00Z') < monthKey('2027-01-01T00:00:00Z')).toBe(true)
  })

  // Tests: the short form clips the month the same way the badge does
  // Chain: en-AU renders September as "Sept" and every other month as three,
  //        so an unclipped list of story dates jogs one month a year
  it('writes the short date with a three-letter month', () => {
    expect(shortDate(START)).toBe('20 Sep')
    expect(shortDate('2026-08-25T00:00:00Z')).toBe('25 Aug')
  })

  it('writes the long date for a detail page', () => {
    expect(longDate(START)).toBe('Sunday 20 September 2026')
  })

  // Tests: minutes are dropped on the hour and kept off it
  // Chain: "10:00am–2:00pm" is four characters of noise on the common case,
  //        and dropping minutes unconditionally would turn a 7:30pm workshop
  //        into a 7pm one
  it('drops minutes on the hour and keeps them off it', () => {
    expect(formatTimeRange(START, END)).toBe('10am–2pm')
    expect(formatTimeRange('2026-09-20T09:30:00Z', '2026-09-20T10:15:00Z')).toBe('7:30pm–8:15pm')
  })

  // Tests: the zone is spelled out on an online event and nowhere else
  // Chain: an in-person event is anchored by its address; an online one has
  //        nothing to anchor it, and a family in Perth needs to know which
  //        11am was meant
  it('names the zone only when there is no venue to anchor it', () => {
    expect(formatTimeRange(START, END, 'online')).toBe('10am–2pm AEST')
    expect(formatTimeRange(START, END, 'in_person')).not.toContain('AEST')
  })

  it('renders a start with no end', () => {
    expect(formatTimeRange(START, null)).toBe('10am')
  })

  // Tests: an event is past when it ENDS, not when it starts
  // Chain: measured from the start, a build day folds itself into "Past
  //        events" over lunch while people are still at the benches
  it('is not past until the end time', () => {
    const middle = new Date('2026-09-20T02:00:00Z')
    expect(isPast(START, END, middle)).toBe(false)
    expect(isPast(START, END, new Date('2026-09-20T05:00:00Z'))).toBe(true)
  })

  it('gives an event with no end time the rest of its day', () => {
    expect(isPast(START, null, new Date('2026-09-20T02:00:00Z'))).toBe(false)
    expect(isPast(START, null, new Date('2026-09-22T00:00:00Z'))).toBe(true)
  })
})
