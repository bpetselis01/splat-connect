import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChildWizard } from '@/components/child-wizard'
import type { ChildProfile } from '@splat-connect/types'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/onboarding/child',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn(), patch: vi.fn() },
}))

import { browserApiClient } from '@/lib/browser-api-client'

const saved = { id: 'c1', everyday_needs: [] } as unknown as ChildProfile
const heading = (name: string) => screen.findByRole('heading', { level: 1, name })

describe('ChildWizard', () => {
  beforeEach(() => {
    push.mockClear()
    vi.mocked(browserApiClient.post).mockReset().mockResolvedValue(saved)
    vi.mocked(browserApiClient.patch).mockReset().mockResolvedValue(saved)
  })

  it('walks name, the four switch questions and the room, skipping without saving', async () => {
    render(<ChildWizard child={null} />)
    for (const h of [
      'Who are we finding toys for?',
      'Which hand does most of the work?',
      'How much force can they apply?',
      'Can they aim at a target?',
      'How long can they hold a press?',
      'What matters in the room?',
    ]) {
      await heading(h)
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    }
    expect(push).toHaveBeenCalledWith('/library')
    expect(browserApiClient.post).not.toHaveBeenCalled()
    expect(browserApiClient.patch).not.toHaveBeenCalled()
    expect(screen.queryByText(/MACS|BFMF|measure/i)).not.toBeInTheDocument()
  })

  it('saves each answered step on Continue: create first, then only that step', async () => {
    render(<ChildWizard child={null} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Sam'), { target: { value: 'Sam' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await heading('Which hand does most of the work?')
    expect(browserApiClient.post).toHaveBeenCalledWith('/api/child-profiles', { name: 'Sam' })

    fireEvent.click(screen.getByRole('button', { name: 'Left' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await heading('How much force can they apply?')
    expect(browserApiClient.patch).toHaveBeenLastCalledWith('/api/child-profiles/c1', { working_hand: 'left' })

    // Continue with nothing picked is a skip — no write.
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await heading('Can they aim at a target?')
    expect(browserApiClient.patch).toHaveBeenCalledTimes(1)
  })

  it('saves the everyday needs on the last step and finishes to the guides', async () => {
    render(<ChildWizard child={null} />)
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await heading('What matters in the room?')
    fireEvent.click(screen.getByRole('button', { name: 'Quiet toys only' }))
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/library'))
    expect(browserApiClient.post).toHaveBeenCalledWith('/api/child-profiles', { everyday_needs: ['quiet'] })
  })
})
