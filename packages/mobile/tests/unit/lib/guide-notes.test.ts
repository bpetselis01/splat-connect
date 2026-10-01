import { noteSummary, pinCountLabel, stepLabel } from '../../../lib/guide-notes'

// The pure helpers only; the hook's client would build a Supabase client on import.
jest.mock('../../../lib/api-client', () => ({ apiClient: {} }))

const note = (over: object) => ({
  id: 'n', step_position: 1, author_id: 'a', author_name: 'Priya', body: 'b', photo_url: null, photo_caption: null,
  pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z', ...over,
})

describe('noteSummary', () => {
  const notes = [
    note({ id: '1', step_position: 1, pinned_at: 'x', pinned_by_name: 'Sam' }),
    note({ id: '2', step_position: 1 }),
    note({ id: '3', step_position: 1 }),
    note({ id: '4', step_position: null, pinned_at: 'x', pinned_by_name: 'Sam', body: 'Test the switch first.' }),
    note({ id: '5', step_position: 9, pinned_at: 'x', pinned_by_name: null, body: 'Past the end.' }),
  ]

  it('labels each step the board’s way', () => {
    expect(noteSummary(notes as never, 4).labels.get(1)).toBe('1 pinned revision · 2 notes')
  })

  it('adds pinned missing steps after the last step, past-the-end positions included', () => {
    expect(noteSummary(notes as never, 4).extras).toEqual([
      { no: 5, body: 'Test the switch first.', by: 'Priya', pinnedBy: 'Sam' },
      { no: 6, body: 'Past the end.', by: 'Priya', pinnedBy: 'Deleted member' },
    ])
  })

  it('splits pinned from discussion', () => {
    const s = noteSummary(notes as never, 4)
    expect([s.pinned.length, s.open.length]).toEqual([3, 2])
  })
})

it('names a note’s step, or Missing step', () => {
  expect(stepLabel(note({ step_position: 2 }) as never, 4)).toBe('Step 2')
  expect(stepLabel(note({ step_position: null }) as never, 4)).toBe('Missing step')
  expect(stepLabel(note({ step_position: 7 }) as never, 4)).toBe('Missing step')
})

it('counts revisions in words', () => {
  expect(pinCountLabel(1)).toBe('1 pinned revision')
  expect(pinCountLabel(2)).toBe('2 pinned revisions')
})
