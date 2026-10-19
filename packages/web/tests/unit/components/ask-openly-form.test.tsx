import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AskOpenlyForm } from '@/components/ask-openly-form'
import { browserApiClient } from '@/lib/browser-api-client'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))
const post = vi.mocked(browserApiClient.post)

const tutorials = [
  { id: 'g1', title: 'Bubble machine', difficulty: 'easy' as const, kind: 'toy_adaptation' as const, build_minutes: 20 },
  { id: 'g2', title: 'Spinning top', difficulty: 'hard' as const, kind: 'assistive_tech' as const, build_minutes: null },
]

beforeEach(() => vi.clearAllMocks())

describe('AskOpenlyForm', () => {
  it('WI26 holds the post until a guide, a suburb and the parts cover are all given', () => {
    render(<AskOpenlyForm tutorials={tutorials} />)
    const post_ = screen.getByRole('button', { name: 'Post to Makers wanted' })
    expect(post_).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Bubble machine/ }))
    fireEvent.change(screen.getByPlaceholderText('Newtown'), { target: { value: 'Newtown' } })
    expect(post_).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/you cover the toy and parts/i))
    expect(post_).toBeEnabled()
  })

  it('WI26 posts the board request with no maker, then opens its thread', async () => {
    post.mockResolvedValue({ id: 'tx-1' })
    render(<AskOpenlyForm tutorials={tutorials} />)
    fireEvent.click(screen.getByRole('button', { name: /Bubble machine/ }))
    fireEvent.change(screen.getByPlaceholderText('Newtown'), { target: { value: ' Newtown ' } })
    fireEvent.click(screen.getByRole('button', { name: '25 km' }))
    fireEvent.click(screen.getByRole('radio', { name: /yes, it just needs adapting/i }))
    fireEvent.change(screen.getByLabelText(/a note to the maker/i), { target: { value: ' Leo likes bubbles ' } })
    fireEvent.click(screen.getByLabelText(/you cover the parts/i))
    fireEvent.click(screen.getByRole('button', { name: 'Post to Makers wanted' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/toy-transactions/build', {
        tutorial_id: 'g1',
        build_brief: 'Leo likes bubbles',
        requester_suburb: 'Newtown',
        travel_km: 25,
        urgency: 'No rush',
        family_has_toy: true,
      })
    )
    expect(push).toHaveBeenCalledWith('/dashboard/exchanges/build/tx-1')
  })

  it('WI26 shows the server sentence and keeps the form when posting fails', async () => {
    post.mockRejectedValue(new Error('Say which suburb you are in and how far you can travel.'))
    render(<AskOpenlyForm tutorials={tutorials} initialGuide="g2" />)
    fireEvent.change(screen.getByPlaceholderText('Newtown'), { target: { value: 'Newtown' } })
    fireEvent.click(screen.getByLabelText(/you cover the toy and parts/i))
    fireEvent.click(screen.getByRole('button', { name: 'Post to Makers wanted' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Say which suburb you are in and how far you can travel.')
    expect(push).not.toHaveBeenCalled()
  })
})
