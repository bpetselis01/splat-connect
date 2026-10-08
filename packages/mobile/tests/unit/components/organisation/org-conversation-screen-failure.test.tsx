// A failed conversation load says so, retries on Try again, and never hits console.error.
// journeys: L29
import { render, screen, fireEvent } from '@testing-library/react-native'
import { OrgConversationScreen } from '../../../../components/organisation/org-conversation-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'fam1', name: 'Priya Nair' } } }),
}))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})

it('offline: says so, Try again re-fetches and shows the thread', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue({
    conversation: { id: 'c1', org_id: 'o1', profile_id: 'fam1', created_at: '', updated_at: '' },
    org_name: 'Northbank',
    person_name: 'Priya Nair',
    messages: [{ id: 'm1', conversation_id: 'c1', sender_id: 'fam1', body: 'Thursday?', created_at: '2026-09-01T00:00:00Z', sender_name: 'Priya Nair', from_org: false }],
  })
  render(<OrgConversationScreen cid="c1" />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Thursday?')).toBeTruthy()
  expect(errSpy).not.toHaveBeenCalled()
})
