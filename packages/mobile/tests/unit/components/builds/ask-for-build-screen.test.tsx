import { render, screen, fireEvent } from '@testing-library/react-native'
import { AskForBuildScreen } from '../../../../components/builds/ask-for-build-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), dismissTo: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null }) }))
const mockGuides = Array.from({ length: 40 }, (_, i) => ({
  id: `g${i}`,
  title: `Guide ${i}`,
  difficulty: 'easy',
  build_minutes: 20,
}))
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: jest.fn(() => Promise.resolve(mockGuides)), post: jest.fn() },
}))

// Every published guide rendered as a row: 1,000 of them on a phone, in a
// form a family is meant to fill in quickly. A few, then search.
it('lists a handful of guides until you search, then the matches', async () => {
  render(<AskForBuildScreen />)
  expect(await screen.findByText('Guide 0')).toBeTruthy()
  expect(screen.queryByText('Guide 8')).toBeNull()
  fireEvent.changeText(screen.getByLabelText('Search guides'), 'Guide 3')
  expect(screen.getByText('Guide 39')).toBeTruthy()
})
