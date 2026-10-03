// The toy page with sparse, long and unusual data, and the thank-you button
// when the network lets it down. The ordinary page lives in toy-detail-screen.test.tsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { toyFacts } from '@splat-connect/types'
import { ToyDetailScreen } from '../../../../components/toys/toy-detail-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('../../../../lib/recents', () => ({ recordRecent: jest.fn() }))
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: { tutorials: [], toys: [], challenges: [] }, isSaved: () => false, toggle: jest.fn() }),
}))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'signed-in' } } }) }))
let mockCaps: object | null
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps, loading: false, refresh: jest.fn() }) }))

const toy = (over: object = {}) => ({
  id: 'toy1', owner_id: 'owner1', owner_org_id: null, quantity: 1, name: 'Bubble machine', description: 'A gentle bubble maker.',
  condition: 8, switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published',
  offer_type: 'donation', created_at: '', updated_at: '', profiles: { name: 'Jamie' }, organizations: null, ...over,
})
const orgToy = (over: object = {}) => toy({ owner_id: null, owner_org_id: 'org1', profiles: null, organizations: { name: 'TAD Australia' }, ...over })
const serve = (detail: Promise<unknown>) => mockGet.mockImplementation((p: string) => (p === '/api/toys' ? Promise.resolve([]) : detail))

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps = { profile: { id: 'viewer1', name: 'Viewer', role: 'contributor' }, isAdmin: false, ledOrgs: [], unread: {}, exchangeActions: 0 }
  serve(Promise.resolve(toy()))
})

describe('toyFacts', () => {
  it.each([
    [{ age_min: 2, age_max: 6 }, '2–6'],
    [{ age_min: 3, age_max: 3 }, '3'],
    [{ age_min: 0, age_max: 0 }, '0'],
    [{ age_min: 0, age_max: null }, '0+'],
    [{ age_min: null, age_max: 5 }, 'Up to 5'],
  ])('reads ages %j as %s', (ages, shown) => {
    expect(toyFacts({ ...ages, batteries: null, switch_fitting: null, volume: null })[0]).toEqual({ k: 'Ages it suits', v: shown })
  })

  it('is empty when the holder gave no facts, and leaves out blank ones', () => {
    expect(toyFacts({ age_min: null, age_max: null, batteries: null, switch_fitting: null, volume: null })).toEqual([])
    expect(toyFacts({ age_min: null, age_max: null, batteries: '', switch_fitting: 'Jack', volume: '' })).toEqual([{ k: 'Switch fitting', v: 'Jack' }])
  })
})

describe('sparse and long toys', () => {
  it('draws a toy with no description, no facts, no photos and no holder, without empty cards', async () => {
    serve(Promise.resolve(toy({ description: null, profiles: null, organizations: null, offer_type: null })))
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
    expect(screen.queryByText('Notes from the holder')).toBeNull()
    expect(screen.queryByText('Ages it suits')).toBeNull()
    expect(screen.queryByText(/^Held by/)).toBeNull()
    expect(screen.queryByText('Also worth a look')).toBeNull()
    expect(screen.getByText('Not currently offered for donation or exchange.')).toBeTruthy()
  })

  it.each(NAMES.filter((n) => !/spaces/.test(n.label)))('draws a toy named with $label text, and its holder', async ({ value }) => {
    serve(Promise.resolve(toy({ name: value, profiles: { name: value } })))
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText(value)).toBeTruthy()
    expect(screen.getByText(`Held by ${value}`)).toBeTruthy()
    expect(screen.getByRole('button', { name: `Thank ${value}` })).toBeTruthy()
  })

  it('draws a description with markup and a very long one as plain text', async () => {
    const description = '<script>alert(1)</script> & "quoted" ' + 'long '.repeat(1500)
    serve(Promise.resolve(toy({ description })))
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText(description)).toBeTruthy()
  })

  it('shows a zero-stock organisation toy as 0 available', async () => {
    serve(Promise.resolve(orgToy({ quantity: 0 })))
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText('· 0 available')).toBeTruthy()
  })

  it('opens both kinds of pick, a toy and a guide, from the holder\'s list', async () => {
    serve(Promise.resolve(toy({ picks: [{ kind: 'toy', id: 't9', title: 'Drum', meta: null }, { kind: 'guide', id: 'g9', title: 'Switch mount', meta: '10 min' }] })))
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Also worth a look')
    fireEvent.press(screen.getByLabelText(/Drum/))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/t9')
    fireEvent.press(screen.getByLabelText(/Switch mount/))
    expect(mockPush).toHaveBeenCalledWith('/guides/g9')
    expect(screen.getByText('10 min')).toBeTruthy()
  })

  it('draws no pick section for an empty picks list or a missing one', async () => {
    serve(Promise.resolve(toy({ picks: [] })))
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(screen.queryByText('Also worth a look')).toBeNull()
  })
})

describe('loading and failing', () => {
  it('says the toy did not load for a 404 and for an offline phone alike, and asks for nothing else', async () => {
    serve(Promise.reject(new Error('API GET /x failed with status 404: Not found')))
    render(<ToyDetailScreen id="gone" />)
    expect(await screen.findByText("Couldn't load this toy.")).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ask to collect it' })).toBeNull()
  })

  it('asks for the toy by the id it was given, encoded as a path', async () => {
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(mockGet).toHaveBeenCalledWith('/api/public/toys/toy1')
  })

  it('offers no request block and fetches no toys of the caller\'s while capabilities are unknown', async () => {
    mockCaps = null
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(screen.queryByRole('button', { name: 'Ask to collect it' })).toBeNull()
    expect(mockGet).not.toHaveBeenCalledWith('/api/toys')
  })

  it('offers only published toys of the caller\'s to swap, not drafts', async () => {
    serve(Promise.resolve(toy({ offer_type: 'exchange' })))
    mockGet.mockImplementation((p: string) =>
      p === '/api/toys'
        ? Promise.resolve([{ id: 'm1', name: 'Published one', status: 'published', condition: 5 }, { id: 'm2', name: 'Draft one', status: 'draft', condition: 5 }])
        : Promise.resolve(toy({ offer_type: 'exchange' }))
    )
    render(<ToyDetailScreen id="toy1" />)
    fireEvent.press(await screen.findByText('Arrange exchange'))
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Published one' })).toBeTruthy())
    expect(screen.queryByRole('radio', { name: 'Draft one' })).toBeNull()
  })
})

describe('thanking an organisation', () => {
  const thank = () => screen.findByRole('button', { name: 'Thank TAD Australia' })
  beforeEach(() => serve(Promise.resolve(orgToy())))

  it('sends one thanks when pressed twice before the answer', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    render(<ToyDetailScreen id="toy1" />)
    const btn = await thank()
    fireEvent.press(btn)
    fireEvent.press(btn)
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('treats a thanks the organisation already has as sent', async () => {
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 409: Already thanked'))
    render(<ToyDetailScreen id="toy1" />)
    fireEvent.press(await thank())
    expect(await screen.findByRole('button', { name: 'Thanked TAD Australia' })).toBeTruthy()
  })

  it('says so, and offers the button again, when the thanks could not be sent', async () => {
    mockPost.mockRejectedValue(new TypeError('Network request failed'))
    render(<ToyDetailScreen id="toy1" />)
    fireEvent.press(await thank())
    expect(await screen.findByText('Could not send that. Try again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Thank TAD Australia' }).props.accessibilityState.disabled).toBeFalsy()
  })

  it('offers no thanks to a leader of the organisation that holds the toy', async () => {
    mockCaps = { profile: { id: 'viewer1' }, isAdmin: false, ledOrgs: [{ id: 'org1', name: 'TAD Australia' }], unread: {}, exchangeActions: 0 }
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(screen.queryByRole('button', { name: 'Thank TAD Australia' })).toBeNull()
  })
})
