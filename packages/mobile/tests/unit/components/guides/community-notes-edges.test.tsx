import { render, screen, fireEvent } from '@testing-library/react-native'
import { CommunityNotes } from '../../../../components/guides/community-notes'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a) } }))
jest.mock('../../../../components/reports/report-problem', () => ({ ReportProblem: ({ subjectLabel }: { subjectLabel: string }) => { const { Text } = jest.requireActual('react-native'); return <Text>{`report:${subjectLabel}`}</Text> } }))

const step = (n: number) => ({ id: `s${n}`, tutorial_id: 'g', position: n, title: `T${n}`, body: 'b', photo_url: null })
const note = (over: object) => ({
  id: 'n1', step_position: 1, author_id: 'p', author_name: 'Priya', body: 'Needs a second zip tie.', photo_url: null, photo_caption: null,
  pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z', ...over,
})
const reload = jest.fn()
const props = { tutorialId: 'g', guideTitle: 'Light-up drum', authorName: 'Sam', steps: [step(1), step(2)], reload, canPin: false, viewerId: 'me', viewerName: 'Me' }

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({}); mockDelete.mockResolvedValue(undefined); reload.mockResolvedValue(undefined)
})

describe('reading', () => {
  it('shows a note’s photo and caption, and a photo without a caption under a generic name', () => {
    render(<CommunityNotes {...props} notes={[note({ id: 'a', photo_url: 'a.jpg', photo_caption: 'The jack' }), note({ id: 'b', photo_url: 'b.jpg' })] as never} />)
    expect(screen.getByLabelText('The jack')).toBeTruthy()
    expect(screen.getByLabelText('Photo with the note')).toBeTruthy()
  })

  it('renders 200 notes', () => {
    const notes = Array.from({ length: 200 }, (_, i) => note({ id: `n${i}`, body: `Body ${i}` }))
    render(<CommunityNotes {...props} notes={notes as never} />)
    expect(screen.getByTestId('feedback-filter-all')).toHaveTextContent('All 200')
    expect(screen.getByText('Body 199')).toBeTruthy()
  })

  it('shows emoji, RTL and markup author names and bodies as they are', () => {
    render(<CommunityNotes {...props} notes={[note({ author_name: 'سارة 🧸', body: '<b>"hi"</b> & bye' })] as never} />)
    expect(screen.getByText('<b>"hi"</b> & bye')).toBeTruthy()
    expect(screen.getByText(/سارة 🧸/)).toBeTruthy()
  })
})

describe('data edges', () => {
  it('a note past the last step, or with no step, files under Missing', () => {
    render(<CommunityNotes {...props} notes={[note({ id: 'a', step_position: 9, body: 'Past' }), note({ id: 'b', step_position: null, body: 'None' })] as never} />)
    fireEvent.press(screen.getByTestId('feedback-filter-missing'))
    expect(screen.getByText('Past')).toBeTruthy()
    expect(screen.getByText('None')).toBeTruthy()
  })

  it('reads approved by the author when whoever pinned the note is gone', () => {
    render(<CommunityNotes {...props} notes={[note({ pinned_at: 'x', pinned_by_name: null })] as never} />)
    expect(screen.getByText('Fix · approved by the author')).toBeTruthy()
  })
})
