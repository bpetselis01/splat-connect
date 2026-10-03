// Outlier rows for the build rules: stranger and missing viewers, completed and
// closed builds, a rejected build that somehow has a photo, empty names.
import { buildCard, buildControls, buildRail } from '../../../lib/builds'

const FAMILY = 'family1'
const MAKER = 'maker1'
const STRANGER = 'maker2'
const tx = (over: object = {}) => ({
  status: 'accepted' as 'requested' | 'accepted' | 'completed' | 'rejected' | 'withdrawn',
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
const SHOT = 'tx1/shot.jpg'
const NOW = '2026-09-01T00:00:00Z'
const approved = tx({ working_photo_url: SHOT, work_approved_at: NOW })

describe('a stranger and nobody', () => {
  it('lets a stranger do nothing on a live build', () => {
    const c = buildControls(approved, STRANGER)
    expect(c).toMatchObject({
      isMaker: false,
      isFamily: false,
      canClaim: false,
      canAnswer: false,
      canPostShot: false,
      canApprove: false,
      showCode: false,
      canMessage: false,
      canWithdraw: false,
    })
  })

  it('lets an empty viewer id do nothing, even on a request nobody has claimed', () => {
    const c = buildControls(tx({ status: 'requested', owner_id: null }), '')
    expect(c.isFamily).toBe(false)
    expect(c.canMessage).toBe(false)
    expect(c.canWithdraw).toBe(false)
  })

  it('lets only a stranger, never the family, claim — even a leader of an organisation the family is not in', () => {
    const open = tx({ status: 'requested', owner_id: null })
    expect(buildControls(open, STRANGER, ['some-org']).canClaim).toBe(true)
    expect(buildControls(open, FAMILY, ['some-org']).canClaim).toBe(false)
  })

  it('does not treat a leader of some other organisation as the maker', () => {
    const orgBuild = tx({ owner_id: null, owner_org_id: 'org1', working_photo_url: SHOT })
    expect(buildControls(orgBuild, STRANGER, ['org2']).isMaker).toBe(false)
    expect(buildControls(orgBuild, STRANGER, ['org1']).isMaker).toBe(true)
    expect(buildControls(orgBuild, STRANGER, ['org1']).canPostShot).toBe(true)
  })
})

describe('finished builds', () => {
  it.each(['completed', 'rejected', 'withdrawn'] as const)('lets nobody act on a %s build', (status) => {
    for (const viewer of [FAMILY, MAKER]) {
      const c = buildControls(tx({ status, working_photo_url: SHOT, work_approved_at: NOW }), viewer)
      expect(c).toMatchObject({ canMessage: false, canWithdraw: false, canPostShot: false, canApprove: false, showCode: false, canAnswer: false })
    }
  })

  it('does not show the family an approval for a withdrawn build that has a shot', () => {
    expect(buildControls(tx({ status: 'withdrawn', working_photo_url: SHOT }), FAMILY).canApprove).toBe(false)
  })

  it('does not offer a claim once a maker holds the build, whatever its status', () => {
    expect(buildControls(tx({ status: 'accepted' }), STRANGER).canClaim).toBe(false)
    expect(buildControls(tx({ status: 'completed' }), STRANGER).canClaim).toBe(false)
  })
})

describe('the code', () => {
  it('reads confirmation off the viewer’s own side only', () => {
    const t = tx({ working_photo_url: SHOT, work_approved_at: NOW, owner_confirmed_at: NOW })
    expect(buildControls(t, MAKER).confirmed).toBe(true)
    expect(buildControls(t, FAMILY).confirmed).toBe(false)
  })

  it('shows the code to the family and the maker once approved, and not to a stranger', () => {
    expect(buildControls(approved, FAMILY).showCode).toBe(true)
    expect(buildControls(approved, MAKER).showCode).toBe(true)
    expect(buildControls(approved, STRANGER).showCode).toBe(false)
  })

  it('does not show a code for an approval stamp on a build that is not accepted', () => {
    expect(buildControls(tx({ status: 'requested', work_approved_at: NOW }), FAMILY).showCode).toBe(false)
  })
})

describe('rail', () => {
  const states = (t: object) => buildRail(t as ReturnType<typeof tx>).map((s) => s.state)

  it('always has four labelled dots', () => {
    expect(buildRail(approved).map((s) => s.label)).toEqual(['Asked', 'Claimed', 'Photo', 'Handover'])
  })

  it('stops a withdrawn build at Handover when only a confirmation survived', () => {
    expect(states(tx({ status: 'withdrawn', requester_confirmed_at: NOW }))).toEqual(['done', 'done', 'done', 'stop'])
    expect(states(tx({ status: 'withdrawn', owner_confirmed_at: NOW }))).toEqual(['done', 'done', 'done', 'stop'])
  })

  it('stops a declined build at Claimed even if a stray photo is on the row', () => {
    expect(states(tx({ status: 'rejected', working_photo_url: SHOT }))).toEqual(['done', 'stop', 'todo', 'todo'])
  })

  it('marks every dot done on a completed build with no photo on the row', () => {
    expect(states(tx({ status: 'completed' }))).toEqual(['done', 'done', 'done', 'done'])
  })
})

describe('the card', () => {
  const card = (t: object, viewer: string, other = 'Tom', led: string[] = []) => buildCard(t as ReturnType<typeof tx>, viewer, other, led)

  it('says "The maker" when the other side has no name', () => {
    expect(card(tx(), FAMILY, '').title).toBe('The maker is building it')
  })

  it('says "them" when the other side has no name on a confirmed handover', () => {
    expect(card({ ...approved, requester_confirmed_at: NOW }, FAMILY, '').title).toBe('Waiting on them to confirm')
  })

  it('names the maker’s range on an open ask and falls back when there is none', () => {
    const open = tx({ status: 'requested', owner_id: null })
    expect(card({ ...open, travel_km: 25 }, FAMILY).body).toBe(
      'On Makers wanted for makers within 25 km. You will hear here the moment someone takes it on.'
    )
    expect(card({ ...open, travel_km: null }, FAMILY).body).toBe('On Makers wanted. You will hear here the moment someone takes it on.')
    expect(card({ ...open, travel_km: 0 }, FAMILY).body).toBe('On Makers wanted. You will hear here the moment someone takes it on.')
  })

  it('tells a stranger a claimed-by-someone-else request is waiting for an answer, not claimable', () => {
    const addressed = tx({ status: 'requested' })
    expect(card(addressed, STRANGER).title).toBe('Waiting for an answer')
  })

  it('has a kicker, title and body for every status and viewer — nothing blank', () => {
    const statuses = ['requested', 'accepted', 'completed', 'rejected', 'withdrawn'] as const
    const extras = [{}, { working_photo_url: SHOT }, { working_photo_url: SHOT, work_approved_at: NOW }, { owner_id: null }]
    for (const status of statuses)
      for (const extra of extras)
        for (const viewer of [FAMILY, MAKER, STRANGER, '']) {
          const c = card(tx({ status, ...extra }), viewer)
          expect([c.kicker, c.title, c.body].every((s) => s.length > 0)).toBe(true)
        }
  })

  it('tells a rejected build from a withdrawn one in the kicker and title', () => {
    expect(card(tx({ status: 'rejected' }), FAMILY)).toMatchObject({ kicker: 'Not taken on', title: 'This one did not go ahead' })
    expect(card(tx({ status: 'withdrawn' }), FAMILY)).toMatchObject({ kicker: 'Withdrawn', title: 'This request was withdrawn' })
  })
})
