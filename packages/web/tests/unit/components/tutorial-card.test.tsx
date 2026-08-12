import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TutorialCard } from '@/components/tutorial-card'
import type { Tutorial } from '@splat-connect/types'

// --- Mock strategy ---
// Two Next.js components are mocked: next/link is replaced with a plain <a> tag so link
// href values can be inspected via the DOM without Next.js routing infrastructure, and
// next/image is replaced with a plain <img> tag so image src values can be checked without
// Next.js image optimisation.
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
  updated_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
  reviewed_for_org_id: null,
}

describe('TutorialCard', () => {
  // Tests: TutorialCard displays the tutorial title
  // How:   renders a card with the mock tutorial; checks text 'Switch Adaptation Tutorial' is present
  // Chain: the title is the primary identifier in the library grid → users can read and
  //        distinguish tutorials by name when browsing
  it('renders tutorial title', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText('Switch Adaptation Tutorial')).toBeInTheDocument()
  })

  // Tests: TutorialCard includes a DifficultyBadge showing the tutorial's difficulty
  // How:   renders the card; checks text 'easy' is in the document (rendered by DifficultyBadge)
  // Chain: the badge is visible on every card in the library → users can filter or sort by
  //        difficulty when choosing which tutorial to follow
  it('renders difficulty badge', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText(/easy/i)).toBeInTheDocument()
  })

  // Tests: TutorialCard wraps content in a link pointing to /tutorials/:id
  // How:   checks the single link element has href='/tutorials/1'
  // Chain: clicking the card navigates to the tutorial detail page → users can read the
  //        full tutorial including PDF, parts, tools, and STL files
  it('renders a link to the tutorial', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/tutorials/1')
  })

  // Tests: the tutorial description text is visible on the card
  // How:   checks text 'A helpful tutorial' is in the document
  // Chain: descriptions give users context before clicking through → they can assess whether
  //        a tutorial suits their needs from the library grid without opening each one
  it('renders description when present', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText('A helpful tutorial')).toBeInTheDocument()
  })

  // Tests: when toy_photo_url is null, a fallback emoji is shown instead of an image
  // How:   renders with toy_photo_url: null; checks the fallback emoji character is present
  // Chain: cards without an uploaded photo still render correctly in the library →
  //        no broken-image icons appear for tutorials that skipped the photo step
  it('renders fallback emoji when toy_photo_url is null', () => {
    render(<TutorialCard tutorial={{ ...mockTutorial, toy_photo_url: null }} />)
    expect(screen.getByText('🧸')).toBeInTheDocument()
  })

  // Tests: the card names its backers to someone browsing
  // How:   a card with one accepted row; checks the name renders
  // Chain: this is the only place a parent sees an endorsement before committing
  //        to a click, and for them it is the whole point of the feature
  it('names the organisations backing a tutorial', () => {
    render(
      <TutorialCard
        tutorial={{
          ...mockTutorial,
          tutorial_orgs: [
            {
              id: 'b1', tutorial_id: mockTutorial.id, org_id: 'o1', status: 'accepted',
              requested_at: '', responded_at: null, responded_by: null,
              organizations: {
                id: 'o1', name: 'Riverside Therapy', description: null,
                status: 'active', created_by: null, created_at: '', updated_at: '',
              },
            },
          ],
        }}
      />
    )
    expect(screen.getByText('Backed by Riverside Therapy')).toBeInTheDocument()
  })

  // Tests: an unbacked card says nothing about review at all
  // How:   empty backing; checks the SPLAT fallback does NOT appear
  // Chain: "Reviewed by SPLAT" is meaningful to a contributor and meaningless to a
  //        parent, who has no idea what the internal review queue is — the absence
  //        of a badge is the right signal on a public card
  it('says nothing about backing when there is none', () => {
    render(<TutorialCard tutorial={{ ...mockTutorial, tutorial_orgs: [] }} />)
    expect(screen.queryByText(/Reviewed by SPLAT/)).not.toBeInTheDocument()
  })
})
