import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardTutorialCard } from '@/components/dashboard-tutorial-card'
import type { Tutorial, TutorialOrg } from '@splat-connect/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

function tutorial(overrides: Partial<Tutorial & { tutorial_orgs?: TutorialOrg[] }> = {}) {
  return {
    id: 't1',
    title: 'Sensory light box',
    difficulty: 'easy' as const,
    kind: 'toy_adaptation' as const,
    status: 'approved' as const,
    maturity: 'complete' as const,
    safety_declared_at: null,
    build_minutes: 30,
    description: null,
    tutorial_pdf_url: null,
    photo_urls: [],
    toy_photo_url: null,
    rejection_note: null,
    created_at: '',
    updated_at: '',
    reviewed_at: null,
    reviewed_by: null,
    reviewed_for_org_id: null,
    ...overrides,
  }
}

describe('DashboardTutorialCard', () => {
  it('links the whole card to the editor', () => {
    render(<DashboardTutorialCard tutorial={tutorial({ id: 'abc' })} />)
    expect(screen.getByTestId('tutorial-row')).toHaveAttribute('href', '/tutorials/abc/edit')
  })

  it('shows the toy photo when there is one', () => {
    const { container } = render(
      <DashboardTutorialCard tutorial={tutorial({ toy_photo_url: 'https://test.supabase.co/storage/v1/object/public/photos/toy.jpg' })} />
    )
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://test.supabase.co/storage/v1/object/public/photos/toy.jpg')
  })

  it('leaves the photo unlabelled, so a broken one cannot repaint the title', () => {
    // The title is rendered as text right below. Naming it again here is a
    // duplicate announcement, and a non-empty alt is what a failed image falls
    // back to painting inside the band, under the difficulty badge.
    const { container } = render(
      <DashboardTutorialCard tutorial={tutorial({ toy_photo_url: 'https://test.supabase.co/storage/v1/object/public/photos/toy.jpg' })} />
    )
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
    expect(screen.getAllByText('Sensory light box')).toHaveLength(1)
  })

  it('falls back to the placeholder tile when there is no photo', () => {
    const { container } = render(<DashboardTutorialCard tutorial={tutorial()} />)
    expect(container.querySelector('img')).toBeNull()
    // A duotone glyph, not the 🧸 it used to draw: ContentCard fills an empty
    // media band with the card's own icon at 48px. An emoji renders in the
    // reader's system font and carries none of the palette.
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('carries the title, status and review route', () => {
    render(<DashboardTutorialCard tutorial={tutorial()} />)
    expect(screen.getByText('Sensory light box')).toBeInTheDocument()
    // The board's shared stage word, not the review status's.
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText('Reviewed by SPLAT')).toBeInTheDocument()
  })

  it('carries difficulty as a pill beside the stage, as the board draws it', () => {
    render(<DashboardTutorialCard tutorial={tutorial()} />)
    expect(screen.getByText('Easy')).toHaveClass('stage-pill')
  })

  it('calls a draft a draft', () => {
    render(<DashboardTutorialCard tutorial={tutorial({ status: 'draft' })} />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('shows the rejection note only when the tutorial was rejected', () => {
    const { unmount } = render(
      <DashboardTutorialCard
        tutorial={tutorial({ status: 'rejected', rejection_note: 'Photos are too dark.' })}
      />
    )
    expect(screen.getByText('Photos are too dark.')).toBeInTheDocument()
    unmount()

    render(<DashboardTutorialCard tutorial={tutorial({ status: 'approved' })} />)
    expect(screen.queryByText('Photos are too dark.')).not.toBeInTheDocument()
  })

  it('falls back to standard wording when a rejection carries no note', () => {
    render(
      <DashboardTutorialCard tutorial={tutorial({ status: 'rejected', rejection_note: null })} />
    )
    expect(screen.getByText('No feedback was provided.')).toBeInTheDocument()
  })

  it('clamps the rejection note so one long note cannot stretch its row', () => {
    render(
      <DashboardTutorialCard
        tutorial={tutorial({ status: 'rejected', rejection_note: 'Photos are too dark.' })}
      />
    )
    expect(screen.getByText('Photos are too dark.')).toHaveClass('line-clamp-2')
  })
})
