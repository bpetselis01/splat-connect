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

  it('WA20 walks age, the four child questions and the notes, skipping without saving', async () => {
    render(<ChildWizard child={null} />)
    for (const h of [
      'How old is your child?',
      'What would help your child day to day?',
      'How does your child start or control things?',
      'How hard can your child press?',
      'What does your child enjoy?',
      'Good to know',
    ]) {
      await heading(h)
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    }
    expect(push).toHaveBeenCalledWith('/library')
    expect(browserApiClient.post).not.toHaveBeenCalled()
    expect(browserApiClient.patch).not.toHaveBeenCalled()
    expect(screen.queryByText(/MACS|BFMF|measure/i)).not.toBeInTheDocument()
  })

  it('asks for no name', () => {
    render(<ChildWizard child={null} />)
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument()
  })

  it('WA19 saves each answered step on Continue: create first, then only that step', async () => {
    render(<ChildWizard child={null} />)
    fireEvent.change(screen.getByLabelText('Age in years'), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await heading('What would help your child day to day?')
    expect(browserApiClient.post).toHaveBeenCalledWith('/api/child-profiles', { age: 6 })

    fireEvent.click(screen.getByRole('button', { name: 'Seeing' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await heading('How does your child start or control things?')
    expect(browserApiClient.patch).toHaveBeenLastCalledWith('/api/child-profiles/c1', { helps_with: ['seeing'] })

    // The One hand chip is a flag saved with the access list.
    fireEvent.click(screen.getByRole('button', { name: 'One hand is enough' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await heading('How hard can your child press?')
    expect(browserApiClient.patch).toHaveBeenLastCalledWith('/api/child-profiles/c1', { one_hand: true })

    // Continue with nothing picked is a skip — no write.
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await heading('What does your child enjoy?')
    expect(browserApiClient.patch).toHaveBeenCalledTimes(2)
  })

  it('WA19 saves the everyday needs on the last step and finishes to the guides', async () => {
    render(<ChildWizard child={null} />)
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await heading('Good to know')
    fireEvent.click(screen.getByRole('button', { name: 'Quiet toys only' }))
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/library'))
    expect(browserApiClient.post).toHaveBeenCalledWith('/api/child-profiles', { everyday_needs: ['quiet'] })
  })

  it('WA20 Back returns to the previous question and is disabled on the first', async () => {
    render(<ChildWizard child={null} />)
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await heading('What would help your child day to day?')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await heading('How old is your child?')
    expect(browserApiClient.post).not.toHaveBeenCalled()
  })

  it('WA20 the Back to guides link goes to /library', () => {
    render(<ChildWizard child={null} />)
    expect(screen.getByRole('link', { name: 'Back to guides' })).toHaveAttribute('href', '/library')
  })

  it('WA19 PATCHes the existing profile when the wizard opens on one', async () => {
    render(<ChildWizard child={{ id: 'c9', age: 4, everyday_needs: [] } as unknown as ChildProfile} />)
    fireEvent.change(screen.getByLabelText('Age in years'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await heading('What would help your child day to day?')
    expect(browserApiClient.patch).toHaveBeenCalledWith('/api/child-profiles/c9', { age: 5 })
    expect(browserApiClient.post).not.toHaveBeenCalled()
  })
})
