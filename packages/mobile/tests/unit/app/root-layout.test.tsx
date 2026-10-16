// packages/mobile/tests/unit/app/root-layout.test.tsx
// A cold start goes straight to the first screen: nothing sits over the stack.
import { Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import RootLayout from '../../../app/_layout'

jest.mock('expo-router', () => {
  const { Text } = require('react-native')
  const Stack = () => <Text>first screen</Text>
  Stack.Screen = () => null
  return { Stack }
})
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }))
jest.mock('@expo-google-fonts/nunito', () => ({ useFonts: () => [true] }))
jest.mock('../../../lib/acting-org', () => ({ ActingOrgProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('../../../lib/auth-context', () => ({ AuthProvider: ({ children }: { children: React.ReactNode }) => children }))

describe('RootLayout', () => {
  it('renders the stack with no intro overlay', () => {
    render(<RootLayout />)
    expect(screen.getByText('first screen')).toBeTruthy()
    expect(screen.queryByLabelText('Skip intro')).toBeNull()
    expect(screen.UNSAFE_queryAllByType(Text)).toHaveLength(1)
  })
})
