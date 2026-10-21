import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BuildQuestionsThread } from '@/components/build-questions'
import { browserApiClient } from '@/lib/browser-api-client'

const refresh = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

const data = {
  transaction_id: 'b1', tutorial_title: 'Bubble machine', requester_suburb: 'Newtown', open: true, family: false,
  threads: [{ maker_id: 'm1', maker_name: 'Tom', messages: [{ id: 'q1', sender_id: 'fam', body: 'A big button.', created_at: '2026-09-30T00:00:00Z' }] }],
}

describe('BuildQuestionsThread', () => {
  it('WX24 shows the stage card and the family’s reply, and sends a question', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue({})
    render(<BuildQuestionsThread data={data} viewerId="m1" makerId={null} />)
    expect(screen.getByText('Asking first')).toBeInTheDocument()
    expect(screen.getByText('Not claimed yet')).toBeInTheDocument()
    expect(screen.getByText('A big button.')).toBeInTheDocument()
    expect(screen.getByText('Family in Newtown')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Batteries?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(browserApiClient.post).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'Batteries?' }))
    expect(refresh).toHaveBeenCalled()
  })

  it('WX25 claims the build for the maker and opens the build thread', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue({})
    push.mockClear()
    render(<BuildQuestionsThread data={data} viewerId="m1" makerId={null} />)
    fireEvent.click(screen.getByRole('button', { name: /I.ll build this/ }))
    await waitFor(() => expect(browserApiClient.post).toHaveBeenCalledWith('/api/toy-transactions/b1/claim', {}))
    expect(push).toHaveBeenCalledWith('/dashboard/exchanges/build/b1')
  })

  it('WX25 shows the maker the refusal and stays on the page when the claim is taken', async () => {
    vi.mocked(browserApiClient.post).mockRejectedValue(new Error('Already claimed'))
    push.mockClear()
    render(<BuildQuestionsThread data={data} viewerId="m1" makerId={null} />)
    fireEvent.click(screen.getByRole('button', { name: /I.ll build this/ }))
    expect(await screen.findByText('Already claimed')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('WX24 lets the family answer one maker by naming that maker', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue({})
    render(<BuildQuestionsThread data={{ ...data, family: true }} viewerId="fam" makerId="m1" />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Two AAs.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(browserApiClient.post).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'Two AAs.', maker_id: 'm1' }))
  })

  it('WM38 offers an admin no claim button', () => {
    render(<BuildQuestionsThread data={data} viewerId="admin1" makerId={null} isAdmin />)
    expect(screen.queryByRole('button', { name: /I.ll build this/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
  })
})
