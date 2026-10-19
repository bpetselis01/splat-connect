import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FollowWriteup } from '@/components/follow-writeup'
import { browserApiClient } from '@/lib/browser-api-client'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

describe('FollowWriteup', () => {
  it('WI21 saves the challenge and says what happens next, on the page', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue(undefined)
    render(<FollowWriteup id="c1" signedIn next="/get-involved/design-challenges/c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Follow the write-up' }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith('/api/saves', { entity_type: 'challenge', entity_id: 'c1' })
    )
    expect(await screen.findByText('You will be told when the guide is published')).toBeInTheDocument()
  })

  it('sends a signed-out reader to sign in first', () => {
    render(<FollowWriteup id="c1" signedIn={false} next="/get-involved/design-challenges/c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Follow the write-up' }))
    expect(push).toHaveBeenCalledWith('/login?next=%2Fget-involved%2Fdesign-challenges%2Fc1')
  })
})
