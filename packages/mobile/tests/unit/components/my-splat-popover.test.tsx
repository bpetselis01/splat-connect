import { render, screen, fireEvent } from '@testing-library/react-native'
import { MySplatPopover } from '../../../components/my-splat-popover'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('../../../lib/my-routes', () => ({ myRoute: (href: string) => `/mapped${href}` }))

const caps: any = {
  profile: { name: 'Byron' }, isAdmin: false, ledOrgs: [],
  unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 }, exchangeActions: 3,
}

it('closes on the scrim and navigates through the route map from a tile', () => {
  const onClose = jest.fn()
  render(<MySplatPopover caps={caps} tabBarHeight={64} onClose={onClose} />)
  // The panel is accessibilityViewIsModal, so RNTL correctly treats the dimmed
  // scrim behind it as hidden from accessibility by default (real screen
  // readers skip it too) — opt back in to reach it for the tap-to-close check.
  fireEvent.press(screen.getByTestId('my-splat-scrim', { includeHiddenElements: true }))
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByText('My exchanges'))
  expect(mockPush).toHaveBeenCalledWith('/mapped/dashboard/exchanges')
  expect(onClose).toHaveBeenCalledTimes(2)
  fireEvent.press(screen.getByText('All of My SPLAT'))
  expect(mockPush).toHaveBeenCalledWith('/my-splat')
})
