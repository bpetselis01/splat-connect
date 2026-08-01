import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const org = (id: string) => ({
  id, name: `Org ${id}`, description: null, status: 'active',
  created_by: null, created_at: '', updated_at: '',
  org_leaders: [{ id: `l-${id}`, org_id: id, user_id: 'u1', created_at: '' }],
})

describe('admin organisations', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: the page does not issue a request per organisation
  // How:   three organisations; counts calls to /api/organizations/:id
  // Chain: fine at five, silly at fifty — and a <details> cannot defer it, since a
  //        server component renders whether or not the panel is open. The list
  //        endpoint carries the leaders instead
  it('fetches the list once, not once per organisation', async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/organizations' ? [org('o1'), org('o2'), org('o3')]
          : path === '/api/admin/contributors'
            ? {
                accounts: [{ id: 'u1', name: 'Sam', email: 'sam@example.com', role: 'contributor', created_at: '' }],
                total: 1,
              }
            : []
      )
    )
    const { default: Page } = await import('@/app/admin/organizations/page')
    render(await Page())

    const perOrg = get.mock.calls.filter((c) => /^\/api\/organizations\/o\d$/.test(c[0] as string))
    expect(perOrg).toHaveLength(0)
  })

  // Tests: leaders still render, from the list payload
  // Chain: removing the per-org fetch without the embed would have silently shown
  //        every organisation as leaderless
  it('shows each organisation its leaders', async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/organizations' ? [org('o1')]
          : path === '/api/admin/contributors'
            ? {
                accounts: [{ id: 'u1', name: 'Sam', email: 'sam@example.com', role: 'contributor', created_at: '' }],
                total: 1,
              }
            : []
      )
    )
    const { default: Page } = await import('@/app/admin/organizations/page')
    render(await Page())

    expect(screen.getByText(/Leaders \(1\)/)).toBeInTheDocument()
    // Three times: the leader row, the create-org picker, and the add-leader
    // picker — each form has its own <select> of eligible leaders.
    expect(screen.getAllByText('Sam')).toHaveLength(3)
  })

  // Tests: the id itself is never rendered as visible text anywhere on the page,
  // even though it is still the submitted value. A <select>'s option value is
  // never shown to the user, unlike an <input list> datalist's value, which
  // browsers surface as the primary autocomplete suggestion.
  it('never shows a raw profile id as visible text', async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/organizations' ? [org('o1')]
          : path === '/api/admin/contributors'
            ? {
                accounts: [{ id: 'u1', name: 'Sam', email: 'sam@example.com', role: 'contributor', created_at: '' }],
                total: 1,
              }
            : []
      )
    )
    const { default: Page } = await import('@/app/admin/organizations/page')
    const { container } = render(await Page())

    expect(container.textContent).not.toContain('u1')
    expect(container.querySelector('datalist')).toBeNull()
  })
})
