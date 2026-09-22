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
    owner_org_id: null,
    quantity: 1,
    name: 'Fire truck',
    description: null,
    condition: 8,
    switch_adapted: false,
    photo_urls: ['https://test.supabase.co/storage/v1/object/public/photos/cover.jpg'],
    cover_photo_url: 'https://test.supabase.co/storage/v1/object/public/photos/cover.jpg',
    switch_photo_url: null,
    status: 'draft',
    created_at: '',
    updated_at: '',
    offer_type: 'donation',
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

  it('opens on Status, with Details one tab away and seeded with the toy', () => {
    render(<ToyEditor toy={toy()} />)
    expect(screen.getByRole('tab', { name: /Status/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: /Details/ }))
    expect(screen.getByLabelText('Name')).toHaveValue('Fire truck')
  })

  it('saves details through PATCH /api/toys/:id and keeps the updated toy in state', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(toy({ name: 'Dump truck' }))
    render(<ToyEditor toy={toy()} />)
    fireEvent.click(screen.getByRole('tab', { name: /Details/ }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dump truck' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(browserApiClient.patch).toHaveBeenCalledWith(
      '/api/toys/t1',
      expect.objectContaining({ name: 'Dump truck' })
    )
  })

  it('names the missing photo and disables listing it', () => {
    render(<ToyEditor toy={toy({ photo_urls: [] })} />)
    expect(screen.getAllByText(/a photo/i).length).toBeGreaterThan(0)
    screen
      .getAllByRole('button', { name: 'List it in the library' })
      .forEach((b) => expect(b).toBeDisabled())
  })

  it('lists through PATCH /api/toys/:id/publish and flips to Live', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(toy({ status: 'published' }))
    render(<ToyEditor toy={toy()} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'List it in the library' })[0])

    expect(await screen.findByText('Families can ask for this')).toBeInTheDocument()
    expect(browserApiClient.patch).toHaveBeenCalledWith('/api/toys/t1/publish', {})
  })

  it('shows an error and stays on the draft when listing fails', async () => {
    vi.mocked(browserApiClient.patch).mockRejectedValue(new Error('boom'))
    render(<ToyEditor toy={toy()} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'List it in the library' })[0])

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not publish this toy')
    expect(screen.getByText('Only you can see this')).toBeInTheDocument()
  })

  it('saves the offer type when a card is picked', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(toy({ offer_type: 'exchange' }))
    render(<ToyEditor toy={toy()} />)
    fireEvent.click(screen.getByRole('radio', { name: /Swap/ }))
    await vi.waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/toys/t1', { offer_type: 'exchange' })
    )
  })

  it('shows the current offer type as checked, and explains it', () => {
    render(<ToyEditor toy={toy({ offer_type: 'donation' })} />)
    expect(screen.getByRole('radio', { name: /Donation/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getAllByText(/keeps this toy for good/).length).toBeGreaterThan(0)
  })

  it('prompts for an offer type when none is chosen yet', () => {
    render(<ToyEditor toy={toy({ offer_type: null })} />)
    expect(screen.getByText(/Choose how this toy is offered/)).toBeInTheDocument()
  })

  it('renders a delete button scoped to this toy', () => {
    render(<ToyEditor toy={toy()} />)
    expect(screen.getByRole('button', { name: /delete toy/i })).toBeInTheDocument()
  })
})
