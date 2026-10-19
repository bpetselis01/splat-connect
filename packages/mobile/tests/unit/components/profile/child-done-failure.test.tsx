// The matches read is a secondary lookup on the wizard's last screen: when it
// rejects offline the heading and button stay, the sentence drops, and nothing
// reaches console.error.
import { render, screen, waitFor } from '@testing-library/react-native'
import { ChildDone } from '../../../../components/profile/child-done'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

it('offline: still ready, no match sentence, no console.error', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValue(new Error('Network request failed'))
  render(<ChildDone child={{} as never} />)
  await waitFor(() => expect(mockGet).toHaveBeenCalled())
  expect(screen.getByText("Your child's profile is ready")).toBeTruthy()
  expect(screen.getByText('See the matches')).toBeTruthy()
  expect(screen.queryByText(/We found/)).toBeNull()
  expect(errSpy).not.toHaveBeenCalled()
})
