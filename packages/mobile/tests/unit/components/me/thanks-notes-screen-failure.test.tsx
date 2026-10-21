// A failed notes load says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ThanksNotesScreen } from '../../../../components/me/thanks-notes-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = require('react')
  return { useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]) }
})

it('offline: says so, Try again re-fetches and shows the notes', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  render(<ThanksNotesScreen />)
  expect(await screen.findByText("Couldn't load your notes.")).toBeTruthy()
  mockGet.mockResolvedValueOnce([
    { profile_id: 'me', thanker_id: 'u1', note: 'You fixed our switch.', byline: 'Wren', show_note: false, hidden_at: null, transaction_id: null, created_at: '2026-10-01T00:00:00Z' },
  ])
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('“You fixed our switch.”')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
