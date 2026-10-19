// A failed load says so, retries on Try again, and never reaches console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PrintAtEventScreen } from '../../../../components/events/print-at-event-screen'
import { event } from './event-fixtures'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ replace: jest.fn(), push: jest.fn() }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

it('offline: says so, Try again re-fetches and lists the saved guides', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockImplementation((path: string) =>
    path === '/api/saves/tutorials' ? Promise.resolve([{ id: 'g1', title: 'Light-up penguin' }]) : Promise.resolve(event({ prints_parts: true, part_sets_max: 3 })),
  )
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  render(<PrintAtEventScreen id="e1" />)
  expect(await screen.findByText('Could not load this event.')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('radio', { name: 'Light-up penguin' })).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
