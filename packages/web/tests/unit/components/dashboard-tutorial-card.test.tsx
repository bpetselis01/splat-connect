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
    description: null,
    tutorial_pdf_url: null,
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
      <DashboardTutorialCard tutorial={tutorial({ toy_photo_url: 'https://x/toy.jpg' })} />
    )
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x/toy.jpg')
  })

  it('leaves the photo unlabelled, so a broken one cannot repaint the title', () => {
    // The title is rendered as text right below. Naming it again here is a
    // duplicate announcement, and a non-empty alt is what a failed image falls
    // back to painting inside the band, under the difficulty badge.
    const { container } = render(
      <DashboardTutorialCard tutorial={tutorial({ toy_photo_url: 'https://x/toy.jpg' })} />
    )
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
    expect(screen.getAllByText('Sensory light box')).toHaveLength(1)
  })

  it('falls back to the placeholder tile when there is no photo', () => {
    const { container } = render(<DashboardTutorialCard tutorial={tutorial()} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('🧸')).toBeInTheDocument()
  })

  it('carries the title, status and review route', () => {
    render(<DashboardTutorialCard tutorial={tutorial()} />)
    expect(screen.getByText('Sensory light box')).toBeInTheDocument()
    expect(screen.getByText('APPROVED')).toBeInTheDocument()
    expect(screen.getByText('Reviewed by SPLAT')).toBeInTheDocument()
  })

  it('overlays difficulty on the photo, not in the text block', () => {
    const { container } = render(<DashboardTutorialCard tutorial={tutorial()} />)
    const badge = screen.getByText('EASY')
    // Its wrapper is absolutely positioned over the photo band, so the badge
    // holds one place down a column of cards.
    expect(badge.parentElement).toHaveClass('absolute')
    expect(container.querySelector('.relative')).toContainElement(badge)
  })

  it('insets the overlaid badge off the photo corner', () => {
    render(<DashboardTutorialCard tutorial={tutorial()} />)
    expect(screen.getByText('EASY').parentElement).toHaveClass('left-3', 'top-3')
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
