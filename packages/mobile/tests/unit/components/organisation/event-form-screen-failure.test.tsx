// A failed load of the event being edited says so, retries on Try again, and never hits console.error.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { EditEventScreen } from '../../../../components/organisation/event-form-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false }) }))

const EVENT = { id: 'e1', kind: 'build_day', title: 'Build day', starts_at: '2099-10-03T07:05:00Z', format: 'in_person', tools: [], status: 'draft' }

it('editing an event offline: says so, Try again re-fetches and opens the form', async () => {
  const errSpy = jest.spyOn(console, 'error')
  let down = true
  mockGet.mockImplementation((p: string) =>
    down ? Promise.reject(new Error('Network request failed')) : Promise.resolve(p.endsWith('/questions') ? [] : [EVENT]),
  )
  render(<EditEventScreen eventId="e1" />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  down = false
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByDisplayValue('Build day')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
