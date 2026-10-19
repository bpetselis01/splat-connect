import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { BuildMode } from '../../../../components/guides/build-mode'
import { apiClient } from '../../../../lib/api-client'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockKeepAwake = jest.fn()
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => mockKeepAwake() }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }))
const mockSetFocus = jest.fn()
jest.mock('../../../../lib/guide-focus', () => ({ setGuideFocus: (...a: unknown[]) => mockSetFocus(...a) }))
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
  tutorial_contributors: [{ profile_id: 'c1', role: 'primary', profiles: { name: 'Mei Tan' } }],
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

it('B01 walks the steps and ticks each one as you go', async () => {
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

it('B03 logs the build once from the done screen, then offers feedback', async () => {
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
  expect(screen.getByRole('button', { name: 'Leave feedback' })).toBeTruthy()
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

it('B02 jumps to any step from All steps, and Start over clears the ticks', async () => {
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

it('B06 ticks parts from Get ready without leaving build mode', async () => {
  const withParts = { ...GUIDE, parts: [{ id: 'p1', tutorial_id: 'g', name: 'Servo', quantity: 1, is_optional: false, buy_links: [] }], tools: [] }
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve([]) : Promise.resolve(withParts)))
  render(<BuildMode id="g" />)
  expect(await screen.findByText('0/1 parts · 0/0 tools')).toBeTruthy()
  fireEvent.press(screen.getByText('Parts and tools'))
  fireEvent.press(screen.getByLabelText('Servo: gathered'))
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-parts.g.signed-out', '["p1"]')
  expect(screen.getByText('1/1 parts · 0/0 tools')).toBeTruthy()
})

it('B07 opens a step photo full screen and comes back to the same step', async () => {
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
  fireEvent.press(screen.getByText("1 more note in the guide's Feedback"))
  expect(mockSetFocus).toHaveBeenCalledWith({ tutorialId: 'g', noteId: null })
  expect(mockBack).toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})

async function reachDone() {
  render(<BuildMode id="g" />)
  fireEvent.press(await screen.findByText('Start step 1'))
  fireEvent.press(screen.getByText('Next'))
  fireEvent.press(screen.getByText('Done'))
  await screen.findByText('All 2 steps done')
}

it('B04 the done screen offers Leave feedback, which opens the sheet on the last step viewed', async () => {
  await reachDone()
  fireEvent.press(screen.getByRole('button', { name: 'Leave feedback' }))
  expect(screen.getByText('How did it go?')).toBeTruthy()
  expect(screen.getByText('Mei can pin it as a fix so the next builder sees it.')).toBeTruthy()
  // Step 2 was the last step on screen, so Post needs only a body.
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Great.')
  expect(screen.getByRole('button', { name: 'Post' }).props.accessibilityState?.disabled).toBeFalsy()
  expect(mockReplace).not.toHaveBeenCalled()
})

it('the feedback sheet names the primary contributor, not whoever is listed first', async () => {
  const guide = { ...GUIDE, tutorial_contributors: [{ profile_id: 'c2', role: 'collaborator', profiles: { name: 'Dan Lee' } }, { profile_id: 'c1', role: 'primary', profiles: { name: 'Mei Tan' } }] }
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve([]) : Promise.resolve(guide)))
  await reachDone()
  fireEvent.press(screen.getByRole('button', { name: 'Leave feedback' }))
  expect(screen.getByText('Mei can pin it as a fix so the next builder sees it.')).toBeTruthy()
})

it('See it on the guide hands the note to the guide and closes build mode', async () => {
  ;(apiClient.post as jest.Mock).mockResolvedValue({ id: 'n9', step_position: 2, author_id: 'me', author_name: 'You', body: 'Great.', photo_url: null, photo_caption: null, pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-10-07T00:00:00Z' })
  await reachDone()
  fireEvent.press(screen.getByRole('button', { name: 'Leave feedback' }))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Great.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await screen.findByText('Feedback posted')
  fireEvent.press(screen.getByRole('button', { name: 'See it on the guide' }))
  expect(mockSetFocus).toHaveBeenCalledWith({ tutorialId: 'g', noteId: 'n9' })
  expect(mockBack).toHaveBeenCalled()
})

it('a failed load offers Try again, which reloads the guide', async () => {
  jest.spyOn(console, 'debug').mockImplementation(() => {})
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve([]) : Promise.reject(new TypeError('Network request failed'))))
  render(<BuildMode id="g" />)
  expect(await screen.findByText("Couldn't load this guide. Please try again.")).toBeTruthy()
  setup()
  fireEvent.press(screen.getByText('Try again'))
  expect(await screen.findByText('Screw the battery door shut')).toBeTruthy()
})

it('a failed post keeps build mode where it is', async () => {
  ;(apiClient.post as jest.Mock).mockRejectedValue(new Error('API POST failed with status 401'))
  await reachDone()
  fireEvent.press(screen.getByRole('button', { name: 'Leave feedback' }))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Great.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  expect(await screen.findByText(/status 401|Could not post/)).toBeTruthy()
  expect(mockSetFocus).not.toHaveBeenCalled()
  expect(mockBack).not.toHaveBeenCalled()
})

it('the notes link on a step opens the guide’s Feedback tab by hand-off, not a second copy', async () => {
  setup([{ ...PINNED, pinned_at: null, step_position: 1 }])
  render(<BuildMode id="g" />)
  fireEvent.press(await screen.findByText('Start step 1'))
  fireEvent.press(screen.getByText("1 note on this step in the guide's Feedback"))
  expect(mockSetFocus).toHaveBeenCalledWith({ tutorialId: 'g', noteId: null })
  expect(mockBack).toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})

it('B05 the header ✕ and the done screen’s Back to the guide both pop back to the guide, keeping the ticked steps', async () => {
  render(<BuildMode id="g" />)
  fireEvent.press(await screen.findByText('Start step 1'))
  fireEvent.press(screen.getByText('Next'))
  fireEvent.press(screen.getByLabelText('Close build mode'))
  expect(mockBack).toHaveBeenCalledTimes(1)
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-steps.g.signed-out', '["s1"]')
  expect(mockReplace).not.toHaveBeenCalled()

  fireEvent.press(screen.getByText('Done'))
  await screen.findByText('All 2 steps done')
  fireEvent.press(screen.getByRole('button', { name: 'Back to the guide' }))
  expect(mockBack).toHaveBeenCalledTimes(2)
  expect(mockReplace).not.toHaveBeenCalled()
})
