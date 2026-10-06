import { render, screen, fireEvent } from '@testing-library/react-native'
import { Text } from 'react-native'
import { HomeButton, WithHome } from '../../../../components/ui/HomeButton'
import { stackScreenOptions } from '../../../../lib/nav-options'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockNavigate = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate, back: jest.fn(), canGoBack: () => true, replace: jest.fn() }) }))

it('goes Home in one tap, unwinding to the Home tab that is already there', () => {
  render(<HomeButton />)
  fireEvent.press(screen.getByRole('button', { name: 'Home' }))
  expect(mockNavigate).toHaveBeenCalledWith('/home')
})

it('is the right-hand header item of every stack that shares the options', () => {
  render(<>{stackScreenOptions.headerRight()}</>)
  expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy()
})

it('keeps a screen’s own header button beside Home', () => {
  render(<WithHome><Text>Add a tutorial</Text></WithHome>)
  expect(screen.getByText('Add a tutorial')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy()
})
