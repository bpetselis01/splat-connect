// packages/mobile/tests/unit/lib/builds.test.ts
//
// A build's stages alternate sides — the maker owes a working shot, then the
// family owes an approval, then both owe a code — so every case below is a
// (stage, viewer) pair. The wrong answer on either axis shows someone a button
// the API refuses, or hides the one thing they are waiting to do.
import { buildCard, buildControls, buildRail, threadHref } from '../../../lib/builds'

const FAMILY = 'family1'
const MAKER = 'maker1'
const STRANGER = 'maker2'

const tx = (over: object = {}) => ({
  status: 'accepted' as const,
  requester_id: FAMILY,
  owner_id: MAKER as string | null,
  owner_org_id: null as string | null,
  owner_confirmed_at: null as string | null,
  requester_confirmed_at: null as string | null,
  working_photo_url: null as string | null,
  work_approved_at: null as string | null,
  travel_km: 10 as number | null,
  ...over,
})

const open = tx({ status: 'requested', owner_id: null })
const building = tx()
const shot = tx({ working_photo_url: 'tx1/shot.jpg' })
const approved = tx({ working_photo_url: 'tx1/shot.jpg', work_approved_at: '2026-09-01T00:00:00Z' })
const states = (t: object) => buildRail(t as ReturnType<typeof tx>).map((s) => s.state)

describe('threadHref', () => {
  it('opens a build in the build thread and anything else in the exchange thread', () => {
    expect(threadHref({ id: 'tx1', type: 'build' })).toBe('/exchanges/build/tx1')
    expect(threadHref({ id: 'tx1', type: 'exchange' })).toBe('/exchanges/tx1')
    expect(threadHref({ id: 'tx1', type: 'donation' })).toBe('/exchanges/tx1')
  })
})

describe('buildRail', () => {
  it('walks Asked → Claimed → Photo → Handover with the step', () => {
    expect(states(open)).toEqual(['done', 'now', 'todo', 'todo'])
    expect(states(building)).toEqual(['done', 'done', 'now', 'todo'])
    // A posted shot is not done until the family approves it.
    expect(states(shot)).toEqual(['done', 'done', 'now', 'todo'])
    expect(states(approved)).toEqual(['done', 'done', 'done', 'now'])
    expect(states({ ...approved, status: 'completed' })).toEqual(['done', 'done', 'done', 'done'])
  })

  it('stops a closed-early build where the row says it got to', () => {
    expect(states({ ...open, status: 'rejected' })).toEqual(['done', 'stop', 'todo', 'todo'])
    expect(states({ ...building, status: 'withdrawn' })).toEqual(['done', 'stop', 'todo', 'todo'])
    expect(states({ ...shot, status: 'withdrawn' })).toEqual(['done', 'done', 'stop', 'todo'])
    expect(states({ ...approved, status: 'withdrawn' })).toEqual(['done', 'done', 'done', 'stop'])
  })
})

describe('buildControls', () => {
  it('lets anyone but the family claim an unclaimed request, and nobody claim a taken one', () => {
    expect(buildControls(open, STRANGER).canClaim).toBe(true)
    expect(buildControls(open, FAMILY).canClaim).toBe(false)
    expect(buildControls(tx({ status: 'requested' }), STRANGER).canClaim).toBe(false)
  })

  it('lets the named maker answer an addressed request', () => {
    const addressed = tx({ status: 'requested' })
    expect(buildControls(addressed, MAKER).canAnswer).toBe(true)
    expect(buildControls(addressed, FAMILY).canAnswer).toBe(false)
  })

  it('gives the working shot to the maker and the approval to the family', () => {
    expect(buildControls(building, MAKER).canPostShot).toBe(true)
    expect(buildControls(building, FAMILY).canPostShot).toBe(false)
    expect(buildControls(building, FAMILY).canApprove).toBe(false)
    // The maker may replace an unapproved shot; the family approves it.
    expect(buildControls(shot, MAKER).canPostShot).toBe(true)
    expect(buildControls(shot, MAKER).canApprove).toBe(false)
    expect(buildControls(shot, FAMILY).canApprove).toBe(true)
    // After approval a new shot would reset the family's yes.
    expect(buildControls(approved, MAKER).canPostShot).toBe(false)
    expect(buildControls(approved, FAMILY).canApprove).toBe(false)
  })

  it('shows both codes only once the shot is approved', () => {
    expect(buildControls(shot, MAKER).showCode).toBe(false)
    expect(buildControls(approved, MAKER).showCode).toBe(true)
    expect(buildControls(approved, FAMILY).showCode).toBe(true)
    expect(buildControls({ ...approved, owner_confirmed_at: 'x' }, MAKER).confirmed).toBe(true)
    expect(buildControls({ ...approved, owner_confirmed_at: 'x' }, FAMILY).confirmed).toBe(false)
  })

  it('treats a leader of the maker organisation as the maker', () => {
    const orgBuild = tx({ owner_id: null, owner_org_id: 'org1' })
    expect(buildControls(orgBuild, 'leader1', ['org1']).canPostShot).toBe(true)
    expect(buildControls(orgBuild, 'leader1').canPostShot).toBe(false)
  })

  it('lets only the two parties talk or withdraw, and only while it is live', () => {
    expect(buildControls(building, STRANGER).canMessage).toBe(false)
    expect(buildControls(building, FAMILY).canWithdraw).toBe(true)
    expect(buildControls(building, MAKER).canWithdraw).toBe(true)
    expect(buildControls({ ...approved, status: 'completed' }, FAMILY).canWithdraw).toBe(false)
  })
})

describe('buildCard', () => {
  const kicker = (t: object, viewer: string) => buildCard(t as ReturnType<typeof tx>, viewer, 'Tom').kicker

  it('says whose move it is at every stage, from both sides', () => {
    expect(kicker(open, FAMILY)).toBe('Waiting')
    expect(kicker(open, STRANGER)).toBe('Needs a maker')
    expect(kicker(building, MAKER)).toBe('Your build')
    expect(kicker(building, FAMILY)).toBe('Live')
    expect(kicker(shot, MAKER)).toBe('Waiting')
    expect(kicker(shot, FAMILY)).toBe('Needs you')
    expect(kicker(approved, MAKER)).toBe('Needs you')
    expect(kicker({ ...approved, requester_confirmed_at: 'x' }, FAMILY)).toBe('Waiting')
    expect(kicker({ ...approved, status: 'completed' }, FAMILY)).toBe('Handed over')
    expect(kicker({ ...building, status: 'withdrawn' }, FAMILY)).toBe('Withdrawn')
  })

  it('names the maker to the family, and the family range on an open ask', () => {
    expect(buildCard(building, FAMILY, 'Tom').title).toBe('Tom is building it')
    expect(buildCard(open, FAMILY, '').body).toContain('within 10 km')
  })
})
