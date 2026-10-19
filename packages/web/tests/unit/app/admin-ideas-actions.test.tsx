import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'


// The first page import loads the whole icon set; a cold run takes several seconds.
vi.setConfig({ testTimeout: 30_000 })

const get = vi.fn()
const patch = vi.fn()
const post = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a), post: (...a: unknown[]) => post(...a) },
}))
const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NOT_FOUND') }) }))

const idea = (over: Record<string, unknown> = {}) => ({
  id: 'i1', author_id: 'u1', title: 'Adaptive spoon holder', summary: 'A grip.', description: 'Why.',
  intended_use: 'Meals', primary_user: 'A child', contact_prefs: [], status: 'pending', kind: 'idea',
  review_note: null, tutorial_id: null, created_at: '2026-08-01T00:00:00.000Z', updated_at: '',
  profiles: { name: 'Sam' }, ...over,
})

async function open(over: Record<string, unknown>) {
  get.mockResolvedValue([idea(over)])
  const { default: Page } = await import('@/app/admin/ideas/[id]/page')
  render(await Page({ params: Promise.resolve({ id: 'i1' }) }))
}

beforeEach(() => vi.clearAllMocks())

describe('admin idea decisions', () => {
  it('WM12 Publish as a challenge patches the status to challenge and refreshes the queue', async () => {
    await open({ status: 'pending' })
    fireEvent.click(screen.getByRole('button', { name: /Publish as a challenge/ }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/ideas/i1/status', { status: 'challenge' }))
    expect(revalidatePath).toHaveBeenCalledWith('/admin/ideas')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/ideas/i1')
  })

  it('WM13 Reject sends the trimmed note as review_note, and sends nothing when the note is blank', async () => {
    await open({ status: 'pending' })
    const note = screen.getByLabelText(/Reason for rejecting/)
    fireEvent.change(note, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /Reject/ }))
    await new Promise((r) => setTimeout(r, 50))
    expect(patch).not.toHaveBeenCalled()

    fireEvent.change(note, { target: { value: ' Too broad for a first challenge. ' } })
    fireEvent.click(screen.getByRole('button', { name: /Reject/ }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/admin/ideas/i1/status', { status: 'rejected', review_note: 'Too broad for a first challenge.' })
    )
  })

  it('WM13 Unpublish on a live challenge sends status rejected with the withdrawal note', async () => {
    await open({ status: 'challenge' })
    fireEvent.change(screen.getByLabelText(/Why is this being withdrawn/), { target: { value: 'Unsafe grip.' } })
    fireEvent.click(screen.getByRole('button', { name: /Unpublish/ }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/ideas/i1/status', { status: 'rejected', review_note: 'Unsafe grip.' }))
  })

  it('WM14 Graduate to draft guide posts to the graduate route, and a 409 from a second click is not an error', async () => {
    await open({ status: 'challenge' })
    fireEvent.click(screen.getByRole('button', { name: /Graduate to draft guide/ }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/admin/ideas/i1/graduate', {}))
    await waitFor(() => expect(revalidatePath).toHaveBeenCalledWith('/admin/ideas/i1'))
  })

  it('WM14 a graduate that races another admin (409) still revalidates the page instead of throwing', async () => {
    post.mockRejectedValue(Object.assign(new Error('Already graduated'), { status: 409 }))
    await open({ status: 'challenge' })
    fireEvent.click(screen.getByRole('button', { name: /Graduate to draft guide/ }))
    await waitFor(() => expect(revalidatePath).toHaveBeenCalledWith('/admin/ideas/i1'))
  })
})
