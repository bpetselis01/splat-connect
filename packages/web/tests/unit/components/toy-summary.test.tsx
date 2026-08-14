import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ToySummary } from '@/components/toy-summary'
import type { Toy } from '@splat-connect/types'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

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
    status: 'published',
    created_at: '',
    updated_at: '',
    offer_type: null,
    archived_at: null,
    ...overrides,
  }
}

describe('ToySummary', () => {
  it('falls back to an em dash when there is no description', () => {
    render(<ToySummary toy={toy({ description: null })} />)
    const dd = screen.getByText('Name').closest('dl')!.querySelectorAll('dd')[2]
    expect(dd).toHaveTextContent('—')
  })

  it('shows the description when present', () => {
    render(<ToySummary toy={toy({ description: 'Squeaky but loved' })} />)
    expect(screen.getByText('Squeaky but loved')).toBeInTheDocument()
  })

  it('shows the switch-adapted Yes/No text', () => {
    const { unmount } = render(<ToySummary toy={toy({ switch_adapted: false })} />)
    expect(screen.getByText('No')).toBeInTheDocument()
    unmount()

    render(<ToySummary toy={toy({ switch_adapted: true })} />)
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })
})
