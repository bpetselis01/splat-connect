import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditRecommendationsSection } from '@/components/edit-recommendations-section'
import { ToastProvider } from '@/components/toast'
import type { Recommendation } from '@splat-connect/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

function rec(id: string, status: Recommendation['tutorials']['status'] = 'approved'): Recommendation {
  return {
    position: 1,
    tutorials: { id, title: `Tutorial ${id}`, kind: 'toy_adaptation', difficulty: 'easy', toy_photo_url: null, status },
  }
}
const candidates = ['self', 'a', 'b', 'c', 'd'].map((id) => ({ id, title: `Tutorial ${id}`, kind: 'toy_adaptation' as const }))

function renderSection(recommendations: Recommendation[], onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ToastProvider>
      <EditRecommendationsSection tutorialId="self" recommendations={recommendations} candidates={candidates} onSave={onSave} />
    </ToastProvider>
  )
  return onSave
}

describe('EditRecommendationsSection', () => {
  // The cap lives in 048's constraints; the editor's job is never to ask.
  it('offers no picker once three are chosen', () => {
    renderSection([rec('a'), rec('b'), rec('c')])
    expect(screen.queryByLabelText('Add a recommendation')).toBeNull()
  })

  it('never offers the tutorial itself or one already chosen', () => {
    renderSection([rec('a')])
    const names = screen.getAllByRole('option').map((o) => o.textContent)
    expect(names.some((n) => n?.startsWith('Tutorial self'))).toBe(false)
    expect(names.some((n) => n?.startsWith('Tutorial a'))).toBe(false)
    expect(names.some((n) => n?.startsWith('Tutorial b'))).toBe(true)
  })

  // The public page drops these silently; this tag is the only place the
  // creator learns why a parent cannot see one of their three.
  it('tags a target that is not approved', () => {
    renderSection([rec('a'), rec('b', 'pending')])
    expect(screen.getAllByText(/Not yet approved/)).toHaveLength(1)
  })

  it('saves the whole list, appended, when one is picked', async () => {
    const onSave = renderSection([rec('a')])
    fireEvent.change(screen.getByLabelText('Add a recommendation'), { target: { value: 'b' } })
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['a', 'b']))
  })

  it('saves the whole list, minus the row, on remove', async () => {
    const onSave = renderSection([rec('a'), rec('b')])
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['b']))
  })

  it('shows an error and keeps the list when the save fails', async () => {
    renderSection([rec('a')], vi.fn().mockRejectedValue(new Error('nope')))
    fireEvent.change(screen.getByLabelText('Add a recommendation'), { target: { value: 'b' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not work')
    expect(screen.getByText('Tutorial a')).toBeInTheDocument()
  })
})
