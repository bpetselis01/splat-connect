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

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
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
    offer_type: 'donation',
    archived_at: null,
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

  it('saves the offer type when a pill is clicked', async () => {
    const patchSpy = vi.spyOn(browserApiClient, 'patch').mockResolvedValue({})
    render(<ToyEditor toy={toy({ status: 'published', offer_type: null })} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))

    fireEvent.click(screen.getByRole('button', { name: 'Donation' }))

    expect(patchSpy).toHaveBeenCalledWith(`/api/toys/${toy().id}`, { offer_type: 'donation' })
  })

  it('shows the current offer type as pressed', () => {
    render(<ToyEditor toy={toy({ status: 'published', offer_type: 'both' })} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))
    expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Donation' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('explains the selected offer type', () => {
    render(<ToyEditor toy={toy({ offer_type: 'exchange' })} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))
    expect(
      screen.getByText("You'll swap this toy for another one with the recipient.")
    ).toBeInTheDocument()
  })

  it('prompts for an offer type when none is chosen yet', () => {
    render(<ToyEditor toy={toy({ offer_type: null })} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))
    expect(
      screen.getByText('Choose how this toy is offered — you can change it later.')
    ).toBeInTheDocument()
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

  it('puts Delete toy last in the pill row, styled as a pill rather than a button', () => {
    const { container } = render(<ToyEditor toy={toy()} />)
    const row = container.querySelector('.step-pill-row') as HTMLElement
    const deleteButton = screen.getByRole('button', { name: 'Delete toy' })

    expect(row).toContainElement(deleteButton)
    expect(deleteButton).toHaveClass('step-pill', 'step-pill-danger')
    // Excluding the confirm dialog's own buttons: DeleteEntityButton renders
    // trigger + <dialog> as one fragment, so both land in the trailing slot.
    const rowButtons = Array.from(row.querySelectorAll('button')).filter((b) => !b.closest('dialog'))
    expect(rowButtons[rowButtons.length - 1]).toBe(deleteButton)
  })

  it('shows the cover photo in Review, so the listing is checked by eye', () => {
    render(<ToyEditor toy={toy()} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))
    expect(screen.getByAltText('Cover photo')).toHaveAttribute(
      'src',
      'https://example.com/cover.jpg'
    )
  })

  it('shows the switch photo in Review only when the toy is switch-adapted', () => {
    const switchPhotos = { switch_photo_urls: ['https://example.com/switch.jpg'] }
    const { unmount } = render(<ToyEditor toy={toy({ ...switchPhotos, switch_adapted: false })} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))
    expect(screen.queryByAltText('Switch photo')).not.toBeInTheDocument()
    unmount()

    render(<ToyEditor toy={toy({ ...switchPhotos, switch_adapted: true })} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))
    expect(screen.getByAltText('Switch photo')).toBeInTheDocument()
  })

  it('falls back to the placeholder tile in Review when there is no cover photo', () => {
    render(<ToyEditor toy={toy({ cover_photo_url: null })} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))
    expect(screen.queryByAltText('Cover photo')).not.toBeInTheDocument()
    expect(screen.getByText('No cover photo yet')).toBeInTheDocument()
  })
})
