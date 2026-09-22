import { describe, it, expect } from 'vitest'
import { needsAction, actionLabel } from '@splat-connect/types'
import type { ToyTransaction } from '@splat-connect/types'

// Lives here rather than in packages/types, which has no test runner — the same
// arrangement as estimate-ability, tested from packages/mobile.

type Subject = Pick<
  ToyTransaction,
  | 'status'
  | 'type'
  | 'owner_id'
  | 'owner_org_id'
  | 'owner_confirmed_at'
  | 'requester_confirmed_at'
  | 'working_photo_url'
  | 'work_approved_at'
  | 'printing_started_at'
  | 'ready_at'
> & { blocked_by_rival_accept?: boolean }

function tx(overrides: Partial<Subject> = {}): Subject {
  return {
    status: 'requested',
    type: 'donation',
    owner_id: 'owner-1',
    owner_org_id: null,
    owner_confirmed_at: null,
    requester_confirmed_at: null,
    working_photo_url: null,
    work_approved_at: null,
    printing_started_at: null,
    ready_at: null,
    ...overrides,
  }
}

describe('needsAction', () => {
  it('flags an open request for the owner, who has to answer it', () => {
    expect(needsAction(tx(), 'owner-1')).toBe(true)
  })

  it('does not flag an open request for the requester, who is waiting', () => {
    expect(needsAction(tx(), 'requester-1')).toBe(false)
  })

  it('does not flag a request the owner is locked out of accepting', () => {
    expect(needsAction(tx({ blocked_by_rival_accept: true }), 'owner-1')).toBe(false)
  })

  it('flags an accepted donation for the owner, who confirms alone', () => {
    expect(needsAction(tx({ status: 'accepted' }), 'owner-1')).toBe(true)
  })

  it('does not flag an accepted donation for the requester, who never confirms', () => {
    expect(needsAction(tx({ status: 'accepted' }), 'requester-1')).toBe(false)
  })

  it('flags an accepted exchange for both parties', () => {
    const exchange = tx({ status: 'accepted', type: 'exchange' })
    expect(needsAction(exchange, 'owner-1')).toBe(true)
    expect(needsAction(exchange, 'requester-1')).toBe(true)
  })

  it('stops flagging a party once they have confirmed', () => {
    const half = tx({
      status: 'accepted',
      type: 'exchange',
      owner_confirmed_at: '2026-08-17T00:00:00Z',
    })
    expect(needsAction(half, 'owner-1')).toBe(false)
    expect(needsAction(half, 'requester-1')).toBe(true)
  })

  it.each(['completed', 'rejected', 'withdrawn'] as const)('never flags a %s transaction', (status) => {
    expect(needsAction(tx({ status }), 'owner-1')).toBe(false)
    expect(needsAction(tx({ status }), 'requester-1')).toBe(false)
  })
})

describe('needsAction for an organisation', () => {
  // An org handoff has no owner_id at all — any of its leaders is the owner
  // side. Without the led-org list this returns false for every leader, and the
  // badge tells them nothing is waiting while a family waits for an answer.
  const orgTx = (overrides: Partial<Subject> = {}) =>
    tx({ owner_id: null, owner_org_id: 'org-1', ...overrides })

  it('flags an open request for a leader of the org it was made to', () => {
    expect(needsAction(orgTx(), 'leader-1', ['org-1'])).toBe(true)
  })

  it('flags it for every leader, since any of them may answer', () => {
    expect(needsAction(orgTx(), 'leader-2', ['org-1', 'org-9'])).toBe(true)
  })

  it('does not flag it for a leader of some other org', () => {
    expect(needsAction(orgTx(), 'leader-3', ['org-2'])).toBe(false)
  })

  it('does not flag it for the family who asked', () => {
    expect(needsAction(orgTx(), 'requester-1', [])).toBe(false)
  })

  it('waits on the leader to confirm a donation handoff', () => {
    const accepted = orgTx({ status: 'accepted', type: 'donation' })
    expect(needsAction(accepted, 'leader-1', ['org-1'])).toBe(true)
    expect(needsAction(accepted, 'requester-1', [])).toBe(false)
  })
})

describe('actionLabel', () => {
  const label = (over: Partial<Subject> = {}) =>
    actionLabel(tx(over), false)

  it('names the action each state is waiting for', () => {
    expect(label()).toMatch(/accept or decline/i)
    expect(label({ status: 'accepted' })).toMatch(/confirm the handoff/i)
  })

  /*
   * Why: a build's extra stage alternates sides. Sharing the exchange wording
   * would tell a maker with no photo posted to confirm a handover that cannot
   * happen, which is the failure the rail exists to prevent.
   */
  it('names the build stage, and the side it is waiting on', () => {
    const build: Partial<Subject> = { type: 'build', status: 'accepted' }
    expect(actionLabel(tx(build), true)).toMatch(/post the working shot/i)
    expect(
      actionLabel(tx({ ...build, working_photo_url: 'b/1.jpg' }), false)
    ).toMatch(/approve the working shot/i)
    expect(
      actionLabel(
        tx({ ...build, working_photo_url: 'b/1.jpg', work_approved_at: '2026-09-10T00:00:00Z' }),
        true
      )
    ).toMatch(/confirm the handoff/i)
    expect(actionLabel(tx({ type: 'build' }), true)).toMatch(/take it on or decline/i)
  })
})
