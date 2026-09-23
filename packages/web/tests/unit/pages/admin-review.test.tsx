import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
// The row link is a client island (it opens the pane); the pane's buttons are
// server actions. Neither runs here — they only have to import.
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const org = (id: string, name: string) => ({
  id, name, description: null, status: 'active' as const,
  created_by: null, created_at: '', updated_at: '',
})
const backing = (orgId: string, name: string, status: 'pending' | 'accepted' | 'declined') => ({
  id: `${orgId}-b`, tutorial_id: 't', org_id: orgId, status,
  requested_at: '', responded_at: null, responded_by: null, organizations: org(orgId, name),
})
const tutorial = (id: string, title: string, tutorial_orgs: unknown[]) => ({
  id, title, description: null, difficulty: 'easy', status: 'pending',
  tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null,
  created_at: '2026-07-01T00:00:00.000Z', reviewed_at: null,
  reviewed_by: null, reviewed_for_org_id: null, tutorial_orgs,
})

const handled = tutorial('t1', 'Backed project', [backing('o1', 'Riverside Therapy', 'accepted')])
const unhandled = tutorial('t2', 'Platform project', [])
const askedOnly = tutorial('t3', 'Asked but unanswered', [backing('o2', 'Northside Clinic', 'pending')])

describe('admin review queue', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: every pending tutorial is listed by default, with the backing org named
  // How:   three tutorials, one accepted by an org; renders with no searchParams
  // Chain: decision 23 — delegation removes the obligation to act, not the visibility,
  //        so the admin still sees work an org is handling and knows who has it
  it('shows org-handled work by default, and says who has it', async () => {
    get.mockResolvedValue([handled, unhandled, askedOnly])
    const { default: Page } = await import('@/app/admin/review/page')
    render(await Page({ searchParams: Promise.resolve({}) }))

    expect(screen.getByText('Backed project')).toBeInTheDocument()
    expect(screen.getByText('Platform project')).toBeInTheDocument()
    // The queue is a table now: who has it is the Backing cell, not a sentence
    // appended to the row. Still the same thing being asserted — that a
    // handled item names the organisation holding it.
    expect(screen.getByText(/Riverside Therapy/)).toBeInTheDocument()
  })

  // Tests: a merely pending request does not count as handled
  // How:   'Asked but unanswered' has a pending backing row; checks it survives the filter
  // Chain: being asked is not the same as accepting — until an org accepts, the work is
  //        still the admin's, and hiding it would drop it out of both queues
  it('does not treat a pending request as handled', async () => {
    get.mockResolvedValue([handled, unhandled, askedOnly])
    const { default: Page } = await import('@/app/admin/review/page')
    render(await Page({ searchParams: Promise.resolve({ mine: '1' }) }))

    expect(screen.getByText('Asked but unanswered')).toBeInTheDocument()
    expect(screen.getByText('Platform project')).toBeInTheDocument()
    expect(screen.queryByText('Backed project')).not.toBeInTheDocument()
  })

  // Tests: the hide link appears only when there is something to hide
  // How:   renders with no accepted backing at all; checks the link is absent
  // Chain: an admin with no delegated work sees no control for it, rather than a
  //        toggle that does nothing
  it('offers no hide link when nothing is being handled', async () => {
    get.mockResolvedValue([unhandled])
    const { default: Page } = await import('@/app/admin/review/page')
    render(await Page({ searchParams: Promise.resolve({}) }))

    expect(screen.queryByText(/Hide the/)).not.toBeInTheDocument()
  })

  // Tests: ?selected= opens the side pane for that row, and the row link still
  //        points at the full review page
  // How:   selects t2; the detail fetch answers with a guide missing its PDF and
  //        with a co-author invite still pending
  // Chain: the pane is a progressive enhancement — without JS the row must
  //        still reach /admin/review/[id]; with it, the marks come from data
  it('opens the side pane for the selected row, marks computed from the guide', async () => {
    get.mockImplementation(async (path: string) =>
      path === '/api/tutorials/t2'
        ? {
            ...unhandled, kind: 'toy_adaptation', photo_urls: ['a.jpg'], safety_declared_at: '2026-07-01T00:00:00Z',
            parts: [{ id: 'p', name: 'Jack', quantity: 1 }], tools: [], stl_files: [],
            tutorial_pdf_url: null, tutorial_contributors: [],
            tutorial_collaborator_invites: [{ id: 'i', status: 'pending' }],
          }
        : path.startsWith('/api/admin/tutorials')
          ? [handled, unhandled]
          : []
    )
    const { default: Page } = await import('@/app/admin/review/page')
    render(await Page({ searchParams: Promise.resolve({ selected: 't2' }) }))

    const pane = screen.getByRole('complementary', { name: /reviewing platform project/i })
    expect(pane).toHaveTextContent('No guide PDF')
    expect(pane).toHaveTextContent('Co-authors not confirmed')
    expect(pane).toHaveTextContent('At least one photo')
    expect(screen.getByRole('link', { name: /open full preview/i })).toHaveAttribute('href', '/admin/review/t2')
    expect(screen.getAllByRole('link', { name: 'Platform project' })[0]).toHaveAttribute('href', '/admin/review/t2')
  })
})
