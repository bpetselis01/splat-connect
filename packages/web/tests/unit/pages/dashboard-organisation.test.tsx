import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const ORG_A = { id: 'oA', name: 'Splat North', status: 'active' }
const ORG_B = { id: 'oB', name: 'Splat South', status: 'active' }

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [ORG_A, ORG_B],
    canAuthor: true,
  }),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: async (path: string) => {
      if (path === '/api/tutorials') {
        return [
          {
            id: 't1',
            title: 'Older request',
            status: 'draft',
            difficulty: 'easy',
            created_at: '2026-01-01T00:00:00Z',
            tutorial_orgs: [{ id: 'r1', tutorial_id: 't1', org_id: 'oA', status: 'pending' }],
          },
          {
            id: 't2',
            title: 'Newer review',
            status: 'pending',
            difficulty: 'medium',
            created_at: '2026-02-01T00:00:00Z',
            tutorial_orgs: [{ id: 'r2', tutorial_id: 't2', org_id: 'oB', status: 'accepted' }],
          },
          {
            id: 't3',
            title: 'Not mine',
            status: 'pending',
            difficulty: 'hard',
            created_at: '2026-01-15T00:00:00Z',
            tutorial_orgs: [{ id: 'r3', tutorial_id: 't3', org_id: 'oZ', status: 'pending' }],
          },
        ]
      }
      if (path === '/api/agreements/me') return [{ agreement_type: 'org_leader_terms' }]
      throw new Error(`unexpected ${path}`)
    },
  },
}))

const Page = (await import('@/app/dashboard/organisation/page')).default

describe('Organisation tab', () => {
  // Chain: this is the assertion that pins the no-picker decision. A
  //        single-organisation fixture would pass whether or not the queue
  //        merges, so two are used deliberately.
  it('merges the queue across every organisation the user leads', async () => {
    render(await Page())
    expect(screen.getByText('Older request')).toBeInTheDocument()
    expect(screen.getByText('Newer review')).toBeInTheDocument()
  })

  it('names the organisation each row belongs to', async () => {
    render(await Page())
    expect(screen.getByText('Splat North')).toBeInTheDocument()
    expect(screen.getByText('Splat South')).toBeInTheDocument()
  })

  it('excludes work offered to an organisation the user does not lead', async () => {
    render(await Page())
    expect(screen.queryByText('Not mine')).not.toBeInTheDocument()
  })

  // Carries forward the coverage lost when Task 3 removed "Organisations you
  // lead" from the dashboard: a leader must still be able to reach their
  // organisation's review screen from somewhere in the dashboard.
  it('links a row to the existing review screen', async () => {
    render(await Page())
    expect(screen.getByRole('link', { name: /Older request/ })).toHaveAttribute(
      'href',
      '/organizations/oA/projects/t1'
    )
  })

  // Guards against re-dropping DifficultyBadge: the row is strictly less
  // informative than app/organizations/[id]/page.tsx without it.
  it('shows each row its difficulty', async () => {
    render(await Page())
    expect(screen.getByText('EASY')).toBeInTheDocument()
    expect(screen.getByText('MEDIUM')).toBeInTheDocument()
  })
})
