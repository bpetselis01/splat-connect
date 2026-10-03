// Ask for a build: the form's order of complaints, what is sent for each
// outlier, and what happens when the guides or the post fail.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { AskForBuildScreen } from '../../../../components/builds/ask-for-build-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockDismiss = jest.fn()
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), dismissTo: mockDismiss }),
  useLocalSearchParams: () => mockParams,
}))
let mockCaps: unknown = null
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps }) }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))

const guide = (i: number | string, over: object = {}) => ({ id: `g${i}`, title: `Guide ${i}`, difficulty: 'easy', build_minutes: 20, ...over })

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue([guide(0), guide(1, { difficulty: 'hard', build_minutes: 90 })])
  mockPost.mockReset().mockResolvedValue({})
  mockDismiss.mockReset()
  mockParams = {}
  mockCaps = null
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

const pick = async (title = 'Guide 0') => fireEvent.press(await screen.findByRole('radio', { name: title }))
const post = () => fireEvent.press(screen.getByRole('button', { name: 'Post to Makers wanted' }))
const body = () => mockPost.mock.calls[0]![1]

describe('the order the form complains in', () => {
  it('asks for a guide first, whatever else is missing', async () => {
    render(<AskForBuildScreen />)
    await screen.findByText('Guide 0')
    post()
    expect(screen.getByText('Pick the guide you want built.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('asks for the suburb second, and treats spaces as nothing', async () => {
    render(<AskForBuildScreen />)
    await pick()
    fireEvent.changeText(screen.getByPlaceholderText('Newtown'), '    ')
    post()
    expect(screen.getByText('Say which suburb you are in — never your address.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('asks for the parts tick third', async () => {
    render(<AskForBuildScreen />)
    await pick()
    fireEvent.changeText(screen.getByPlaceholderText('Newtown'), 'Glebe')
    post()
    expect(screen.getByText('Tick that you will cover the parts.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('clears the complaint when the next post goes out', async () => {
    render(<AskForBuildScreen />)
    await pick()
    post()
    expect(screen.getByText('Say which suburb you are in — never your address.')).toBeTruthy()
    fireEvent.changeText(screen.getByPlaceholderText('Newtown'), 'Glebe')
    fireEvent.press(screen.getByRole('checkbox'))
    post()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(screen.queryByText('Say which suburb you are in — never your address.')).toBeNull()
  })
})

describe('picking the guide', () => {
  it('preselects the guide named in the route and shows it with a Change action', async () => {
    mockParams = { guide: 'g1' }
    render(<AskForBuildScreen />)
    expect(await screen.findByText('Change')).toBeTruthy()
    expect(screen.getByText('Hard · 1.5 h')).toBeTruthy()
    expect(screen.queryByLabelText('Search guides')).toBeNull()
  })

  it('goes back to the search when Change is tapped, so another guide can be picked', async () => {
    mockParams = { guide: 'g1' }
    render(<AskForBuildScreen />)
    fireEvent.press(await screen.findByText('Change'))
    expect(screen.getByLabelText('Search guides')).toBeTruthy()
  })

  it('posts the guide id named in the route even when it is not in the list, leaving the API to refuse it', async () => {
    mockParams = { guide: 'unpublished' }
    render(<AskForBuildScreen />)
    await screen.findByText('Guide 0')
    fireEvent.changeText(screen.getByPlaceholderText('Newtown'), 'Glebe')
    fireEvent.press(screen.getByRole('checkbox'))
    post()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().tutorial_id).toBe('unpublished')
  })

  it('searches case-insensitively and ignores the spaces around the query', async () => {
    mockGet.mockResolvedValue([guide('A', { title: 'Bubble Machine' }), guide('B', { title: 'Fan' })])
    render(<AskForBuildScreen />)
    await screen.findByText('Bubble Machine')
    fireEvent.changeText(screen.getByLabelText('Search guides'), '  bubble ')
    expect(screen.getByText('Bubble Machine')).toBeTruthy()
    expect(screen.queryByText('Fan')).toBeNull()
  })

  it('says no guide matches and points at Submit an idea', async () => {
    render(<AskForBuildScreen />)
    await screen.findByText('Guide 0')
    fireEvent.changeText(screen.getByLabelText('Search guides'), 'zzz')
    expect(screen.getByText(/^No published guide matches that\./)).toBeTruthy()
  })

  it.each([
    ['percent', '100%'],
    ['regex characters', '(.*'],
    ['emoji', '🧸'],
    ['angle brackets', '<b>'],
  ])('treats a search for %s as plain text and finds nothing', async (_l, q) => {
    render(<AskForBuildScreen />)
    await screen.findByText('Guide 0')
    fireEvent.changeText(screen.getByLabelText('Search guides'), q)
    expect(screen.getByText(/^No published guide matches that\./)).toBeTruthy()
  })

  it('shows no empty-search hint while there are no guides at all', async () => {
    mockGet.mockResolvedValue([])
    render(<AskForBuildScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText(/No published guide matches/)).toBeNull()
  })

  it('shows the guides could not load when the read fails, and the form still refuses to post', async () => {
    mockGet.mockRejectedValue(new Error('Network request failed'))
    render(<AskForBuildScreen />)
    expect(await screen.findByText("Couldn't load the guides. Close this and try again.")).toBeTruthy()
    post()
    expect(screen.getByText('Pick the guide you want built.')).toBeTruthy()
  })

  it('omits the build time when a guide has none, and writes minutes under an hour', async () => {
    mockGet.mockResolvedValue([guide('A', { build_minutes: null }), guide('B', { build_minutes: 45 })])
    render(<AskForBuildScreen />)
    expect(await screen.findByText('Easy · 45 min')).toBeTruthy()
    expect(screen.getByText('Easy')).toBeTruthy()
  })
})

describe('the suburb', () => {
  it('starts from the profile’s pickup suburb', async () => {
    mockCaps = { profile: { pickup_suburb: 'Newtown' } }
    render(<AskForBuildScreen />)
    await screen.findByText('Guide 0')
    expect(screen.getByPlaceholderText('Newtown').props.value).toBe('Newtown')
  })

  it('does not overwrite a suburb already typed when the profile arrives late', async () => {
    const { rerender } = render(<AskForBuildScreen />)
    await screen.findByText('Guide 0')
    fireEvent.changeText(screen.getByPlaceholderText('Newtown'), 'Glebe')
    mockCaps = { profile: { pickup_suburb: 'Newtown' } }
    rerender(<AskForBuildScreen />)
    expect(screen.getByPlaceholderText('Newtown').props.value).toBe('Glebe')
  })
})

describe('what is sent', () => {
  const ready = async () => {
    render(<AskForBuildScreen />)
    await pick()
    fireEvent.changeText(screen.getByPlaceholderText('Newtown'), 'Glebe')
    fireEvent.press(screen.getByRole('checkbox'))
  }

  it('sends the defaults: 10 km, No rush, a null brief, an empty child label, and no maker named', async () => {
    await ready()
    post()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/build', {
      tutorial_id: 'g0',
      build_brief: null,
      child_label: '',
      requester_suburb: 'Glebe',
      travel_km: 10,
      urgency: 'No rush',
    })
  })

  it.each([5, 10, 15, 25])('sends a %i km range when that chip is chosen', async (km) => {
    await ready()
    fireEvent.press(screen.getByRole('radio', { name: `${km} km` }))
    post()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().travel_km).toBe(km)
  })

  it('trims the suburb, the child label and the note, and sends a blank note as null', async () => {
    await ready()
    fireEvent.changeText(screen.getByPlaceholderText('Newtown'), '  Glebe  ')
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Leo, 3 — 100 mm button switch'), '  Leo, 3  ')
    fireEvent.changeText(screen.getByPlaceholderText(/^Why this toy/), '   ')
    post()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body()).toMatchObject({ requester_suburb: 'Glebe', child_label: 'Leo, 3', build_brief: null })
  })

  it.each(NAMES.filter((n) => n.label !== 'very long' && n.value.trim() === n.value))('sends a note with $label as typed', async ({ value }) => {
    await ready()
    fireEvent.changeText(screen.getByPlaceholderText(/^Why this toy/), value)
    post()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().build_brief).toBe(value)
  })

  it('caps the fields at what the API keeps: child label 60, suburb 80, note 2000', async () => {
    render(<AskForBuildScreen />)
    await screen.findByText('Guide 0')
    expect(screen.getByPlaceholderText('e.g. Leo, 3 — 100 mm button switch').props.maxLength).toBe(60)
    expect(screen.getByPlaceholderText('Newtown').props.maxLength).toBe(80)
    expect(screen.getByPlaceholderText(/^Why this toy/).props.maxLength).toBe(2000)
  })

  it('goes to the Yours tab on the board after posting', async () => {
    await ready()
    post()
    await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith({ pathname: '/explore/makers-wanted', params: { tab: 'mine' } }))
  })

  it('can untick and re-tick the parts promise', async () => {
    await ready()
    fireEvent.press(screen.getByRole('checkbox'))
    post()
    expect(screen.getByText('Tick that you will cover the parts.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('posting', () => {
  const ready = async () => {
    render(<AskForBuildScreen />)
    await pick()
    fireEvent.changeText(screen.getByPlaceholderText('Newtown'), 'Glebe')
    fireEvent.press(screen.getByRole('checkbox'))
  }

  it('posts once however many times it is tapped while in flight, and says Posting…', async () => {
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    await ready()
    post()
    expect(screen.getByRole('button', { name: 'Posting…' })).toBeDisabled()
    fireEvent.press(screen.getByRole('button', { name: 'Posting…' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish({}))
    expect(mockDismiss).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a 400 shows the API sentence', new Error('failed with status 400: Say which suburb you are in and how far you can travel.'), 'Say which suburb you are in and how far you can travel.'],
    ['a 404 shows the API sentence', new Error('failed with status 404: Not found'), 'Not found'],
    ['a 429 shows the API sentence', new Error('failed with status 429: Slow down.'), 'Slow down.'],
    ['a 500 keeps the generic apology', new Error('failed with status 500: boom'), 'That did not post. Try once more.'],
    ['offline says so', new Error('Network request failed'), "You're offline. Check your connection and try again."],
  ])('%s, and stays on the form', async (_l, failure, message) => {
    mockPost.mockRejectedValue(failure)
    await ready()
    post()
    expect(await screen.findByText(message)).toBeTruthy()
    expect(mockDismiss).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Post to Makers wanted' })).toBeEnabled()
  })

  it('allows a retry after a failure, sending the same form', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network request failed'))
    await ready()
    post()
    await screen.findByText("You're offline. Check your connection and try again.")
    post()
    await waitFor(() => expect(mockDismiss).toHaveBeenCalled())
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(mockPost.mock.calls[1]![1]).toEqual(mockPost.mock.calls[0]![1])
  })
})
