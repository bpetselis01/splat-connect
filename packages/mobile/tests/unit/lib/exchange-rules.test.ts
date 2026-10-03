// Who an exchange is waiting on, which stage it is at, and which toys a person
// gave away. Stages past requested/accepted are timestamps, never statuses
// (toy_transactions is polymorphic), so every rule here reads timestamps.
import { actionLabel, givenAway, isOwnerSide, needsAction } from '@splat-connect/types'
import { stageRail } from '../../../components/exchanges/thread-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => ({ session: null }) }))
jest.mock('../../../lib/api-client', () => ({ apiClient: {} }))
jest.mock('expo-router', () => ({ useFocusEffect: () => {}, useRouter: () => ({}) }))
jest.mock('expo-clipboard', () => ({}))
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null }) }))

const tx = (over: object = {}) => ({
  id: 'tx1', type: 'donation', status: 'requested', owner_id: 'owner', owner_org_id: null, requester_id: 'fam',
  owner_confirmed_at: null, requester_confirmed_at: null, working_photo_url: null, work_approved_at: null,
  printing_started_at: null, ready_at: null, blocked_by_rival_accept: false, created_at: '2026-10-01T00:00:00Z', ...over,
}) as never

describe('isOwnerSide', () => {
  it('is the owner for a personal toy, and nobody else', () => {
    expect(isOwnerSide({ owner_id: 'owner', owner_org_id: null }, 'owner')).toBe(true)
    expect(isOwnerSide({ owner_id: 'owner', owner_org_id: null }, 'fam')).toBe(false)
  })

  it('is any leader of the organisation for an organisation toy, and not the person whose id is stale on the row', () => {
    expect(isOwnerSide({ owner_id: null, owner_org_id: 'org1' }, 'anyone', ['org1'])).toBe(true)
    expect(isOwnerSide({ owner_id: null, owner_org_id: 'org1' }, 'anyone', ['org2'])).toBe(false)
    expect(isOwnerSide({ owner_id: 'owner', owner_org_id: 'org1' }, 'owner', [])).toBe(false)
    expect(isOwnerSide({ owner_id: null, owner_org_id: 'org1' }, 'anyone')).toBe(false)
  })
})

describe('needsAction', () => {
  it('waits on the owner while requested, and never on the requester', () => {
    expect(needsAction(tx(), 'owner')).toBe(true)
    expect(needsAction(tx(), 'fam')).toBe(false)
  })

  it('does not wait on an owner whose request is blocked by a rival accept', () => {
    expect(needsAction(tx({ blocked_by_rival_accept: true }), 'owner')).toBe(false)
  })

  it('waits on an organisation leader, but not on one who leads a different organisation', () => {
    const t = tx({ owner_id: null, owner_org_id: 'org1' })
    expect(needsAction(t, 'leader', ['org1'])).toBe(true)
    expect(needsAction(t, 'leader', ['org2'])).toBe(false)
    expect(needsAction(t, 'leader')).toBe(false)
  })

  it.each(['completed', 'rejected', 'withdrawn'])('waits on nobody once %s', (status) => {
    for (const who of ['owner', 'fam']) expect(needsAction(tx({ status }), who)).toBe(false)
  })

  describe('an accepted donation', () => {
    const accepted = (over: object = {}) => tx({ status: 'accepted', ...over })
    it('waits on the owner to confirm, and never on the requester', () => {
      expect(needsAction(accepted(), 'owner')).toBe(true)
      expect(needsAction(accepted(), 'fam')).toBe(false)
    })
    it('stops waiting on the owner once they confirmed', () => {
      expect(needsAction(accepted({ owner_confirmed_at: '2026-10-02T00:00:00Z' }), 'owner')).toBe(false)
    })
  })

  describe('an accepted exchange, which both sides confirm', () => {
    const accepted = (over: object = {}) => tx({ type: 'exchange', status: 'accepted', ...over })
    it('waits on both until each has confirmed', () => {
      expect(needsAction(accepted(), 'owner')).toBe(true)
      expect(needsAction(accepted(), 'fam')).toBe(true)
    })
    it('waits only on the side that has not confirmed', () => {
      const t = accepted({ owner_confirmed_at: '2026-10-02T00:00:00Z' })
      expect(needsAction(t, 'owner')).toBe(false)
      expect(needsAction(t, 'fam')).toBe(true)
    })
    it('waits on nobody once both have confirmed', () => {
      const t = accepted({ owner_confirmed_at: 'x', requester_confirmed_at: 'y' })
      expect(needsAction(t, 'owner')).toBe(false)
      expect(needsAction(t, 'fam')).toBe(false)
    })
  })

  describe('a build, whose middle alternates', () => {
    const accepted = (over: object = {}) => tx({ type: 'build', status: 'accepted', ...over })
    it('waits on the maker for the working shot, then on the family to approve it, then on both to confirm', () => {
      expect([needsAction(accepted(), 'owner'), needsAction(accepted(), 'fam')]).toEqual([true, false])
      const shot = accepted({ working_photo_url: 'p.jpg' })
      expect([needsAction(shot, 'owner'), needsAction(shot, 'fam')]).toEqual([false, true])
      const approved = accepted({ working_photo_url: 'p.jpg', work_approved_at: 'z' })
      expect([needsAction(approved, 'owner'), needsAction(approved, 'fam')]).toEqual([true, true])
    })
  })

  describe('a print job, whose middle is the printer\'s', () => {
    const accepted = (over: object = {}) => tx({ type: 'print', status: 'accepted', ...over })
    it('waits on the printer until it is ready, then on both to confirm', () => {
      expect([needsAction(accepted(), 'owner'), needsAction(accepted(), 'fam')]).toEqual([true, false])
      const ready = accepted({ ready_at: 'r' })
      expect([needsAction(ready, 'owner'), needsAction(ready, 'fam')]).toEqual([true, true])
    })
  })
})

describe('actionLabel', () => {
  it.each([
    [{ status: 'requested', type: 'donation' }, false, 'Waiting on you — accept or decline'],
    [{ status: 'requested', type: 'exchange' }, true, 'Waiting on you — accept or decline'],
    [{ status: 'requested', type: 'build' }, true, 'Waiting on you — take it on or decline'],
    [{ status: 'requested', type: 'print' }, true, 'Waiting on you — take the job or decline'],
    [{ status: 'accepted', type: 'donation' }, true, 'Waiting on you — confirm the handoff'],
    [{ status: 'accepted', type: 'print' }, true, 'Waiting on you — start the print'],
    [{ status: 'accepted', type: 'print', printing_started_at: 's' }, true, 'Waiting on you — mark it ready'],
    [{ status: 'accepted', type: 'print', printing_started_at: 's', ready_at: 'r' }, true, 'Waiting on you — confirm the handoff'],
    [{ status: 'accepted', type: 'build' }, true, 'Waiting on you — post the working shot'],
    [{ status: 'accepted', type: 'build', working_photo_url: 'p' }, false, 'Waiting on you — approve the working shot'],
    [{ status: 'accepted', type: 'build', working_photo_url: 'p', work_approved_at: 'a' }, false, 'Waiting on you — confirm the handoff'],
  ])('says the right line for %j as owner=%s', (t, owner, line) => {
    expect(actionLabel({ working_photo_url: null, work_approved_at: null, printing_started_at: null, ready_at: null, ...t } as never, owner)).toBe(line)
  })
})

describe('stageRail', () => {
  it.each([
    ['requested', null, ['current', 'todo', 'todo', 'todo']],
    ['accepted', 'code', ['done', 'done', 'current', 'todo']],
    ['completed', 'code', ['done', 'done', 'done', 'done']],
    ['rejected', null, ['done', 'todo', 'todo', 'done']],
    ['withdrawn', null, ['done', 'todo', 'todo', 'done']],
    ['withdrawn', '123456', ['done', 'done', 'todo', 'done']],
  ])('draws %s with owner_code %j as %j', (status, owner_code, rail) => {
    expect(stageRail({ status, owner_code } as never)).toEqual(rail)
  })
})

describe('givenAway', () => {
  const done = (over: object = {}) => ({
    id: 'tx1', type: 'donation', status: 'completed', toy_id: 'toy1', toy_name: 'Drum', toy_cover_photo_url: 'd.jpg', offered_toy_id: null,
    offered_toy_name: null, offered_toy_cover_photo_url: null, owner_id: 'me', owner_org_id: null, requester_id: 'fam',
    other_party_name: 'Fam', updated_at: '2026-10-01T00:00:00Z', ...over,
  }) as never

  it('is empty for no transactions', () => {
    expect(givenAway([], 'me')).toEqual([])
  })

  it('lists a donation the viewer made, and not one they received', () => {
    expect(givenAway([done()], 'me').map((r) => r.name)).toEqual(['Drum'])
    expect(givenAway([done()], 'fam')).toEqual([])
  })

  it('lists both halves of a swap, each to the person who gave it', () => {
    const swap = done({ type: 'exchange', offered_toy_id: 'toy2', offered_toy_name: 'Car', offered_toy_cover_photo_url: 'c.jpg' })
    expect(givenAway([swap], 'me')[0]).toMatchObject({ name: 'Drum', received_name: 'Car', toy_id: 'toy1' })
    expect(givenAway([swap], 'fam')[0]).toMatchObject({ name: 'Car', received_name: 'Drum', toy_id: 'toy2' })
  })

  it('leaves out anything not completed, every organisation transaction, and a transaction with no toy', () => {
    const rows = [done({ id: 'a', status: 'accepted' }), done({ id: 'b', status: 'withdrawn' }), done({ id: 'c', owner_org_id: 'org1', owner_id: null }), done({ id: 'd', toy_id: null, type: 'build' })]
    expect(givenAway(rows, 'me', ['org1'])).toEqual([])
  })

  it('gives a swap-typed row with no offered toy nothing to the requester', () => {
    expect(givenAway([done({ type: 'exchange' })], 'fam')).toEqual([])
  })

  it('orders newest first, and keeps two with the same time', () => {
    const rows = [done({ id: 'old', updated_at: '2026-01-01T00:00:00Z' }), done({ id: 'new', updated_at: '2026-09-01T00:00:00Z' }), done({ id: 'same', updated_at: '2026-09-01T00:00:00Z' })]
    const ids = givenAway(rows, 'me').map((r) => r.transaction_id)
    expect(ids[2]).toBe('old')
    expect(ids).toHaveLength(3)
  })
})
