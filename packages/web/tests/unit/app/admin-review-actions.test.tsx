import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.setConfig({ testTimeout: 30_000 })

const get = vi.fn()
const patch = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a) },
}))
const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
const redirect = vi.fn()
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
  redirect: (...a: unknown[]) => redirect(...a),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

const tutorial = (over: Record<string, unknown> = {}) => ({
  id: 't1', title: 'Spoon holder', description: null, difficulty: 'easy', kind: 'assistive_tech',
  status: 'pending', tutorial_pdf_url: 't1/tutorial.pdf', photo_urls: [], toy_photo_url: null,
  rejection_note: null, created_at: '2026-10-01T00:00:00Z', reviewed_at: null, reviewed_by: null,
  reviewed_for_org_id: null, reviewer: null, reviewed_for: null, safety_declared_at: '2026-10-01T00:00:00Z',
  tutorial_contributors: [{ profile_id: 'u1', role: 'primary', profiles: { name: 'Sam Maker', email: 'sam@example.com' } }],
  parts: [], tools: [], stl_files: [{ id: 's1', filename: 'mount.stl', file_url: 't1/mount.stl' }], steps: [],
  tutorial_orgs: [], tutorial_collaborator_invites: [], ...over,
})

async function openDetail(over: Record<string, unknown> = {}) {
  get.mockResolvedValue(tutorial(over))
  const { default: Page } = await import('@/app/admin/review/[id]/page')
  return render(await Page({ params: Promise.resolve({ id: 't1' }) }))
}

beforeEach(() => vi.clearAllMocks())

describe('admin review decisions', () => {
  it('WM06 approveTutorial patches the status to approved and refreshes the queue, the guide page and the library', async () => {
    const { approveTutorial } = await import('@/app/admin/review/actions')
    await approveTutorial('t1')
    expect(patch).toHaveBeenCalledWith('/api/admin/tutorials/t1/status', { status: 'approved' })
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(['/admin', '/admin/review', '/admin/review/t1', '/library'])
  })

  it('WM06 the pane Approve button approves that guide whatever is typed in the note', async () => {
    get.mockImplementation(async (path: string) =>
      path === '/api/tutorials/t1' ? tutorial() : path.startsWith('/api/admin/tutorials') ? [tutorial()] : []
    )
    const { default: Page } = await import('@/app/admin/review/page')
    render(await Page({ searchParams: Promise.resolve({ selected: 't1' }) }))
    fireEvent.change(screen.getByLabelText('Note to contributor'), { target: { value: 'ignored on approve' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/tutorials/t1/status', { status: 'approved' }))
  })

  it('WM07 rejectTutorial patches rejected with the note, and null when the note is empty', async () => {
    const { rejectTutorial } = await import('@/app/admin/review/actions')
    const form = (note: string) => {
      const f = new FormData()
      f.set('id', 't1')
      f.set('note', note)
      return f
    }
    await rejectTutorial(form('Needs clearer photos.'))
    expect(patch).toHaveBeenLastCalledWith('/api/admin/tutorials/t1/status', { status: 'rejected', rejection_note: 'Needs clearer photos.' })
    await rejectTutorial(form(''))
    expect(patch).toHaveBeenLastCalledWith('/api/admin/tutorials/t1/status', { status: 'rejected', rejection_note: null })
  })

  it('WM07 the pane Send back button submits the typed note for that guide', async () => {
    get.mockImplementation(async (path: string) =>
      path === '/api/tutorials/t1' ? tutorial() : path.startsWith('/api/admin/tutorials') ? [tutorial()] : []
    )
    const { default: Page } = await import('@/app/admin/review/page')
    render(await Page({ searchParams: Promise.resolve({ selected: 't1' }) }))
    fireEvent.change(screen.getByLabelText('Note to contributor'), { target: { value: 'Step 4 is unclear.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/admin/tutorials/t1/status', { status: 'rejected', rejection_note: 'Step 4 is unclear.' })
    )
  })

  it('WM08 the full page links the PDF and STL through /files, the contributor by mailto, and Approve patches approved', async () => {
    await openDetail()
    expect(screen.getByRole('link', { name: 'The guide (PDF)' })).toHaveAttribute('href', '/files/tutorial-pdfs/t1/tutorial.pdf')
    expect(screen.getByRole('link', { name: 'mount.stl' })).toHaveAttribute('href', '/files/stl-files/t1/mount.stl')
    expect(screen.getByRole('link', { name: 'sam@example.com' })).toHaveAttribute('href', 'mailto:sam@example.com')
    fireEvent.click(screen.getByRole('button', { name: /Approve and publish/ }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/tutorials/t1/status', { status: 'approved' }))
  })

  it('WM08 the full page Send back submits the note, and a decided guide opens without decision buttons', async () => {
    const first = await openDetail()
    fireEvent.change(screen.getByLabelText(/Reason for sending it back/), { target: { value: 'Photos are blurry.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send back to the author' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/admin/tutorials/t1/status', { status: 'rejected', rejection_note: 'Photos are blurry.' })
    )
    first.unmount()

    await openDetail({ status: 'rejected', rejection_note: 'Photos are blurry.' })
    expect(screen.getByText(/Rejected: Photos are blurry\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve|Send back|Unpublish/ })).toBeNull()
  })

  it('WM09 Unpublish sends the trimmed note as a rejection and redirects to spot-check, and a blank note sends nothing', async () => {
    await openDetail({ status: 'approved' })
    const note = screen.getByLabelText(/Why are you taking it down/)
    fireEvent.change(note, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }))
    await new Promise((r) => setTimeout(r, 50))
    expect(patch).not.toHaveBeenCalled()

    fireEvent.change(note, { target: { value: ' Step 4 is unsafe. ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/admin/tutorials/t1/status', { status: 'rejected', rejection_note: 'Step 4 is unsafe.' })
    )
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/admin/spot-check'))
    expect(revalidatePath).toHaveBeenCalledWith('/admin/spot-check')
  })
})
