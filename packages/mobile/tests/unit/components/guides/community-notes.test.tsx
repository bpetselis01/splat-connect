// journeys: G25 G26 G28
import { Platform } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { CLEARANCE, paddingBottomOf } from '../../bottom-spacing'
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
  expect(onHighlightRow).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('note-row-new').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ borderWidth: 2, borderColor: theme.colors.primary, borderTopColor: theme.colors.primary })]))
  // The ring's border relays the row out; that second layout must not scroll or re-time the hand-off.
  fireEvent(screen.getByTestId('note-row-new'), 'layout', { nativeEvent: { layout: { x: 0, y: 120, width: 300, height: 84 } } })
  expect(onHighlightRow).toHaveBeenCalledTimes(1)
})

it('falls back to All when the fix is unpinned under the Fixes filter', () => {
  const pinned = note({ id: 'a', pinned_at: 'x', pinned_by_name: 'Mei', body: 'Tin both leads first.' })
  const view = render(<CommunityNotes {...props} notes={[pinned] as never} />)
  fireEvent.press(screen.getByTestId('feedback-filter-fixes'))
  view.rerender(<CommunityNotes {...props} notes={[{ ...pinned, pinned_at: null }] as never} />)
  expect(screen.queryByTestId('feedback-filter-fixes')).toBeNull()
  expect(screen.getByText('Tin both leads first.')).toBeTruthy()
})

it('falls back to All when the highlighted note is outside the chosen step', () => {
  const notes = [note({ id: 'a', step_position: 4, body: 'Cap was tight.' }), note({ id: 'b', step_position: 2, body: 'Second step tip.' })]
  const view = render(<CommunityNotes {...props} notes={notes as never} />)
  fireEvent.press(screen.getByTestId('feedback-filter-step-4'))
  expect(screen.queryByText('Second step tip.')).toBeNull()
  view.rerender(<CommunityNotes {...props} notes={notes as never} highlightId="b" />)
  expect(screen.getByTestId('note-row-b')).toBeTruthy()
  expect(screen.getByText('Cap was tight.')).toBeTruthy()
})

it('keeps the Fixes chip the person tapped while a hand-off highlight is still set', () => {
  const notes = [note({ id: 'a', pinned_at: 'x', pinned_by_name: 'Mei', body: 'Tin both leads first.' }), note({ id: 'b', body: 'Second step tip.' })]
  render(<CommunityNotes {...props} notes={notes as never} highlightId="b" />)
  fireEvent.press(screen.getByTestId('feedback-filter-fixes'))
  expect(screen.getByText('Tin both leads first.')).toBeTruthy()
  expect(screen.queryByText('Second step tip.')).toBeNull()
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

it('ends the ⋯ menu one gutter above the home indicator', () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'theirs' })] as never} />)
  fireEvent.press(screen.getByTestId('note-menu-theirs'))
  expect(paddingBottomOf(screen.getByTestId('note-menu'))).toBe(CLEARANCE)
})

describe('a guide with notes on many steps filters through the step picker', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `s${i + 1}`, tutorial_id: 'g', position: i + 1, title: `Part ${i + 1}`, body: 'b', photo_url: null }))
  const notes = [1, 2, 3, 4, 5, 6, 17].map((p) => note({ id: `n${p}`, step_position: p, body: `Note on ${p}.` }))
    .concat(note({ id: 'm', step_position: null, body: 'Whole guide.' }))

  it('shows one field instead of a chip per step, and filters to the chosen step', () => {
    render(<CommunityNotes {...props} steps={many as never} notes={notes as never} />)
    expect(screen.queryByTestId('feedback-filter-step-17')).toBeNull()
    expect(screen.getByTestId('feedback-filter-all')).toHaveTextContent('All 8')
    expect(screen.getByTestId('feedback-filter-missing')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filter by step, Filter by step' })).toBeTruthy()
    fireEvent.press(screen.getByTestId('feedback-filter-step-field'))
    // Only steps that have notes are listed, and there is no Missing row (it has its chip).
    expect(screen.queryByRole('button', { name: '9. Part 9' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Missing step' })).toBeNull()
    fireEvent.changeText(screen.getByLabelText('Search steps'), 'part 17')
    fireEvent.press(screen.getByRole('button', { name: '17. Part 17' }))
    expect(screen.getByRole('button', { name: 'Filter by step, 17. Part 17' })).toBeTruthy()
    expect(screen.getByText('Note on 17.')).toBeTruthy()
    expect(screen.queryByText('Note on 1.')).toBeNull()
    fireEvent.press(screen.getByTestId('feedback-filter-all'))
    expect(screen.getByText('Note on 1.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filter by step, Filter by step' })).toBeTruthy()
  })

  it('Missing and the field coexist: Missing still filters', () => {
    render(<CommunityNotes {...props} steps={many as never} notes={notes as never} />)
    fireEvent.press(screen.getByTestId('feedback-filter-missing'))
    expect(screen.getByText('Whole guide.')).toBeTruthy()
    expect(screen.queryByText('Note on 17.')).toBeNull()
  })

  it('five or fewer steps with notes keep their chips even in a long guide', () => {
    render(<CommunityNotes {...props} steps={many as never} notes={notes.slice(0, 3) as never} />)
    expect(screen.getByTestId('feedback-filter-step-2')).toBeTruthy()
    expect(screen.queryByTestId('feedback-filter-step-field')).toBeNull()
  })
})

it('on a guide with no steps a note is tagged Whole guide and there is no Missing filter', () => {
  render(<CommunityNotes {...props} steps={[]} notes={[note({ step_position: null })] as never} />)
  expect(screen.getAllByText('Whole guide').length).toBeGreaterThan(0)
  expect(screen.queryByTestId('feedback-filter-missing')).toBeNull()
})
