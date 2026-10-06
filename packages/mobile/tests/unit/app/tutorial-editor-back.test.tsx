import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import TutorialEditorLayout from '../../../app/(my)/tutorials/[id]/_layout'
import { rememberBarPath } from '../../../lib/last-bar-path'

// Every editor screen's ✕ closes back to the last screen with the tab bar, and
// it saves first: the draft debounces 250ms, and unmounting clears the timer,
// so a quick tap after typing used to drop the last edit.

type Opts = { headerLeft?: () => React.ReactNode }
let mockScreenOptions: Opts = {}
const mockRouter = { replace: jest.fn() }
const mockRef = {
  getRootState: () => ({ index: 1, routes: [{ name: '(tabs)', state: { index: 0, routes: [{ name: 'home' }, { name: 'me' }] } }, { name: '(my)' }] }),
  dispatch: jest.fn(),
}
const mockFlush = jest.fn(() => Promise.resolve())
jest.mock('expo-router', () => {
  const Stack = ({ children, screenOptions }: { children: React.ReactNode; screenOptions: Opts }) => {
    mockScreenOptions = screenOptions
    return <>{children}</>
  }
  Stack.Screen = () => null
  return { Stack, useRouter: () => mockRouter, useNavigationContainerRef: () => mockRef, useLocalSearchParams: () => ({ id: 't1' }) }
})
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../lib/use-tutorial-draft', () => ({
  TutorialDraftProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDraft: () => ({ saveState: 'idle', flush: mockFlush }),
}))
jest.mock('../../../components/my-tutorials/sections/save-chip', () => ({ SaveChip: () => null, SAVE_CHIP_LABEL: {} }))

beforeEach(() => jest.clearAllMocks())

it('saves the draft, then closes to the last screen with the tab bar', async () => {
  rememberBarPath('me')
  render(<TutorialEditorLayout />)
  render(<>{mockScreenOptions.headerLeft!()}</>)
  fireEvent.press(screen.getByLabelText('Close'))
  await waitFor(() => expect(mockRef.dispatch).toHaveBeenCalled())
  const reset = mockRef.dispatch.mock.calls[0][0]
  expect(reset.payload.routes.map((r: { name: string }) => r.name)).toEqual(['(tabs)'])
  expect(reset.payload.routes[0].state.index).toBe(1)
  expect(mockFlush.mock.invocationCallOrder[0]).toBeLessThan(mockRef.dispatch.mock.invocationCallOrder[0])
})
