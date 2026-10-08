// packages/mobile/tests/unit/components/challenges/submit-idea-screen.test.tsx
// journeys: C09 C12 C13 C14
import { CLEARANCE, scrollPaddings } from '../../bottom-spacing'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { SubmitIdeaScreen } from '../../../../components/challenges/submit-idea-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

// This screen pulls ErrorRow in from components/auth-screen, which imports
// useAuth from lib/auth-context — and that module's real implementation
// reaches all the way to the live supabase client. Same mock, same reason, as
// exchanges/thread-screen.test.tsx.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockPick = jest.fn()
jest.mock('../../../../lib/upload', () => ({ pickAndUploadPhoto: (...a: unknown[]) => mockPick(...a) }))

const mockPost = jest.fn()
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => mockPost(...a), get: (...a: unknown[]) => mockGet(...a) },
}))

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }))

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const signedIn = {
  caps: {
    profile: { id: 'viewer1', name: 'Viewer', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
    unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 },
    exchangeActions: 0,
  },
  loading: false,
  refresh: jest.fn(),
}
const signedOut = { caps: null, loading: false, refresh: jest.fn() }

/** The board's form: a title and a summary are all it requires. */
function fillEverything() {
  fireEvent.changeText(screen.getByLabelText('Idea name'), 'A switch a toddler can hit')
  fireEvent.changeText(screen.getByLabelText('Summarise it in one sentence'), 'Too much force needed.')
  fireEvent.changeText(screen.getByLabelText('Why it matters'), 'She swipes rather than presses.')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(signedIn)
  mockPost.mockResolvedValue({ id: 'idea1' })
})

describe('SubmitIdeaScreen', () => {
  it('posts exactly the fields the API reads, trimmed', async () => {
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.changeText(screen.getByLabelText('Idea name'), '  A switch a toddler can hit  ')
    fireEvent.press(screen.getByRole('button', { name: 'Co-design' }))
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/ideas', {
        title: 'A switch a toddler can hit',
        summary: 'Too much force needed.',
        description: 'She swipes rather than presses.',
        kind: 'challenge',
        contact_prefs: ['co_design'],
        photo_path: null,
        anonymous: false,
      })
    )
  })

  // 078: a question is filed as one, so an admin can never graduate it.
  it('files a question when that choice is picked', async () => {
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('radio', { name: 'A question for the community' }))
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1]).toMatchObject({ kind: 'question' })
  })

  it('sends no contact prefs when none are picked', async () => {
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1]).toMatchObject({ contact_prefs: [] })
  })

  it('un-picks a contact pref that is tapped twice', async () => {
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('button', { name: 'Clarification' }))
    fireEvent.press(screen.getByRole('button', { name: 'Clarification' }))
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1]).toMatchObject({ contact_prefs: [] })
  })

  it('refuses a whitespace-only field rather than spending the round trip', async () => {
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.changeText(screen.getByLabelText('Summarise it in one sentence'), '   ')
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))

    expect(await screen.findByText('A title and a summary are required.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('sends an idea with only a title and a summary, and never asks for intended use or primary user', async () => {
    render(<SubmitIdeaScreen />)
    expect(screen.queryByLabelText('Intended use')).toBeNull()
    expect(screen.queryByLabelText('Primary user')).toBeNull()
    expect(screen.getByPlaceholderText('Who would use it, and what they cannot do today.')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Idea name'), 'Bubbles')
    fireEvent.changeText(screen.getByLabelText('Summarise it in one sentence'), 'One switch.')
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/ideas', {
        title: 'Bubbles',
        summary: 'One switch.',
        description: null,
        kind: 'challenge',
        contact_prefs: [],
        photo_path: null,
        anonymous: false,
      })
    )
  })

  // 106: uploaded before the idea exists; the idea carries the path.
  it('adds a photo, shows it, and sends its path with the idea', async () => {
    mockPick.mockResolvedValue({ path: 'ideas/viewer1/a.jpg', url: 'https://x/toy-photos/ideas/viewer1/a.jpg' })
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    await waitFor(() => expect(mockPick).toHaveBeenCalledWith('/api/upload/idea-photo', '', null))
    expect(await screen.findByLabelText('Your photo')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ photo_path: 'ideas/viewer1/a.jpg' }))
    )
  })

  it('says why a photo could not be added, and keeps the form', async () => {
    mockPick.mockRejectedValue(new Error('Could not upload the photo. Please try again.'))
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeTruthy()
    expect(screen.getByLabelText('Idea name').props.value).toBe('A switch a toddler can hit')
  })

  // 77f6bad7: a raw upload error never reaches the screen; the photo-library
  // permission words (already written for people) do.
  it.each([
    [new Error('API POST /api/upload/idea-photo failed with status 500: pg boom'), 'Could not upload the photo. Please try again.'],
    [new TypeError('Network request failed'), /offline/],
    [new Error('Photo library access is off. Turn it on in Settings.'), 'Photo library access is off. Turn it on in Settings.'],
  ])('shows a friendly line for a photo upload failing with %s', async (err, shown) => {
    mockPick.mockRejectedValue(err)
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    expect(await screen.findByText(shown)).toBeTruthy()
    expect(screen.queryByText(/pg boom|status 500/)).toBeNull()
  })

  it('lands on your ideas once it is sent', async () => {
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))

    expect(await screen.findByText('Idea sent.')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'See your ideas' }))
    expect(mockReplace).toHaveBeenCalledWith('/challenges')
  })

  it('keeps what was typed when the post fails, and shows the API’s own words', async () => {
    mockPost.mockRejectedValue(new Error('API POST /api/ideas failed with status 400: Title is required'))
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))

    expect(await screen.findByText('Title is required')).toBeTruthy()
    expect(screen.getByLabelText('Idea name').props.value).toBe('A switch a toddler can hit')
  })

  it('asks a signed-out visitor to sign in instead of showing a form that would 401', () => {
    mockUseCapabilities.mockReturnValue(signedOut)
    render(<SubmitIdeaScreen />)

    expect(screen.getByRole('button', { name: 'Sign in to submit an idea' })).toBeTruthy()
    expect(screen.queryByLabelText('Idea name')).toBeNull()
  })

  it('shows the scope limits to everyone, signed in or not', () => {
    mockUseCapabilities.mockReturnValue(signedOut)
    render(<SubmitIdeaScreen />)
    expect(screen.getByText("What we can't take on")).toBeTruthy()
    // The bullet is part of the rendered line, so the assertion carries it.
    expect(screen.getByText('· Nothing that could be swallowed.')).toBeTruthy()
  })

  it('starts a revised idea from the rejected one', async () => {
    mockGet.mockResolvedValue({
      id: 'c1', title: 'Old title', summary: 'Old summary', description: 'Old why', kind: 'challenge',
      contact_prefs: ['co_design'], photo_path: 'ideas/viewer1/p.png', photo_url: 'https://x/p.png', status: 'rejected',
    })
    render(<SubmitIdeaScreen from="c1" />)
    expect(await screen.findByDisplayValue('Old title')).toBeTruthy()
    expect(screen.getByDisplayValue('Old why')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/ideas/mine/c1')
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ title: 'Old title', photo_path: 'ideas/viewer1/p.png' })))
  })

  it('posts anonymously when asked to', async () => {
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('checkbox', { name: 'Post anonymously' }))
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ anonymous: true })))
  })
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

it('ends its scroll one gutter above the home indicator, so Submit idea is not tucked under it', () => {
  render(<SubmitIdeaScreen />)
  expect(scrollPaddings(screen)).toEqual([CLEARANCE])
})
