import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCapabilities = vi.fn()
const headerValue = vi.fn()
vi.mock('@/lib/capabilities', () => ({ getCapabilities: () => getCapabilities() }))
vi.mock('next/headers', () => ({ headers: async () => ({ get: (k: string) => headerValue(k) }) }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`)
  },
}))

import { requireCapabilities } from '@/lib/require-capabilities'

beforeEach(() => {
  vi.clearAllMocks()
  getCapabilities.mockResolvedValue(null)
})

describe('requireCapabilities', () => {
  it('returns the capabilities when signed in', async () => {
    getCapabilities.mockResolvedValue({ isAdmin: false })
    await expect(requireCapabilities()).resolves.toEqual({ isAdmin: false })
  })

  it('sends a signed-out visitor to /login keeping the path and query', async () => {
    headerValue.mockReturnValue('/dashboard/printing?tab=jobs')
    await expect(requireCapabilities()).rejects.toThrow('redirect /login?next=%2Fdashboard%2Fprinting%3Ftab%3Djobs')
    expect(headerValue).toHaveBeenCalledWith('x-pathname-search')
  })

  it('sends a bare /login when the path header is absent', async () => {
    headerValue.mockReturnValue(null)
    await expect(requireCapabilities()).rejects.toThrow('redirect /login')
  })
})
