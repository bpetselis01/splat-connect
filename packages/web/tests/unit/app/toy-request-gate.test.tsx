import { describe, it, expect, vi, beforeEach } from 'vitest'
import RequestToyPage from '@/app/toy-library/[id]/request/page'

const { mockGetCapabilities } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  notFound: vi.fn(),
}))

const visit = (mode?: string) =>
  RequestToyPage({ params: Promise.resolve({ id: 't1' }), searchParams: Promise.resolve(mode === undefined ? {} : { mode }) })

beforeEach(() => mockGetCapabilities.mockResolvedValue(null))

describe('the toy request page, signed out', () => {
  it.each(['exchange', 'donation'])('WY07 keeps ?mode=%s on the way back from sign-in', async (mode) => {
    await expect(visit(mode)).rejects.toThrow(`REDIRECT:/login?next=%2Ftoy-library%2Ft1%2Frequest%3Fmode%3D${mode}`)
  })

  it('WY07 sends the bare path when ?mode= is absent', async () => {
    await expect(visit()).rejects.toThrow('REDIRECT:/login?next=%2Ftoy-library%2Ft1%2Frequest')
  })

  it('WY07 drops a ?mode= that is not donation or exchange', async () => {
    await expect(visit('evil')).rejects.toThrow('REDIRECT:/login?next=%2Ftoy-library%2Ft1%2Frequest')
  })
})
