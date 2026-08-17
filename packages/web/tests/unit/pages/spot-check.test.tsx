import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const baseTutorial = {
  id: 't1', title: 'Spoon holder', description: null, difficulty: 'easy',
  status: 'approved', tutorial_pdf_url: null, toy_photo_url: null,
  rejection_note: null, created_at: '', reviewed_at: '2026-07-01T00:00:00.000Z',
  reviewed_by: 'u1', reviewed_for_org_id: 'o1', tutorial_orgs: [],
}

describe('admin spot-check', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: a sampled tutorial links where the admin can act on it
  // Chain: linking to the public page made spot-check a dead end — you could see a
  //        bad approval and had nowhere to go. Decision 14's safety argument rests
  //        on this being one motion, not two
  it('links rows to the admin project page, not the public one', async () => {
    get.mockResolvedValue([baseTutorial])
    const { default: Page } = await import('@/app/admin/spot-check/page')
    render(await Page({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole('link', { name: /Spoon holder/i })).toHaveAttribute(
      'href', '/admin/review/t1'
    )
  })

  // Tests: the page states the route out, not just the sample
  // Chain: a list of approved tutorials with no stated purpose reads as trivia
  it('says what to do with what you find', async () => {
    get.mockResolvedValue([baseTutorial])
    const { default: Page } = await import('@/app/admin/spot-check/page')
    render(await Page({ searchParams: Promise.resolve({}) }))
    expect(screen.getByText(/unpublish it if it should not be there/i)).toBeInTheDocument()
  })

  it('teaches the interface when the sample is empty', async () => {
    get.mockResolvedValue([])
    const { default: Page } = await import('@/app/admin/spot-check/page')
    render(await Page({ searchParams: Promise.resolve({}) }))
    expect(screen.getByText(/Nothing to check yet/i)).toBeInTheDocument()
  })

  // Tests: ?limit widens the sample the endpoint returns
  // Chain: the sample is random and unordered, so the default ten silently omit
  //        rows — an admin cannot widen it and a test cannot pin it down
  it('passes a requested limit through to the endpoint', async () => {
    get.mockResolvedValue([])
    const { default: Page } = await import('@/app/admin/spot-check/page')
    await Page({ searchParams: Promise.resolve({ limit: '200' }) })
    expect(get).toHaveBeenCalledWith('/api/admin/spot-check?limit=200')
  })

  it('asks for the default sample when no limit is given or it is nonsense', async () => {
    get.mockResolvedValue([])
    const { default: Page } = await import('@/app/admin/spot-check/page')
    await Page({ searchParams: Promise.resolve({}) })
    expect(get).toHaveBeenCalledWith('/api/admin/spot-check')

    get.mockClear()
    await Page({ searchParams: Promise.resolve({ limit: 'lots' }) })
    expect(get).toHaveBeenCalledWith('/api/admin/spot-check')
  })
})
