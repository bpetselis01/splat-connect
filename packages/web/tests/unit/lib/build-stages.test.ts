import { describe, it, expect } from 'vitest'
import { buildStages } from '@/lib/build-stages'
import type { ToyTransaction } from '@splat-connect/types'

type Row = Parameters<typeof buildStages>[0]

function tx(over: Partial<ToyTransaction> = {}): Row {
  return {
    status: 'requested',
    owner_confirmed_at: null,
    requester_confirmed_at: null,
    working_photo_url: null,
    work_approved_at: null,
    created_at: '2026-09-03T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
    ...over,
  }
}

const at = (stages: ReturnType<typeof buildStages>, key: string) =>
  stages.find((s) => s.key === key)!

describe('buildStages', () => {
  it('walks the five steps as the row fills in', () => {
    expect(at(buildStages(tx()), 'claimed').state).toBe('now')

    const claimed = buildStages(tx({ status: 'accepted' }))
    expect(at(claimed, 'claimed').state).toBe('done')
    expect(at(claimed, 'shot').state).toBe('now')

    const shot = buildStages(tx({ status: 'accepted', working_photo_url: 'a/1.png' }))
    expect(at(shot, 'shot').state).toBe('done')
    expect(at(shot, 'approved').state).toBe('now')

    const approved = buildStages(
      tx({
        status: 'accepted',
        working_photo_url: 'a/1.png',
        work_approved_at: '2026-09-09T00:00:00Z',
      })
    )
    expect(at(approved, 'approved').state).toBe('done')
    expect(at(approved, 'closed').state).toBe('now')
  })

  /*
   * Why: the brief's rule. A record that ended early stops where it stopped and
   * must never show an in-progress dot — an amber "waiting" on a build nobody
   * is building reads as work still under way.
   */
  it('stops a declined build at the step it died at, with no dot anywhere', () => {
    const stages = buildStages(tx({ status: 'rejected' }))
    expect(at(stages, 'claimed').state).toBe('stop')
    expect(at(stages, 'shot').caption).toBe('Never got here')
    expect(at(stages, 'closed').state).toBe('done')
    expect(stages.some((s) => s.state === 'now')).toBe(false)
  })

  /*
   * Why: `status` is overwritten on withdrawal, so how far it got has to be
   * read off what survived. A shot proves a maker took it on; an approval
   * proves the family saw it.
   */
  it('reads how far a withdrawn build got from what the row still holds', () => {
    const early = buildStages(tx({ status: 'withdrawn' }))
    expect(at(early, 'claimed').state).toBe('stop')

    const afterShot = buildStages(tx({ status: 'withdrawn', working_photo_url: 'a/1.png' }))
    expect(at(afterShot, 'claimed').state).toBe('done')
    expect(at(afterShot, 'shot').state).toBe('stop')

    const afterApproval = buildStages(
      tx({
        status: 'withdrawn',
        working_photo_url: 'a/1.png',
        work_approved_at: '2026-09-09T00:00:00Z',
      })
    )
    expect(at(afterApproval, 'approved').state).toBe('stop')
    expect(afterApproval.some((s) => s.state === 'now')).toBe(false)
  })

  it('marks every step done on a completed build', () => {
    const stages = buildStages(tx({ status: 'completed' }))
    expect(stages.every((s) => s.state === 'done')).toBe(true)
  })

  /*
   * Why: the caption field is per step precisely so a shared map cannot leak
   * one record's wording into another row. Two different rows must not produce
   * the same captions by accident of a module-level object.
   */
  it('gives each record its own captions', () => {
    const a = buildStages(tx({ created_at: '2026-09-03T00:00:00Z' }))
    const b = buildStages(tx({ created_at: '2026-07-11T00:00:00Z' }))
    expect(at(a, 'asked').caption).not.toBe(at(b, 'asked').caption)
  })
})
