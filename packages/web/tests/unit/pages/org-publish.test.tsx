import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1' }, isAdmin: false, ledOrgs: [{ id: 'o1', name: 'Splat North', status: 'active' }],
  }),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const calls: string[] = []
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: async (path: string) => {
      calls.push(path)
      if (path === '/api/organizations/o1/events')
        return [{ id: 'e1', kind: 'build_day', title: 'Build day', starts_at: new Date(Date.now() + 864e5).toISOString(), ends_at: null, format: 'online', status: 'published' }]
      if (path === '/api/organizations/o1/stories') return []
      if (path === '/api/organizations/o1/events/e1/registrations')
        return [{ id: 'r1', cancelled_at: null }, { id: 'r2', cancelled_at: '2026-10-01T00:00:00Z' }, { id: 'r3', cancelled_at: null }]
      if (path === '/api/toy-transactions?role=owner')
        return [{ event_id: 'e1', status: 'requested' }, { event_id: 'e1', status: 'accepted' }, { event_id: null, status: 'requested' }]
      throw new Error(`unexpected ${path}`)
    },
  },
}))

const Page = (await import('@/app/dashboard/organisation/publish/page')).default

describe('Events and stories page', () => {
  it('WB15 reads the acting organisation’s events, stories and registrations, and shows going and to-answer per event', async () => {
    render(await Page())
    expect(calls).toEqual(
      expect.arrayContaining(['/api/organizations/o1/events', '/api/organizations/o1/stories', '/api/organizations/o1/events/e1/registrations']),
    )
    expect(screen.getByRole('heading', { name: 'Build day' }).closest('article')).toHaveTextContent('Online · ')
    expect(screen.getByRole('heading', { name: 'Build day' }).closest('article')).toHaveTextContent('2 going · 1 to answer')
  })

  it('WB18 heads the page with "New story" and "New event" links', async () => {
    render(await Page())
    expect(screen.getByRole('link', { name: 'New story' })).toHaveAttribute('href', '/dashboard/organisation/stories/new')
    expect(screen.getByRole('link', { name: 'New event' })).toHaveAttribute('href', '/dashboard/organisation/events/new')
  })
})
