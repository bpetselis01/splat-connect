import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminIdeaReports, type IdeaReport } from '@/components/admin-idea-reports'

const patch = vi.fn()
const del = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { patch: (...a: unknown[]) => patch(...a), delete: (...a: unknown[]) => del(...a) },
}))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

beforeEach(() => vi.clearAllMocks())

const report = (over: Partial<IdeaReport> = {}): IdeaReport => ({
  id: 'r1',
  idea_id: 'i1',
  reported_profile_id: 'p1',
  reason: 'Rude in the thread.',
  created_at: '2026-10-01T00:00:00Z',
  resolved_at: null,
  resolution_note: null,
  removed: false,
  toy_ideas: { title: 'Ladybug switch' },
  reported_profile: { name: 'Sam' },
  reporter: { name: 'Priya' },
  ...over,
})

describe('AdminIdeaReports', () => {
  it('shows an empty state when there are no reports', () => {
    render(<AdminIdeaReports reports={[]} />)
    expect(screen.getByText(/No idea reports/)).toBeInTheDocument()
  })

  it('WM30 Remove sends the action and the trimmed note, then refreshes', async () => {
    patch.mockResolvedValue({})
    render(<AdminIdeaReports reports={[report()]} />)
    fireEvent.change(screen.getByLabelText('Note for the record'), { target: { value: ' Warned twice. ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/reports/r1', { action: 'remove', resolution_note: 'Warned twice.' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WM30 Dismiss sends the dismiss action', async () => {
    patch.mockResolvedValue({})
    render(<AdminIdeaReports reports={[report()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/reports/r1', { action: 'dismiss', resolution_note: '' }))
  })

  it('WM31 offers Reinstate only on a resolved report whose person is still removed', async () => {
    del.mockResolvedValue(undefined)
    render(<AdminIdeaReports reports={[report({ resolved_at: '2026-10-02T00:00:00Z', removed: true }), report({ id: 'r2', resolved_at: '2026-10-02T00:00:00Z' })]} />)
    expect(screen.getAllByRole('button', { name: 'Reinstate' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Reinstate' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/admin/ideas/i1/participants/p1/removal'))
  })

  it('shows the server sentence when removing the author is refused', async () => {
    patch.mockRejectedValue(new Error("PATCH failed with status 409: The reported person wrote this challenge and can't be removed. Dismiss the report instead."))
    render(<AdminIdeaReports reports={[report()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The reported person wrote this challenge and can't be removed. Dismiss the report instead."
    )
    expect(refresh).not.toHaveBeenCalled()
  })
})
