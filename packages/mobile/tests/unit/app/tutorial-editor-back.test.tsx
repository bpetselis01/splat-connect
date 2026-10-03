import { render, screen, fireEvent } from '@testing-library/react-native'
import TutorialEditorLayout from '../../../app/(my)/tutorials/[id]/_layout'

// The hub's back control used to be labelled "My tutorials" whatever the stack
// held. Opened from a notification, Back returns to the Inbox, so the label lied
// and no control on the screen was called Back.

type Opts = { headerLeft?: () => React.ReactNode }
const mockOptions: Record<string, Opts> = {}
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() }
jest.mock('expo-router', () => {
  const Stack = ({ children }: { children: React.ReactNode }) => <>{children}</>
  Stack.Screen = ({ name, options }: { name: string; options: Opts }) => {
    mockOptions[name] = options
    return null
  }
  return { Stack, useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: 't1' }) }
})
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../lib/use-tutorial-draft', () => ({
  TutorialDraftProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDraft: () => ({ saveState: 'idle' }),
}))
jest.mock('../../../components/my-tutorials/sections/save-chip', () => ({ SaveChip: () => null, SAVE_CHIP_LABEL: {} }))

beforeEach(() => jest.clearAllMocks())

function hubBack() {
  render(<TutorialEditorLayout />)
  render(<>{mockOptions.index.headerLeft!()}</>)
  return screen.getByLabelText('Back')
}

it('is called Back, and goes back to wherever the editor was opened from', () => {
  mockRouter.canGoBack.mockReturnValue(true)
  fireEvent.press(hubBack())
  expect(mockRouter.back).toHaveBeenCalled()
})

it('falls back to My tutorials when nothing is behind it', () => {
  mockRouter.canGoBack.mockReturnValue(false)
  fireEvent.press(hubBack())
  expect(mockRouter.replace).toHaveBeenCalledWith('/tutorials')
})
