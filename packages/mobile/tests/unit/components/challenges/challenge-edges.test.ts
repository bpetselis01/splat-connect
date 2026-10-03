// Pure rules behind the challenge pills, tiles, history and the My challenges
// meta line, at the boundaries: zero, one, null counts, future dates, no dates.
import type { MyIdea, ToyIdeaDetail } from '@splat-connect/types'
import { challengeCounts, challengeHistory, challengePill, challengeStats, shortDate } from '../../../../components/challenges/challenge-status'
jest.mock('../../../../lib/api-client', () => ({ apiClient: {} }))
jest.mock('expo-router', () => ({ useRouter: () => ({}), useFocusEffect: () => {} }))

import { ideaMeta } from '../../../../components/challenges/my-screen'

const brief = (over: Partial<ToyIdeaDetail> = {}) =>
  ({
    id: 'c1',
    author_id: 'a1',
    author_name: 'Priya',
    title: 'T',
    summary: 'S',
    description: 'D',
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

describe('pill', () => {
  it('says Waiting for a pending idea and Declined for a rejected one, whatever its kind', () => {
    for (const kind of ['challenge', 'question'] as const) {
      expect(challengePill({ status: 'pending', kind, answered_at: null }).label).toBe('Waiting')
      expect(challengePill({ status: 'rejected', kind, answered_at: '2026-08-03' }).label).toBe('Declined')
    }
  })

  it('says Became a guide for a graduated question too', () => {
    expect(challengePill({ status: 'graduated', kind: 'question', answered_at: '2026-08-03' }).label).toBe('Became a guide')
  })

  it('reads a question as answered from the marked message alone, as the detail brief carries it', () => {
    expect(challengePill({ status: 'challenge', kind: 'question', answered_at: null, answer_message_id: 'm1' }).label).toBe('Answered')
    expect(challengePill({ status: 'challenge', kind: 'question', answered_at: null, answer_message_id: null }).label).toBe('Waiting')
  })

  it('never calls a build challenge Answered, even with an answered date', () => {
    expect(challengePill({ status: 'challenge', kind: 'challenge', answered_at: '2026-08-03' }).label).toBe('Live')
  })

  it('gives every pill a badge status key', () => {
    for (const status of ['pending', 'challenge', 'rejected', 'graduated'] as const)
      for (const kind of ['challenge', 'question'] as const) expect(challengePill({ status, kind, answered_at: null }).status).toBeTruthy()
  })
})

describe('counts', () => {
  it.each([
    [0, 0, '0 makers · 0 posts'],
    [1, 0, '1 maker · 0 posts'],
    [0, 1, '0 makers · 1 post'],
    [1000, 12345, '1000 makers · 12345 posts'],
  ])('writes %i makers and %i posts as %p', (makers, posts, text) => {
    expect(challengeCounts({ kind: 'challenge', maker_count: makers, answer_count: posts })).toBe(text)
  })

  it('counts a question’s answers alone, singular and plural, ignoring makers', () => {
    expect(challengeCounts({ kind: 'question', maker_count: 9, answer_count: 0 })).toBe('0 answers')
    expect(challengeCounts({ kind: 'question', maker_count: 9, answer_count: 1 })).toBe('1 answer')
    expect(challengeCounts({ kind: 'question', maker_count: 9, answer_count: 2 })).toBe('2 answers')
  })
})

describe('stat tiles', () => {
  const now = new Date('2026-08-12T00:00:00Z')
  const labels = (c: ToyIdeaDetail) => challengeStats(c, now).map((s) => `${s.n} ${s.label}`)

  it('falls back to the number of participants when the brief carries no maker count', () => {
    const c = brief({ maker_count: undefined, participants: [{ profile_id: 'p', joined_at: '2026-08-03T00:00:00Z' }, { profile_id: 'q', joined_at: '2026-08-04T00:00:00Z' }] as never })
    expect(labels(c)[0]).toBe('2 makers')
  })

  it('writes one as singular on every tile, and zero as plural', () => {
    expect(labels(brief({ maker_count: 1, answer_count: 1, save_count: 1 }))).toEqual(['1 maker', '1 post', '1 save', '10 days open'])
    expect(labels(brief({ maker_count: 0, answer_count: 0, save_count: 0 }))).toEqual(['0 makers', '0 posts', '0 saves', '10 days open'])
  })

  it('treats missing answer and save counts as zero', () => {
    expect(labels(brief({ answer_count: undefined, save_count: undefined }))).toEqual(['0 makers', '0 posts', '0 saves', '10 days open'])
  })

  it('says "1 day open" on the day after and 0 days open on the day itself', () => {
    expect(challengeStats(brief(), new Date('2026-08-03T00:00:00Z')).at(-1)).toEqual({ n: 1, label: 'day open' })
    expect(challengeStats(brief(), new Date('2026-08-02T05:00:00Z')).at(-1)).toEqual({ n: 0, label: 'days open' })
  })

  it('never goes negative when the device clock is behind the server', () => {
    expect(challengeStats(brief(), new Date('2026-07-01T00:00:00Z')).at(-1)).toEqual({ n: 0, label: 'days open' })
  })

  it('drops the days tile once an idea is solved, rejected or pending', () => {
    for (const status of ['graduated', 'rejected', 'pending'] as const) expect(challengeStats(brief({ status }), now)).toHaveLength(3)
  })

  it('counts a question’s people and answers in the question’s words, and stops the clock when it is answered', () => {
    const q = brief({ kind: 'question', maker_count: 1, answer_count: 2 })
    expect(labels(q).slice(0, 2)).toEqual(['1 person in', '2 answers'])
    expect(challengeStats(q, now)).toHaveLength(4)
    expect(challengeStats({ ...q, answered_at: '2026-08-05T00:00:00Z' }, now)).toHaveLength(3)
  })
})

describe('history', () => {
  it('has just the submission for a brand-new idea', () => {
    const [only, ...rest] = challengeHistory(brief({ status: 'pending' }))
    expect(only!.title).toBe('Idea submitted')
    expect(rest).toEqual([])
  })

  it('dates the first join by the earliest joiner even when the list is out of order', () => {
    const h = challengeHistory(
      brief({
        participants: [
          { profile_id: 'b', joined_at: '2026-08-09T00:00:00Z' },
          { profile_id: 'a', joined_at: '2026-08-03T00:00:00Z' },
        ] as never,
      })
    )
    expect(h.find((e) => e.title === '2 makers joined')!.date).toMatch(/^Since \d{1,2} Aug$/)
  })

  it('singularises one maker and one person', () => {
    const joined = [{ profile_id: 'a', joined_at: '2026-08-03T00:00:00Z' }] as never
    expect(challengeHistory(brief({ participants: joined })).map((e) => e.title)).toContain('1 maker joined')
    expect(challengeHistory(brief({ kind: 'question', participants: joined })).map((e) => e.title)).toContain('1 person joined')
  })

  it('does not say a rejected or pending idea was opened', () => {
    for (const status of ['rejected', 'pending'] as const) expect(challengeHistory(brief({ status })).map((e) => e.title)).not.toContain('Opened as a challenge')
  })

  it('ends a graduated idea with Became a guide, after Opened', () => {
    const titles = challengeHistory(brief({ status: 'graduated' })).map((e) => e.title)
    expect(titles).toEqual(['Idea submitted', 'Opened as a challenge', 'Became a guide'])
  })

  it('never lists Answered for a build challenge that has an answered date', () => {
    expect(challengeHistory(brief({ answered_at: '2026-08-05T00:00:00Z' })).map((e) => e.title)).not.toContain('Answered')
  })
})

describe('short dates', () => {
  it.each([
    ['2026-01-15T12:00:00', '15 Jan'],
    ['2026-06-05T12:00:00', '5 Jun'],
    ['2026-07-31T12:00:00', '31 Jul'],
    ['2026-09-09T12:00:00', '9 Sep'],
    ['2026-12-25T12:00:00', '25 Dec'],
  ])('writes %s as %s, never "Sept" or "June"', (iso, text) => {
    expect(shortDate(iso)).toBe(text)
  })
})

describe('the My challenges meta line', () => {
  const idea = (over: Partial<MyIdea> = {}) =>
    ({
      id: 'i1',
      title: 'T',
      status: 'challenge',
      created_at: '2026-08-02T12:00:00',
      updated_at: '2026-08-10T12:00:00',
      maker_count: 0,
      answer_count: 0,
      review_note: null,
      ...over,
    }) as MyIdea

  it('says an idea of yours is with an admin while pending', () => {
    expect(ideaMeta(idea({ status: 'pending' }), false)).toBe('Your idea · submitted 2 Aug · with an admin')
  })

  it('counts makers joined, singular and zero', () => {
    expect(ideaMeta(idea({ maker_count: 1 }), false)).toBe('Your idea · submitted 2 Aug · 1 maker joined')
    expect(ideaMeta(idea({ maker_count: 0 }), false)).toBe('Your idea · submitted 2 Aug · 0 makers joined')
    expect(ideaMeta(idea({ maker_count: undefined }), false)).toBe('Your idea · submitted 2 Aug · 0 makers joined')
  })

  it('says a graduated idea is being written up, from either side', () => {
    expect(ideaMeta(idea({ status: 'graduated' }), false)).toBe('Your idea · submitted 2 Aug · being written up')
    expect(ideaMeta(idea({ status: 'graduated', joined_at: '2026-08-05T12:00:00' }), true)).toBe('Joined 5 Aug · being written up')
  })

  it('dates a decline by the update, and points at the reason only when one is attached', () => {
    expect(ideaMeta(idea({ status: 'rejected' }), false)).toBe('Your idea · declined 10 Aug')
    expect(ideaMeta(idea({ status: 'rejected', review_note: 'Too heavy' }), false)).toBe('Your idea · declined 10 Aug — a reason is attached')
  })

  it('never prints the reason itself on the list', () => {
    expect(ideaMeta(idea({ status: 'rejected', review_note: '<b>secret</b> reason' }), false)).not.toContain('secret')
  })

  it('dates a joined challenge by the join and falls back to creation when the join date is missing', () => {
    expect(ideaMeta(idea({ joined_at: '2026-08-05T12:00:00', maker_count: 3, answer_count: 1 }), true)).toBe('Joined 5 Aug · 3 makers · 1 post')
    expect(ideaMeta(idea({ joined_at: undefined }), true)).toBe('Joined 2 Aug · 0 makers · 0 posts')
  })
})
