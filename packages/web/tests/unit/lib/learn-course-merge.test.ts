/**
 * site-content-learn-legal-editing: a saved outline can rename, re-time,
 * re-kind and reorder what the code has — never add to it, never move a
 * lesson between units, never break the course (Review Focus 5).
 */
import { describe, it, expect } from 'vitest'
import { LEARN_COURSE, learnLessons, mergeLearnCourse, readLearnCourse } from '@splat-connect/types'

const lesson = (slug: string, over: object = {}) => ({ slug, title: slug, minutes: 5, kind: 'read', ...over })

describe('mergeLearnCourse', () => {
  it('is the code default when nothing is saved', () => {
    const c = mergeLearnCourse(null)
    expect(c).toEqual(LEARN_COURSE)
    expect(c.units).toHaveLength(6)
    expect(learnLessons(c)).toHaveLength(16)
    expect(c).toMatchObject({ title: null, outcome: null, shown_as: 'free' })
  })

  it('takes the course fields and the saved unit order, appending missing units in default order', () => {
    const c = mergeLearnCourse({
      title: 'Toy adaptation, start to finish',
      shown_as: 'sign_in',
      outcome: 'Adapt a battery toy for a switch.',
      units: [{ id: 'handover', title: 'Hand it over', blurb: '', lessons: [] }],
    })
    expect(c).toMatchObject({ title: 'Toy adaptation, start to finish', shown_as: 'sign_in', outcome: 'Adapt a battery toy for a switch.' })
    expect(c.units.map((u) => u.id)).toEqual(['handover', 'start-here', 'bench', 'connector', 'first-toys', 'own-switch'])
    // n is the position, so "Unit 1" is whichever unit comes first now.
    expect(c.units.map((u) => u.n)).toEqual([1, 2, 3, 4, 5, 6])
    // A blank blurb keeps the code's.
    expect(c.units[0].blurb).toBe(LEARN_COURSE.units.find((u) => u.id === 'handover')!.blurb)
  })

  it('ignores unknown slugs and keeps every lesson in its own unit', () => {
    const c = mergeLearnCourse({
      units: [
        {
          id: 'start-here',
          title: 'Start here',
          blurb: 'b',
          lessons: [
            lesson('handover'), // Unit 6's — not movable here
            lesson('nope'), // no such lesson
            lesson('switch-types', { title: 'Switches', minutes: 7, kind: 'build' }),
          ],
        },
      ],
    })
    const start = c.units.find((u) => u.id === 'start-here')!
    expect(start.lessons.map((l) => l.slug)).toEqual([
      'switch-types', 'toy-adaptation-101', 'how-a-switch-works', 'choosing-a-toy', 'checkpoint-1',
    ])
    expect(start.lessons[0]).toMatchObject({ title: 'Switches', minutes: 7, kind: 'build' })
    expect(c.units.find((u) => u.id === 'handover')!.lessons.map((l) => l.slug)).toContain('handover')
    expect(learnLessons(c)).toHaveLength(16)
  })

  it('falls back to the default for a value it cannot read', () => {
    expect(mergeLearnCourse({ units: 'everything' })).toEqual(LEARN_COURSE)
    expect(mergeLearnCourse([1, 2])).toEqual(LEARN_COURSE)
  })
})

describe('readLearnCourse', () => {
  const unit = (lessons: object[]) => ({ units: [{ id: 'start-here', title: 'Start here', blurb: '', lessons }] })

  it('refuses each limit with a sentence', () => {
    for (const [value, error] of [
      [unit([lesson('switch-types', { minutes: 0 })]), 'A lesson length must be a whole number of minutes from 1 to 240.'],
      [unit([lesson('switch-types', { minutes: 2.5 })]), 'A lesson length must be a whole number of minutes from 1 to 240.'],
      [unit([lesson('switch-types', { kind: 'video' })]), 'A lesson is a read, a build or a checkpoint.'],
      [unit([lesson('switch-types', { title: '' })]), 'A lesson title must be 1 to 80 characters.'],
      [{ title: 'x'.repeat(81) }, 'The course title must be 1 to 80 characters.'],
      [{ outcome: 'x'.repeat(401) }, 'What a reader can do by the end must be 400 characters or fewer.'],
      [{ shown_as: 'members' }, 'Shown as must be free, sign_in or hidden.'],
      [{ units: [{ id: 'start-here', title: 'x'.repeat(81), blurb: '', lessons: [] }] }, 'A unit title must be 1 to 80 characters.'],
      [{ units: [{ id: 'start-here', title: 'Start', blurb: 'x'.repeat(301), lessons: [] }] }, 'A unit blurb must be 300 characters or fewer.'],
    ] as const) {
      expect(readLearnCourse(value), JSON.stringify(value).slice(0, 60)).toEqual({ error })
    }
  })

  it('returns the value trimmed', () => {
    expect(readLearnCourse({ title: '  Toy adaptation  ', units: [] })).toEqual({ value: { title: 'Toy adaptation', units: [] } })
  })
})
