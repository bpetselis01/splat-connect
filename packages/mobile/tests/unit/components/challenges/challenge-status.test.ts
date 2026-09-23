// packages/mobile/tests/unit/components/challenges/challenge-status.test.ts
import type { ToyIdeaDetail } from '@splat-connect/types'
import {
  challengeCounts,
  challengeHistory,
  challengePill,
  challengeStats,
} from '../../../../components/challenges/challenge-status'

const brief = (over: Partial<ToyIdeaDetail> = {}) =>
  ({
    id: 'c1',
    author_id: 'a1',
    author_name: 'Priya',
    title: 'T',
    summary: 'S',
    description: 'D',
    intended_use: 'I',
    primary_user: 'P',
    contact_prefs: [],
    status: 'challenge',
    review_note: null,
    tutorial_id: null,
    kind: 'challenge',
    answered_at: null,
    created_at: '2026-08-02T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    participants: [],
    maker_count: 0,
    answer_count: 0,
    ...over,
  }) as ToyIdeaDetail

describe('challengePill', () => {
  it('is Live, Waiting, Answered or Became a guide', () => {
    expect(challengePill({ status: 'challenge', kind: 'challenge', answered_at: null }).label).toBe('Live')
    expect(challengePill({ status: 'challenge', kind: 'question', answered_at: null }).label).toBe('Waiting')
    expect(challengePill({ status: 'challenge', kind: 'question', answered_at: '2026-08-03' }).label).toBe('Answered')
    expect(challengePill({ status: 'graduated', kind: 'challenge', answered_at: null }).label).toBe('Became a guide')
  })
})

describe('challengeCounts', () => {
  it('counts makers and posts, or a question’s answers', () => {
    expect(challengeCounts({ kind: 'challenge', maker_count: 3, answer_count: 4 })).toBe('3 makers · 4 posts')
    expect(challengeCounts({ kind: 'challenge', maker_count: 1, answer_count: 1 })).toBe('1 maker · 1 post')
    expect(challengeCounts({ kind: 'question', maker_count: 2, answer_count: 1 })).toBe('1 answer')
  })
})

describe('challengeStats', () => {
  const now = new Date('2026-08-25T12:00:00Z')
  it('gives makers, posts and days open, and no saves tile', () => {
    expect(challengeStats(brief({ maker_count: 3, answer_count: 4 }), now)).toEqual([
      { n: 3, label: 'makers' },
      { n: 4, label: 'posts' },
      { n: 23, label: 'days open' },
    ])
  })
  it('stops counting days once it is solved or answered', () => {
    expect(challengeStats(brief({ status: 'graduated' }), now)).toHaveLength(2)
    expect(challengeStats(brief({ kind: 'question', answered_at: '2026-08-10T00:00:00Z' }), now)).toEqual([
      { n: 0, label: 'people in' },
      { n: 0, label: 'answers' },
    ])
  })
})

describe('challengeHistory', () => {
  it('runs submitted → opened → makers joined → became a guide', () => {
    const h = challengeHistory(
      brief({
        status: 'graduated',
        participants: [
          { idea_id: 'c1', profile_id: 'p2', joined_at: '2026-08-16T00:00:00Z', name: 'B' },
          { idea_id: 'c1', profile_id: 'p1', joined_at: '2026-08-14T00:00:00Z', name: 'A' },
        ] as ToyIdeaDetail['participants'],
      })
    )
    expect(h.map((e) => e.title)).toEqual(['Idea submitted', 'Opened as a challenge', '2 makers joined', 'Became a guide'])
    expect(h[2].date).toBe('Since 14 Aug')
  })
  it('gives a question its asked and answered steps, never an opening', () => {
    const h = challengeHistory(brief({ kind: 'question', answered_at: '2026-08-10T00:00:00Z' }))
    expect(h.map((e) => e.title)).toEqual(['Question asked', 'Answered'])
  })
})
