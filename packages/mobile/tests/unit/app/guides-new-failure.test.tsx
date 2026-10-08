// The create-time extras lookup (GET after the draft exists) is secondary: when
// it rejects offline the editor still opens and nothing reaches console.error.
// journeys: N02
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import NewGuideRoute from '../../../app/(tabs)/guides/new'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }))
const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: { post: jest.fn().mockResolvedValue({ id: 'uuid-1' }), get: (...a: unknown[]) => mockGet(...a), patch: jest.fn(), put: jest.fn() },
}))
jest.mock('../../../lib/upload', () => ({ uploadFile: jest.fn() }))
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }))
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }))
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => ({ acceptContributorTerms: jest.fn() }) }))

it('offline extras lookup: the editor still opens, no console.error', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValue(new Error('Network request failed'))
  render(<NewGuideRoute />)
  fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Light-up drum')
  fireEvent.changeText(screen.getByLabelText('Youngest age'), '3')
  fireEvent.press(screen.getByLabelText('Create draft'))
  await waitFor(() => expect(mockReplace).toHaveBeenCalled())
  expect(errSpy).not.toHaveBeenCalled()
})
