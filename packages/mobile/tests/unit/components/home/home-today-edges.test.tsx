// journeys: H01
import { render, screen, fireEvent, act } from '@testing-library/react-native'
import { HomeScreen } from '../../../../components/home/home-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPush = jest.fn()
let mockFocus: () => void
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (e: () => void) => { mockFocus = e; useEffect(e, []) } }
})
let mockCaps: { unread?: { total: number; exchanges: number } } | null = null
const mockRefresh = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps, refresh: mockRefresh }) }))
jest.mock('../../../../lib/home-shortcuts', () => ({
  useHomeShortcuts: () => ({ features: [], ids: [], ready: true, add: jest.fn(), remove: jest.fn(), move: jest.fn(), moveToTop: jest.fn(), reset: jest.fn() }),
}))
jest.mock('../../../../lib/recents', () => ({ useRecents: () => ({ recents: [], ready: true, clear: jest.fn() }) }))
jest.mock('../../../../components/home/add-shortcut-sheet', () => ({ AddShortcutSheet: () => null }))

const setup = (unread?: { total: number; exchanges: number }) => {
  mockCaps = { unread }
  render(<HomeScreen />)
  fireEvent(screen.getByTestId('shortcut-grid'), 'layout', { nativeEvent: { layout: { width: 358, height: 0 } } })
}

beforeEach(() => { jest.clearAllMocks(); mockCaps = null })

describe('Home Today card count math', () => {
  it.each([[0], [-1], [-250], [NaN]])('is hidden for a total of %p', (total) => {
    setup({ total, exchanges: 0 })
    expect(screen.queryByText(/new message/)).toBeNull()
  })

  it('is hidden while capabilities have not loaded, or carry no unread block', () => {
    setup(undefined)
    expect(screen.queryByText(/new message/)).toBeNull()
  })

  it('one unread that is all about an exchange names the exchange, singular', () => {
    setup({ total: 1, exchanges: 1 })
    expect(screen.getByLabelText('1 new message about your toy exchange. Open Inbox')).toBeTruthy()
  })

  it('a thousand messages are counted in full, not capped like the tab badge', () => {
    setup({ total: 1000, exchanges: 3 })
    expect(screen.getByText('1000 new messages')).toBeTruthy()
    expect(screen.getByLabelText('1000 new messages waiting for you. Open Inbox')).toBeTruthy()
  })

  it('more exchange notices than total (counts read a moment apart) never claims the exchange', () => {
    setup({ total: 2, exchanges: 5 })
    expect(screen.queryByText(/toy exchange/)).toBeNull()
  })

  it('opens the Inbox however large the count', () => {
    setup({ total: 99999, exchanges: 0 })
    fireEvent.press(screen.getByLabelText(/new messages/))
    expect(mockPush).toHaveBeenCalledWith('/inbox')
  })

  it('an emptied Home still draws its Edit control and the Add tile', () => {
    setup({ total: 0, exchanges: 0 })
    expect(screen.getByLabelText('Edit')).toBeTruthy()
    expect(screen.getByLabelText('Add a shortcut')).toBeTruthy()
  })

  it('refetches the unread count each time Home regains focus, not on the first focus', () => {
    setup({ total: 1, exchanges: 0 })
    expect(mockRefresh).not.toHaveBeenCalled()
    act(() => { mockFocus() })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })
})
