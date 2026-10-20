import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminTestPrints } from '@/components/admin-test-prints'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn() } }))

const waiting = { id: 't1', printer_name: 'Bambu P1S', owner_name: 'Tom B.', photo: 'https://x/p.jpg', submitted_at: '2026-10-01T00:00:00Z', verdict: null, note: null }

describe('AdminTestPrints', () => {
  it('WM34 passes a waiting test print with a note', async () => {
    const patch = vi.mocked(browserApiClient.patch).mockResolvedValue({})
    render(<AdminTestPrints prints={[waiting]} />)
    fireEvent.change(screen.getByLabelText('Note for Bambu P1S'), { target: { value: 'Clean layers.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/test-prints/t1', { verdict: 'pass', note: 'Clean layers.' }))
  })

  it('shows a decided one with its verdict and note', () => {
    render(<AdminTestPrints prints={[{ ...waiting, verdict: 'fail', note: 'Stringing.' }]} />)
    expect(screen.getByText('Failed — Stringing.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pass' })).toBeNull()
  })
})
