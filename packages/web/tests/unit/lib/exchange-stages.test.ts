import { describe, it, expect } from 'vitest'
import { exchangeStages } from '@/lib/exchange-stages'
import type { ToyTransactionStatus } from '@splat-connect/types'

const row = (
  status: ToyTransactionStatus,
  over: Partial<{ owner_confirmed_at: string | null; requester_confirmed_at: string | null }> = {}
) => ({
  status,
  owner_confirmed_at: null,
  requester_confirmed_at: null,
  created_at: '2026-09-02T00:00:00Z',
  updated_at: '2026-09-05T00:00:00Z',
  ...over,
})

const states = (s: ReturnType<typeof exchangeStages>) => s.map((x) => x.state)

describe('exchangeStages', () => {
  it('always draws the same four steps', () => {
    for (const status of ['requested', 'accepted', 'rejected', 'withdrawn', 'completed'] as const) {
      expect(exchangeStages(row(status)).map((s) => s.key)).toEqual([
        'requested',
        'accepted',
        'handover',
        'closed',
      ])
    }
  })

  it('puts the live step on what is actually waiting', () => {
    expect(states(exchangeStages(row('requested')))).toEqual(['done', 'now', 'todo', 'todo'])
    expect(states(exchangeStages(row('accepted')))).toEqual(['done', 'done', 'now', 'todo'])
  })

  it('closes every step on a completed exchange', () => {
    expect(states(exchangeStages(row('completed')))).toEqual(['done', 'done', 'done', 'done'])
  })

  /*
   * Why: the brief's rule. A record that ended early stops where it stopped and
   * must never show an in-progress dot — an amber step on a declined exchange
   * tells the reader somebody is still waiting on them.
   */
  it('never shows an in-progress step on a record that ended', () => {
    for (const status of ['rejected', 'withdrawn', 'completed'] as const) {
      expect(states(exchangeStages(row(status)))).not.toContain('now')
    }
  })

  it('stops a rejected exchange at the step where somebody answered', () => {
    const s = exchangeStages(row('rejected'))
    expect(s[1]).toMatchObject({ key: 'accepted', state: 'stop', caption: 'They said no' })
    expect(s[2].caption).toBe('Never got here')
    // Closed still closes: the record is over, and the rail says so.
    expect(s[3].state).toBe('done')
  })

  /*
   * Why: status is overwritten on withdrawal, so the row cannot say whether it
   * was pulled before or after acceptance. A handover confirmation is the one
   * piece of evidence that it got that far, and this is the whole of what
   * distinguishes the two rails.
   */
  it('reads a handover confirmation as proof a withdrawn exchange got that far', () => {
    const early = exchangeStages(row('withdrawn'))
    expect(early[1]).toMatchObject({ state: 'stop', caption: 'Withdrawn' })

    const late = exchangeStages(row('withdrawn', { owner_confirmed_at: '2026-09-04T00:00:00Z' }))
    expect(late[1]).toMatchObject({ state: 'done', caption: 'They said yes' })
    expect(late[2]).toMatchObject({ key: 'handover', state: 'stop', caption: 'Withdrawn' })
  })

  it('distinguishes one confirmation from none on a live handover', () => {
    expect(exchangeStages(row('accepted'))[2].caption).toBe('Agree a time')
    expect(
      exchangeStages(row('accepted', { requester_confirmed_at: '2026-09-04T00:00:00Z' }))[2].caption
    ).toBe('Waiting on the other confirmation')
  })

  /*
   * Why: captions are per record, and this is the property that makes a shared
   * caption map impossible to introduce by accident.
   */
  it('gives two records their own captions for the same step', () => {
    const a = exchangeStages(row('accepted'))
    const b = exchangeStages(row('rejected'))
    expect(a[1].caption).toBe('They said yes')
    expect(b[1].caption).toBe('They said no')
  })

  /*
   * en-AU abbreviates September as "Sept". The artboard shows "2 Sep" because
   * it was drawn under a US locale — the locale is right and a mockup is not a
   * reason to hand-roll month names, so the assertion follows Intl rather than
   * the picture.
   */
  it('dates the opening step from when it was asked', () => {
    expect(exchangeStages(row('requested'))[0].caption).toMatch(/^Asked 2 Sept?$/)
  })
})
