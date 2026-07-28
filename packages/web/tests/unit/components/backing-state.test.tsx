import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BackingSummary, BackingBadge } from '@/components/backing-state'
import type { TutorialOrg, TutorialOrgStatus } from '@splat-connect/types'

const row = (name: string, status: TutorialOrgStatus): TutorialOrg => ({
  id: name,
  tutorial_id: 't',
  org_id: name,
  status,
  requested_at: '',
  responded_at: null,
  responded_by: null,
  organizations: {
    id: name,
    name,
    description: null,
    status: 'active',
    created_by: null,
    created_at: '',
    updated_at: '',
  },
})

describe('BackingSummary', () => {
  // Tests: the default path reads as a path, not as an absence
  // How:   renders with no backing rows; checks the SPLAT wording
  // Chain: every tutorial written before organisations existed is in this state —
  //        calling it "no organisation" would make the normal case read as failure
  it('reads "Reviewed by SPLAT" when nothing was asked', () => {
    render(<BackingSummary backing={[]} />)
    expect(screen.getByText('Reviewed by SPLAT')).toBeInTheDocument()
  })

  it('names a single organisation that is deciding', () => {
    render(<BackingSummary backing={[row('Riverside Therapy', 'pending')]} />)
    expect(screen.getByText('Riverside Therapy is deciding')).toBeInTheDocument()
  })

  it('counts several that are deciding rather than listing them', () => {
    render(<BackingSummary backing={[row('A', 'pending'), row('B', 'pending')]} />)
    expect(screen.getByText('2 organisations deciding')).toBeInTheDocument()
  })

  it('leads with who is backing it, and mentions who is still deciding', () => {
    render(
      <BackingSummary backing={[row('Riverside', 'accepted'), row('Northside', 'pending')]} />
    )
    expect(screen.getByText(/Backed by Riverside/)).toBeInTheDocument()
    expect(screen.getByText(/1 still deciding/)).toBeInTheDocument()
  })

  it('joins several backers', () => {
    render(
      <BackingSummary backing={[row('Riverside', 'accepted'), row('Northside', 'accepted')]} />
    )
    expect(screen.getByText('Backed by Riverside and Northside')).toBeInTheDocument()
  })

  // Tests: all-declined says where the work went, not just that it was refused
  // How:   two declined rows; checks both the refusal and the fallback are stated
  // Chain: a contributor whose organisations all said no must not read it as a dead
  //        end — the tutorial is still queued, just with the platform instead
  it('says where the work went when everyone declined', () => {
    render(<BackingSummary backing={[row('A', 'declined'), row('B', 'declined')]} />)
    expect(screen.getByText(/2 organisations declined/)).toBeInTheDocument()
    expect(screen.getByText(/now reviewed by SPLAT/i)).toBeInTheDocument()
  })
})

describe('BackingBadge', () => {
  // Tests: the three states are visually distinct, not merely differently worded
  // How:   renders each; checks the word and that the classes differ
  // Chain: "waiting on someone else" and "they said no" are the two states a
  //        contributor most needs to tell apart at a glance, and colour is what
  //        does that work in a list
  it('renders each state with its own word and treatment', () => {
    const { rerender, container } = render(<BackingBadge status="accepted" />)
    expect(screen.getByText('BACKING')).toBeInTheDocument()
    const accepted = container.firstElementChild?.className

    rerender(<BackingBadge status="pending" />)
    expect(screen.getByText('DECIDING')).toBeInTheDocument()
    const pending = container.firstElementChild?.className

    rerender(<BackingBadge status="declined" />)
    expect(screen.getByText('DECLINED')).toBeInTheDocument()
    const declined = container.firstElementChild?.className

    expect(new Set([accepted, pending, declined]).size).toBe(3)
  })

  // Tests: the badge reuses the status palette rather than inventing one
  // How:   checks the accepted badge carries the same mint pair StatusBadge uses
  // Chain: a leader sees a StatusBadge and a BackingBadge on the same row; if mint
  //        meant two different things they would have to learn two colour languages
  it('reuses the StatusBadge palette', () => {
    const { container } = render(<BackingBadge status="accepted" />)
    expect(container.firstElementChild?.className).toContain('bg-mint-soft')
    expect(container.firstElementChild?.className).toContain('text-mint-deep')
  })
})
