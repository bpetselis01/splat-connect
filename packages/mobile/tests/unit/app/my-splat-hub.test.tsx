import { render, screen, fireEvent } from '@testing-library/react-native'
import MySplatHub from '../../../app/(my)/my-splat'

// `mock`-prefixed: jest hoists the factory above this const, and only that prefix is allowed through.
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: {
    profile: { name: 'Byron P', role: 'contributor' }, isAdmin: false, ledOrgs: [{ id: 'o', name: 'Alpha' }],
    unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 5 }, exchangeActions: 3,
  }, loading: false, refresh: jest.fn() }),
}))

it('renders every buildNav group as rows and routes them through the map', () => {
  render(<MySplatHub />)
  // getAllByText: "Account" is both a group heading and a row label.
  for (const h of ['Add a tutorial', 'Exchange a toy', 'Give us a challenge', 'Organisation', 'Account']) expect(screen.getAllByText(h).length).toBeGreaterThan(0)
  expect(screen.getByText('Leads Alpha')).toBeTruthy()
  expect(screen.getByText('3')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('My toys'))
  expect(mockPush).toHaveBeenCalledWith('/toys')
})
