import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrintAtEventForm } from '@/components/print-at-event-form'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { get: vi.fn(), post: vi.fn() } }))

const get = vi.mocked(browserApiClient.get)
const post = vi.mocked(browserApiClient.post)
const GUIDE = { id: 'g1', title: 'Light-up penguin', stl_files: [{ id: 'f1', filename: 'body.stl' }, { id: 'f2', filename: 'wing.stl' }] }

function serve(saved: unknown[] = [{ id: 'g1', title: 'Light-up penguin' }]) {
  get.mockImplementation(async (path: string) => (path === '/api/saves/tutorials' ? saved : GUIDE) as never)
}
async function pickGuide() {
  fireEvent.click(screen.getByRole('button', { name: /Print parts here/ }))
  await screen.findByRole('option', { name: 'Light-up penguin' })
  fireEvent.change(screen.getByLabelText('Guide'), { target: { value: 'g1' } })
  await screen.findByRole('checkbox', { name: 'body.stl' })
}

describe('PrintAtEventForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serve()
    post.mockResolvedValue({ id: 't1' } as never)
  })

  it('WI34 sends the guide, the ticked parts, the sets and the note, then points at My events', async () => {
    render(<PrintAtEventForm eventId="e1" maxSets={3} />)
    await pickGuide()
    fireEvent.click(screen.getByRole('checkbox', { name: 'wing.stl' }))
    fireEvent.change(screen.getByLabelText(/Sets/), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/Note to the host/), { target: { value: 'Blue if you can' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/toy-transactions/print-at-event', {
        event_id: 'e1', tutorial_id: 'g1', stl_file_ids: ['f1'], part_sets: 2, note: 'Blue if you can',
      }),
    )
    expect(await screen.findByRole('link', { name: 'My events' })).toBeTruthy()
  })

  it('WI34 shows the server\'s sentence when no part is ticked', async () => {
    post.mockRejectedValue(new Error('Request failed with status 400: Tick at least one part to print.'))
    render(<PrintAtEventForm eventId="e1" maxSets={3} />)
    await pickGuide()
    fireEvent.click(screen.getByRole('checkbox', { name: 'body.stl' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'wing.stl' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Tick at least one part to print.')
  })

  it('with nothing saved it says to save a guide first and offers no send', async () => {
    serve([])
    render(<PrintAtEventForm eventId="e1" maxSets={3} />)
    fireEvent.click(screen.getByRole('button', { name: /Print parts here/ }))
    expect(await screen.findByText(/Save a guide first/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send request' })).toBeNull()
  })

  it('a failed saves load says so', async () => {
    get.mockRejectedValue(new Error('Network request failed'))
    render(<PrintAtEventForm eventId="e1" maxSets={3} />)
    fireEvent.click(screen.getByRole('button', { name: /Print parts here/ }))
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
