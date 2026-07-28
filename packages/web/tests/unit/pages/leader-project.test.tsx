import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), post: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  redirect: vi.fn(),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

const theOrg = {
  id: 'o1', name: 'Riverside', description: null, status: 'active',
  created_by: null, created_at: '', updated_at: '',
}

const tutorial = (status: string) => ({
  id: 't1', title: 'Spoon holder', description: 'A spoon holder', difficulty: 'easy',
  status, tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null,
  created_at: '', reviewed_at: null, reviewed_by: null, reviewed_for_org_id: null,
  reviewer: status === 'approved' ? { name: 'Sam' } : null,
  reviewed_for: status === 'approved' ? { name: 'Riverside' } : null,
  tutorial_contributors: [], parts: [], tools: [], stl_files: [],
})

const route = (o: { leads: boolean; tutorialStatus: string; backing: string | null }) => (path: string) =>
  Promise.resolve(
    path === '/api/organizations/mine' ? (o.leads ? [theOrg] : [])
      : path === '/api/tutorials/t1/orgs'
        ? (o.backing
            ? [{ id: 'b1', tutorial_id: 't1', org_id: 'o1', status: o.backing, requested_at: '', responded_at: null, responded_by: null }]
            : [])
      : path === '/api/tutorials/t1' ? tutorial(o.tutorialStatus)
      : theOrg
  )

const params = () => Promise.resolve({ id: 'o1', tutorialId: 't1' })

describe('leader project page', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: a leader can READ a project they were asked to back, and decide
  // How:   pending backing, pending tutorial; checks content and both actions
  // Chain: this is the hole — the queue linked pending requests to the public page,
  //        which serves only approved work, so the leader got a 404 on the one
  //        thing they had to read before deciding
  it('renders the tutorial and the backing decision for a pending request', async () => {
    get.mockImplementation(route({ leads: true, tutorialStatus: 'pending', backing: 'pending' }))
    const { default: Page } = await import('@/app/organizations/[id]/projects/[tutorialId]/page')
    render(await Page({ params: params() }))

    expect(screen.getByText('Spoon holder')).toBeInTheDocument()
    expect(screen.getByText('A spoon holder')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back this project/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Decline$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument()
  })

  it('offers the review decision once backing is accepted', async () => {
    get.mockImplementation(route({ leads: true, tutorialStatus: 'pending', backing: 'accepted' }))
    const { default: Page } = await import('@/app/organizations/[id]/projects/[tutorialId]/page')
    render(await Page({ params: params() }))

    expect(screen.getByRole('button', { name: /Approve and publish/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Back this project/i })).not.toBeInTheDocument()
  })

  // Tests: published work is read-only here, and says who published it
  // Chain: a leader cannot unpublish — only SPLAT can — so the page must say that
  //        rather than show a button the database refuses
  it('is read-only once the tutorial is published, and names the approver', async () => {
    get.mockImplementation(route({ leads: true, tutorialStatus: 'approved', backing: 'accepted' }))
    const { default: Page } = await import('@/app/organizations/[id]/projects/[tutorialId]/page')
    render(await Page({ params: params() }))

    expect(screen.queryByRole('button', { name: /Approve|Reject|Back|Decline/i })).not.toBeInTheDocument()
    expect(screen.getByText(/approved by Sam/i)).toBeInTheDocument()
    expect(screen.getByText(/Only SPLAT can take it down/i)).toBeInTheDocument()
  })

  it('404s for someone who does not lead the organisation', async () => {
    get.mockImplementation(route({ leads: false, tutorialStatus: 'pending', backing: 'pending' }))
    const { default: Page } = await import('@/app/organizations/[id]/projects/[tutorialId]/page')
    await expect(Page({ params: params() })).rejects.toThrow('NOT_FOUND')
  })
})
