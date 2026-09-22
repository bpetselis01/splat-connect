import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ToyLibraryClient } from '@/app/toy-library/toy-library-client'
import type { ToyWithOwner } from '@splat-connect/types'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/toy-library',
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

function toy(overrides: Partial<ToyWithOwner> = {}): ToyWithOwner {
  return {
    id: 't1',
    owner_id: 'u1',
    owner_org_id: null,
    quantity: 1,
    name: 'Fire truck',
    description: null,
    condition: 8,
    switch_adapted: false,
    photo_urls: [],
    cover_photo_url: null,
    switch_photo_url: null,
    status: 'published',
    created_at: '',
    updated_at: '',
    offer_type: null,
    profiles: { name: 'Lee' },
    organizations: null,
    ...overrides,
  }
}

const names = () => [...document.querySelectorAll('.browse-card__title')].map((p) => p.textContent)

describe('ToyLibraryClient', () => {
  // The board's facets. A toy offered either way answers both a gift and a
  // swap search; "Swap or gift" asks only for the ones open to both.
  it('filters by how a toy is offered', () => {
    render(
      <ToyLibraryClient
        toys={[
          toy({ id: 't1', name: 'Gift toy', offer_type: 'donation' }),
          toy({ id: 't2', name: 'Swap toy', offer_type: 'exchange' }),
          toy({ id: 't3', name: 'Either toy', offer_type: 'both' }),
        ]}
        savedIds={[]}
        signedIn={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Gift' }))
    expect(names().sort()).toEqual(['Either toy', 'Gift toy'])
    fireEvent.click(screen.getByRole('button', { name: 'Swap or gift' }))
    expect(names()).toEqual(['Either toy'])
  })

  it('filters by who is holding it', () => {
    render(
      <ToyLibraryClient
        toys={[
          toy({ id: 't1', name: 'Family toy' }),
          toy({ id: 't2', name: 'Org toy', owner_id: null, owner_org_id: 'o1', organizations: { name: 'Hub' }, profiles: null }),
        ]}
        savedIds={[]}
        signedIn={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'An organisation' }))
    expect(names()).toEqual(['Org toy'])
  })

  it('sorts by condition, best first, and flips', () => {
    render(
      <ToyLibraryClient
        toys={[
          toy({ id: 't1', name: 'Worn', condition: 3 }),
          toy({ id: 't2', name: 'Mint', condition: 10 }),
        ]}
        savedIds={[]}
        signedIn={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Newest first/ }))
    fireEvent.click(screen.getByRole('option', { name: /Condition/ }))
    expect(names()).toEqual(['Mint', 'Worn'])
    fireEvent.click(screen.getByRole('button', { name: 'Switch to needs a fix first' }))
    expect(names()).toEqual(['Worn', 'Mint'])
  })

  it('shows the empty state when nothing matches', () => {
    render(<ToyLibraryClient toys={[toy({ offer_type: 'donation' })]} savedIds={[]} signedIn={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Swap only' }))
    expect(screen.getByText('No toys match all of those')).toBeInTheDocument()
  })
})
