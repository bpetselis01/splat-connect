import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TutorialCard } from '@/components/tutorial-card'
import type { Tutorial } from '@splat-connect/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

const mockTutorial: Tutorial = {
  id: '1',
  title: 'Switch Adaptation Tutorial',
  difficulty: 'easy',
  status: 'approved',
  description: 'A helpful tutorial',
  tutorial_pdf_url: 'https://example.com/tutorial.pdf',
  toy_photo_url: 'https://example.com/photo.jpg',
  rejection_note: null,
  created_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
}

describe('TutorialCard', () => {
  it('renders tutorial title', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText('Switch Adaptation Tutorial')).toBeInTheDocument()
  })

  it('renders difficulty badge', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText(/easy/i)).toBeInTheDocument()
  })

  it('renders a link to the tutorial', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/tutorials/1')
  })

  it('renders description when present', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText('A helpful tutorial')).toBeInTheDocument()
  })

  it('renders fallback emoji when toy_photo_url is null', () => {
    render(<TutorialCard tutorial={{ ...mockTutorial, toy_photo_url: null }} />)
    expect(screen.getByText('🧸')).toBeInTheDocument()
  })
})
