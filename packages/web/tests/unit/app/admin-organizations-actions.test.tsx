import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'

// The first page import loads the whole icon set; a cold run takes several seconds.
vi.setConfig({ testTimeout: 30_000 })

const get = vi.fn()
const post = vi.fn()
const patch = vi.fn()
const del = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}))
const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
const redirect = vi.fn()
vi.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => redirect(...a) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

const org = (over: Record<string, unknown> = {}) => ({
  id: 'o1', name: 'Eastside Makers', description: 'Builds switch toys', status: 'active', verified_at: null,
  suburb: null, state: null, created_by: null, created_at: '', updated_at: '',
  org_leaders: [{ id: 'l1', org_id: 'o1', user_id: 'u1', created_at: '' }],
  ...over,
})
const accounts = {
  accounts: [
    { id: 'u1', name: 'Sam Leader', email: 'sam@example.com', role: 'contributor', created_at: '2026-01-01T00:00:00Z' },
    { id: 'u2', name: 'Priya Maker', email: 'priya@example.com', role: 'contributor', created_at: '2026-01-02T00:00:00Z' },
  ],
  total: 2,
}

async function open(searchParams: Record<string, string>, orgs = [org()]) {
  get.mockImplementation((path: string) => Promise.resolve(path === '/api/organizations' ? orgs : accounts))
  const { default: Page } = await import('@/app/admin/organizations/page')
  return render(await Page({ searchParams: Promise.resolve(searchParams) }))
}

// Click the button: jsdom turns it into the form's submit, which React answers by calling the form's action with its FormData.
const submit = (button: HTMLElement) => fireEvent.click(button)

beforeEach(() => vi.clearAllMocks())

describe('admin organisations actions', () => {
  it('WM18 Create organisation posts the name, description and chosen first leader, then returns to the list', async () => {
    await open({ new: '1' })
    const drawer = screen.getByRole('dialog', { name: 'New organisation' })
    fireEvent.change(within(drawer).getByLabelText('Name'), { target: { value: 'Westside Printers' } })
    fireEvent.change(within(drawer).getByLabelText('Description'), { target: { value: 'Prints for families' } })
    fireEvent.change(within(drawer).getByLabelText('First leader'), { target: { value: 'u2' } })
    submit(within(drawer).getByRole('button', { name: 'Create organisation' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/admin/organizations', {
        name: 'Westside Printers',
        description: 'Prints for families',
        leader_user_id: 'u2',
      })
    )
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/admin/organizations'))
    expect(revalidatePath).toHaveBeenCalledWith('/admin')
  })

  it('WM19 Appoint posts the chosen account to the organisation leaders', async () => {
    await open({ manage: 'o1' })
    fireEvent.change(screen.getByLabelText('New leader'), { target: { value: 'u2' } })
    submit(screen.getByRole('button', { name: 'Appoint' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/admin/organizations/o1/leaders', { user_id: 'u2' }))
  })

  it('WM20 Remove deletes that leader from the organisation', async () => {
    await open({ manage: 'o1' })
    const drawer = screen.getByRole('dialog', { name: 'Eastside Makers' })
    submit(within(drawer).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/admin/organizations/o1/leaders/u1'))
  })

  it('WM21 Verify asks for verified true, and Unverify for verified false', async () => {
    const first = await open({ manage: 'o1' })
    submit(screen.getByRole('button', { name: 'Verify' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/organizations/o1', { verified: true }))
    first.unmount()

    await open({ manage: 'o1' }, [org({ verified_at: '2026-05-01T00:00:00Z' })])
    submit(screen.getByRole('button', { name: 'Unverify' }))
    await waitFor(() => expect(patch).toHaveBeenLastCalledWith('/api/admin/organizations/o1', { verified: false }))
  })

  it('WM22 Suspend sends status suspended, and Reactivate sends active', async () => {
    const first = await open({ manage: 'o1' })
    submit(screen.getByRole('button', { name: 'Suspend organisation' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/organizations/o1', { status: 'suspended' }))
    first.unmount()

    await open({ manage: 'o1' }, [org({ status: 'suspended' })])
    submit(screen.getByRole('button', { name: 'Reactivate organisation' }))
    await waitFor(() => expect(patch).toHaveBeenLastCalledWith('/api/admin/organizations/o1', { status: 'active' }))
  })
})
