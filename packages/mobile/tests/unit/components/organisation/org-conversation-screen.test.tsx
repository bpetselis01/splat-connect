// packages/mobile/tests/unit/components/organisation/org-conversation-screen.test.tsx
// A conversation with an organisation (077): opened from the profile before any
// message exists it posts to the 'mine' route, which creates it; once it
// exists every message goes to the conversation. The family sees a leader's
// reply signed with the organisation.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { OrgConversationScreen } from '../../../../components/organisation/org-conversation-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
// ErrorRow's module imports the auth context, which builds a Supabase client.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'fam1', name: 'Priya Nair' } } }),
}))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})

const THREAD = {
  conversation: { id: 'c1', org_id: 'o1', profile_id: 'fam1', created_at: '', updated_at: '' },
  org_name: 'Northbank',
  person_name: 'Priya Nair',
  messages: [
    { id: 'm1', conversation_id: 'c1', sender_id: 'fam1', body: 'Thursday?', created_at: '2026-09-01T00:00:00Z', sender_name: 'Priya Nair', from_org: false },
    { id: 'm2', conversation_id: 'c1', sender_id: 'lead1', body: 'Yes.', created_at: '2026-09-01T01:00:00Z', sender_name: 'Rachel', from_org: true },
  ],
}

beforeEach(() => jest.clearAllMocks())

it('starts the conversation through the mine route before one exists', async () => {
  mockGet.mockResolvedValueOnce(null).mockResolvedValue(THREAD)
  mockPost.mockResolvedValue({})
  render(<OrgConversationScreen orgId="o1" orgName="Northbank" />)
  expect(await screen.findByText('Northbank')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledWith('/api/organizations/o1/conversations/mine')

  fireEvent.changeText(screen.getByPlaceholderText('Message Northbank…'), 'Thursday?')
  fireEvent.press(screen.getByText('Send'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/organizations/o1/conversations/mine/messages', { body: 'Thursday?' })
  )
})

it('signs a leader’s reply with the organisation, on the family’s side', async () => {
  mockGet.mockResolvedValue(THREAD)
  mockPost.mockResolvedValue({})
  render(<OrgConversationScreen cid="c1" />)
  expect(await screen.findByLabelText('Rachel · Northbank said: Yes.')).toBeTruthy()
  expect(screen.getByLabelText('You said: Thursday?')).toBeTruthy()

  fireEvent.changeText(screen.getByPlaceholderText('Message Northbank…'), 'Great')
  fireEvent.press(screen.getByText('Send'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/organizations/conversations/c1/messages', { body: 'Great' })
  )
})
