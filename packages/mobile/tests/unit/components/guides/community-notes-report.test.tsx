// journeys: G27
import { Platform } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { CommunityNotes } from '../../../../components/guides/community-notes'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/upload', () => ({ pickAndUploadPhoto: jest.fn() }))
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: jest.fn(), delete: jest.fn() } }))

const steps = [1, 2].map((p) => ({ id: `s${p}`, tutorial_id: 'g', position: p, title: `T${p}`, body: 'b', photo_url: null }))
const theirs = { id: 'theirs', step_position: 1, author_id: 'p', author_name: 'Sam R', body: 'Hi', photo_url: null, photo_caption: null, pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z' }
const props = { tutorialId: 'g', guideTitle: 'Switch', authorName: 'Mei Tan', steps: steps as never, reload: jest.fn(), canPin: false, viewerId: 'me', viewerName: 'Me' }

afterEach(() => jest.restoreAllMocks())

// The real ReportProblem re-renders on every keystroke and hands a new `open`
// each time; the sheet must open once and then behave like any sheet.
it('the real report sheet keeps typed text and stays closed after Close', () => {
  jest.replaceProperty(Platform, 'OS', 'android')
  render(<CommunityNotes {...props} notes={[theirs] as never} />)
  fireEvent.press(screen.getByTestId('note-menu-theirs'))
  fireEvent.press(screen.getByText('Report this note'))
  fireEvent.changeText(screen.getByLabelText('What happened?'), 'Rude')
  expect(screen.getByLabelText('What happened?').props.value).toBe('Rude')
  fireEvent.press(screen.getAllByRole('button', { name: 'Close' }).at(-1)!)
  expect(screen.queryByLabelText('What happened?')).toBeNull()
})
