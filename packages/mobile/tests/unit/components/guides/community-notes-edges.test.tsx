import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { CommunityNotes } from '../../../../components/guides/community-notes'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPick = jest.fn()
jest.mock('../../../../lib/upload', () => ({ pickAndUploadPhoto: (...a: unknown[]) => mockPick(...a) }))
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
const props = { tutorialId: 'g', guideTitle: 'Light-up drum', authorName: 'Sam', steps: [step(1), step(2)], reload, canPin: false, viewerId: 'me' }
const posted = () => mockPost.mock.calls.find((c) => c[0] === '/api/tutorials/g/notes')![1]

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({}); mockDelete.mockResolvedValue(undefined); reload.mockResolvedValue(undefined)
})

describe('posting', () => {
  it('keeps Post off until a step is chosen and the note has words', () => {
    render(<CommunityNotes {...props} notes={[]} />)
    const post = () => screen.getByRole('button', { name: 'Post' })
    expect(post()).toBeDisabled()
    fireEvent.changeText(screen.getByLabelText('Your note'), 'Words')
    expect(post()).toBeDisabled()
    fireEvent.press(screen.getByText('Step 2'))
    expect(post()).toBeEnabled()
    fireEvent.changeText(screen.getByLabelText('Your note'), '   \n\t ')
    expect(post()).toBeDisabled()
  })

  it('sends the note trimmed and a blank caption as null', async () => {
    mockPick.mockResolvedValue({ path: 'g/notes/a.jpg', url: 'u' })
    render(<CommunityNotes {...props} notes={[]} />)
    fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }))
    await screen.findByLabelText('Photo caption')
    fireEvent.changeText(screen.getByLabelText('Photo caption'), '   ')
    fireEvent.press(screen.getByText('Step 2'))
    fireEvent.changeText(screen.getByLabelText('Your note'), '  padded note \n')
    fireEvent.press(screen.getByRole('button', { name: 'Post' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(posted()).toEqual({ step_position: 2, body: 'padded note', photo_path: 'g/notes/a.jpg', photo_caption: null })
  })

  it('sends a trimmed caption when there is one', async () => {
    mockPick.mockResolvedValue({ path: 'p', url: 'u' })
    render(<CommunityNotes {...props} notes={[]} />)
    fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }))
    fireEvent.changeText(await screen.findByLabelText('Photo caption'), '  The jack ')
    fireEvent.press(screen.getByText('Step 1'))
    fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
    fireEvent.press(screen.getByRole('button', { name: 'Post' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(posted().photo_caption).toBe('The jack')
  })

  it('caps the note at 1000 characters and the caption at 60', async () => {
    mockPick.mockResolvedValue({ path: 'p', url: 'u' })
    render(<CommunityNotes {...props} notes={[]} />)
    expect(screen.getByLabelText('Your note').props.maxLength).toBe(1000)
    fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }))
    expect((await screen.findByLabelText('Photo caption')).props.maxLength).toBe(60)
  })

  it('sends emoji, quotes and markup exactly', async () => {
    render(<CommunityNotes {...props} notes={[]} />)
    fireEvent.press(screen.getByText('Step 1'))
    const body = `🧸 "grip" <tight> & 'twist'`
    fireEvent.changeText(screen.getByLabelText('Your note'), body)
    fireEvent.press(screen.getByRole('button', { name: 'Post' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(posted().body).toBe(body)
  })

  it('clears the form and reloads after a good post', async () => {
    render(<CommunityNotes {...props} notes={[]} />)
    fireEvent.press(screen.getByText('Step 1'))
    fireEvent.changeText(screen.getByLabelText('Your note'), 'Done')
    fireEvent.press(screen.getByRole('button', { name: 'Post' }))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('Your note').props.value).toBe('')
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled()
  })

  it('keeps the words, and the chosen step, when the post fails, and lets a second try go through', async () => {
    mockPost.mockRejectedValueOnce(new Error('offline'))
    render(<CommunityNotes {...props} notes={[]} />)
    fireEvent.press(screen.getByText('Step 2'))
    fireEvent.changeText(screen.getByLabelText('Your note'), 'Keep me')
    fireEvent.press(screen.getByRole('button', { name: 'Post' }))
    expect(await screen.findByText('Could not post that. Please try again.')).toBeTruthy()
    expect(screen.getByLabelText('Your note').props.value).toBe('Keep me')
    expect(reload).not.toHaveBeenCalled()
    fireEvent.press(screen.getByRole('button', { name: 'Post' }))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Could not post that. Please try again.')).toBeNull()
  })

  it('ignores a second tap on Post while the first is in flight', async () => {
    let finish!: (v?: unknown) => void
    mockPost.mockReturnValue(new Promise((r) => { finish = r }))
    render(<CommunityNotes {...props} notes={[]} />)
    fireEvent.press(screen.getByText('Step 1'))
    fireEvent.changeText(screen.getByLabelText('Your note'), 'Once')
    fireEvent.press(screen.getByRole('button', { name: 'Post' }))
    fireEvent.press(screen.getByRole('button', { name: 'Post' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => { finish() })
  })

  it('on a guide with no steps only offers Missing step, landing as step 1', () => {
    render(<CommunityNotes {...props} steps={[]} notes={[]} />)
    expect(screen.queryByText('Step 1')).toBeNull()
    fireEvent.press(screen.getByText('Missing step'))
    expect(screen.getByText(/added to the end as step 1\./)).toBeTruthy()
  })

  it('shows a picked photo’s caption box in place of the Add a photo button, and says why a refused upload failed', async () => {
    mockPick.mockResolvedValueOnce(null)
    render(<CommunityNotes {...props} notes={[]} />)
    fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }))
    await waitFor(() => expect(mockPick).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeTruthy()
    mockPick.mockRejectedValueOnce(new Error('Could not upload the photo. Please try again.'))
    fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }))
    expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeTruthy()
  })
})

describe('reading and moderating', () => {
  it('counts every note in the heading and handles none', () => {
    const view = render(<CommunityNotes {...props} notes={[]} />)
    expect(screen.getByText('Community notes 0')).toBeTruthy()
    expect(screen.getByText('Discussion · 0')).toBeTruthy()
    expect(screen.queryByText(/Revisions/)).toBeNull()
    view.rerender(<CommunityNotes {...props} notes={[note({ id: 'a' }), note({ id: 'b' })] as never} />)
    expect(screen.getByText('Community notes 2')).toBeTruthy()
  })

  it('labels a note past the last step as a Missing step', () => {
    render(<CommunityNotes {...props} notes={[note({ step_position: 9 }), note({ id: 'm', step_position: null })] as never} />)
    expect(screen.getAllByText(/^Missing step · Priya/)).toHaveLength(2)
  })

  it('says Deleted member when whoever pinned the note is gone', () => {
    render(<CommunityNotes {...props} notes={[note({ pinned_at: 'x', pinned_by_name: null })] as never} />)
    expect(screen.getByText('Pinned by Deleted member')).toBeTruthy()
  })

  it('offers Unpin on a pinned note and posts to the unpin route', async () => {
    render(<CommunityNotes {...props} canPin notes={[note({ pinned_at: 'x', pinned_by_name: 'Sam' })] as never} />)
    fireEvent.press(screen.getByRole('button', { name: 'Unpin' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes/n1/unpin', {}))
    expect(await screen.findByText('Unpinned')).toBeTruthy()
  })

  it('shows no Pin control to a reader who cannot pin', () => {
    render(<CommunityNotes {...props} notes={[note({})] as never} />)
    expect(screen.queryByRole('button', { name: 'Pin as revision' })).toBeNull()
  })

  it('lets the author delete their own note and report anyone else’s, never both', () => {
    render(<CommunityNotes {...props} notes={[note({ id: 'mine', author_id: 'me' }), note({ id: 'theirs', author_id: 'p' })] as never} />)
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1)
    expect(screen.getAllByText('report:A note on Light-up drum')).toHaveLength(1)
  })

  it('says so, and does not reload, when a pin fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('403'))
    render(<CommunityNotes {...props} canPin notes={[note({})] as never} />)
    fireEvent.press(screen.getByRole('button', { name: 'Pin as revision' }))
    expect(await screen.findByText('That did not work. Try again.')).toBeTruthy()
    expect(reload).not.toHaveBeenCalled()
  })

  it('says so, and keeps the note, when a delete fails', async () => {
    mockDelete.mockRejectedValueOnce(new Error('500'))
    render(<CommunityNotes {...props} notes={[note({ author_id: 'me' })] as never} />)
    fireEvent.press(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('That did not work. Try again.')).toBeTruthy()
    expect(screen.getByText('Needs a second zip tie.')).toBeTruthy()
  })

  it('shows a note’s photo and caption, and a photo without a caption under a generic name', () => {
    render(<CommunityNotes {...props} notes={[note({ id: 'a', photo_url: 'a.jpg', photo_caption: 'The jack' }), note({ id: 'b', photo_url: 'b.jpg' })] as never} />)
    expect(screen.getByLabelText('The jack')).toBeTruthy()
    expect(screen.getByLabelText('Photo with the note')).toBeTruthy()
  })

  it('renders 200 notes', () => {
    const notes = Array.from({ length: 200 }, (_, i) => note({ id: `n${i}`, body: `Body ${i}` }))
    render(<CommunityNotes {...props} notes={notes as never} />)
    expect(screen.getByText('Community notes 200')).toBeTruthy()
    expect(screen.getByText('Body 199')).toBeTruthy()
  })

  it('shows emoji, RTL and markup author names and bodies as they are', () => {
    render(<CommunityNotes {...props} notes={[note({ author_name: 'سارة 🧸', body: '<b>"hi"</b> & bye' })] as never} />)
    expect(screen.getByText('<b>"hi"</b> & bye')).toBeTruthy()
    expect(screen.getByText(/سارة 🧸/)).toBeTruthy()
  })
})
