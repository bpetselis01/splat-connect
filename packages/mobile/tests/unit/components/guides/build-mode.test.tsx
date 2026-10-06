import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { BuildMode } from '../../../../components/guides/build-mode'
import { apiClient } from '../../../../lib/api-client'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockKeepAwake = jest.fn()
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => mockKeepAwake() }))
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
const PINNED = { id: 'k1', body: 'Use a longer screw', step_position: 2, pinned_at: '2026-09-01', pinned_by_name: 'Sam', author_name: 'Al', created_at: '2026-09-01T00:00:00Z', photo_url: null, photo_caption: null }

function setup(notes: unknown[] = []) {
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve(notes) : Promise.resolve(GUIDE)))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockStored = null
  setup()
})

it('opens on Get ready with the safety notes, and the author checklist behind Show', async () => {
  render(<BuildMode id="g" />)
  expect(await screen.findByText('Screw the battery door shut')).toBeTruthy()
  expect(screen.getByText('Use the supplied screw.')).toBeTruthy()
  expect(screen.getByText('Get ready')).toBeTruthy()
  expect(screen.queryByText('No mains voltage anywhere in the design')).toBeNull()
  fireEvent.press(screen.getByText('6 safety checks passed'))
  expect(screen.getByText('No mains voltage anywhere in the design')).toBeTruthy()
  expect(mockKeepAwake).toHaveBeenCalled()
})

it('walks the steps and ticks each one as you go', async () => {
  render(<BuildMode id="g" />)
  fireEvent.press(await screen.findByText('Start step 1'))
  expect(screen.getByText('Open it')).toBeTruthy()
  expect(screen.getByText('Step 1 of 2')).toBeTruthy()
  fireEvent.press(screen.getByText('Next'))
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-steps.g.signed-out', '["s1"]')
  expect(screen.getByText('Close it')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Previous step'))
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
  fireEvent.press(screen.getByText('Next'))
  expect(await screen.findByText('Use a longer screw')).toBeTruthy()
  expect(screen.getByText('Notes from builders')).toBeTruthy()
  expect(screen.getByText('Approved by Sam')).toBeTruthy()
  expect(screen.getByText('Al')).toBeTruthy()
  fireEvent.press(screen.getByText('Notes from builders'))
  expect(screen.queryByText('Use a longer screw')).toBeNull()
  fireEvent.press(screen.getByText('Notes from builders'))
  fireEvent.press(screen.getByLabelText('Previous step'))
  expect(screen.queryByText(/Use a longer screw/)).toBeNull()
})

it('logs the build once from the done screen, then offers a note', async () => {
  ;(apiClient.post as jest.Mock).mockResolvedValue({ built: true })
  render(<BuildMode id="g" />)
  fireEvent.press(await screen.findByText('Start step 1'))
  fireEvent.press(screen.getByText('Next'))
  fireEvent.press(screen.getByText('Done'))
  expect(await screen.findByText('All 2 steps done')).toBeTruthy()
  expect(screen.getByText('You built it!')).toBeTruthy()
  fireEvent.press(screen.getByText('Add to My SPLAT'))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/tutorials/g/build', {}))
  expect(await screen.findByText('Added to My SPLAT')).toBeTruthy()
  fireEvent.press(screen.getByText('Added to My SPLAT'))
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
  expect(screen.getByText('5 min')).toBeTruthy()
  expect(screen.getByText('Tip')).toBeTruthy()
  fireEvent.press(screen.getByText('Done'))
  expect(screen.getByText('Plug it into the bubble machine and press.')).toBeTruthy()
})

it('opens on the step the guide page asked for', async () => {
  render(<BuildMode id="g" step="2" />)
  expect(await screen.findByText('Close it')).toBeTruthy()
  expect(screen.getByText('Step 2 of 2')).toBeTruthy()
})

it('ignores a step that is not in the guide and resumes as usual', async () => {
  render(<BuildMode id="g" step="9" />)
  expect(await screen.findByText('Start step 1')).toBeTruthy()
})

it('jumps to any step from All steps, and Start over clears the ticks', async () => {
  mockStored = '["s1"]'
  render(<BuildMode id="g" />)
  expect(await screen.findByText('Step 2 of 2')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('All steps'))
  expect(screen.getByText('1 of 2 done')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Step 1: Open it, done'))
  expect(screen.getByText('Step 1 of 2')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('All steps'))
  fireEvent.press(screen.getByText('Start over and clear ticks'))
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-steps.g.signed-out', '[]')
  expect(screen.getByText('Get ready')).toBeTruthy()
})

it('shows a step of several sentences as a lettered list, word for word', async () => {
  const twoLines = { ...GUIDE, steps: [{ ...GUIDE.steps[0], body: 'Hold the switch in the jig. Test it with a toy you know works.' }] }
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve([]) : Promise.resolve(twoLines)))
  render(<BuildMode id="g" />)
  fireEvent.press(await screen.findByText('Start step 1'))
  expect(screen.getByText('a')).toBeTruthy()
  expect(screen.getByText('Hold the switch in the jig.')).toBeTruthy()
  expect(screen.getByText('Test it with a toy you know works.')).toBeTruthy()
})

it('ticks parts from Get ready without leaving build mode', async () => {
  const withParts = { ...GUIDE, parts: [{ id: 'p1', tutorial_id: 'g', name: 'Servo', quantity: 1, is_optional: false, buy_links: [] }], tools: [] }
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve([]) : Promise.resolve(withParts)))
  render(<BuildMode id="g" />)
  expect(await screen.findByText('0/1 parts · 0/0 tools')).toBeTruthy()
  fireEvent.press(screen.getByText('Parts and tools'))
  fireEvent.press(screen.getByLabelText('Servo: gathered'))
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-parts.g.signed-out', '["p1"]')
  expect(screen.getByText('1/1 parts · 0/0 tools')).toBeTruthy()
})

it('opens a step photo full screen and comes back to the same step', async () => {
  const withPhoto = { ...GUIDE, steps: [{ ...GUIDE.steps[0], photo_url: 'https://x.test/s1.jpg' }, GUIDE.steps[1]] }
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve([]) : Promise.resolve(withPhoto)))
  render(<BuildMode id="g" step="1" />)
  fireEvent.press(await screen.findByLabelText('Open the photo for step 1 full screen'))
  fireEvent.press(screen.getByLabelText('Close photo'))
  expect(screen.getByText('Step 1 of 2')).toBeTruthy()
})

it('reads an approved note and its photo on the step, and leaves the rest to Notes', async () => {
  const withPhoto = { ...PINNED, photo_url: 'https://x.test/n.jpg', photo_caption: 'Foam under the switch' }
  const open = { id: 'k2', body: 'Worked for me', step_position: 2, pinned_at: null, pinned_by_name: null, author_name: 'Bo', created_at: '2026-09-02T00:00:00Z', photo_url: null, photo_caption: null }
  setup([withPhoto, open])
  render(<BuildMode id="g" step="2" />)
  fireEvent.press(await screen.findByLabelText("Open Al's photo full screen"))
  expect(screen.getAllByLabelText('Foam under the switch')).toHaveLength(2) // the note's photo and the viewer's
  fireEvent.press(screen.getByLabelText('Close photo'))
  expect(screen.queryByText('Worked for me')).toBeNull()
  fireEvent.press(screen.getByText("1 more note in the guide's Notes"))
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/guides/[id]', params: { id: 'g', tab: 'notes' } })
})
