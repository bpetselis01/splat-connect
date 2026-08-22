import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ToyIdea } from '@splat-connect/types'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))

const idea = (id: string, status: ToyIdea['status']): ToyIdea => ({
  id, author_id: 'a1', title: `Idea ${id}`, summary: '', description: '',
  intended_use: '', primary_user: '', contact_prefs: [], status,
  review_note: null, tutorial_id: null, created_at: '', updated_at: '',
})

function mockGet(ideas: ToyIdea[]) {
  get.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/admin/tutorials?status=pending' ? []
        : path === '/api/admin/contributors' ? { accounts: [], total: 0 }
        : path === '/api/organizations' ? []
        : path === '/api/admin/spot-check' ? []
        : path === '/api/admin/ideas' ? ideas
        : []
    )
  )
}

describe('admin dashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: the fifth card exists, links to the idea queue, and counts the
  //        same way the Tutorials card does — items awaiting review
  // How:   three ideas, one pending; renders the index and reads the card
  // Chain: CRITICAL 1 — the idea queue had no card at all, so no admin could
  //        find it without hand-typing the URL and every submitted idea sat
  //        at 'pending' forever
  it('renders a Design challenges card counting pending ideas, linking to /admin/ideas', async () => {
    mockGet([idea('i1', 'pending'), idea('i2', 'challenge'), idea('i3', 'graduated')])
    const { default: Page } = await import('@/app/admin/page')
    render(await Page())

    const link = screen.getByRole('link', { name: /design challenges/i })
    expect(link).toHaveAttribute('href', '/admin/ideas')
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
