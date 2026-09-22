import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TutorialView } from '@/components/tutorial-view'
import type { TutorialWithDetails, Recommendation } from '@splat-connect/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next/navigation', () => ({ usePathname: () => '/tutorials/t1' }))

const stl = [{ id: 's1', tutorial_id: 't1', filename: 'bracket.stl', file_url: 't1/bracket.stl' }]

function rec(id: string, position: number, status: Recommendation['tutorials']['status'] = 'approved'): Recommendation {
  return {
    position,
    tutorials: { id, title: `Rec ${id}`, kind: 'assistive_tech', difficulty: 'easy', toy_photo_url: null, status, maturity: 'complete' },
  }
}

function tutorial(overrides: Partial<TutorialWithDetails> = {}): TutorialWithDetails {
  return {
    id: 't1',
    title: 'Bubble Machine',
    description: null,
    difficulty: 'easy',
    kind: 'toy_adaptation',
    status: 'approved',
    maturity: 'complete',
    safety_declared_at: null,
    build_minutes: 30,
    tutorial_pdf_url: null,
    photo_urls: [],
    toy_photo_url: null,
    rejection_note: null,
    created_at: '',
    updated_at: '',
    reviewed_at: null,
    reviewed_by: null,
    reviewed_for_org_id: null,
    parts: [],
    tools: [],
    stl_files: [],
    tutorial_recommendations: [],
    tutorial_contributors: [],
    ...overrides,
  }
}

describe('TutorialView', () => {
  // A toy adaptation switched from assistive tech keeps its rows; the section
  // is about the kind, not about whether rows happen to exist.
  it('shows 3D-print files only for an assistive-tech tutorial', () => {
    const { unmount } = render(<TutorialView tutorial={tutorial({ stl_files: stl })} signedIn={false} />)
    expect(screen.queryByText('bracket.stl')).toBeNull()
    unmount()
    render(<TutorialView tutorial={tutorial({ kind: 'assistive_tech', stl_files: stl })} signedIn={false} />)
    expect(screen.getByText('bracket.stl')).toBeInTheDocument()
  })

  it('names the kind in the header', () => {
    render(<TutorialView tutorial={tutorial({ kind: 'assistive_tech' })} signedIn={false} />)
    expect(screen.getByText('Assistive tech')).toBeInTheDocument()
  })

  it('lists recommendations as cards in position order', () => {
    render(<TutorialView tutorial={tutorial({ tutorial_recommendations: [rec('a', 1), rec('b', 2), rec('c', 3)] })} signedIn={false} />)
    expect(screen.getByText('Also worth a look')).toBeInTheDocument()
    const hrefs = screen.getAllByTestId('rec-card').map((el) => el.getAttribute('href'))
    expect(hrefs).toEqual(['/tutorials/a', '/tutorials/b', '/tutorials/c'])
    expect(screen.queryByText(/Not yet approved/)).toBeNull()
  })

  // Only the review pages ever hand this an unapproved target; the public
  // route has dropped them before the component sees the tutorial.
  it('tags an unapproved recommendation for a reviewer', () => {
    render(<TutorialView tutorial={tutorial({ tutorial_recommendations: [rec('a', 1, 'pending')] })} signedIn={false} />)
    expect(screen.getByText(/Not yet approved/)).toBeInTheDocument()
  })

  it('draws no section when there are no recommendations', () => {
    render(<TutorialView tutorial={tutorial()} signedIn={false} />)
    expect(screen.queryByText('Also worth a look')).toBeNull()
  })

  const files = { kind: 'assistive_tech' as const, tutorial_pdf_url: 't1/tutorial.pdf', stl_files: stl }

  // The link is the gate the visitor sees. Same <a>, a different destination
  // — no client JavaScript, the way save-button.tsx sends a signed-out saver
  // to signup.
  it('sends a signed-out visitor to sign up from the PDF and each STL', () => {
    render(<TutorialView tutorial={tutorial(files)} signedIn={false} />)
    const detour = '/signup?next=%2Ftutorials%2Ft1&reason=download'
    expect(screen.getByRole('link', { name: 'Sign in to download' })).toHaveAttribute('href', detour)
    expect(screen.getByRole('link', { name: 'Download bracket.stl' })).toHaveAttribute('href', detour)
    expect(screen.getByRole('link', { name: 'Sign in to download' })).not.toHaveAttribute('target')
  })

  it('links a signed-in visitor through /files, which signs on click', () => {
    render(<TutorialView tutorial={tutorial(files)} signedIn />)
    expect(screen.getByRole('link', { name: 'Download guide (PDF)' })).toHaveAttribute(
      'href',
      '/files/tutorial-pdfs/t1/tutorial.pdf'
    )
    expect(screen.getByRole('link', { name: 'Download guide (PDF)' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'Download bracket.stl' })).toHaveAttribute('href', '/files/stl-files/t1/bracket.stl')
    expect(screen.getByRole('link', { name: 'Download bracket.stl' })).not.toHaveAttribute('target')
  })

  // Parts sourcing is open in both states: it is someone else's shop, and a
  // parent pricing a build should not need an account to do it.
  it('leaves buy links open either way', () => {
    const parts = [{ id: 'p1', tutorial_id: 't1', name: 'Switch', quantity: 1, is_optional: false, buy_links: [{ label: 'Jaycar', url: 'https://shop.test/switch' }] }]
    render(<TutorialView tutorial={tutorial({ parts })} signedIn={false} />)
    expect(screen.getByRole('link', { name: 'Buy Switch from Jaycar' })).toHaveAttribute('href', 'https://shop.test/switch')
  })
})

describe('TutorialView tabs', () => {
  const parts = [{ id: 'p1', tutorial_id: 't1', name: 'Switch', quantity: 1, is_optional: false, buy_links: [] }]

  // Only the sections the data can fill get a tab; the board's Steps and
  // Community notes have nothing behind them in this schema.
  it('draws a tab per filled section and keeps the rest in the DOM', () => {
    render(
      <TutorialView
        tutorial={tutorial({ kind: 'assistive_tech', parts, stl_files: stl, safety_declared_at: '2026-08-01T00:00:00Z' })}
        signedIn
      />
    )
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Parts & tools',
      'Files & print settings',
      'Safety',
    ])
    expect(screen.getByText('bracket.stl').closest('[role="tabpanel"]')).toHaveAttribute('hidden')
  })

  it('draws no strip for a single section', () => {
    render(<TutorialView tutorial={tutorial({ parts })} signedIn={false} />)
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByText('Switch')).toBeVisible()
  })
})
