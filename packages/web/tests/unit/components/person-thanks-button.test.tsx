import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PersonThanksButton } from '@/components/person-thanks-button'

const post = vi.fn()
const push = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => post(...a) } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/contributors/p1' }))

beforeEach(() => vi.clearAllMocks())

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Say thanks to Sam' }))
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send thanks' }))

describe('PersonThanksButton', () => {
  it('posts an empty body when no note is written', async () => {
    post.mockResolvedValue({ thanks_count: 1 })
    render(<PersonThanksButton profileId="p1" name="Sam" signedIn />)
    open()
    send()
    expect(await screen.findByRole('status')).toHaveTextContent('Thanks sent')
    expect(post).toHaveBeenCalledWith('/api/contributors/p1/thanks', {})
    expect(screen.getByRole('button', { name: 'Thanked' })).toBeDisabled()
  })

  it('posts the trimmed note and says only they will see it', async () => {
    post.mockResolvedValue({ thanks_count: 1 })
    render(<PersonThanksButton profileId="p1" name="Sam" signedIn />)
    open()
    expect(screen.getByText('Only they will see this.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Add a note (optional)'), { target: { value: '  Loved it.  ' } })
    send()
    await screen.findByRole('status')
    expect(post).toHaveBeenCalledWith('/api/contributors/p1/thanks', { note: 'Loved it.' })
  })

  it('says you already thanked them on a 409', async () => {
    post.mockRejectedValue(Object.assign(new Error('409'), { status: 409 }))
    render(<PersonThanksButton profileId="p1" name="Sam" signedIn />)
    open()
    send()
    expect(await screen.findByRole('status')).toHaveTextContent('You already thanked them')
  })

  it('raises an alert on a failure and keeps the form', async () => {
    post.mockRejectedValue(Object.assign(new Error('500'), { status: 500 }))
    render(<PersonThanksButton profileId="p1" name="Sam" signedIn />)
    open()
    send()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send that. Try again.')
    expect(screen.getByRole('button', { name: 'Send thanks' })).toBeEnabled()
  })

  it('sends a signed-out visitor to sign up', () => {
    render(<PersonThanksButton profileId="p1" name="Sam" signedIn={false} />)
    open()
    expect(push).toHaveBeenCalledWith('/signup?next=%2Fcontributors%2Fp1&reason=thanks')
    expect(post).not.toHaveBeenCalled()
  })
})
