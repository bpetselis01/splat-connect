import { render, screen, fireEvent } from '@testing-library/react-native'
import MeTab from '../../../app/(tabs)/me'

// `mock`-prefixed: jest hoists the factory above this const, and only that prefix is allowed through.
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: {
    profile: { name: 'Byron P', role: 'contributor' }, isAdmin: false, ledOrgs: [{ id: 'o', name: 'Alpha' }],
    unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 5 }, exchangeActions: 3,
  }, loading: false, refresh: jest.fn() }),
}))

it('renders every buildNav group as rows, routes them through the map, and ends with Explore', () => {
  render(<MeTab />)
  // getAllByText: "Account" is both a group heading and a row label.
  for (const h of ['Add a tutorial', 'Exchange a toy', 'Give us a challenge', 'Organisation', 'Account', 'Explore']) expect(screen.getAllByText(h).length).toBeGreaterThan(0)
  expect(screen.getByText('Leads Alpha')).toBeTruthy()
  expect(screen.getByText('3')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('My toys'))
  expect(mockPush).toHaveBeenCalledWith('/toys')
  fireEvent.press(screen.getByLabelText('Learn'))
  expect(mockPush).toHaveBeenCalledWith('/explore/learn')
})

it('draws a row with no mobile screen as SOON and never sends it back to Me', () => {
  render(<MeTab />)
  mockPush.mockClear()
  // /dashboard/events has no screen under app/(my) — see my-routes.test.
  fireEvent.press(screen.getByLabelText('My events'))
  expect(mockPush).not.toHaveBeenCalled()
  // Print for others was the example here until it got its screen.
  fireEvent.press(screen.getByLabelText('Print for others'))
  expect(mockPush).toHaveBeenCalledWith('/print-for-others')
  expect(screen.getAllByText('SOON').length).toBeGreaterThan(0)
})
