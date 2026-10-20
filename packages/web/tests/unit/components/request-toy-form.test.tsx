import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Toy } from '@splat-connect/types'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
const post = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => post(...a) } }))

const { RequestToyForm } = await import('@/components/request-toy-form')

const mine = (overrides: Partial<Toy> = {}): Toy =>
  ({ id: 'mine-1', name: 'Blocks', status: 'published', condition: 7, description: null, photo_urls: [], ...overrides }) as Toy

const form = (props: Partial<React.ComponentProps<typeof RequestToyForm>> = {}) =>
  render(
    <RequestToyForm toyId="toy-1" holderName="Dana" offerType="both" myToys={[]} offeredElsewhere={[]} suburb="Ashfield" {...props} />
  )

beforeEach(() => {
  push.mockReset()
  post.mockReset().mockResolvedValue({ id: 'tx-9' })
})

describe('RequestToyForm', () => {
  it('WY10 sends a gift request with the note and collection line, then opens the thread', async () => {
    form({ initialMode: 'donation' })
    expect(screen.getByRole('button', { name: 'Send the request' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Say who it is for/), { target: { value: 'My son is four.' } })
    fireEvent.change(screen.getByLabelText(/When suits you/), { target: { value: 'Weekends' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the request' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/exchanges/tx-9'))
    expect(post).toHaveBeenCalledWith('/api/toy-transactions', {
      toy_id: 'toy-1',
      type: 'donation',
      offered_toy_id: undefined,
      note: 'My son is four.\n\nI can collect from Ashfield. Weekends',
    })
  })

  it('WY10 sends a swap offer naming the toy picked from the shelf', async () => {
    form({ initialMode: 'exchange', myToys: [mine(), mine({ id: 'mine-2', name: 'Puzzle' })] })
    fireEvent.click(screen.getByRole('radio', { name: /Puzzle/ }))
    fireEvent.change(screen.getByLabelText(/Say who it is for/), { target: { value: 'She loves puzzles.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Offer Puzzle' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/exchanges/tx-9'))
    expect(post).toHaveBeenCalledWith('/api/toy-transactions', expect.objectContaining({ type: 'exchange', offered_toy_id: 'mine-2' }))
  })

  it('WY10 stays on the form and says so when the request is refused', async () => {
    post.mockRejectedValue(new Error('You already asked for this toy'))
    form({ initialMode: 'donation' })
    fireEvent.change(screen.getByLabelText(/Say who it is for/), { target: { value: 'Please.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You already asked for this toy')
    expect(push).not.toHaveBeenCalled()
  })

  it('WY11 disables the swap card when nothing of yours is listed, and starts on the gift', () => {
    form()
    expect(screen.getByText('You have no listed toys to offer yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send the request' })).toBeInTheDocument()
  })

  it('WY11 refuses to offer a toy that is already promised, saying why', () => {
    form({ initialMode: 'exchange', myToys: [mine(), mine({ id: 'mine-2', name: 'Puzzle' })], offeredElsewhere: ['mine-2'] })
    expect(screen.getByRole('radio', { name: /Puzzle/ })).toBeDisabled()
    expect(screen.getByText('Already offered in another open exchange.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Blocks/ })).toBeChecked()
  })

  it('WY11 offers the note chips as a collection choice, and a way back to the toy', () => {
    form({ initialMode: 'donation' })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'I can collect from Ashfield',
      'Could you drop it off?',
      'Happy to cover postage',
    ])
    expect(screen.getByRole('link', { name: 'Back to the toy' })).toHaveAttribute('href', '/toy-library/toy-1')
  })
})
