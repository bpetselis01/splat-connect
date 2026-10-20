import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.setConfig({ testTimeout: 30_000 })

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

const answers = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  '/api/admin/tutorials?status=pending': [],
  '/api/admin/contributors': { accounts: [], total: 0 },
  '/api/admin/counts': { tutorials: 3, reports: 2, ideas: 4, spotCheck: 5, accounts: 7, organisations: 6 },
  '/api/admin/ideas': [],
  '/api/admin/organization-requests': [
    { id: 'r1', status: 'pending', org_name: 'A', created_at: '2020-01-01T00:00:00Z' },
    { id: 'r2', status: 'pending', org_name: 'B', created_at: '2020-01-01T00:00:00Z' },
    { id: 'r3', status: 'approved', org_name: 'C', created_at: '2020-01-01T00:00:00Z' },
  ],
  '/api/admin/inbox': [
    { id: 'm1', status: 'open', name: 'Jen', created_at: '2020-01-01T00:00:00Z' },
    { id: 'm2', status: 'open', name: 'Kim', created_at: '2020-01-01T00:00:00Z' },
    { id: 'm3', status: 'open', name: 'Lee', created_at: '2020-01-01T00:00:00Z' },
    { id: 'm4', status: 'closed', name: 'Max', created_at: '2020-01-01T00:00:00Z' },
  ],
  '/api/admin/member-reports': [],
  '/api/admin/build-requests': [
    { id: 'b1', unclaimed_too_long: true, claimed_and_silent: false },
    { id: 'b2', unclaimed_too_long: false, claimed_and_silent: false },
  ],
  '/api/admin/print-jobs': [{ id: 'p1', stalled: true }, { id: 'p2', stalled: false }],
  '/api/admin/test-prints': [{ id: 'x1', verdict: null }, { id: 'x2', verdict: null }, { id: 'x3', verdict: 'pass' }],
  ...over,
})

async function open(over: Record<string, unknown> = {}) {
  const table = answers(over)
  get.mockImplementation((path: string) => Promise.resolve(table[path]))
  const { default: Page } = await import('@/app/admin/page')
  render(await Page())
}

const card = (name: RegExp) => screen.getByRole('link', { name })

beforeEach(() => vi.clearAllMocks())

describe('admin dashboard cards', () => {
  it.each([
    [/Site content/, '/admin/content', '4'],
    [/Tutorials awaiting review/, '/admin/review', '3'],
    [/Reports from members/, '/admin/reports', '2'],
    [/Design challenges awaiting review/, '/admin/ideas', '4'],
    [/Spot-check/, '/admin/spot-check', '5'],
    [/Print jobs stalled/, '/admin/print-jobs', '1'],
    [/Test prints/, '/admin/test-prints', '2'],
    [/Build requests needing a nudge/, '/admin/build-requests', '1'],
    [/Inbox/, '/admin/inbox', '3'],
    [/Accounts/, '/admin/contributors', '7'],
    [/Organisations Create/, '/admin/organizations', '6'],
    [/Organisation requests/, '/admin/organization-requests', '2'],
  ])('WM01 the %s card links to %s and shows %s', async (name, href, count) => {
    await open()
    const link = card(name)
    expect(link).toHaveAttribute('href', href)
    expect(within(link).getByText(count, { selector: 'p' })).toBeInTheDocument()
  })

  it('WM01 a queue the API cannot read shows 0 instead of taking the page down', async () => {
    get.mockImplementation((path: string) =>
      path === '/api/admin/counts' || path === '/api/admin/inbox' ? Promise.reject(new Error('down')) : Promise.resolve(answers()[path])
    )
    const { default: Page } = await import('@/app/admin/page')
    render(await Page())
    expect(within(card(/Tutorials awaiting review/)).getByText('0', { selector: 'p' })).toBeInTheDocument()
    expect(within(card(/Inbox/)).getByText('0', { selector: 'p' })).toBeInTheDocument()
  })

  it('WM02 Recent activity lists the six newest arrivals, newest first, and drops older ones', async () => {
    const at = (day: number) => `2026-10-0${day}T09:00:00Z`
    await open({
      '/api/admin/tutorials?status=pending': [{ id: 't1', title: 'Spoon holder', created_at: at(1) }],
      '/api/admin/ideas': [{ id: 'i1', title: 'Ladybug switch', created_at: at(2) }],
      '/api/admin/organization-requests': [{ id: 'o1', status: 'pending', org_name: 'Eastside Therapy', created_at: at(3) }],
      '/api/admin/member-reports': [
        { id: 'r1', category: 'safety', subject_label: 'Spoon holder', created_at: at(4) },
        { id: 'r2', category: 'other', subject_label: 'A toy', created_at: at(5) },
      ],
      '/api/admin/inbox': [{ id: 'm1', status: 'open', name: 'Jen', created_at: at(6) }],
      '/api/admin/contributors': { accounts: [{ id: 'a1', name: 'N', email: 'n@x', created_at: new Date().toISOString() }], total: 1 },
    })
    const items = within(screen.getByRole('heading', { name: 'Recent activity' }).nextElementSibling as HTMLElement).getAllByRole('listitem')
    expect(items.map((li) => li.textContent?.replace(/\d{1,2} [A-Z][a-z]{2} \d\d:\d\d$/, ''))).toEqual([
      '1 new account created',
      'Message from Jen',
      'Report on "A toy"',
      'Safety report on "Spoon holder"',
      'Eastside Therapy asked to join as an organisation',
      'New idea submitted — "Ladybug switch"',
    ])
    expect(screen.queryByText('"Spoon holder" submitted for review')).toBeNull()
  })
})
