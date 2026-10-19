import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const get = vi.fn()
const post = vi.fn()
const redirect = vi.fn()
const revalidatePath = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }))
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  redirect: (...a: unknown[]) => redirect(...a),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

const org = { id: 'o1', name: 'Riverside', description: null, status: 'active', created_by: null, created_at: '', updated_at: '' }
const tutorial = {
  id: 't1', title: 'Spoon holder', description: 'A spoon holder', difficulty: 'easy', kind: 'assistive_tech',
  status: 'pending', tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, rejection_note: null,
  created_at: '', reviewed_at: null, reviewed_by: null, reviewed_for_org_id: null, reviewer: null, reviewed_for: null,
  tutorial_contributors: [], parts: [], tools: [], stl_files: [], tutorial_recommendations: [],
}

async function openPage(backing: 'pending' | 'accepted') {
  get.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/organizations/mine' ? [org]
        : path === '/api/tutorials/t1/orgs' ? [{ id: 'b1', tutorial_id: 't1', org_id: 'o1', status: backing }]
        : path === '/api/tutorials/t1' ? tutorial
        : org,
    ),
  )
  const { default: Page } = await import('@/app/organizations/[id]/projects/[tutorialId]/page')
  render(await Page({ params: Promise.resolve({ id: 'o1', tutorialId: 't1' }) }))
}

describe('leader project page — the decisions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('WB04 "Back this project" posts the accept for this organisation and stays on the page', async () => {
    await openPage('pending')
    fireEvent.click(screen.getByRole('button', { name: 'Back this project' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/tutorials/t1/orgs/o1/accept', {}))
    expect(revalidatePath).toHaveBeenCalledWith('/organizations/o1/projects/t1')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('WB05 "Decline" posts the decline and returns to the organisation page', async () => {
    await openPage('pending')
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/tutorials/t1/orgs/o1/decline', {}))
    expect(redirect).toHaveBeenCalledWith('/organizations/o1')
  })

  it('WB06 "Approve and publish" posts status approved with the organisation id and returns to the organisation page', async () => {
    await openPage('accepted')
    fireEvent.click(screen.getByRole('button', { name: 'Approve and publish' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/tutorials/t1/review', { status: 'approved', org_id: 'o1' }))
    expect(revalidatePath).toHaveBeenCalledWith('/library')
    expect(redirect).toHaveBeenCalledWith('/organizations/o1')
  })

  it('WB07 "Reject" posts status rejected with the trimmed note, and sends nothing without one', async () => {
    await openPage('accepted')
    const note = screen.getByLabelText('Why are you rejecting this?')
    fireEvent.change(note, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await new Promise((r) => setTimeout(r, 50))
    expect(post).not.toHaveBeenCalled()
    fireEvent.change(note, { target: { value: '  Missing a washer.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/tutorials/t1/review', {
        status: 'rejected',
        org_id: 'o1',
        rejection_note: 'Missing a washer.',
      }),
    )
    expect(redirect).toHaveBeenCalledWith('/organizations/o1')
  })
})
