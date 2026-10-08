import { describe, it, expect, vi } from 'vitest'

let mockResult: { data: unknown; error: unknown } = { data: null, error: null }
const chain: Record<string, unknown> = {}
for (const m of ['from', 'select', 'eq', 'order']) chain[m] = () => chain
chain.single = async () => mockResult
vi.mock('../../src/supabase/client.js', () => ({
  createAnonClient: () => chain,
  createAdminClient: () => ({ rpc: async () => ({ error: null }) }),
}))

const { default: publicRoutes } = await import('../../src/routes/public.js')

describe('GET /tutorials/:id when the read fails', () => {
  it('is a 404 when no approved guide has that id', async () => {
    mockResult = { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
    expect((await publicRoutes.request('/tutorials/missing')).status).toBe(404)
  })

  it('is a 500, not a 404, when the database times out', async () => {
    mockResult = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }
    expect((await publicRoutes.request('/tutorials/g1')).status).toBe(500)
  })
})
