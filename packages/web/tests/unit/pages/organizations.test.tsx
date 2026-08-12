import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
// The page shows the directory only to a signed-in caller — see the fetch
// comment in app/organizations/page.tsx. Signed in is the default here so the
// directory cases below read as they always did.
const getUserRole = vi.fn(async () => 'contributor' as const)
vi.mock('@/lib/auth', () => ({ getUserRole: () => getUserRole() }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const org = (id: string, name: string, status: 'active' | 'suspended') => ({
  id, name, description: `${name} helps children`, status,
  created_by: null, created_at: '', updated_at: '',
})

describe('organisations directory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserRole.mockResolvedValue('contributor')
  })

  // Tests: a suspended organisation is shown and marked, not hidden
  // How:   one active and one suspended; checks both render and the state is stated
  // Chain: an organisation vanishing from a directory is unexplainable to someone
  //        who expected to find it, and their name is still on work they backed
  it('lists suspended organisations, marked', async () => {
    get.mockResolvedValue([org('o1', 'Riverside', 'active'), org('o2', 'Dormant', 'suspended')])
    const { default: Page } = await import('@/app/organizations/page')
    render(await Page())

    expect(screen.getByText('Riverside')).toBeInTheDocument()
    expect(screen.getByText('Dormant')).toBeInTheDocument()
    expect(screen.getByText('SUSPENDED')).toBeInTheDocument()
  })

  // Tests: the empty state teaches who creates organisations
  // How:   empty list; checks the copy names SPLAT and the asking flow
  // Chain: a contributor cannot create one and would otherwise be left looking for
  //        a button that does not exist
  it('teaches the interface when there are none', async () => {
    get.mockResolvedValue([])
    const { default: Page } = await import('@/app/organizations/page')
    render(await Page())
    expect(screen.getByText(/No organisations yet/i)).toBeInTheDocument()
    expect(screen.getByText(/set up by SPLAT/i)).toBeInTheDocument()
  })

  it('links each organisation to its page', async () => {
    get.mockResolvedValue([org('o1', 'Riverside', 'active')])
    const { default: Page } = await import('@/app/organizations/page')
    render(await Page())
    expect(screen.getByRole('link')).toHaveAttribute('href', '/organizations/o1')
  })

  // Tests: a signed-out visitor gets the explainer and no directory
  // How:   getUserRole resolves null; checks nothing was fetched and the page
  //        points at sign-in instead of listing organisations
  // Chain: GET /api/organizations builds its Supabase client from the caller's
  //        token, so there is no anonymous path to this data → the page must
  //        not attempt the call rather than fail on it
  it('shows the explainer and never fetches when signed out', async () => {
    getUserRole.mockResolvedValue(null as never)
    const { default: Page } = await import('@/app/organizations/page')
    render(await Page())

    expect(get).not.toHaveBeenCalled()
    expect(screen.getByText(/Only SPLAT creates them/i)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/login')
  })
})
