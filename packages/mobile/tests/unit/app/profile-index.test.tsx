import { render, screen } from '@testing-library/react-native'
import ProfileIndex from '../../../app/(tabs)/profile/index'
import { useAuth } from '../../../lib/auth-context'

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../components/profile-screen', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { ProfileScreen: () => React.createElement(Text, null, 'ACCOUNT_VIEW') }
})
jest.mock('../../../components/profile/child-profile-home', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { ChildProfileHome: () => React.createElement(Text, null, 'CHILD_HOME') }
})

describe('Profile route role branch', () => {
  it('renders the child-profile home for a signed-in parent', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ session: { user: {} }, profile: { role: 'parent' } })
    render(<ProfileIndex />)
    expect(screen.getByText('CHILD_HOME')).toBeTruthy()
  })

  it('renders the account view for a signed-in contributor', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ session: { user: {} }, profile: { role: 'contributor' } })
    render(<ProfileIndex />)
    expect(screen.getByText('ACCOUNT_VIEW')).toBeTruthy()
  })

  it('renders the account view when signed out', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ session: null, profile: null })
    render(<ProfileIndex />)
    expect(screen.getByText('ACCOUNT_VIEW')).toBeTruthy()
  })

  it('renders the account view for a signed-in parent whose profile has not loaded yet', () => {
    ;(useAuth as jest.Mock).mockReturnValue({ session: { user: {} }, profile: null })
    render(<ProfileIndex />)
    expect(screen.getByText('ACCOUNT_VIEW')).toBeTruthy()
  })
})
