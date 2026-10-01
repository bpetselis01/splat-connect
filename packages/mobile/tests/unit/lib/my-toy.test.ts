import { loadOwnedToy, toySummaryLead } from '../../../lib/my-toy'

const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const toy = (over: object) => ({ id: 't1', owner_id: 'me', owner_org_id: null, name: 'Light-up drum', condition: 8, switch_adapted: true, status: 'published', created_at: '2026-06-04T12:00:00Z', ...over })

describe('toySummaryLead', () => {
  it("says the board's sentence", () => {
    expect(toySummaryLead(toy({}) as never, 2)).toBe(
      'Light-up drum — listed 4 June, good condition, switch-adapted. 2 families have asked for it.'
    )
  })
  it('says one family, and nothing about asking when nobody has', () => {
    expect(toySummaryLead(toy({}) as never, 1)).toMatch(/ 1 family has asked for it\.$/)
    expect(toySummaryLead(toy({ switch_adapted: false }) as never, 0)).toBe('Light-up drum — listed 4 June, good condition.')
  })
  it('does not say listed for a draft', () => {
    expect(toySummaryLead(toy({ status: 'draft', condition: 9, switch_adapted: false }) as never, 0)).toBe('Light-up drum, like new condition.')
  })
})

describe('loadOwnedToy', () => {
  beforeEach(() => mockGet.mockReset())

  it('finds a personal toy without asking for the shelf', async () => {
    mockGet.mockResolvedValueOnce([toy({})])
    expect((await loadOwnedToy('t1'))?.toy.id).toBe('t1')
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it("falls back to the organisation's inventory, and returns that org's shelf", async () => {
    mockGet
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([toy({ id: 'o1', owner_id: null, owner_org_id: 'org1' }), toy({ id: 'o2', owner_id: null, owner_org_id: 'org2' })])
    const owned = await loadOwnedToy('o1')
    expect(owned?.toy.id).toBe('o1')
    expect(owned?.shelf.map((t) => t.id)).toEqual(['o1'])
    expect(mockGet).toHaveBeenLastCalledWith('/api/toys/inventory')
  })

  it('is null for a toy the caller does not hold', async () => {
    mockGet.mockResolvedValue([])
    expect(await loadOwnedToy('nope')).toBeNull()
  })
})
