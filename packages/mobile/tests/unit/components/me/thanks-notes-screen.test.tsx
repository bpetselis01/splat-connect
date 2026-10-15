// journeys: S02
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ThanksNotesScreen } from '../../../../components/me/thanks-notes-screen'

const mockGet = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a) },
}))
jest.mock('expo-router', () => {
  const { useEffect } = require('react')
  return { useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]) }
})

const row = (over = {}) => ({
  profile_id: 'me', thanker_id: 'u1', note: 'You fixed our switch.', byline: 'Wren', show_note: false,
  hidden_at: null, transaction_id: null, created_at: '2026-10-01T00:00:00Z', ...over,
})

beforeEach(() => jest.clearAllMocks())

describe('ThanksNotesScreen', () => {
  it('lists the notes and hides one, then shows it again', async () => {
    mockGet.mockResolvedValue([row()])
    render(<ThanksNotesScreen />)
    expect(await screen.findByText('“You fixed our switch.”')).toBeTruthy()
    mockPatch.mockResolvedValueOnce(row({ hidden_at: '2026-10-02T00:00:00Z' }))
    fireEvent.press(screen.getByRole('button', { name: 'Hide the note from Wren' }))
    expect(await screen.findByRole('button', { name: 'Show the note from Wren' })).toBeTruthy()
    expect(mockPatch).toHaveBeenCalledWith('/api/contributors/me/thanks/u1', { hidden: true })
    mockPatch.mockResolvedValueOnce(row())
    fireEvent.press(screen.getByRole('button', { name: 'Show the note from Wren' }))
    await waitFor(() => expect(mockPatch).toHaveBeenLastCalledWith('/api/contributors/me/thanks/u1', { hidden: false }))
  })

  it('shows an EmptyState when there are no notes', async () => {
    mockGet.mockResolvedValue([row({ note: null })])
    render(<ThanksNotesScreen />)
    expect(await screen.findByText('No notes yet')).toBeTruthy()
  })

  it('a failed PATCH shows an error and leaves the row as it was', async () => {
    mockGet.mockResolvedValue([row()])
    mockPatch.mockRejectedValue(new Error('Request failed with status 404'))
    render(<ThanksNotesScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Hide the note from Wren' }))
    expect(await screen.findByText(/did not save|Request failed/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide the note from Wren' })).toBeTruthy()
  })

  it('offers a retry when the list will not load', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network request failed'))
    render(<ThanksNotesScreen />)
    expect(await screen.findByText("Couldn't load your notes.")).toBeTruthy()
    mockGet.mockResolvedValueOnce([row()])
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('“You fixed our switch.”')).toBeTruthy()
  })
})
