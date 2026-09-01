// packages/mobile/tests/unit/components/challenges/submit-idea-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { SubmitIdeaScreen } from '../../../../components/challenges/submit-idea-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

// This screen pulls ErrorRow in from components/auth-screen, which imports
// useAuth from lib/auth-context — and that module's real implementation
// reaches all the way to the live supabase client. Same mock, same reason, as
// exchanges/thread-screen.test.tsx.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => mockPost(...a) },
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
    unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
    exchangeActions: 0,
  },
  loading: false,
  refresh: jest.fn(),
}
const signedOut = { caps: null, loading: false, refresh: jest.fn() }

/** Fills every narrative field web's IdeaForm marks required. */
function fillEverything() {
  fireEvent.changeText(screen.getByLabelText('Idea name'), 'A switch a toddler can hit')
  fireEvent.changeText(screen.getByLabelText('Summarise it in one sentence'), 'Too much force needed.')
  fireEvent.changeText(screen.getByLabelText('Full description'), 'She swipes rather than presses.')
  fireEvent.changeText(screen.getByLabelText('Intended use'), 'A bubble machine in therapy.')
  fireEvent.changeText(screen.getByLabelText('Primary user'), 'A three-year-old with low tone.')
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
        intended_use: 'A bubble machine in therapy.',
        primary_user: 'A three-year-old with low tone.',
        contact_prefs: ['co_design'],
      })
    )
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
    fireEvent.changeText(screen.getByLabelText('Intended use'), '   ')
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))

    expect(await screen.findByText('All fields are required')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
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
})
