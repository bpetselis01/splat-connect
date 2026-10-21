// A story link opened offline says so (not "no longer published"), retries on Try again, and never hits console.error.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { OrgNewsScreen } from '../../../../components/organisation/org-news-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockReplace = jest.fn()
// A stable router: the screen's effect depends on it.
const mockRouter = { replace: mockReplace }
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))

it('offline: says so, Try again re-fetches and opens the organisation', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed'))
  render(<OrgNewsScreen kind="story" id="x1" />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  mockGet.mockResolvedValueOnce({ org_id: 'o9' })
  fireEvent.press(screen.getByText('Try again'))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/toy-library/organisation/[id]', params: { id: 'o9' } }))
  expect(errSpy).not.toHaveBeenCalled()
})
