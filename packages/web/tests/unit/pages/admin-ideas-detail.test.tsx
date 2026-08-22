import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), patch: vi.fn(), post: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

const idea = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'i1', author_id: 'u1', title: 'Adaptive spoon holder',
  summary: 'A one-handed grip for cutlery.',
  description: 'Full description of the idea.',
  intended_use: 'Held during mealtimes at the table.',
  primary_user: 'A child with limited grip strength.',
  contact_prefs: [], status: 'pending', review_note: null, tutorial_id: null,
  created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z',
  profiles: { name: 'Sam' },
  ...overrides,
})

const params = (id = 'i1') => Promise.resolve({ id })

describe('admin design-challenge detail page', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: the reviewer sees enough to judge scope, not just a title
  // Chain: scope is a safety judgement here — a reviewer who can't see the
  //        description, intended use and primary user has nothing to judge
  it('renders the full brief, including contact preferences', async () => {
    get.mockResolvedValue([idea({ contact_prefs: ['co_design', 'user_testing'] })])
    const { default: Page } = await import('@/app/admin/ideas/[id]/page')
    render(await Page({ params: params() }))

    expect(screen.getByText('Full description of the idea.')).toBeInTheDocument()
    expect(screen.getByText('Held during mealtimes at the table.')).toBeInTheDocument()
    expect(screen.getByText('A child with limited grip strength.')).toBeInTheDocument()
    // Tells a reviewer whether the author wants to co-design, be available
    // for clarification, or user-test — changes how a maker approaches it.
    expect(screen.getByText('Co-design')).toBeInTheDocument()
    expect(screen.getByText('User testing')).toBeInTheDocument()
  })

  // Tests: the browser-level guard exists (a real, if weaker, property)
  it('marks the reject note required in the browser', async () => {
    get.mockResolvedValue([idea({ status: 'pending' })])
    const { default: Page } = await import('@/app/admin/ideas/[id]/page')
    render(await Page({ params: params() }))

    expect(screen.getByLabelText(/isn.t this going forward/i)).toBeRequired()
  })

  // Tests: the actual guard behind the reject path — rejectNoteFrom, which
  // rejectIdea calls before ever reaching the API. This is the real
  // guarantee "a rejection with no reason is what stops someone submitting
  // again" rests on; `required` above is only the browser's opinion, and
  // nothing in this codebase drives a 'use server' action directly to prove
  // the handler itself refuses.
  it.each([
    [null, null],
    ['', null],
    ['   ', null],
    ['Scope is too broad for a first challenge', 'Scope is too broad for a first challenge'],
    ['  trimmed on both sides  ', 'trimmed on both sides'],
  ])('rejectNoteFrom(%j) -> %j', async (input, expected) => {
    const { rejectNoteFrom } = await import('@/app/admin/ideas/[id]/page')
    expect(rejectNoteFrom(input)).toBe(expected)
  })

  // Tests: Graduate only ever appears on a published challenge
  // Chain: it writes a tutorial and contributor rows, not just a status —
  //        offering it on the wrong status invites a 400 (pending/rejected,
  //        REVIEW_OUTCOMES never includes 'graduated') or a duplicate
  //        (an already-graduated idea)
  it.each(['pending', 'rejected', 'graduated'])(
    'does not offer Graduate on a %s idea',
    async (status) => {
      get.mockResolvedValue([idea({ status, tutorial_id: status === 'graduated' ? 't9' : null })])
      const { default: Page } = await import('@/app/admin/ideas/[id]/page')
      render(await Page({ params: params() }))

      expect(screen.queryByRole('button', { name: /Graduate/i })).not.toBeInTheDocument()
    }
  )

  it('offers Graduate on a challenge idea', async () => {
    get.mockResolvedValue([idea({ status: 'challenge' })])
    const { default: Page } = await import('@/app/admin/ideas/[id]/page')
    render(await Page({ params: params() }))

    expect(screen.getByRole('button', { name: /Graduate/i })).toBeInTheDocument()
  })

  // Tests: a graduated idea surfaces the draft it created, not just its status
  // Chain: the draft is the point of the whole feature — it must be reachable,
  //        not just implied by the badge
  it('links to the created draft guide once graduated', async () => {
    get.mockResolvedValue([idea({ status: 'graduated', tutorial_id: 't9' })])
    const { default: Page } = await import('@/app/admin/ideas/[id]/page')
    render(await Page({ params: params() }))

    expect(screen.getByRole('link', { name: /view the draft guide/i })).toHaveAttribute(
      'href',
      '/admin/review/t9'
    )
  })

  // Tests: CRITICAL 2 — a published idea can be taken down from this page,
  //        not just via a hand-typed API call
  // Chain: the control only appears on a published (challenge-status) idea,
  //        and requires a note in the browser the same way Reject does
  it('offers an Unpublish control, requiring a note, on a challenge idea', async () => {
    get.mockResolvedValue([idea({ status: 'challenge' })])
    const { default: Page } = await import('@/app/admin/ideas/[id]/page')
    render(await Page({ params: params() }))

    expect(screen.getByRole('button', { name: /unpublish/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/why is this being withdrawn/i)).toBeRequired()
  })

  it.each(['pending', 'rejected', 'graduated'])(
    'does not offer Unpublish on a %s idea',
    async (status) => {
      get.mockResolvedValue([idea({ status, tutorial_id: status === 'graduated' ? 't9' : null })])
      const { default: Page } = await import('@/app/admin/ideas/[id]/page')
      render(await Page({ params: params() }))

      expect(screen.queryByRole('button', { name: /unpublish/i })).not.toBeInTheDocument()
    }
  )

  // Tests: IMPORTANT 6 — the documented worst case (graduated with no
  //        tutorial_id) is detected and surfaced, not silently blank
  // Chain: before this, the page rendered no draft link and no action
  //        buttons for this state, with nothing on the page saying why
  it('flags an incomplete graduation when graduated but tutorial_id is null', async () => {
    get.mockResolvedValue([idea({ status: 'graduated', tutorial_id: null })])
    const { default: Page } = await import('@/app/admin/ideas/[id]/page')
    render(await Page({ params: params() }))

    expect(screen.getByText(/graduation did not complete/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view the draft guide/i })).not.toBeInTheDocument()
  })
})
