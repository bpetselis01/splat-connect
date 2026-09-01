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
    cover_photo_url: null,
    switch_photo_urls: [],
    status: 'published',
    created_at: '',
    updated_at: '',
    offer_type: null,
    profiles: { name: 'Lee' },
    organizations: null,
    ...overrides,
  }
}

describe('ToyLibraryClient', () => {
  it('filters by name, case-insensitive substring', () => {
    render(
      <ToyLibraryClient
        toys={[toy({ id: 't1', name: 'Fire truck' }), toy({ id: 't2', name: 'Blocks' })]}
        savedIds={[]}
        signedIn={false}
      />
    )
    fireEvent.change(screen.getByLabelText('Search by toy name'), { target: { value: 'fire' } })
    expect(screen.getByRole('link', { name: /Fire truck/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Blocks/ })).not.toBeInTheDocument()
  })

  it('filters by condition bucket', () => {
    render(
      <ToyLibraryClient
        toys={[
          toy({ id: 't1', name: 'Good toy', condition: 9 }),
          toy({ id: 't2', name: 'Fair toy', condition: 5 }),
          toy({ id: 't3', name: 'Loved toy', condition: 2 }),
        ]}
        savedIds={[]}
        signedIn={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Good (7–10)' }))
    expect(screen.getByRole('link', { name: /Good toy/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Fair toy/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Loved toy/ })).not.toBeInTheDocument()
  })

  it('toggles the switch-adapted filter independently of condition', () => {
    render(
      <ToyLibraryClient
        toys={[
          toy({ id: 't1', name: 'Adapted toy', switch_adapted: true, condition: 3 }),
          toy({ id: 't2', name: 'Plain toy', switch_adapted: false, condition: 3 }),
        ]}
        savedIds={[]}
        signedIn={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Switch-adapted' }))
    expect(screen.getByRole('link', { name: /Adapted toy/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Plain toy/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Well-loved (1–3)' }))
    expect(screen.getByRole('link', { name: /Adapted toy/ })).toBeInTheDocument()
  })

  it('shows the empty state when nothing matches', () => {
    render(<ToyLibraryClient toys={[toy({ name: 'Fire truck' })]} savedIds={[]} signedIn={false} />)
    fireEvent.change(screen.getByLabelText('Search by toy name'), { target: { value: 'zzz' } })
    expect(screen.getByText('No toys found.')).toBeInTheDocument()
  })
})
