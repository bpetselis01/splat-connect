import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { CommunityNotes } from '../../../../components/guides/community-notes'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }))
jest.mock('../../../../lib/upload', () => ({ uploadFile: jest.fn() }))
const mockPost = jest.fn().mockResolvedValue({})
const mockDelete = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a) } }))
jest.mock('../../../../components/reports/report-problem', () => ({ ReportProblem: () => null }))

const steps = [{ id: 's1', tutorial_id: 'g', position: 1, title: 'Open the battery bay', body: 'b', photo_url: null }]
const note = (over: object) => ({
  id: 'n1', step_position: 1, author_id: 'p', author_name: 'Priya', body: 'Needs a second zip tie.', photo_url: null, photo_caption: null,
  pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z', ...over,
})
const reload = jest.fn().mockResolvedValue(undefined)
const props = { tutorialId: 'g', guideTitle: 'Light-up drum', authorName: 'Sam', steps, reload, canPin: false, viewerId: 'me' }

beforeEach(() => jest.clearAllMocks())

it('lists revisions and discussion, and posts a note against a step', async () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'a', pinned_at: 'x', pinned_by_name: 'Sam' }), note({ id: 'b' })] as never} />)
  expect(screen.getByText('Revisions · 1 pinned')).toBeTruthy()
  expect(screen.getByText('Discussion · 1')).toBeTruthy()
  expect(screen.getByText('Pinned by Sam')).toBeTruthy()
  fireEvent.press(screen.getByText('Step 1'))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Glue the jack too.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', { step_position: 1, body: 'Glue the jack too.', photo_url: null, photo_caption: null }))
  expect(reload).toHaveBeenCalled()
})

it('posts a missing step and says where it would land', async () => {
  render(<CommunityNotes {...props} notes={[]} />)
  fireEvent.press(screen.getByText('Missing step'))
  expect(screen.getByText('Not part of any step above. If pinned, it is added to the end as step 2.')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Test the switch first.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', expect.objectContaining({ step_position: null })))
})

it('offers Pin to a contributor and Delete on your own note', async () => {
  render(<CommunityNotes {...props} canPin notes={[note({ id: 'mine', author_id: 'me' })] as never} />)
  fireEvent.press(screen.getByRole('button', { name: 'Pin as revision' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes/mine/pin', {}))
  fireEvent.press(screen.getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/g/notes/mine'))
})

it('asks a signed-out reader to sign in instead of showing the form', () => {
  render(<CommunityNotes {...props} viewerId={null} notes={[note({})] as never} />)
  expect(screen.getByText('Sign in to add a note.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Post' })).toBeNull()
  expect(screen.queryByLabelText('Your note')).toBeNull()
})
