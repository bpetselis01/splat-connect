import { describe, it, expect } from 'vitest'
import { buildCalendar } from '@splat-connect/types'

const event = {
  uid: 'e1@splat-connect',
  starts_at: '2026-10-04T03:00:00Z',
  ends_at: '2026-10-04T06:00:00Z',
  summary: 'Toy library open afternoon',
  location: 'Eastwood Special School, 14 Corella St, Eastwood, NSW',
  url: 'https://splat.example/get-involved/events/e1',
  description: 'Hosted by Eastwood; bring a toy.',
}

/** Undoes folding, the way a reader does, so the tests read whole lines. */
const unfold = (ics: string) => ics.replace(/\r\n /g, '')

describe('buildCalendar', () => {
  it('writes one VEVENT per event with UTC stamps, CRLF lines and a calendar name', () => {
    const ics = buildCalendar([event, { ...event, uid: 'e2@splat-connect' }], {
      name: 'SPLAT Connect events',
      now: new Date('2026-09-23T00:00:00Z'),
    })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).not.toMatch(/[^\r]\n/)
    const lines = unfold(ics).split('\r\n')
    expect(lines).toContain('X-WR-CALNAME:SPLAT Connect events')
    expect(lines).toContain('UID:e1@splat-connect')
    expect(lines).toContain('DTSTAMP:20260923T000000Z')
    expect(lines).toContain('DTSTART:20261004T030000Z')
    expect(lines).toContain('DTEND:20261004T060000Z')
    expect(lines).toContain('URL:https://splat.example/get-involved/events/e1')
  })

  it('escapes commas, semicolons, backslashes and newlines in text, but not in a URL', () => {
    const lines = unfold(buildCalendar([{ ...event, description: 'a;b\\c\nd' }])).split('\r\n')
    expect(lines).toContain('LOCATION:Eastwood Special School\\, 14 Corella St\\, Eastwood\\, NSW')
    expect(lines).toContain('DESCRIPTION:a\\;b\\\\c\\nd')
  })

  it('gives an event with no end two hours, and leaves out empty optional lines', () => {
    const ics = buildCalendar([{ ...event, ends_at: null, location: null, url: null, description: '' }])
    expect(ics).toContain('DTEND:20261004T050000Z')
    expect(ics).not.toMatch(/LOCATION:|URL:|DESCRIPTION:/)
  })

  it('folds lines at 75 octets without splitting a multi-byte character', () => {
    const title = '–'.repeat(60) // en dash: three octets each
    const ics = buildCalendar([{ ...event, summary: title }])
    const bytes = (s: string) => new TextEncoder().encode(s).length
    const lines = ics.split('\r\n')
    const at = lines.findIndex((l) => l.startsWith('SUMMARY:'))
    expect(lines[at + 1].startsWith(' ')).toBe(true)
    for (const l of lines) expect(bytes(l)).toBeLessThanOrEqual(75)
    expect(unfold(ics)).toContain(`SUMMARY:${title}\r\n`)
    // No replacement characters: a fold never lands inside the dash.
    expect(ics).not.toContain('\uFFFD')
  })
})
