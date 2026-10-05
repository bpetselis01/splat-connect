import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { BuildMode } from '../../../../components/guides/build-mode'
import { apiClient } from '../../../../lib/api-client'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }))
const mockReplace = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: mockBack }) }))
let mockStored: string | null = null
const mockSetItem = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: jest.fn(() => Promise.resolve(mockStored)), setItem: (...a: unknown[]) => mockSetItem(...a), removeItem: jest.fn() }),
}))

const GUIDE = {
  id: 'g',
  title: 'Robot Arm',
  safety_declared_at: '2026-08-01',
  safety_notes: [{ id: 'n1', tutorial_id: 'g', position: 1, title: 'Screw the battery door shut', detail: 'Use the supplied screw.' }],
  steps: [
    { id: 's1', tutorial_id: 'g', position: 1, title: 'Open it', body: 'Unscrew the lid.', photo_url: null },
    { id: 's2', tutorial_id: 'g', position: 2, title: 'Close it', body: 'Fit the lid.', photo_url: null },
  ],
}
const PINNED = { id: 'k1', body: 'Use a longer screw', step_position: 2, pinned_at: '2026-09-01', pinned_by_name: 'Sam', author_name: 'Al' }

function setup(notes: unknown[] = []) {
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve(notes) : Promise.resolve(GUIDE)))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockStored = null
  setup()
})

it('opens on Before you start with the safety notes and the author checklist', async () => {
  render(<BuildMode id="g" />)
  expect(await screen.findByText('Screw the battery door shut')).toBeTruthy()
  expect(screen.getByText('Use the supplied screw.')).toBeTruthy()
  expect(screen.getByText('The author checked that')).toBeTruthy()
  expect(screen.getByText('Before you start')).toBeTruthy()
})

it('walks the steps and ticks each one as you go', async () => {
  render(<BuildMode id="g" />)
  fireEvent.press(await screen.findByText('Start step 1'))
  expect(screen.getByText('Open it')).toBeTruthy()
  expect(screen.getByText('Step 1 of 2')).toBeTruthy()
  fireEvent.press(screen.getByText('Done, next step'))
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-steps.g', '["s1"]')
  expect(screen.getByText('Close it')).toBeTruthy()
  fireEvent.press(screen.getByText('Back'))
  expect(screen.getByText('Open it')).toBeTruthy()
})

it('resumes at the first unticked step', async () => {
  mockStored = '["s1"]'
  render(<BuildMode id="g" />)
  expect(await screen.findByText('Close it')).toBeTruthy()
  expect(screen.getByText('Step 2 of 2')).toBeTruthy()
})

it('shows a pinned note on its step only', async () => {
  setup([PINNED])
  render(<BuildMode id="g" />)
  fireEvent.press(await screen.findByText('Start step 1'))
  expect(screen.queryByText(/Use a longer screw/)).toBeNull()
  fireEvent.press(screen.getByText('Done, next step'))
  expect(await screen.findByText('Use a longer screw — pinned by Sam')).toBeTruthy()
  fireEvent.press(screen.getByText('Back'))
  expect(screen.queryByText(/Use a longer screw/)).toBeNull()
})

it('logs the build once from the done screen, then offers a note', async () => {
  ;(apiClient.post as jest.Mock).mockResolvedValue({ built: true })
  render(<BuildMode id="g" />)
  fireEvent.press(await screen.findByText('Start step 1'))
  fireEvent.press(screen.getByText('Done, next step'))
  fireEvent.press(screen.getByText('Done'))
  expect(await screen.findByText('All 2 steps done')).toBeTruthy()
  fireEvent.press(screen.getByText('Mark this build done'))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/tutorials/g/build', {}))
  expect(await screen.findByText('Build logged')).toBeTruthy()
  fireEvent.press(screen.getByText('Build logged'))
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByText('Leave a note'))
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/guides/[id]', params: { id: 'g', tab: 'notes' } })
})

// 129: a step's tip and minutes on its screen, and the author's closing line when done.
it('shows a step tip and minutes, and the closing line on the done screen', async () => {
  const withExtras = {
    ...GUIDE,
    done_note: 'Plug it into the bubble machine and press.',
    steps: [{ ...GUIDE.steps[0], tip: 'Keep the screws in a cup.', minutes: 5 }],
  }
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve([]) : Promise.resolve(withExtras)))
  render(<BuildMode id="g" />)
  fireEvent.press(await screen.findByText('Start step 1'))
  expect(screen.getByText('Keep the screws in a cup.')).toBeTruthy()
  expect(screen.getByText('About 5 min')).toBeTruthy()
  fireEvent.press(screen.getByText('Done'))
  expect(screen.getByText('Plug it into the bubble machine and press.')).toBeTruthy()
})
