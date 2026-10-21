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

  it('does not count a crawler, and still answers', async () => {
    mockRpc.mockReset().mockResolvedValue({ error: null })
    const res = await publicRoutes.request('/tutorials/g1', {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    })
    expect(res.status).toBe(200)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('counts a browser', async () => {
    mockRpc.mockReset().mockResolvedValue({ error: null })
    await publicRoutes.request('/tutorials/g1', {
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1' },
    })
    expect(mockRpc).toHaveBeenCalledWith('bump_tutorial_view', { p_tutorial_id: 'g1' })
  })
})
