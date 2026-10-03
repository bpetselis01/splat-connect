// Makers wanted: the four tabs, distance, claiming, paging and the ways the
// board can be empty, failing or answering out of order.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { MakersWantedScreen } from '../../../../components/builds/makers-wanted-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
const mockPush = jest.fn()
let mockParams: Record<string, string> = {}
let mockHeader: { headerRight?: () => React.ReactNode } = {}
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    Stack: { Screen: ({ options }: { options: typeof mockHeader }) => ((mockHeader = options), null) },
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  }
})
let mockCaps: { profile: Record<string, unknown> } | null = null
let mockCapsLoading = false
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps, loading: mockCapsLoading }) }))

const row = (id: string, over: object = {}) => ({
  id,
  tutorial_id: 'g1',
  build_brief: null,
  travel_km: 30,
  urgency: null,
  child_label: null,
  requester_suburb: 'Newtown',
  family_has_toy: false,
  created_at: new Date().toISOString(),
  mine: false,
  km: null,
  tutorial: { id: 'g1', title: `Guide ${id}`, difficulty: 'easy', status: 'approved', build_minutes: 20, parts_total_cents: 2800 },
  ...over,
})
const boardRow = (id: string, over: object = {}) => row(id, { maker_name: 'Tom', party: false, updated_at: new Date().toISOString(), ...over })

type Feeds = { open?: unknown[]; live?: unknown[]; done?: unknown[] }
function serve({ open = [row('b1')], live = [], done = [] }: Feeds = {}) {
  mockGet.mockImplementation((path: string) =>
    path.includes('tab=live') ? Promise.resolve(live) : path.includes('tab=done') ? Promise.resolve(done) : Promise.resolve(open)
  )
}

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset().mockResolvedValue({})
  mockPush.mockReset()
  mockParams = {}
  mockHeader = {}
  mockCaps = null
  mockCapsLoading = false
  serve()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

const tab = (name: string) => screen.getByRole('tab', { name })

describe('the tabs', () => {
  it('starts on Needs a maker, and on Yours when the route asks for it', async () => {
    const { unmount } = render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    expect(tab('Needs a maker').props.accessibilityState.selected).toBe(true)
    unmount()
    mockParams = { tab: 'mine' }
    serve({ open: [row('m1', { mine: true })] })
    render(<MakersWantedScreen />)
    expect(await screen.findByText('Guide m1')).toBeTruthy()
    expect(tab('Yours').props.accessibilityState.selected).toBe(true)
  })

  it('starts on Needs a maker for a tab param it does not know', async () => {
    mockParams = { tab: 'nonsense' }
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    expect(tab('Needs a maker').props.accessibilityState.selected).toBe(true)
  })

  it('splits open requests into other families’ and your own, with a count on each tab that has any', async () => {
    serve({ open: [row('a'), row('b'), row('c', { mine: true })] })
    render(<MakersWantedScreen />)
    await screen.findByText('Guide a')
    expect(tab('Needs a maker').props.accessibilityValue.text).toBe('2')
    expect(tab('Yours').props.accessibilityValue.text).toBe('1')
    expect(screen.queryByText('Guide c')).toBeNull()
    fireEvent.press(tab('Yours'))
    expect(screen.getByText('Guide c')).toBeTruthy()
    expect(screen.queryByText('Guide a')).toBeNull()
  })

  it('gives Live and Done no count', async () => {
    serve({ live: [boardRow('l1')] })
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    expect(tab('Live').props.accessibilityValue.text).toBeUndefined()
    expect(tab('Done').props.accessibilityValue.text).toBeUndefined()
  })

  it('says what Yours is for when the family has asked for nothing', async () => {
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    fireEvent.press(tab('Yours'))
    expect(screen.getByText('You have not asked for a build yet')).toBeTruthy()
    expect(screen.getByText(/^Tap \+ to pick a guide/)).toBeTruthy()
  })

  it('says nothing is posted yet when there are no open requests at all', async () => {
    serve({ open: [] })
    render(<MakersWantedScreen />)
    expect(await screen.findByText('Open requests show up here as families post them.')).toBeTruthy()
  })

  it('says Nothing at that stage with no hint on an empty Live or Done tab', async () => {
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    fireEvent.press(tab('Live'))
    expect(await screen.findByText('Nothing at that stage')).toBeTruthy()
    expect(screen.queryByText(/Open requests show up here/)).toBeNull()
  })
})

describe('failing to load', () => {
  it('says the board could not load, and Try again reloads it', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network request failed'))
    render(<MakersWantedScreen />)
    expect(await screen.findByText("Couldn't load the board.")).toBeTruthy()
    serve()
    fireEvent.press(screen.getByText('Try again'))
    expect(await screen.findByText('Guide b1')).toBeTruthy()
    expect(screen.queryByText("Couldn't load the board.")).toBeNull()
  })

  it('says the board could not load when the Live feed fails, rather than "Nothing at that stage"', async () => {
    mockGet.mockImplementation((path: string) =>
      path.includes('tab=live') ? Promise.reject(new Error('Network request failed')) : Promise.resolve([row('b1')])
    )
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    fireEvent.press(tab('Live'))
    expect(await screen.findByText("Couldn't load the board.")).toBeTruthy()
    expect(screen.queryByText('Nothing at that stage')).toBeNull()
  })
})

describe('a failed Live feed', () => {
  const liveDown = () =>
    mockGet.mockImplementation((path: string) =>
      path.includes('tab=live') ? Promise.reject(new Error('Network request failed')) : Promise.resolve([])
    )

  it('retries the Live feed, not the open requests, when Try again is tapped', async () => {
    liveDown()
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Live' }))
    await screen.findByText("Couldn't load the board.")
    serve({ open: [], live: [boardRow('l1')] })
    fireEvent.press(screen.getByText('Try again'))
    expect(await screen.findByText('Guide l1')).toBeTruthy()
  })

  it('does not carry the Live failure over to an empty Needs a maker tab', async () => {
    liveDown()
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Live' }))
    await screen.findByText("Couldn't load the board.")
    fireEvent.press(screen.getByRole('tab', { name: 'Needs a maker' }))
    expect(screen.queryByText("Couldn't load the board.")).toBeNull()
    expect(screen.getByText('Open requests show up here as families post them.')).toBeTruthy()
  })
})

describe('distance', () => {
  beforeEach(() => {
    mockCaps = { profile: { id: 'me', pickup_postcode: '2000' } }
  })

  it('offers Within chips with Anywhere last when the profile has a postcode', async () => {
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    for (const label of ['5 km', '10 km', '25 km', 'Anywhere']) expect(screen.getByText(label)).toBeTruthy()
    expect(screen.queryByText('Add your postcode')).toBeNull()
  })

  it('keeps a request exactly at the range and drops one a kilometre past it, and one with no distance', async () => {
    serve({ open: [row('exact', { km: 10 }), row('past', { km: 11 }), row('unknown', { km: null }), row('zero', { km: 0 })] })
    render(<MakersWantedScreen />)
    await screen.findByText('Guide exact')
    fireEvent.press(screen.getByText('10 km'))
    expect(screen.getByText('Guide exact')).toBeTruthy()
    expect(screen.getByText('Guide zero')).toBeTruthy()
    expect(screen.queryByText('Guide past')).toBeNull()
    expect(screen.queryByText('Guide unknown')).toBeNull()
  })

  it('writes 0 km away for a family in the same postcode', async () => {
    serve({ open: [row('zero', { km: 0 })] })
    render(<MakersWantedScreen />)
    expect(await screen.findByText('0 km away')).toBeTruthy()
  })

  it('shows everything again on Anywhere, including requests with no distance', async () => {
    serve({ open: [row('far', { km: 90 }), row('unknown')] })
    render(<MakersWantedScreen />)
    await screen.findByText('Guide far')
    fireEvent.press(screen.getByText('5 km'))
    expect(screen.queryByText('Guide far')).toBeNull()
    fireEvent.press(screen.getByText('Anywhere'))
    expect(screen.getByText('Guide far')).toBeTruthy()
    expect(screen.getByText('Guide unknown')).toBeTruthy()
  })

  it('points at Anywhere when the range filters out every request, but not when there are none', async () => {
    serve({ open: [row('far', { km: 90 })] })
    render(<MakersWantedScreen />)
    await screen.findByText('Guide far')
    fireEvent.press(screen.getByText('5 km'))
    expect(screen.getByText('No family in that range at the moment. Try Any distance.')).toBeTruthy()
  })

  it('leaves the range alone on Live and Done, which carry no distance', async () => {
    serve({ live: [boardRow('l1', { km: 90 })] })
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    fireEvent.press(screen.getByText('5 km'))
    fireEvent.press(tab('Live'))
    expect(await screen.findByText('Guide l1')).toBeTruthy()
  })

  it('sends the postcode as the near parameter, URL-encoded', async () => {
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/open-builds?near=2000')
  })

  it('shows no distance chips while the profile loads, and asks for the postcode once it has and there is none', async () => {
    mockCaps = null
    mockCapsLoading = true
    const { unmount } = render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    expect(screen.queryByText('Add your postcode')).toBeNull()
    expect(screen.queryByText('Anywhere')).toBeNull()
    unmount()
    mockCapsLoading = false
    mockCaps = { profile: { id: 'me', pickup_postcode: '12' } }
    render(<MakersWantedScreen />)
    expect(await screen.findByText('Add your postcode')).toBeTruthy()
    expect(mockGet).toHaveBeenLastCalledWith('/api/toy-transactions/open-builds')
  })
})

describe('claiming', () => {
  it('claims and goes to the thread', async () => {
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('button', { name: "I'll build this" }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/exchanges/build/b1'))
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/claim', {})
  })

  it('shows the API’s sentence and reloads the board when somebody else got there first', async () => {
    mockPost.mockRejectedValue(new Error('failed with status 409: Someone else already claimed this.'))
    render(<MakersWantedScreen />)
    await screen.findByRole('button', { name: "I'll build this" })
    const reads = mockGet.mock.calls.length
    serve({ open: [] })
    fireEvent.press(screen.getByRole('button', { name: "I'll build this" }))
    expect(await screen.findByText('Someone else already claimed this.')).toBeTruthy()
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(reads))
    expect(await screen.findByText('Open requests show up here as families post them.')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it.each([
    ['a 500', new Error('failed with status 500: boom'), 'That did not go through. Try once more.'],
    ['offline', new Error('Network request failed'), "You're offline. Check your connection and try again."],
  ])('shows the right sentence for %s', async (_l, failure, message) => {
    mockPost.mockRejectedValue(failure)
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('button', { name: "I'll build this" }))
    expect(await screen.findByText(message)).toBeTruthy()
  })

  it('claims once however many times the button is tapped while the claim is in flight', async () => {
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('button', { name: "I'll build this" }))
    expect(screen.getByRole('button', { name: 'Claiming…' })).toBeDisabled()
    fireEvent.press(screen.getByRole('button', { name: 'Claiming…' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish({}))
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('disables only the card being claimed', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    serve({ open: [row('a'), row('b')] })
    render(<MakersWantedScreen />)
    await screen.findByText('Guide a')
    fireEvent.press(screen.getAllByRole('button', { name: "I'll build this" })[0]!)
    expect(screen.getAllByRole('button', { name: "I'll build this" })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Claiming…' })).toHaveLength(1)
  })

  it('offers Track on a request of your own and no claim', async () => {
    serve({ open: [row('m1', { mine: true })] })
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Yours' }))
    fireEvent.press(screen.getByText('Track'))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/build/m1')
    expect(screen.queryByRole('button', { name: "I'll build this" })).toBeNull()
  })

  it('says how far makers can see a request of your own', async () => {
    serve({ open: [row('m1', { mine: true, travel_km: 25 })] })
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Yours' }))
    expect(screen.getByText('Visible to makers within 25 km')).toBeTruthy()
  })
})

describe('Live and Done paging', () => {
  const page = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => boardRow(`${prefix}${i}`))

  it('offers Show more only for a full page of twenty, and not for 19 or none', async () => {
    serve({ live: page(19, 'l') })
    const { unmount } = render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Live' }))
    await screen.findByText('Guide l0')
    expect(screen.queryByText('Show more builds')).toBeNull()
    unmount()
    serve({ live: page(20, 'l') })
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Live' }))
    expect(await screen.findByText('Show more builds')).toBeTruthy()
  })

  it('appends the next page, asks for page 1, and stops offering more when it comes back short', async () => {
    mockGet.mockImplementation((path: string) =>
      path.endsWith('tab=live&page=0') ? Promise.resolve(page(20, 'a')) : path.endsWith('tab=live&page=1') ? Promise.resolve(page(3, 'b')) : Promise.resolve([])
    )
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Live' }))
    fireEvent.press(await screen.findByText('Show more builds'))
    expect(await screen.findByText('Guide b2')).toBeTruthy()
    expect(screen.getByText('Guide a19')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/builds-board?tab=live&page=1')
    expect(screen.queryByText('Show more builds')).toBeNull()
  })

  it('offers no Show more on Needs a maker or Yours', async () => {
    serve({ open: Array.from({ length: 20 }, (_, i) => row(`o${i}`)) })
    render(<MakersWantedScreen />)
    await screen.findByText('Guide o0')
    expect(screen.queryByText('Show more builds')).toBeNull()
  })

  it('shows Done rows under Done even when the Live answer arrives after it', async () => {
    const live: Array<(v: unknown[]) => void> = []
    mockGet.mockImplementation((path: string) =>
      path.includes('tab=live')
        ? new Promise((r) => live.push(r))
        : path.includes('tab=done')
          ? Promise.resolve([boardRow('d1')])
          : Promise.resolve([row('b1')])
    )
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    fireEvent.press(tab('Live'))
    fireEvent.press(tab('Done'))
    expect(await screen.findByText('Guide d1')).toBeTruthy()
    await act(async () => live[0]!([boardRow('l1')]))
    expect(screen.getByText('Guide d1')).toBeTruthy()
    expect(screen.queryByText('Guide l1')).toBeNull()
  })

  it('clears the previous tab’s rows while the next one loads', async () => {
    serve({ live: [boardRow('l1')], done: [boardRow('d1')] })
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Live' }))
    await screen.findByText('Guide l1')
    mockGet.mockImplementation((path: string) => (path.includes('tab=done') ? new Promise(() => {}) : Promise.resolve([])))
    fireEvent.press(tab('Done'))
    expect(screen.queryByText('Guide l1')).toBeNull()
  })
})

describe('what a card says', () => {
  it('shows a request whose guide was unpublished with the board’s sentence and no difficulty', async () => {
    serve({ open: [row('b1', { tutorial: null })] })
    render(<MakersWantedScreen />)
    expect(await screen.findByText('A guide that is no longer published')).toBeTruthy()
    expect(screen.queryByText('Easy')).toBeNull()
  })

  it('shows a guide with no difficulty without a difficulty pill', async () => {
    serve({ open: [row('b1', { tutorial: { id: 'g1', title: 'Plain', difficulty: null, status: 'approved', build_minutes: null, parts_total_cents: null } })] })
    render(<MakersWantedScreen />)
    expect(await screen.findByText('Plain')).toBeTruthy()
    for (const w of ['Easy', 'Medium', 'Hard']) expect(screen.queryByText(w)).toBeNull()
  })

  it.each([
    ['easy', 'Easy'],
    ['medium', 'Medium'],
    ['hard', 'Hard'],
  ])('labels a %s guide %s', async (difficulty, label) => {
    serve({ open: [row('b1', { tutorial: { id: 'g1', title: 'G', difficulty, status: 'approved', build_minutes: null, parts_total_cents: null } })] })
    render(<MakersWantedScreen />)
    expect(await screen.findByText(label)).toBeTruthy()
  })

  it('writes build time over an hour in hours, and a free-parts guide as ~$0.00', async () => {
    serve({ open: [row('b1', { tutorial: { id: 'g1', title: 'G', difficulty: 'easy', status: 'approved', build_minutes: 90, parts_total_cents: 0 } })] })
    render(<MakersWantedScreen />)
    expect(await screen.findByText('1.5 h · ~$0.00')).toBeTruthy()
  })

  it('shows the child, range and urgency facts when given, and omits them when null', async () => {
    serve({ open: [row('a', { child_label: 'Leo, 3', urgency: 'This month', travel_km: 25 }), row('b', { travel_km: null })] })
    render(<MakersWantedScreen />)
    await screen.findByText('Guide a')
    expect(screen.getByText('Leo, 3')).toBeTruthy()
    expect(screen.getByText('This month')).toBeTruthy()
    expect(screen.getByText('25 km')).toBeTruthy()
    expect(screen.queryByText(/null|undefined/)).toBeNull()
  })

  it('says the family has the toy when they do', async () => {
    serve({ open: [row('b1', { family_has_toy: true })] })
    render(<MakersWantedScreen />)
    expect(await screen.findByText('Family has the toy')).toBeTruthy()
  })

  it.each(NAMES.filter((n) => n.value.trim() === n.value))('quotes a family’s note with $label as typed, and a suburb the same way', async ({ value }) => {
    serve({ open: [row('b1', { build_brief: value, requester_suburb: value })] })
    render(<MakersWantedScreen />)
    expect(await screen.findByText(new RegExp(`“${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}”`))).toBeTruthy()
  })

  it('attributes a note to "You" on your own request and to "Family in <suburb>" on theirs', async () => {
    serve({ open: [row('a', { build_brief: 'Please', mine: true }), row('b', { build_brief: 'Pretty please' })] })
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b')
    expect(screen.getByText(/Family in Newtown/)).toBeTruthy()
    fireEvent.press(tab('Yours'))
    expect(screen.getByText(/^You: /)).toBeTruthy()
  })

  it('shows a Live build the viewer is part of with a Thread button, and nobody else’s', async () => {
    serve({ live: [boardRow('l1', { party: true }), boardRow('l2', { party: false })] })
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Live' }))
    await screen.findByText('Guide l1')
    expect(screen.getAllByRole('button', { name: 'Thread' })).toHaveLength(1)
    expect(screen.getByText('Tom is building it')).toBeTruthy()
  })

  it('shows a Done build with no buttons at all', async () => {
    serve({ done: [boardRow('d1', { party: true })] })
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Done' }))
    await screen.findByText('Guide d1')
    expect(screen.queryByRole('button', { name: 'Thread' })).toBeNull()
    expect(screen.queryByRole('button', { name: "I'll build this" })).toBeNull()
  })
})

describe('the rest of the screen', () => {
  it('opens the ask form from the header plus button', async () => {
    render(<MakersWantedScreen />)
    await screen.findByText('Guide b1')
    render(<>{mockHeader.headerRight!()}</>)
    fireEvent.press(screen.getByLabelText('Ask for a build'))
    expect(mockPush).toHaveBeenCalledWith('/explore/makers-wanted/new')
  })

  it('sends someone with no guide for their child’s need to Submit an idea', async () => {
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByLabelText('No guide for what your child needs?'))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/new')
  })

  it('opens Ask first for a request, without claiming it', async () => {
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Ask first' }))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/build/ask/b1')
    expect(mockPost).not.toHaveBeenCalled()
  })
})
