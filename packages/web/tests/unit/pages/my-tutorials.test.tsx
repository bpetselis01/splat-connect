import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MyTutorialsPage from '@/app/my-tutorials/page'
import type { Tutorial } from '@splat-connect/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/difficulty-badge', () => ({
  DifficultyBadge: () => null,
}))

import { apiClient } from '@/lib/api-client'

const baseTutorial: Tutorial = {
  id: '1',
  title: 'Test Tutorial',
  difficulty: 'easy',
  status: 'approved',
  description: null,
  tutorial_pdf_url: null,
  toy_photo_url: null,
  rejection_note: null,
  created_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
  reviewed_for_org_id: null,
}

describe('MyTutorialsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // Tests: tutorial title, uppercase status badge, and Edit link render for each row
  // How:   passes one draft tutorial with id 'abc'; checks title text, 'DRAFT' badge,
  //        and Edit link href
  // Chain: contributors scan this list to find and navigate to specific tutorials by title
  it('renders tutorial title, status badge, and Edit link', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      { ...baseTutorial, id: 'abc', title: 'Switch Tutorial', status: 'draft' },
    ])
    render(await MyTutorialsPage())
    expect(screen.getByText('Switch Tutorial')).toBeInTheDocument()
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/tutorials/abc/edit')
  })

  // Tests: empty state message appears when the contributor has no tutorials
  // How:   passes an empty array; checks for the empty-state copy
  // Chain: first-time contributors see a prompt to create their first tutorial
  it('shows empty state when no tutorials', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([])
    render(await MyTutorialsPage())
    expect(screen.getByText(/haven't submitted any tutorials/i)).toBeInTheDocument()
  })

  // Tests: rejection note text appears when a rejected tutorial has a note
  // How:   passes a rejected tutorial with rejection_note: 'Needs more detail';
  //        checks the note text is in the document
  // Chain: contributor reads the admin's specific feedback inline from the list
  it('shows rejection note for rejected tutorial with a note', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      { ...baseTutorial, status: 'rejected', rejection_note: 'Needs more detail' },
    ])
    render(await MyTutorialsPage())
    expect(screen.getByText('Needs more detail')).toBeInTheDocument()
  })

  // Tests: fallback text appears when a rejected tutorial has no note
  // How:   passes a rejected tutorial with rejection_note: null;
  //        checks 'No feedback was provided.' is in the document
  // Chain: contributor knows their tutorial was rejected even when the admin gave no reason
  it('shows fallback text for rejected tutorial with no note', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      { ...baseTutorial, status: 'rejected', rejection_note: null },
    ])
    render(await MyTutorialsPage())
    expect(screen.getByText('No feedback was provided.')).toBeInTheDocument()
  })

  // Tests: rejection callout does not appear for draft, pending, or approved tutorials
  // How:   passes three tutorials with non-rejected statuses; asserts fallback text is absent
  // Chain: the callout is rejection-specific — other statuses must not show it
  it('does not show rejection callout for draft, pending, or approved tutorials', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      { ...baseTutorial, id: '1', status: 'draft' },
      { ...baseTutorial, id: '2', status: 'pending' },
      { ...baseTutorial, id: '3', status: 'approved' },
    ])
    render(await MyTutorialsPage())
    expect(screen.queryByText('No feedback was provided.')).toBeNull()
  })

  // Tests: a row states its backing without the reader opening the tutorial
  // How:   one accepted row in the fixture; checks the summary text
  // Chain: the row's job is to say whether it is worth clicking — before this a
  //        contributor had to open a tutorial to learn anything about backing, and
  //        there was nothing there to find
  it('shows backing state on the row', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      {
        ...baseTutorial,
        id: 't1',
        title: 'Spoon holder',
        tutorial_orgs: [
          {
            id: 'b1', tutorial_id: 't1', org_id: 'o1', status: 'accepted',
            requested_at: '', responded_at: null, responded_by: null,
            organizations: {
              id: 'o1', name: 'Riverside Therapy', description: null,
              status: 'active', created_by: null, created_at: '', updated_at: '',
            },
          },
        ],
      },
    ])
    render(await MyTutorialsPage())
    expect(screen.getByText('Backed by Riverside Therapy')).toBeInTheDocument()
  })

  it('says a tutorial with no backing is reviewed by SPLAT', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([{ ...baseTutorial, tutorial_orgs: [] }])
    render(await MyTutorialsPage())
    expect(screen.getByText('Reviewed by SPLAT')).toBeInTheDocument()
  })
})
