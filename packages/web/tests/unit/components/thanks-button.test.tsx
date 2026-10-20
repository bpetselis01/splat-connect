import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThanksButton } from '@/components/thanks-button'

const post = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => post(...a) } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/tutorials/t1' }))

beforeEach(() => vi.clearAllMocks())

// The public guide page has no ToastProvider, so a toast here was silent.
describe('ThanksButton', () => {
  it('WT09 posts the thank for the guide, shows the new count, and says so inline with no toast provider on the page', async () => {
    post.mockResolvedValue({ thanks_count: 4 })
    render(<ThanksButton tutorialId="t1" count={3} thanked={false} own={false} signedIn />)
    fireEvent.click(screen.getByRole('button', { name: /Say thanks/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Thanks sent — they will see it in their notifications')
    expect(post).toHaveBeenCalledWith('/api/tutorials/t1/thanks', {})
    expect(screen.getByRole('button')).toHaveTextContent('Thanked')
    expect(screen.getByRole('button')).toHaveTextContent('4')
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('WT09 says you already thanked them on a 409, and disables the button', async () => {
    post.mockRejectedValue(Object.assign(new Error('409'), { status: 409 }))
    render(<ThanksButton tutorialId="t1" count={3} thanked={false} own={false} signedIn />)
    fireEvent.click(screen.getByRole('button', { name: /Say thanks/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('You already thanked them')
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('raises an alert when it could not send', async () => {
    post.mockRejectedValue(Object.assign(new Error('500'), { status: 500 }))
    render(<ThanksButton tutorialId="t1" count={3} thanked={false} own={false} signedIn />)
    fireEvent.click(screen.getByRole('button', { name: /Say thanks/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send that. Try again.')
  })
})
