import { CLEARANCE, scrollPaddings } from '../../bottom-spacing'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AskForBuildScreen } from '../../../../components/builds/ask-for-build-screen'
import { apiClient } from '../../../../lib/api-client'

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

it('K05 offers the board’s How soon? choices and posts without a note', async () => {
  render(<AskForBuildScreen />)
  fireEvent.press(await screen.findByRole('radio', { name: 'Guide 0' }))
  for (const label of ['No rush', 'This month', 'Before holidays']) {
    expect(screen.getByRole('radio', { name: label })).toBeTruthy()
  }
  expect(screen.queryByRole('radio', { name: 'Within a month' })).toBeNull()
  expect(screen.getByText('A note to the maker (optional)')).toBeTruthy()
  fireEvent.changeText(screen.getByPlaceholderText('Newtown'), 'Glebe')
  fireEvent.press(screen.getByRole('radio', { name: 'This month' }))
  fireEvent.press(screen.getByRole('checkbox'))
  fireEvent.press(screen.getByRole('button', { name: 'Post to Makers wanted' }))
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/toy-transactions/build',
      expect.objectContaining({ tutorial_id: 'g0', build_brief: null, urgency: 'This month', requester_suburb: 'Glebe' })
    )
  )
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

it('ends one gutter above the home indicator (the full-height sheet runs under it)', async () => {
  render(<AskForBuildScreen />)
  expect(scrollPaddings(screen)).toEqual([CLEARANCE])
})
