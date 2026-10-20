import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`)
})
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }))
const getCapabilities = vi.fn()
vi.mock('@/lib/capabilities', () => ({ getCapabilities: () => getCapabilities() }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('@/components/child-wizard', () => ({ ChildWizard: () => null }))

import ChildWizardPage from '@/app/onboarding/child/page'

describe('onboarding child page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('WA21 sends a signed-out visitor to /login with the page as ?next=', async () => {
    getCapabilities.mockResolvedValue(null)
    await expect(ChildWizardPage()).rejects.toThrow('NEXT_REDIRECT /login?next=%2Fonboarding%2Fchild')
    expect(redirect).toHaveBeenCalledWith('/login?next=%2Fonboarding%2Fchild')
  })
})
