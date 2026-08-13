import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToyEditor } from '@/components/toy-editor'
import type { Toy } from '@splat-connect/types'

const replace = vi.fn()
const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push, refresh }),
  usePathname: () => '/dashboard/toys/t1',
  useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { patch: vi.fn(), delete: vi.fn() },
}))

import { browserApiClient } from '@/lib/browser-api-client'

function toy(overrides: Partial<Toy> = {}): Toy {
  return {
    id: 't1',
    owner_id: 'u1',
    name: 'Fire truck',
    description: null,
    condition: 8,
    switch_adapted: false,
    cover_photo_url: 'https://example.com/cover.jpg',
    switch_photo_urls: [],
    status: 'draft',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('ToyEditor', () => {
  beforeEach(() => {
    replace.mockClear()
    push.mockClear()
    refresh.mockClear()
    vi.mocked(browserApiClient.patch).mockReset()
    vi.mocked(browserApiClient.delete).mockReset()
  })

  it('shows the Details pill first, seeded with the toy', () => {
    render(<ToyEditor toy={toy()} />)
    expect(screen.getByLabelText('Name')).toHaveValue('Fire truck')
  })

  it('saves details through PATCH /api/toys/:id and keeps the updated toy in state', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(toy({ name: 'Dump truck' }))
    render(<ToyEditor toy={toy()} />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dump truck' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(browserApiClient.patch).toHaveBeenCalledWith(
      '/api/toys/t1',
      expect.objectContaining({ name: 'Dump truck' })
    )
  })

  it('disables Publish and names the missing field when the cover photo is absent', () => {
    render(<ToyEditor toy={toy({ cover_photo_url: null })} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))

    expect(screen.getByText('Add Cover photo to publish')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('publishes through PATCH /api/toys/:id/publish and shows Published afterwards', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(toy({ status: 'published' }))
    render(<ToyEditor toy={toy()} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await screen.findByText('Published')
    expect(browserApiClient.patch).toHaveBeenCalledWith('/api/toys/t1/publish', {})
  })

  it('shows an error and stays on the draft when publish fails', async () => {
    vi.mocked(browserApiClient.patch).mockRejectedValue(new Error('boom'))
    render(<ToyEditor toy={toy()} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not publish')
    expect(screen.queryByText('Published')).not.toBeInTheDocument()
  })

  it('wraps every step body in a panel, like the edit-tutorial page', () => {
    const { container } = render(<ToyEditor toy={toy()} />)
    for (const label of ['Details', 'Photos', 'Review']) {
      fireEvent.click(screen.getByRole('tab', { name: label }))
      expect(container.querySelector('[role="tabpanel"] > .panel')).toBeInTheDocument()
    }
  })

  it('renders a delete button scoped to this toy', () => {
    render(<ToyEditor toy={toy()} />)
    expect(screen.getByRole('button', { name: 'Delete toy' })).toBeInTheDocument()
  })
})
