import { Platform } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { theme } from '../../../../lib/theme'
import { CommunityNotes } from '../../../../components/guides/community-notes'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/upload', () => ({ pickAndUploadPhoto: jest.fn() }))
const mockPost = jest.fn().mockResolvedValue({})
const mockDelete = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a) } }))
const mockReport = jest.fn()
jest.mock('../../../../components/reports/report-problem', () => ({
  ReportProblem: (p: { subjectKind: string; subjectId: string; subjectLabel: string; trigger?: (open: () => void) => unknown }) => {
    mockReport(p.subjectKind, p.subjectId, p.subjectLabel)
    return p.trigger ? (p.trigger(() => mockReport('opened')) as never) : null
  },
}))

const steps = [1, 2, 3, 4].map((p) => ({ id: `s${p}`, tutorial_id: 'g', position: p, title: `Step ${p} title`, body: 'b', photo_url: null }))
const note = (over: object) => ({
  id: 'n1', step_position: 1, author_id: 'p', author_name: 'Priya S', body: 'Needs a second zip tie.', photo_url: null, photo_caption: null,
  pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z', ...over,
})
const reload = jest.fn().mockResolvedValue(undefined)
const props = { tutorialId: 'g', guideTitle: 'Light Touch Switch', authorName: 'Mei Tan', steps: steps as never, reload, canPin: false, viewerId: 'me', viewerName: 'Byron P' }

beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.restoreAllMocks())

it('lists fixes first, then the rest, with filter chips that count', () => {
  const notes = [note({ id: 'a', step_position: 3, pinned_at: 'x', pinned_by_name: 'Mei Tan', body: 'Tin both leads first.' }), note({ id: 'b', step_position: 4, author_name: 'Sam R', body: 'Cap was tight.' }), note({ id: 'c', step_position: null, body: 'Test before gluing.' })]
  render(<CommunityNotes {...props} notes={notes as never} />)
  expect(screen.getByTestId('feedback-filter-all')).toHaveTextContent('All 3')
  expect(screen.getByTestId('feedback-filter-fixes')).toHaveTextContent('Fixes 1')
  expect(screen.getByTestId('feedback-filter-step-3')).toBeTruthy()
  expect(screen.getByTestId('feedback-filter-step-4')).toBeTruthy()
  expect(screen.queryByTestId('feedback-filter-step-1')).toBeNull()
  expect(screen.getByTestId('feedback-filter-missing')).toBeTruthy()
  expect(screen.getByText('Fix · approved by Mei')).toBeTruthy()
  expect(screen.getByText('Tin both leads first.')).toBeTruthy()
  expect(screen.getByText('Sam R')).toBeTruthy()
  expect(screen.queryByText(/^Revisions/)).toBeNull()
  expect(screen.queryByText(/^Discussion/)).toBeNull()
})

it('filters by step, fixes and missing', () => {
  const notes = [note({ id: 'a', step_position: 3, pinned_at: 'x', pinned_by_name: 'Mei' }), note({ id: 'b', step_position: 4, body: 'Cap was tight.' }), note({ id: 'c', step_position: null, body: 'Test before gluing.' })]
  render(<CommunityNotes {...props} notes={notes as never} />)
  fireEvent.press(screen.getByTestId('feedback-filter-step-4'))
  expect(screen.getByText('Cap was tight.')).toBeTruthy()
  expect(screen.queryByText('Test before gluing.')).toBeNull()
  fireEvent.press(screen.getByTestId('feedback-filter-missing'))
  expect(screen.getByText('Test before gluing.')).toBeTruthy()
  expect(screen.queryByText('Cap was tight.')).toBeNull()
  fireEvent.press(screen.getByTestId('feedback-filter-fixes'))
  expect(screen.getByText('Fix · approved by Mei')).toBeTruthy()
  expect(screen.queryByText('Cap was tight.')).toBeNull()
})

it('a note past the end of the steps files under Missing, with no chip of its own', () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'z', step_position: 9, body: 'Past the end.' })] as never} />)
  expect(screen.queryByTestId('feedback-filter-step-9')).toBeNull()
  fireEvent.press(screen.getByTestId('feedback-filter-missing'))
  expect(screen.getByText('Past the end.')).toBeTruthy()
})

it('the composer bar opens the sheet; a post reloads and hands the note up', async () => {
  const onPosted = jest.fn()
  mockPost.mockResolvedValueOnce(note({ id: 'new', step_position: 2, body: 'Posted.' }))
  render(<CommunityNotes {...props} notes={[]} onPosted={onPosted} />)
  expect(screen.getByText('No feedback yet. Built it? Say how it went.')).toBeTruthy()
  fireEvent.press(screen.getByTestId('feedback-composer'))
  expect(screen.getByText('How did it go?')).toBeTruthy()
  fireEvent.press(screen.getByText('Step 2'))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Posted.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await waitFor(() => expect(onPosted).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' })))
  expect(reload).toHaveBeenCalled()
})

it('signed out, the bar says to sign in and opens nothing', () => {
  render(<CommunityNotes {...props} viewerId={null} viewerName={null} notes={[]} />)
  fireEvent.press(screen.getByText('Sign in to leave feedback'))
  expect(screen.queryByText('How did it go?')).toBeNull()
})

it('the ⋯ menu lists only what this viewer can do', () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'mine', author_id: 'me' }), note({ id: 'theirs', author_id: 'p', author_name: 'Sam R', step_position: 4 })] as never} />)
  fireEvent.press(screen.getByTestId('note-menu-theirs'))
  expect(screen.getByText("Sam R's note on Step 4")).toBeTruthy()
  expect(screen.getByText('Report this note')).toBeTruthy()
  expect(screen.queryByText('Delete')).toBeNull()
  expect(screen.queryByText('Pin as a fix')).toBeNull()
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.press(screen.getByTestId('note-menu-mine'))
  expect(screen.getByText('Delete')).toBeTruthy()
  expect(screen.queryByText('Report this note')).toBeNull()
})

it('an author sees Pin as a fix, pins, and the flash says so', async () => {
  render(<CommunityNotes {...props} canPin notes={[note({ id: 'b', step_position: 4 })] as never} />)
  fireEvent.press(screen.getByTestId('note-menu-b'))
  fireEvent.press(screen.getByText('Pin as a fix'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes/b/pin', {}))
  expect(reload).toHaveBeenCalled()
  expect(screen.getByText('Pinned as a fix — shows on its step in build mode')).toBeTruthy()
})

it('Delete removes your own note', async () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'mine', author_id: 'me' })] as never} />)
  fireEvent.press(screen.getByTestId('note-menu-mine'))
  fireEvent.press(screen.getByText('Delete'))
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/g/notes/mine'))
  expect(screen.getByText('Note deleted')).toBeTruthy()
})

it('Report this note reports the note, not the guide', () => {
  jest.replaceProperty(Platform, 'OS', 'android') // iOS defers the report to the menu's onDismiss, which a closed jest Modal never fires
  render(<CommunityNotes {...props} notes={[note({ id: 'theirs', author_id: 'p', author_name: 'Sam R' })] as never} />)
  fireEvent.press(screen.getByTestId('note-menu-theirs'))
  fireEvent.press(screen.getByText('Report this note'))
  expect(mockReport).toHaveBeenCalledWith('note', 'theirs', "Sam R's note on Light Touch Switch")
  expect(mockReport).toHaveBeenCalledWith('opened')
})

it('a photo shows as a thumbnail that opens the viewer', () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'p', photo_url: 'https://x/p.jpg', photo_caption: 'The jig' })] as never} />)
  fireEvent.press(screen.getByRole('imagebutton', { name: "Open Priya S's photo full screen" }))
  expect(screen.getAllByLabelText('The jig')).toHaveLength(2) // thumbnail + the open viewer
})

it('rings the highlighted note and reports its row', () => {
  const onHighlightRow = jest.fn()
  render(<CommunityNotes {...props} notes={[note({ id: 'new', author_id: 'me' })] as never} highlightId="new" onHighlightRow={onHighlightRow} />)
  expect(onHighlightRow).not.toHaveBeenCalled()
  expect(JSON.stringify(screen.getByTestId('note-row-new').props.style)).not.toContain('"borderWidth":2')
  fireEvent(screen.getByTestId('note-row-new'), 'layout', { nativeEvent: { layout: { x: 0, y: 120, width: 300, height: 80 } } })
  expect(onHighlightRow).toHaveBeenCalled()
  expect(screen.getByTestId('note-row-new').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ borderWidth: 2, borderColor: theme.colors.primary, borderTopColor: theme.colors.primary })]))
})
