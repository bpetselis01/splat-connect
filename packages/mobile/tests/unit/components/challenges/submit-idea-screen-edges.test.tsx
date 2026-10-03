// Submit an idea: required-field refusals, odd text, double submit, every
// failure, the photo's replace and cancel paths, anonymous, and a revised idea.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { SubmitIdeaScreen } from '../../../../components/challenges/submit-idea-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockPick = jest.fn()
jest.mock('../../../../lib/upload', () => ({ pickAndUploadPhoto: (...a: unknown[]) => mockPick(...a) }))
const mockPost = jest.fn()
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => mockPost(...a), get: (...a: unknown[]) => mockGet(...a) },
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace }) }))
const mockCaps = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockCaps() }))

const signedIn = { caps: { profile: { id: 'viewer1', name: 'Viewer' }, ledOrgs: [] }, loading: false, refresh: jest.fn() }

beforeEach(() => {
  for (const m of [mockPick, mockPost, mockGet, mockReplace]) m.mockReset()
  mockCaps.mockReturnValue(signedIn)
  mockPost.mockResolvedValue({ id: 'idea1' })
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

const title = (v: string) => fireEvent.changeText(screen.getByLabelText('Idea name'), v)
const summary = (v: string) => fireEvent.changeText(screen.getByLabelText('Summarise it in one sentence'), v)
const why = (v: string) => fireEvent.changeText(screen.getByLabelText('Why it matters'), v)
const fill = () => (title('Bubbles'), summary('One switch.'))
const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))
const body = () => mockPost.mock.calls[0]![1]

describe('required fields', () => {
  it.each([
    ['both empty', '', ''],
    ['an empty title', '', 'One switch.'],
    ['an empty summary', 'Bubbles', ''],
    ['a title of spaces', '   ', 'One switch.'],
    ['a title of newlines and tabs', '\n\t\n', 'One switch.'],
    ['a summary of spaces', 'Bubbles', '     '],
  ])('refuses %s without a request', (_l, t, s) => {
    render(<SubmitIdeaScreen />)
    title(t)
    summary(s)
    submit()
    expect(screen.getByText('A title and a summary are required.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('does not need the optional "why it matters", and sends null for it when blank or spaces', async () => {
    render(<SubmitIdeaScreen />)
    fill()
    why('   ')
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().description).toBeNull()
  })

  it('clears the required-fields line once a valid idea goes out', async () => {
    render(<SubmitIdeaScreen />)
    submit()
    expect(screen.getByText('A title and a summary are required.')).toBeTruthy()
    fill()
    submit()
    await screen.findByText('Idea sent.')
  })
})

describe('what is typed', () => {
  it.each(NAMES)('sends a title, summary and note with $label (trimmed, otherwise as typed)', async ({ value }) => {
    render(<SubmitIdeaScreen />)
    title(value)
    summary(value)
    why(value)
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body()).toMatchObject({ title: value.trim(), summary: value.trim(), description: value.trim() })
  })

  it('sends a five-thousand-character idea whole, since the form sets no limit', async () => {
    render(<SubmitIdeaScreen />)
    title('T'.repeat(5000))
    summary('S'.repeat(5000))
    why('W'.repeat(5000))
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().title).toHaveLength(5000)
    expect(body().description).toHaveLength(5000)
  })

  it('keeps line breaks inside the note and trims only its ends', async () => {
    render(<SubmitIdeaScreen />)
    fill()
    why('\n  first line\nsecond line  \n')
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().description).toBe('first line\nsecond line')
  })
})

describe('kind, contact and anonymous', () => {
  it('explains each kind of idea as it is chosen', () => {
    render(<SubmitIdeaScreen />)
    expect(screen.getByText('Becomes a build challenge makers can pick up.')).toBeTruthy()
    fireEvent.press(screen.getByRole('radio', { name: 'A question for the community' }))
    expect(screen.getByText('No build needed. People answer in the thread, and you mark the answer that helped.')).toBeTruthy()
    fireEvent.press(screen.getByRole('radio', { name: 'A toy worth adapting' }))
    expect(screen.getByText('Becomes a build challenge makers can pick up.')).toBeTruthy()
  })

  it('sends the kind that is selected last', async () => {
    render(<SubmitIdeaScreen />)
    fill()
    fireEvent.press(screen.getByRole('radio', { name: 'A question for the community' }))
    fireEvent.press(screen.getByRole('radio', { name: 'A toy worth adapting' }))
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().kind).toBe('challenge')
  })

  it('sends all three contact preferences in the order they were picked', async () => {
    render(<SubmitIdeaScreen />)
    fill()
    for (const name of ['User testing', 'Clarification', 'Co-design']) fireEvent.press(screen.getByRole('button', { name }))
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().contact_prefs).toEqual(['user_testing', 'clarification', 'co_design'])
  })

  it('sends anonymous false after the box is ticked and unticked', async () => {
    render(<SubmitIdeaScreen />)
    fill()
    const box = () => screen.getByRole('checkbox', { name: 'Post anonymously' })
    fireEvent.press(box())
    expect(box().props.accessibilityState.checked).toBe(true)
    fireEvent.press(box())
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().anonymous).toBe(false)
  })
})

describe('photo', () => {
  const photo = (n: string) => ({ path: `ideas/viewer1/${n}.jpg`, url: `https://x/${n}.jpg` })

  it('sends photo_path null when none was added', async () => {
    render(<SubmitIdeaScreen />)
    fill()
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().photo_path).toBeNull()
  })

  it('replaces the photo when a second one is picked', async () => {
    mockPick.mockResolvedValueOnce(photo('a')).mockResolvedValueOnce(photo('b'))
    render(<SubmitIdeaScreen />)
    fill()
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    await screen.findByLabelText('Your photo')
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    await waitFor(() => expect(screen.getByLabelText('Your photo').props.source.uri).toBe('https://x/b.jpg'))
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().photo_path).toBe('ideas/viewer1/b.jpg')
  })

  it('keeps the photo already added when the picker is cancelled', async () => {
    mockPick.mockResolvedValueOnce(photo('a')).mockResolvedValueOnce(null)
    render(<SubmitIdeaScreen />)
    fill()
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    await screen.findByLabelText('Your photo')
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    await waitFor(() => expect(mockPick).toHaveBeenCalledTimes(2))
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().photo_path).toBe('ideas/viewer1/a.jpg')
  })

  it('keeps the photo already added when a replacement fails, and says why', async () => {
    mockPick.mockResolvedValueOnce(photo('a')).mockRejectedValueOnce(new Error('Upload to /x failed with status 413: Photo must be under 10 MB.'))
    render(<SubmitIdeaScreen />)
    fill()
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    await screen.findByLabelText('Your photo')
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    expect(await screen.findByText('Photo must be under 10 MB.')).toBeTruthy()
    expect(screen.getByLabelText('Your photo').props.source.uri).toBe('https://x/a.jpg')
  })

  it('clears a photo error when the next attempt works', async () => {
    mockPick.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(photo('a'))
    render(<SubmitIdeaScreen />)
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    await screen.findByText("You're offline. Check your connection and try again.")
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    await screen.findByLabelText('Your photo')
    expect(screen.queryByText("You're offline. Check your connection and try again.")).toBeNull()
  })

  it('shows the permission refusal in its own words', async () => {
    mockPick.mockRejectedValue(new Error('Photo library access is needed to choose a photo.'))
    render(<SubmitIdeaScreen />)
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    expect(await screen.findByText('Photo library access is needed to choose a photo.')).toBeTruthy()
  })

  it('shows the API’s refusal when the photo was not uploaded from this account', async () => {
    mockPost.mockRejectedValue(new Error('failed with status 400: That photo was not uploaded from this account.'))
    mockPick.mockResolvedValue(photo('a'))
    render(<SubmitIdeaScreen />)
    fill()
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    await screen.findByLabelText('Your photo')
    submit()
    expect(await screen.findByText('That photo was not uploaded from this account.')).toBeTruthy()
    expect(screen.getByLabelText('Your photo')).toBeTruthy()
  })
})

describe('submitting', () => {
  it('posts once however many times Submit is tapped while it is in flight', async () => {
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<SubmitIdeaScreen />)
    fill()
    submit()
    expect(screen.getByRole('button', { name: 'Submit idea' })).toBeDisabled()
    submit()
    submit()
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish({ id: 'i' }))
    expect(await screen.findByText('Idea sent.')).toBeTruthy()
  })

  it.each([
    ['a 400', new Error('failed with status 400: Post anonymously must be on or off.'), 'Post anonymously must be on or off.'],
    ['a 401', new Error('failed with status 401: Sign in first.'), 'Sign in first.'],
    ['a 429', new Error('failed with status 429: Too many ideas today.'), 'Too many ideas today.'],
    ['a 500', new Error('failed with status 500: pg boom'), 'Could not submit this idea. Please try again.'],
    ['offline', new Error('Network request failed'), "You're offline. Check your connection and try again."],
  ])('keeps the whole draft and shows the right words for %s', async (_l, failure, message) => {
    mockPost.mockRejectedValue(failure)
    render(<SubmitIdeaScreen />)
    fill()
    why('Because.')
    fireEvent.press(screen.getByRole('button', { name: 'Co-design' }))
    submit()
    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.getByLabelText('Idea name').props.value).toBe('Bubbles')
    expect(screen.getByLabelText('Why it matters').props.value).toBe('Because.')
    expect(screen.getByRole('button', { name: 'Submit idea' })).toBeEnabled()
    expect(screen.queryByText('Idea sent.')).toBeNull()
  })

  it('resends the same idea after a failure, once, and then shows it sent', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce({ id: 'i' })
    render(<SubmitIdeaScreen />)
    fill()
    submit()
    await screen.findByText("You're offline. Check your connection and try again.")
    submit()
    expect(await screen.findByText('Idea sent.')).toBeTruthy()
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(mockPost.mock.calls[1]![1]).toEqual(mockPost.mock.calls[0]![1])
  })

  it('replaces the form with the sent state, so going back cannot file a second copy', async () => {
    render(<SubmitIdeaScreen />)
    fill()
    submit()
    await screen.findByText('Idea sent.')
    expect(screen.queryByLabelText('Idea name')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Submit idea' })).toBeNull()
  })
})

describe('a revised idea', () => {
  const rejected = (over: object = {}) => ({
    id: 'c1',
    title: 'Old title',
    summary: 'Old summary',
    description: null,
    kind: 'question',
    contact_prefs: ['clarification', 'user_testing'],
    photo_path: null,
    photo_url: null,
    anonymous: true,
    status: 'rejected',
    ...over,
  })

  it('starts from the rejected idea’s kind, contact preferences and anonymity, with a blank note when it had none', async () => {
    mockGet.mockResolvedValue(rejected())
    render(<SubmitIdeaScreen from="c1" />)
    await screen.findByDisplayValue('Old title')
    expect(screen.getByLabelText('Why it matters').props.value).toBe('')
    expect(screen.getByRole('radio', { name: 'A question for the community' })).toBeSelected()
    expect(screen.getByRole('checkbox', { name: 'Post anonymously' }).props.accessibilityState.checked).toBe(true)
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body()).toEqual({
      title: 'Old title',
      summary: 'Old summary',
      description: null,
      kind: 'question',
      contact_prefs: ['clarification', 'user_testing'],
      photo_path: null,
      anonymous: true,
    })
  })

  it('does not carry a photo path that has no preview url', async () => {
    mockGet.mockResolvedValue(rejected({ photo_path: 'ideas/viewer1/p.png', photo_url: null }))
    render(<SubmitIdeaScreen from="c1" />)
    await screen.findByDisplayValue('Old title')
    expect(screen.queryByLabelText('Your photo')).toBeNull()
  })

  it('shows an empty form, still usable, when the rejected idea cannot be read', async () => {
    mockGet.mockRejectedValue(new Error('failed with status 404: Not found'))
    render(<SubmitIdeaScreen from="gone" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/ideas/mine/gone'))
    fill()
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body()).toMatchObject({ title: 'Bubbles', kind: 'challenge', anonymous: false })
  })

  it('lets the revised text be edited before it is sent', async () => {
    mockGet.mockResolvedValue(rejected())
    render(<SubmitIdeaScreen from="c1" />)
    await screen.findByDisplayValue('Old title')
    title('New title')
    submit()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().title).toBe('New title')
  })

  it('does not read a rejected idea when there is none to start from', () => {
    render(<SubmitIdeaScreen />)
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('signed out', () => {
  it('shows no form and sends nothing, and the scope limits stay visible', () => {
    mockCaps.mockReturnValue({ caps: null, loading: false, refresh: jest.fn() })
    render(<SubmitIdeaScreen />)
    expect(screen.queryByRole('button', { name: 'Submit idea' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Post anonymously' })).toBeNull()
    expect(screen.getByText('· Nothing medical.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })
})
