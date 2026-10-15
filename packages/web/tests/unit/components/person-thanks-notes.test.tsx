import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PersonThanksNotes } from '@/components/person-thanks-notes'
import type { PersonThanks } from '@splat-connect/types'

const patch = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: (...a: unknown[]) => patch(...a) } }))

beforeEach(() => vi.clearAllMocks())

const note = (over: Partial<PersonThanks> = {}): PersonThanks => ({
  profile_id: 'me',
  thanker_id: 'u1',
  note: 'You fixed our switch.',
  byline: 'Wren',
  show_note: false,
  hidden_at: null,
  transaction_id: null,
  created_at: '2026-10-01T00:00:00Z',
  ...over,
})

describe('PersonThanksNotes', () => {
  it('shows an empty state when nobody left a note', () => {
    render(<PersonThanksNotes thanks={[note({ note: null })]} />)
    expect(screen.getByText('No notes yet')).toBeInTheDocument()
  })

  it('hides a note, then shows it again', async () => {
    patch.mockResolvedValueOnce(note({ hidden_at: '2026-10-02T00:00:00Z' }))
    render(<PersonThanksNotes thanks={[note()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide the note from Wren' }))
    expect(await screen.findByRole('button', { name: 'Show the note from Wren' })).toBeInTheDocument()
    expect(patch).toHaveBeenCalledWith('/api/contributors/me/thanks/u1', { hidden: true })
    patch.mockResolvedValueOnce(note())
    fireEvent.click(screen.getByRole('button', { name: 'Show the note from Wren' }))
    await waitFor(() => expect(patch).toHaveBeenLastCalledWith('/api/contributors/me/thanks/u1', { hidden: false }))
  })

  it('a failed PATCH shows an error and does not flip the row', async () => {
    patch.mockRejectedValue(Object.assign(new Error('404'), { status: 404 }))
    render(<PersonThanksNotes thanks={[note()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide the note from Wren' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change that note')
    expect(screen.getByRole('button', { name: 'Hide the note from Wren' })).toBeEnabled()
  })
})
