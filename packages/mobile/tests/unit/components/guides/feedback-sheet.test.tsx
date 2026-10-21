import { CLEARANCE, paddingBottomOf } from '../../bottom-spacing'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { FeedbackSheet } from '../../../../components/guides/feedback-sheet'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPick = jest.fn()
jest.mock('../../../../lib/upload', () => ({ pickAndUploadPhoto: (...a: unknown[]) => mockPick(...a) }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

const steps = [
  { id: 's1', tutorial_id: 'g', position: 1, title: 'Prepare', body: 'b', photo_url: null },
  { id: 's2', tutorial_id: 'g', position: 2, title: 'Solder', body: 'b', photo_url: null },
]
const posted = { id: 'n9', step_position: 2, author_id: 'me', author_name: 'You', body: 'Tin first.', photo_url: null, photo_caption: null, pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-10-07T00:00:00Z' }
const base = { tutorialId: 'g', steps, authorFirstName: 'Mei', open: true, onClose: jest.fn(), onPosted: jest.fn() }

beforeEach(() => { jest.clearAllMocks(); mockPost.mockResolvedValue(posted) })

it('G23 needs a step and a body before Post enables, then posts and shows the confirmation', async () => {
  render(<FeedbackSheet {...base} steps={steps as never} />)
  expect(screen.getByText('How did it go?')).toBeTruthy()
  expect(screen.getByText('Mei can pin it as a fix so the next builder sees it.')).toBeTruthy()
  const post = () => screen.getByRole('button', { name: 'Post' })
  expect(post().props.accessibilityState?.disabled).toBe(true)
  fireEvent.press(screen.getByText('Step 2'))
  fireEvent.changeText(screen.getByLabelText('Your note'), ' Tin first. ')
  expect(post().props.accessibilityState?.disabled).toBeFalsy()
  fireEvent.press(post())
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', { step_position: 2, body: 'Tin first.', photo_path: null, photo_caption: null }))
  expect(base.onPosted).toHaveBeenCalledWith(posted)
  expect(screen.getByText('Feedback posted')).toBeTruthy()
  expect(screen.getByText("It's on the guide's Feedback tab now, under Step 2.")).toBeTruthy()
})

it('preselects the step it was opened on', () => {
  render(<FeedbackSheet {...base} steps={steps as never} initialStep={1} />)
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  expect(screen.getByRole('button', { name: 'Post' }).props.accessibilityState?.disabled).toBeFalsy()
})

it('on a guide with no steps there is no step picker and Post only needs a note', async () => {
  render(<FeedbackSheet {...base} steps={[]} />)
  expect(screen.queryByText('Which step?')).toBeNull()
  expect(screen.queryByText('Missing step')).toBeNull()
  expect(screen.getByText(/Your note goes on the whole guide/)).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Your note'), 'The strap length is missing')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', expect.objectContaining({ step_position: null })))
})

it('stays open and says why when the post fails', async () => {
  mockPost.mockRejectedValue(new Error('API POST failed with status 401'))
  render(<FeedbackSheet {...base} steps={steps as never} initialStep={1} />)
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  expect(await screen.findByText(/Could not post that|status 401/)).toBeTruthy()
  expect(screen.getByText('How did it go?')).toBeTruthy()
  expect(base.onPosted).not.toHaveBeenCalled()
  expect(base.onClose).not.toHaveBeenCalled()
})

it('G24 uploads a photo and sends its path and caption', async () => {
  mockPick.mockResolvedValue({ path: 'g/photo.jpg' })
  render(<FeedbackSheet {...base} steps={steps as never} initialStep={1} />)
  fireEvent.press(screen.getByText('Add a photo'))
  await waitFor(() => expect(mockPick).toHaveBeenCalledWith('/api/upload/note-photo', 'g'))
  fireEvent.changeText(screen.getByLabelText('Photo caption'), 'The jig')
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', expect.objectContaining({ photo_path: 'g/photo.jpg', photo_caption: 'The jig' })))
})

it('from build mode, See it on the guide hands the note over; Stay here just closes', async () => {
  const onSeeOnGuide = jest.fn()
  render(<FeedbackSheet {...base} steps={steps as never} initialStep={2} onSeeOnGuide={onSeeOnGuide} />)
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await screen.findByText('Feedback posted')
  fireEvent.press(screen.getByRole('button', { name: 'Stay here' }))
  expect(base.onClose).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByRole('button', { name: 'See it on the guide' }))
  expect(onSeeOnGuide).toHaveBeenCalledWith(posted)
})

it('without onSeeOnGuide, See it on the guide closes', async () => {
  render(<FeedbackSheet {...base} steps={steps as never} initialStep={2} />)
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await screen.findByText('Feedback posted')
  fireEvent.press(screen.getByRole('button', { name: 'See it on the guide' }))
  expect(base.onClose).toHaveBeenCalled()
})

it('resets to a blank form each time it opens', async () => {
  const view = render(<FeedbackSheet {...base} steps={steps as never} initialStep={2} />)
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await screen.findByText('Feedback posted')
  view.rerender(<FeedbackSheet {...base} steps={steps as never} initialStep={2} open={false} />)
  view.rerender(<FeedbackSheet {...base} steps={steps as never} initialStep={2} open />)
  expect(screen.getByText('How did it go?')).toBeTruthy()
  expect(screen.getByLabelText('Your note').props.value).toBe('')
})

it('a host callback that throws does not turn a saved note into "Could not post that"', async () => {
  base.onPosted.mockImplementationOnce(() => { throw new Error('host broke') })
  const logged = jest.spyOn(console, 'error').mockImplementation(() => {})
  render(<FeedbackSheet {...base} steps={steps as never} />)
  fireEvent.press(screen.getByText('Step 2'))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Tin first.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  expect(await screen.findByText('Feedback posted')).toBeTruthy()
  expect(screen.queryByText('Could not post that. Please try again.')).toBeNull()
  expect(logged).toHaveBeenCalled()
  logged.mockRestore()
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

it('sits Post one gutter above the home indicator, not 24px from the edge', () => {
  render(<FeedbackSheet {...base} steps={steps as never} />)
  expect(paddingBottomOf(screen.getByTestId('feedback-sheet'))).toBe(CLEARANCE)
})

describe('a long guide picks its step from the list sheet', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `s${i + 1}`, tutorial_id: 'g', position: i + 1, title: i === 16 ? 'Seal with varnish' : `Part ${i + 1}`, body: 'b', photo_url: null }))

  it('G23 posts the step found by number, and the confirmation names it', async () => {
    mockPost.mockResolvedValue({ ...posted, step_position: 17 })
    render(<FeedbackSheet {...base} steps={many as never} />)
    expect(screen.queryByText('Step 17')).toBeNull()
    expect(screen.getByRole('button', { name: 'Which step, Choose a step' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Post' }).props.accessibilityState?.disabled).toBe(true)
    fireEvent.press(screen.getByTestId('step-picker-field'))
    fireEvent.changeText(screen.getByLabelText('Search steps'), '17')
    fireEvent.press(screen.getByRole('button', { name: '17. Seal with varnish' }))
    expect(screen.getByRole('button', { name: 'Which step, 17. Seal with varnish' })).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Your note'), 'Brush it on thin.')
    fireEvent.press(screen.getByRole('button', { name: 'Post' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', expect.objectContaining({ step_position: 17, body: 'Brush it on thin.' })))
    expect(await screen.findByText("It's on the guide's Feedback tab now, under Step 17.")).toBeTruthy()
  })

  it('opens on the step it was opened from, tagged "you were here"', () => {
    render(<FeedbackSheet {...base} steps={many as never} initialStep={7} />)
    expect(screen.getByRole('button', { name: 'Which step, 7. Part 7, you were here' })).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
    expect(screen.getByRole('button', { name: 'Post' }).props.accessibilityState?.disabled).toBeFalsy()
  })

  it('G23 Missing step from the list posts a null step', async () => {
    render(<FeedbackSheet {...base} steps={many as never} initialStep={7} />)
    fireEvent.press(screen.getByTestId('step-picker-field'))
    fireEvent.press(screen.getByRole('button', { name: 'Missing step' }))
    fireEvent.changeText(screen.getByLabelText('Your note'), 'Whole-guide note.')
    fireEvent.press(screen.getByRole('button', { name: 'Post' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', expect.objectContaining({ step_position: null })))
  })

  it('opening the list and closing it leaves the step and the typed note alone', () => {
    render(<FeedbackSheet {...base} steps={many as never} initialStep={7} />)
    fireEvent.changeText(screen.getByLabelText('Your note'), 'half written')
    fireEvent.press(screen.getByTestId('step-picker-field'))
    fireEvent.press(screen.getByRole('button', { name: 'Close step list' }))
    expect(screen.getByRole('button', { name: 'Which step, 7. Part 7, you were here' })).toBeTruthy()
    expect(screen.getByLabelText('Your note').props.value).toBe('half written')
    expect(base.onClose).not.toHaveBeenCalled()
  })
})
