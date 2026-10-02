import { render, screen, fireEvent } from '@testing-library/react-native'
import { HeaderAddButton } from '../../../components/ui/HeaderAddButton'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

it('is a named button that opens its add screen', () => {
  render(<HeaderAddButton label="Submit an idea" href="/explore/challenges/new" />)
  fireEvent.press(screen.getByRole('button', { name: 'Submit an idea' }))
  expect(mockPush).toHaveBeenCalledWith('/explore/challenges/new')
})
