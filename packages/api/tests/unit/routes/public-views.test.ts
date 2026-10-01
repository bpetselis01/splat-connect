import { describe, it, expect, vi } from 'vitest'

const chain: Record<string, unknown> = {}
for (const m of ['from', 'select', 'eq', 'order']) chain[m] = () => chain
chain.single = async () => ({ data: { id: 'g1', title: 'Guide', tutorial_orgs: [], tutorial_recommendations: [], tutorial_contributors: [] }, error: null })
const mockRpc = vi.fn()
vi.mock('../../../src/supabase/client.js', () => ({
  createAnonClient: () => chain,
  createAdminClient: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }),
}))

const { default: publicRoutes } = await import('../../../src/routes/public.js')

describe('GET /tutorials/:id views', () => {
  it('still answers when the view cannot be counted', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'function bump_tutorial_view does not exist' } })
    const res = await publicRoutes.request('/tutorials/g1')
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('bump_tutorial_view', { p_tutorial_id: 'g1' })
  })

  it('still answers when the call throws', async () => {
    mockRpc.mockRejectedValue(new Error('fetch failed'))
    expect((await publicRoutes.request('/tutorials/g1')).status).toBe(200)
  })
})
