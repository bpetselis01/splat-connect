import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), patch: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  redirect: vi.fn(),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

const baseTutorial = {
  id: 't1', title: 'Spoon holder', description: null, difficulty: 'easy',
  status: 'pending', tutorial_pdf_url: null, toy_photo_url: null,
  rejection_note: null, created_at: '', reviewed_at: null,
  reviewed_by: null, reviewed_for_org_id: null, reviewer: null, reviewed_for: null,
  tutorial_contributors: [], parts: [], tools: [], stl_files: [],
}

const params = () => Promise.resolve({ id: 't1' })

describe('admin project page', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: an approved tutorial can be taken down from this page
  // How:   status 'approved'; checks Unpublish renders instead of a 404
  // Chain: this is the hole — the page did `if (status !== 'pending') notFound()`,
  //        so an admin who found a bad approval in spot-check had nowhere to act.
  //        Decision 14's whole safety argument depends on this control existing
  it('offers unpublish for a tutorial a leader approved', async () => {
    get.mockResolvedValue({
      ...baseTutorial,
      status: 'approved',
      reviewer: { name: 'Sam' },
      reviewed_for: { name: 'Riverside Therapy' },
    })
    const { default: Page } = await import('@/app/admin/review/[id]/page')
    render(await Page({ params: params() }))

    expect(screen.getByRole('button', { name: /Unpublish/i })).toBeInTheDocument()
    // The admin is overriding someone; the page says whose decision it was.
    expect(screen.getByText(/Sam/)).toBeInTheDocument()
    expect(screen.getByText(/Riverside Therapy/)).toBeInTheDocument()
  })

  // Tests: the note is required, so the contributor is never left guessing
  // Chain: it is the only thing they will ever see explaining why work that was
  //        live is not any more
  it('requires a reason to unpublish', async () => {
    get.mockResolvedValue({ ...baseTutorial, status: 'approved' })
    const { default: Page } = await import('@/app/admin/review/[id]/page')
    render(await Page({ params: params() }))

    expect(screen.getByLabelText(/Why are you taking it down/i)).toBeRequired()
  })

  it('still offers approve and reject while pending', async () => {
    get.mockResolvedValue({ ...baseTutorial, status: 'pending' })
    const { default: Page } = await import('@/app/admin/review/[id]/page')
    render(await Page({ params: params() }))

    expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Unpublish/i })).not.toBeInTheDocument()
  })

  it('is read-only on a rejected tutorial, showing the note', async () => {
    get.mockResolvedValue({
      ...baseTutorial, status: 'rejected', rejection_note: 'Step 4 is unsafe',
    })
    const { default: Page } = await import('@/app/admin/review/[id]/page')
    render(await Page({ params: params() }))

    expect(screen.getByText(/Step 4 is unsafe/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve|Unpublish/i })).not.toBeInTheDocument()
  })
})
