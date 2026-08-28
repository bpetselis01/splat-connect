import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), post: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// usePathname is here for BoundaryLink, which the backed-tutorials list uses to
// force a full load out of the rail into the public /tutorials/[id] page.
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
  usePathname: () => '/organizations/org-1',
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/org-review-banner', () => ({ OrgReviewBanner: () => <div>ACCEPT TERMS</div> }))

const theOrg = {
  id: 'o1', name: 'Riverside Therapy', description: 'Helps children',
  status: 'active', created_by: null, created_at: '', updated_at: '',
}

/** One pending request and one published, backed tutorial. */
const tutorials = [
  {
    id: 't1', title: 'Asking project', description: null, difficulty: 'easy',
    status: 'pending', tutorial_pdf_url: null, toy_photo_url: null,
    rejection_note: null, created_at: '', reviewed_at: null,
    reviewed_by: null, reviewed_for_org_id: null,
    tutorial_orgs: [{ id: 'b1', tutorial_id: 't1', org_id: 'o1', status: 'pending', requested_at: '', responded_at: null, responded_by: null }],
  },
  {
    id: 't2', title: 'Published project', description: null, difficulty: 'easy',
    status: 'approved', tutorial_pdf_url: null, toy_photo_url: null,
    rejection_note: null, created_at: '', reviewed_at: null,
    reviewed_by: null, reviewed_for_org_id: 'o1',
    tutorial_orgs: [{ id: 'b2', tutorial_id: 't2', org_id: 'o1', status: 'accepted', requested_at: '', responded_at: null, responded_by: null }],
  },
]

const route = (mine: unknown[]) => (path: string) =>
  Promise.resolve(
    path === '/api/organizations/mine' ? mine
      : path === '/api/tutorials' ? tutorials
      : path === '/api/agreements/me' ? [{ id: 'a', user_id: 'u', agreement_type: 'org_leader_terms', version: 'v0-todo', accepted_at: '' }]
      : theOrg
  )

describe('organisation detail', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: a non-leader is sent to the public profile, not left on a dead end
  // How:   /api/organizations/mine returns [] (empty — leads nothing)
  // Chain: an anonymous visitor's fetch of GET /api/organizations/:id 401s behind
  //        authMiddleware, so this page cannot render anything for them itself —
  //        it must redirect, and a signed-in non-leader gets the same redirect
  //        rather than a page missing its workspace
  it('redirects a non-leader to the public profile', async () => {
    get.mockImplementation(route([]))
    const { default: Page } = await import('@/app/organizations/[id]/page')

    await expect(
      Page({ params: Promise.resolve({ id: 'o1' }) })
    ).rejects.toThrow('REDIRECT:/organizations/o1/public')
  })

  it('adds the workspace for a leader of it', async () => {
    get.mockImplementation(route([theOrg]))
    const { default: Page } = await import('@/app/organizations/[id]/page')
    render(await Page({ params: Promise.resolve({ id: 'o1' }) }))

    expect(screen.getByText('Riverside Therapy')).toBeInTheDocument()
    expect(screen.getByText(/Waiting on you/i)).toBeInTheDocument()
    expect(screen.getByText('Asking project')).toBeInTheDocument()
  })

  // Tests: the public half lists only published, accepted work
  // How:   fixture has one pending request and one published backed tutorial
  // Chain: a pending request is not an endorsement, and listing it here would claim
  //        one the organisation never gave
  it('lists only published tutorials it actually backed', async () => {
    get.mockImplementation(route([theOrg]))
    const { default: Page } = await import('@/app/organizations/[id]/page')
    render(await Page({ params: Promise.resolve({ id: 'o1' }) }))

    expect(screen.getByText(/Tutorials backed \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Tutorials backed \(1\)/).closest('section')).not.toHaveTextContent('Asking project')
  })

  // Tests: both kinds of waiting work appear in one list
  // Chain: a leader arrives asking "what is oldest", not "what kind of thing is
  //        oldest" — two sections made them merge the answer themselves
  it('shows one queue rather than two sections', async () => {
    get.mockImplementation(route([theOrg]))
    const { default: Page } = await import('@/app/organizations/[id]/page')
    render(await Page({ params: Promise.resolve({ id: 'o1' }) }))

    expect(screen.getByText(/Waiting on you/i)).toBeInTheDocument()
    expect(screen.queryByText(/Projects asking for your backing/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Waiting for your review/i)).not.toBeInTheDocument()
  })

  // Tests: no queue row links to the public tutorial page
  // Chain: that link IS the hole — the public page serves only approved work, so
  //        every item in this queue 404'd on click
  it('links rows to the project page, never the public one', async () => {
    get.mockImplementation(route([theOrg]))
    const { default: Page } = await import('@/app/organizations/[id]/page')
    render(await Page({ params: Promise.resolve({ id: 'o1' }) }))

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/organizations/o1/projects/t1')
    expect(hrefs.filter((h) => h === '/tutorials/t1')).toHaveLength(0)
  })
})
