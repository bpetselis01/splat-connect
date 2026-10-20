import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AskForBuildForm } from '@/components/ask-for-build-form'
import { browserApiClient } from '@/lib/browser-api-client'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))
const post = vi.mocked(browserApiClient.post)

const guides = [{ id: 'g1', label: 'Bubble machine' }, { id: 'g2', label: 'Spinning top' }]
const makers = [{ id: 'o1', label: 'Northside Therapy' }, { id: 'o2', label: 'Eastside Makers' }]

beforeEach(() => vi.clearAllMocks())

describe('AskForBuildForm', () => {
  it('WI28 asks the chosen organisation about the chosen guide, then opens the build thread', async () => {
    post.mockResolvedValue({ id: 'tx-9' })
    render(<AskForBuildForm guides={guides} makers={makers} />)
    expect(screen.getByRole('button', { name: 'Send the request' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Which guide'), { target: { value: 'g2' } })
    fireEvent.change(screen.getByLabelText('Who you are asking'), { target: { value: 'o2' } })
    fireEvent.change(screen.getByLabelText('What they need to know'), { target: { value: '  For Mia, 5.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the request' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/toy-transactions/build', {
        tutorial_id: 'g2',
        build_brief: 'For Mia, 5.',
        maker_org_id: 'o2',
      })
    )
    expect(push).toHaveBeenCalledWith('/dashboard/exchanges/build/tx-9')
  })

  it('WI28 asks one person from their profile with maker_id and no organisation picker', async () => {
    post.mockResolvedValue({ id: 'tx-9' })
    render(<AskForBuildForm guides={guides} makers={makers} defaultGuideId="g1" makerId="u7" makerName="Tom Beattie" />)
    expect(screen.queryByLabelText('Who you are asking')).toBeNull()
    expect(screen.getByText('Tom Beattie')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('What they need to know'), { target: { value: 'Switch is 100 mm' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the request' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/toy-transactions/build', {
        tutorial_id: 'g1',
        build_brief: 'Switch is 100 mm',
        maker_id: 'u7',
      })
    )
  })

  it('WI28 shows the API sentence when the same ask is already open', async () => {
    post.mockRejectedValue(new Error('409 {"error":"You already have an open build request with them for this guide"}'))
    render(<AskForBuildForm guides={guides} makers={makers} />)
    fireEvent.change(screen.getByLabelText('What they need to know'), { target: { value: 'Again' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You already have an open build request with them for this guide')
    expect(push).not.toHaveBeenCalled()
  })
})
