// packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ToyDetailScreen } from '../../../../components/toys/toy-detail-screen'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as the
// rest of the suite.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
  },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

// useSaves is mocked directly, same as toy-library-screen.test.tsx, so a save
// press can be asserted against exactly what SaveButton is contracted to call.
const mockToggle = jest.fn()
const NO_SAVES = { tutorials: [], toys: [], challenges: [] }
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: NO_SAVES, isSaved: () => false, toggle: mockToggle }),
}))

// RequestBlock pulls ErrorRow in from components/auth-screen, which imports
// useAuth from lib/auth-context — and that module's real implementation
// reaches all the way to the live supabase client. Mocking auth-context here
// (unused by this screen itself) is what keeps that import inert.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => mockUseCapabilities(),
}))

function caps(over: object) {
  return {
    caps: {
      profile: { id: 'viewer1', name: 'Viewer', role: 'contributor' },
      isAdmin: false,
      ledOrgs: [],
      unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
      exchangeActions: 0,
      ...over,
    },
    loading: false,
    refresh: jest.fn(),
  }
}

const toy = (over: object) => ({
  id: 'toy1',
  owner_id: 'owner1',
  owner_org_id: null,
  quantity: 1,
  name: 'Bubble machine',
  description: 'A gentle bubble maker.',
  condition: 8,
  switch_adapted: false,
  cover_photo_url: null,
  switch_photo_urls: [],
  status: 'published',
  offer_type: 'donation',
  archived_at: null,
  created_at: '',
  updated_at: '',
  profiles: { name: 'Jamie' },
  organizations: null,
  ...over,
})

const myToy = (over: object) => ({
  id: 'mine1',
  owner_id: 'viewer1',
  owner_org_id: null,
  quantity: 1,
  name: 'Puzzle',
  description: null,
  condition: 5,
  switch_adapted: false,
  cover_photo_url: null,
  switch_photo_urls: [],
  status: 'published',
  offer_type: null,
  archived_at: null,
  created_at: '',
  updated_at: '',
  ...over,
})

// Two independent apiClient.get calls happen — the public toy fetch and,
// when signed in and not the owner, the caller's own toys for the exchange
// chooser — routed by path the same way detail-screen.test.tsx's
// mockEndpoints does for /api/saves/ids vs the tutorial fetch.
function mockEndpoints({
  detail = Promise.resolve(toy({})),
  myToys = Promise.resolve([]),
}: { detail?: Promise<unknown>; myToys?: Promise<unknown> } = {}) {
  mockGet.mockImplementation((p: string) => (p === '/api/toys' ? myToys : detail))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(caps({}))
  mockEndpoints()
})

describe('ToyDetailScreen', () => {
  it('renders the toy fetched from the public detail endpoint', async () => {
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/toys/toy1')
    expect(screen.getByText('A gentle bubble maker.')).toBeTruthy()
  })

  it('shows an error message when the fetch rejects', async () => {
    mockEndpoints({ detail: Promise.reject(new Error('API GET failed with status 404')) })
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText("Couldn't load this toy.")).toBeTruthy()
  })

  it('shows the person holder line as plain text', async () => {
    mockEndpoints({ detail: Promise.resolve(toy({ profiles: { name: 'Jamie' }, organizations: null })) })
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText('Held by Jamie')).toBeTruthy()
  })

  it('shows the org holder line with quantity, and navigates to the org page on press', async () => {
    mockEndpoints({
      detail: Promise.resolve(
        toy({ owner_id: null, owner_org_id: 'org1', quantity: 4, profiles: null, organizations: { name: 'TAD Australia' } })
      ),
    })
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('TAD Australia')).toBeTruthy()
    expect(screen.getByText('· 4 available')).toBeTruthy()
    // Same precedent as guides/provenance.tsx's pressable byline name: a name
    // pressable inside a sentence reads as a link, not an unlabelled button.
    expect(screen.getByRole('link', { name: 'TAD Australia' })).toBeTruthy()
    fireEvent.press(screen.getByText('TAD Australia'))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/organisation/org1')
  })

  it('shows the condition meter score and the switch-adapted fact', async () => {
    mockEndpoints({ detail: Promise.resolve(toy({ condition: 7, switch_adapted: true })) })
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('7 / 10')).toBeTruthy()
    expect(screen.getByText('Yes · 3.5mm jack')).toBeTruthy()
  })

  it('shows "No" for switch-adapted when the toy is not adapted', async () => {
    mockEndpoints({ detail: Promise.resolve(toy({ switch_adapted: false })) })
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('No')).toBeTruthy()
  })

  it('hides the request block for the toy owner', async () => {
    mockUseCapabilities.mockReturnValue(caps({ profile: { id: 'owner1', name: 'Owner', role: 'contributor' } }))
    mockEndpoints({ detail: Promise.resolve(toy({ owner_id: 'owner1' })) })
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(screen.queryByRole('button', { name: 'Arrange pickup' })).toBeNull()
    expect(mockGet).not.toHaveBeenCalledWith('/api/toys')
  })

  it('hides the request block for a leader of the owning organisation', async () => {
    mockUseCapabilities.mockReturnValue(caps({ ledOrgs: [{ id: 'org1', name: 'TAD Australia' }] }))
    mockEndpoints({
      detail: Promise.resolve(toy({ owner_id: null, owner_org_id: 'org1', organizations: { name: 'TAD Australia' } })),
    })
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(screen.queryByRole('button', { name: 'Arrange pickup' })).toBeNull()
    expect(mockGet).not.toHaveBeenCalledWith('/api/toys')
  })

  it('shows the request block for a signed-in non-owner, with the not-offered line when unoffered', async () => {
    mockEndpoints({ detail: Promise.resolve(toy({ offer_type: null })) })
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(screen.getByText('Not currently offered for donation or exchange.')).toBeTruthy()
  })

  it('fetches the caller\'s toys and filters the chooser to published, unarchived ones', async () => {
    mockEndpoints({
      detail: Promise.resolve(toy({ offer_type: 'exchange' })),
      myToys: Promise.resolve([
        myToy({ id: 'mine1', name: 'Puzzle', status: 'published', archived_at: null }),
        myToy({ id: 'mine2', name: 'Draft toy', status: 'draft', archived_at: null }),
        myToy({ id: 'mine3', name: 'Archived toy', status: 'published', archived_at: '2026-01-01' }),
      ]),
    })
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/toys'))

    fireEvent.press(screen.getByRole('button', { name: 'Arrange exchange' }))
    expect(await screen.findByText('Puzzle')).toBeTruthy()
    expect(screen.queryByText('Draft toy')).toBeNull()
    expect(screen.queryByText('Archived toy')).toBeNull()
  })

  it('disables Arrange exchange while the caller\'s own toys are still in flight', async () => {
    let resolveMyToys: (v: unknown) => void = () => {}
    mockEndpoints({
      detail: Promise.resolve(toy({ offer_type: 'exchange' })),
      myToys: new Promise((resolve) => {
        resolveMyToys = resolve
      }),
    })
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    expect(screen.getByRole('button', { name: 'Arrange exchange' }).props.accessibilityState.disabled).toBe(true)

    resolveMyToys([myToy({})])
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Arrange exchange' }).props.accessibilityState.disabled).toBeFalsy()
    )
  })

  it('shows the load-failure copy instead of the add-a-toy line when the caller\'s toys fail to load', async () => {
    // A second, independent .catch on the same rejection (not a .catch chain
    // that replaces the reference passed below) — otherwise Node flags it as
    // an unhandled rejection during the gap before ToyDetailScreen's own
    // effect attaches its handler, and fails the test over it.
    const myToysRejection = Promise.reject(new Error('API GET failed with status 500'))
    myToysRejection.catch(() => {})
    mockEndpoints({
      detail: Promise.resolve(toy({ offer_type: 'exchange' })),
      myToys: myToysRejection,
    })
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Arrange exchange' }).props.accessibilityState.disabled).toBeFalsy()
    )

    fireEvent.press(screen.getByRole('button', { name: 'Arrange exchange' }))
    expect(screen.getByText("Couldn't load your toys — try again.")).toBeTruthy()
    expect(screen.queryByText('Add a toy to My Toys before you can offer an exchange.')).toBeNull()
  })

  it('starts a donation request and navigates to the exchange thread on success', async () => {
    mockPost.mockResolvedValue({ id: 'tx1', toy_id: 'toy1', type: 'donation' })
    mockEndpoints({ detail: Promise.resolve(toy({ offer_type: 'donation' })) })
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')

    fireEvent.press(screen.getByRole('button', { name: 'Arrange pickup' }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/exchanges/tx1'))
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions', { toy_id: 'toy1', type: 'donation' })
  })

  it('flips a save by calling toggle with the toys slug and the toy id', async () => {
    render(<ToyDetailScreen id="toy1" />)
    await screen.findByText('Bubble machine')
    fireEvent.press(screen.getByLabelText('Save'))
    expect(mockToggle).toHaveBeenCalledWith('toys', 'toy1')
  })
})
