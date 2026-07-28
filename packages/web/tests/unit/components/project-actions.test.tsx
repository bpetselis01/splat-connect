import { describe, it, expect } from 'vitest'
import { leaderActions, adminActions } from '@/components/project-actions'

describe('leaderActions', () => {
  // Tests: a pending request offers the backing decision, not the review one
  // Chain: this is the hole — the leader's page refused anything not already
  //        accepted, so the act of deciding whether to back had nowhere to happen
  it('offers back and decline while the request is pending', () => {
    expect(leaderActions('pending', 'pending')).toEqual(['back', 'decline'])
    expect(leaderActions('pending', 'draft')).toEqual(['back', 'decline'])
  })

  it('offers the review decision once backing is accepted', () => {
    expect(leaderActions('accepted', 'pending')).toEqual(['approve', 'reject'])
  })

  // Tests: nothing is actionable once published or declined
  // Chain: a leader cannot unpublish — only the admin can — and a declined request
  //        is finished. Offering buttons the database refuses is the failure the
  //        contributor surfaces already learned to avoid
  it('offers nothing once the tutorial is published', () => {
    expect(leaderActions('accepted', 'approved')).toEqual([])
  })

  it('offers nothing once the request was declined', () => {
    expect(leaderActions('declined', 'pending')).toEqual([])
  })

  it('offers nothing when this organisation was never asked', () => {
    expect(leaderActions(null, 'pending')).toEqual([])
  })
})

describe('adminActions', () => {
  it('offers approve and reject while pending', () => {
    expect(adminActions('pending')).toEqual(['approve', 'reject'])
  })

  // Tests: the admin can take down published work
  // Chain: decision 14 removed the self-review block on the argument that the
  //        controls are reactive — this is that control, and it was unreachable
  it('offers unpublish once approved', () => {
    expect(adminActions('approved')).toEqual(['unpublish'])
  })

  it('offers nothing on a rejected tutorial', () => {
    expect(adminActions('rejected')).toEqual([])
  })
})
