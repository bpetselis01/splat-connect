import { describe, it, expect } from 'vitest'
import { givenAway } from '@splat-connect/types'
import type { ToyTransactionSummary } from '@splat-connect/types'

// Lives here rather than in packages/types, which has no test runner — the same
// arrangement as toy-transaction-action.test.ts and estimate-ability.

function tx(overrides: Partial<ToyTransactionSummary> = {}): ToyTransactionSummary {
  return {
    id: 'tx-1',
    toy_id: 'toy-1',
    offered_toy_id: null,
    owner_id: 'owner-1',
    owner_org_id: null,
    requester_id: 'requester-1',
    type: 'donation',
    status: 'completed',
    owner_confirmed_at: '2026-08-12T00:00:00Z',
    requester_confirmed_at: null,
    owner_code: null,
    requester_code: null,
    pickup_line1: null,
    pickup_suburb: null,
    pickup_state: null,
    pickup_postcode: null,
    pickup_instructions: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-12T00:00:00Z',
    toy_name: 'Fire truck',
    toy_cover_photo_url: 'https://example.invalid/fire-truck.jpg',
    offered_toy_name: null,
    offered_toy_cover_photo_url: null,
    other_party_name: 'Priya',
    acting_for_org_name: null,
    blocked_by_rival_accept: false,
    last_message: null,
    ...overrides,
  } as ToyTransactionSummary
}

describe('givenAway', () => {
  it('gives the owner of a completed donation the toy they handed over', () => {
    const [row] = givenAway([tx()], 'owner-1')
    expect(row).toMatchObject({
      transaction_id: 'tx-1',
      toy_id: 'toy-1',
      name: 'Fire truck',
      cover_photo_url: 'https://example.invalid/fire-truck.jpg',
      other_party_name: 'Priya',
      type: 'donation',
      received_name: null,
      at: '2026-08-12T00:00:00Z',
    })
  })

  it('gives the requester of a donation nothing — they received, they did not give', () => {
    expect(givenAway([tx()], 'requester-1')).toEqual([])
  })

  it('gives each side of an exchange the toy that side let go of', () => {
    const swap = tx({
      type: 'exchange',
      offered_toy_id: 'toy-2',
      offered_toy_name: 'Spinning top',
      offered_toy_cover_photo_url: 'https://example.invalid/top.jpg',
    })

    const [ownerRow] = givenAway([swap], 'owner-1')
    expect(ownerRow).toMatchObject({
      toy_id: 'toy-1',
      name: 'Fire truck',
      // What came back, so the row can say what it was swapped for.
      received_name: 'Spinning top',
    })

    const [requesterRow] = givenAway([swap], 'requester-1')
    expect(requesterRow).toMatchObject({
      toy_id: 'toy-2',
      name: 'Spinning top',
      cover_photo_url: 'https://example.invalid/top.jpg',
      received_name: 'Fire truck',
    })
  })

  it('gives the requester of an exchange nothing when no toy was actually offered', () => {
    // type says exchange but offered_toy_id never got set: there is no toy of
    // theirs that changed hands, so there is nothing to list.
    expect(givenAway([tx({ type: 'exchange' })], 'requester-1')).toEqual([])
  })

  it('counts only completed handoffs', () => {
    for (const status of ['requested', 'accepted', 'rejected', 'withdrawn'] as const) {
      expect(givenAway([tx({ status })], 'owner-1')).toEqual([])
    }
  })

  it("leaves an organisation's stock out of a leader's personal list", () => {
    // isOwnerSide says yes for a leader, so this needs excluding on purpose: a
    // unit leaving org stock is inventory, not something the leader gave away.
    const orgHandoff = tx({ owner_id: null, owner_org_id: 'org-1' })
    expect(givenAway([orgHandoff], 'leader-1', ['org-1'])).toEqual([])
  })

  it('still lists what a leader gave from their own shelf', () => {
    expect(givenAway([tx()], 'owner-1', ['org-1'])).toHaveLength(1)
  })

  it('orders newest handoff first', () => {
    const older = tx({ id: 'tx-old', updated_at: '2026-08-01T00:00:00Z', toy_name: 'Older' })
    const newer = tx({ id: 'tx-new', updated_at: '2026-08-20T00:00:00Z', toy_name: 'Newer' })
    expect(givenAway([older, newer], 'owner-1').map((r) => r.name)).toEqual(['Newer', 'Older'])
  })

  it('survives a toy whose name or photo never came back', () => {
    const row = givenAway([tx({ toy_name: '', toy_cover_photo_url: null })], 'owner-1')[0]
    expect(row.name).toBe('')
    expect(row.cover_photo_url).toBeNull()
  })
})
