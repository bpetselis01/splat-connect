import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

const idea = (id: string, title: string, status: string, name = 'Sam') => ({
  id, author_id: 'u1', title,
  summary: 's', description: 'd', intended_use: 'iu', primary_user: 'pu',
  contact_prefs: [], status, review_note: null, tutorial_id: null,
  created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z',
  profiles: { name },
})

describe('admin design-challenge queue', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: a pending idea is pulled to the top even when it was submitted
  //        after an already-decided one
  // Chain: pending is the only status still waiting on this page's actions —
  //        it must not get buried under settled rows
  it('sorts pending ideas ahead of already-decided ones', async () => {
    get.mockResolvedValue([
      idea('i1', 'Decided idea', 'challenge'),
      idea('i2', 'Waiting idea', 'pending'),
    ])
    const { default: Page } = await import('@/app/admin/ideas/page')
    render(await Page())

    const titles = screen.getAllByText(/idea$/i).map((el) => el.textContent)
    expect(titles).toEqual(['Waiting idea', 'Decided idea'])
  })

  // Tests: each row links to its own detail page
  it('links each row to /admin/ideas/:id', async () => {
    get.mockResolvedValue([idea('i1', 'Spoon holder', 'pending')])
    const { default: Page } = await import('@/app/admin/ideas/page')
    render(await Page())

    expect(screen.getByRole('link', { name: /Spoon holder/i })).toHaveAttribute(
      'href',
      '/admin/ideas/i1'
    )
  })

  it('shows an empty state when nothing has been submitted', async () => {
    get.mockResolvedValue([])
    const { default: Page } = await import('@/app/admin/ideas/page')
    render(await Page())

    expect(screen.getByText(/No ideas submitted yet/i)).toBeInTheDocument()
  })
})
