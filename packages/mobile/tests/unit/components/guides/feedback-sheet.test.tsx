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

it('needs a step and a body before Post enables, then posts and shows the confirmation', async () => {
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

it('a guide with no steps still posts, as a missing step', async () => {
  render(<FeedbackSheet {...base} steps={[]} />)
  expect(screen.queryByText(/^Step \d/)).toBeNull()
  fireEvent.press(screen.getByText('Missing step'))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Worked great.')
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

it('uploads a photo and sends its path and caption', async () => {
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
